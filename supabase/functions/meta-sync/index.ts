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
    const token = Deno.env.get("META_SYSTEM_USER_TOKEN");
    if (!token) return json({ erro: "META_SYSTEM_USER_TOKEN não configurado" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // ===== 1) SYNC BMs + ACCOUNTS (via /me/adaccounts — single source of truth) =====
    if (action === "sync_bms" || action === "sync_accounts") {
      // Pull every ad account this System User can see, with its owning business inline
      const all: any[] = [];
      let url: string | null = `${META_API}/me/adaccounts?access_token=${encodeURIComponent(token)}&fields=id,account_id,name,account_status,currency,amount_spent,business{id,name,verification_status}&limit=200`;
      while (url) {
        const r = await fetch(url);
        const d = await r.json();
        if (!r.ok || d.error) throw new Error(`Meta API error: ${JSON.stringify(d.error || d)}`);
        all.push(...(d.data || []));
        url = d.paging?.next || null;
      }

      if (all.length === 0) {
        return json({
          sucesso: true,
          sincronizadas: 0,
          hint: "Nenhuma conta de anúncio visível para este System User. Atribua contas a ele em business.facebook.com → Configurações → Usuários do Sistema → Adicionar Ativos.",
        });
      }

      // Upsert BMs (deduped)
      const bmMap = new Map<string, any>();
      for (const acc of all) {
        const bm = acc.business;
        if (bm?.id && !bmMap.has(bm.id)) bmMap.set(bm.id, bm);
      }
      const bmRows = Array.from(bmMap.values()).map((bm) => ({
        meta_bm_id: bm.id,
        name: bm.name,
        status: bm.verification_status || "active",
        last_synced_at: new Date().toISOString(),
      }));
      if (bmRows.length > 0) {
        const { error } = await supabase.from("meta_business_managers")
          .upsert(bmRows, { onConflict: "meta_bm_id" });
        if (error) throw error;
      }

      // Lookup BM uuids
      const { data: bmsDb } = await supabase.from("meta_business_managers")
        .select("id, meta_bm_id");
      const bmIdMap = new Map((bmsDb || []).map((b: any) => [b.meta_bm_id, b.id]));

      // Upsert accounts
      const accRows = all.map((acc: any) => ({
        meta_account_id: acc.id,
        bm_id: acc.business?.id ? bmIdMap.get(acc.business.id) : null,
        name: acc.name,
        account_status: acc.account_status,
        status: acc.account_status === 1 ? "active" : "blocked",
        currency: acc.currency || "USD",
        amount_spent: acc.amount_spent ? Number(acc.amount_spent) / 100 : 0,
        last_synced_at: new Date().toISOString(),
      }));
      const { error: accErr } = await supabase.from("meta_ad_accounts")
        .upsert(accRows, { onConflict: "meta_account_id" });
      if (accErr) throw accErr;

      return json({
        sucesso: true,
        bms_sincronizadas: bmRows.length,
        contas_sincronizadas: accRows.length,
        bms: bmRows.map((b) => b.name),
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
            fields: "spend,impressions,clicks,cpm,cpc,ctr,reach,actions",
            time_range: JSON.stringify({ since: date, until: date }),
            level: "account",
          });

          const row = (data.data || [])[0];
          if (!row) continue;

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
