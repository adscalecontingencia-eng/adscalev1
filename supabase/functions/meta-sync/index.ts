// Meta Marketing API sync — pulls BMs, ad accounts and daily insights
// Endpoints (POST):
//   { action: "sync_bms" }                    -> sync all Business Managers
//   { action: "sync_accounts", bm_id?: uuid } -> sync ad accounts for a BM (or all)
//   { action: "sync_insights", date?: "YYYY-MM-DD" } -> sync daily insights for all accounts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const META_API = "https://graph.facebook.com/v21.0";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function metaFetch(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${META_API}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Meta API error: ${JSON.stringify(data.error || data)}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "Use POST" }, 405);

  try {
    const rawToken = Deno.env.get("META_SYSTEM_USER_TOKEN");
    const token = rawToken?.replace(/\s+/g, "").trim();
    if (!token) return json({ erro: "META_SYSTEM_USER_TOKEN não configurado" }, 500);

    // Diagnostic: returns first/last chars + length without leaking the token
    if (req.url.includes("debug=1")) {
      return json({
        token_length: token.length,
        starts_with: token.slice(0, 6),
        ends_with: token.slice(-6),
        starts_correct: token.startsWith("EAA"),
        raw_length: rawToken?.length,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // ===== 1) SYNC BMs + ACCOUNTS (User Token: list BMs then accounts of each) =====
    if (action === "sync_bms" || action === "sync_accounts") {
      // Helper: paginate any /edge URL
      const paginate = async (firstUrl: string) => {
        const out: any[] = [];
        let url: string | null = firstUrl;
        while (url) {
          const r = await fetch(url);
          const d = await r.json();
          if (!r.ok || d.error) throw new Error(`Meta API error: ${JSON.stringify(d.error || d)}`);
          out.push(...(d.data || []));
          url = d.paging?.next || null;
        }
        return out;
      };

      // 1a) List all BMs the user admins
      const bms = await paginate(
        `${META_API}/me/businesses?access_token=${encodeURIComponent(token)}&fields=id,name,verification_status&limit=200`
      );

      if (bms.length === 0) {
        return json({
          sucesso: true,
          sincronizadas: 0,
          hint: "Nenhuma Business Manager encontrada. Verifique se este token pertence ao usuário admin das BMs.",
        });
      }

      // Quick mode: only sync BMs (skip accounts) — use sync_accounts to fetch accounts
      if (action === "sync_bms") {
        const bmRowsQuick = bms.map((bm: any) => ({
          meta_bm_id: bm.id,
          name: bm.name,
          status: bm.verification_status || "active",
          last_synced_at: new Date().toISOString(),
        }));
        await supabase.from("meta_business_managers")
          .upsert(bmRowsQuick, { onConflict: "meta_bm_id" });
        return json({
          sucesso: true,
          bms_sincronizadas: bmRowsQuick.length,
          bms: bmRowsQuick.map((b) => b.name),
          proximo_passo: "Rode action=sync_accounts para puxar as contas de anúncio.",
        });
      }

      // Upsert BMs
      const bmRows = bms.map((bm: any) => ({
        meta_bm_id: bm.id,
        name: bm.name,
        status: bm.verification_status || "active",
        last_synced_at: new Date().toISOString(),
      }));
      const { error: bmErr } = await supabase.from("meta_business_managers")
        .upsert(bmRows, { onConflict: "meta_bm_id" });
      if (bmErr) throw bmErr;

      const { data: bmsDb } = await supabase.from("meta_business_managers")
        .select("id, meta_bm_id");
      const bmIdMap = new Map((bmsDb || []).map((b: any) => [b.meta_bm_id, b.id]));

      // 1b) For each BM, list owned + client ad accounts
      const allAccounts: any[] = [];
      const errors: any[] = [];
      for (const bm of bms) {
        for (const edge of ["owned_ad_accounts", "client_ad_accounts"]) {
          try {
            const accs = await paginate(
              `${META_API}/${bm.id}/${edge}?access_token=${encodeURIComponent(token)}&fields=id,account_id,name,account_status,currency,amount_spent&limit=200`
            );
            for (const acc of accs) allAccounts.push({ ...acc, _bm_meta_id: bm.id });
          } catch (e) {
            errors.push({ bm: bm.name, edge, erro: (e as Error).message });
          }
        }
      }

      // Dedupe by meta_account_id
      const seen = new Set<string>();
      const unique = allAccounts.filter((a) => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      });

      const accRows = unique.map((acc: any) => ({
        meta_account_id: acc.id,
        bm_id: bmIdMap.get(acc._bm_meta_id) || null,
        name: acc.name,
        account_status: acc.account_status,
        status: acc.account_status === 1 ? "active" : "blocked",
        currency: acc.currency || "USD",
        amount_spent: acc.amount_spent ? Number(acc.amount_spent) / 100 : 0,
        last_synced_at: new Date().toISOString(),
      }));

      if (accRows.length > 0) {
        const { error: accErr } = await supabase.from("meta_ad_accounts")
          .upsert(accRows, { onConflict: "meta_account_id" });
        if (accErr) throw accErr;
      }

      return json({
        sucesso: true,
        bms_sincronizadas: bmRows.length,
        contas_sincronizadas: accRows.length,
        bms: bmRows.map((b) => b.name),
        erros: errors,
      });
    }

    // ===== 3) SYNC DAILY INSIGHTS =====
    if (action === "sync_insights") {
      const date = body.date || new Date(Date.now() - 86400000).toISOString().slice(0, 10); // ontem por padrão

      const { data: accounts, error: accErr } = await supabase
        .from("meta_ad_accounts")
        .select("id, meta_account_id, name");
      if (accErr) throw accErr;

      let synced = 0;
      const errors: any[] = [];

      for (const acc of accounts || []) {
        try {
          const data = await metaFetch(`/${acc.meta_account_id}/insights`, token, {
            fields: "spend,impressions,clicks,cpm,cpc,ctr,reach,actions,action_values",
            time_range: JSON.stringify({ since: date, until: date }),
            level: "account",
          });

          const row = (data.data || [])[0];
          if (!row) continue;

          const purchaseTypes = ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"];
          const sumByType = (arr: any[]) =>
            (arr || [])
              .filter((a) => purchaseTypes.includes(a.action_type))
              .reduce((s, a) => s + Number(a.value || 0), 0);
          const purchases = sumByType(row.actions);
          const revenue = sumByType(row.action_values);

          const { error } = await supabase.from("meta_ad_insights").upsert(
            {
              ad_account_id: acc.id,
              date,
              spend: Number(row.spend || 0),
              impressions: Number(row.impressions || 0),
              clicks: Number(row.clicks || 0),
              cpm: Number(row.cpm || 0),
              cpc: Number(row.cpc || 0),
              ctr: Number(row.ctr || 0),
              reach: Number(row.reach || 0),
              actions: row.actions || null,
              purchases,
              revenue,
            },
            { onConflict: "ad_account_id,date" }
          );
          if (error) throw error;
          synced++;
        } catch (e) {
          errors.push({ account: acc.name, erro: (e as Error).message });
        }
      }

      return json({ sucesso: true, data: date, contas_sincronizadas: synced, erros: errors });
    }

    return json({ erro: "action inválida. Use: sync_bms | sync_accounts | sync_insights" }, 400);
  } catch (err) {
    return json({ erro: (err as Error).message }, 500);
  }
});
