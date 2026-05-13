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

    // ===== 1) SYNC BMs =====
    if (action === "sync_bms") {
      // System User: own business via /me, plus shared client businesses
      const me = await metaFetch("/me", token, { fields: "id,name" });
      const own = await metaFetch("/me/businesses", token, {
        fields: "id,name,verification_status", limit: "100",
      });
      const owned = own.data || [];

      // For each owned BM, list client BMs (BMs that shared assets with us)
      const clientBms: any[] = [];
      for (const bm of owned) {
        try {
          const c = await metaFetch(`/${bm.id}/clients`, token, {
            fields: "id,name,verification_status", limit: "200",
          });
          clientBms.push(...(c.data || []));
        } catch (_) { /* ignore */ }
      }

      const bms = [...owned, ...clientBms];
      if (bms.length === 0) {
        return json({ sucesso: true, sincronizadas: 0, debug: { me, hint: "System User não pertence a nenhuma BM. Certifique-se de que ele foi criado dentro de uma Business Manager e atribua ativos a ele." } });
      }
      const upserts = bms.map((bm: any) => ({
        meta_bm_id: bm.id,
        name: bm.name,
        status: bm.verification_status || "active",
        last_synced_at: new Date().toISOString(),
      }));

      if (upserts.length > 0) {
        const { error } = await supabase
          .from("meta_business_managers")
          .upsert(upserts, { onConflict: "meta_bm_id" });
        if (error) throw error;
      }

      return json({ sucesso: true, sincronizadas: bms.length, bms });
    }

    // ===== 2) SYNC AD ACCOUNTS =====
    if (action === "sync_accounts") {
      // Get BMs to sync
      let bmsQuery = supabase.from("meta_business_managers").select("id, meta_bm_id, name");
      if (body.bm_id) bmsQuery = bmsQuery.eq("id", body.bm_id);
      const { data: bms, error: bmErr } = await bmsQuery;
      if (bmErr) throw bmErr;

      let totalAccounts = 0;
      const results: any[] = [];

      for (const bm of bms || []) {
        try {
          const data = await metaFetch(`/${bm.meta_bm_id}/owned_ad_accounts`, token, {
            fields: "id,account_id,name,account_status,currency,amount_spent",
            limit: "200",
          });
          const accounts = data.data || [];

          const upserts = accounts.map((acc: any) => ({
            meta_account_id: acc.id, // act_xxx
            bm_id: bm.id,
            name: acc.name,
            account_status: acc.account_status,
            status: acc.account_status === 1 ? "active" : "blocked",
            currency: acc.currency || "USD",
            amount_spent: acc.amount_spent ? Number(acc.amount_spent) / 100 : 0,
            last_synced_at: new Date().toISOString(),
          }));

          if (upserts.length > 0) {
            const { error } = await supabase
              .from("meta_ad_accounts")
              .upsert(upserts, { onConflict: "meta_account_id" });
            if (error) throw error;
          }

          totalAccounts += accounts.length;
          results.push({ bm: bm.name, accounts: accounts.length });
        } catch (e) {
          results.push({ bm: bm.name, erro: (e as Error).message });
        }
      }

      return json({ sucesso: true, total_contas: totalAccounts, resultados: results });
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
