// Syncs ALL ad accounts accessible by the token stored in meta_apps.
// Strategy: try multiple endpoints and record every step in meta_diagnostics_log.
//   1) /me/adaccounts                             — funciona só com ads_read/ads_management
//   2) /me/businesses                             — lista BMs
//   3) /{business_id}/owned_ad_accounts           — contas de propriedade da BM
//   4) /{business_id}/client_ad_accounts          — contas de clientes atribuídas à BM
// Request: { meta_app_id: uuid, dry_run?: boolean }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const META_API = "https://graph.facebook.com/v21.0";
const AD_FIELDS = "id,name,account_id,account_status,business,currency,timezone_name,disable_reason,created_time";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function sanitize(s: string): string {
  return String(s || "").replace(/access_token=[^&\s"']+/gi, "access_token=***");
}

async function fetchAll(baseUrl: string, token: string, log: (m: string, x?: unknown) => void): Promise<{ ok: boolean; items: any[]; error: any; status: number }> {
  const items: any[] = [];
  const sep = baseUrl.includes("?") ? "&" : "?";
  let url: string | null = `${baseUrl}${sep}limit=200&access_token=${encodeURIComponent(token)}`;
  let lastStatus = 0;
  while (url) {
    log("GET", { url: sanitize(url) });
    const res = await fetch(url);
    lastStatus = res.status;
    const body = await res.json().catch(() => ({}));
    log("response", { status: res.status, has_error: !!body?.error, count: Array.isArray(body?.data) ? body.data.length : null, error: body?.error || null });
    if (body?.error) return { ok: false, items, error: body.error, status: res.status };
    const chunk = Array.isArray(body?.data) ? body.data : [];
    items.push(...chunk);
    url = body?.paging?.next || null;
  }
  return { ok: true, items, error: null, status: lastStatus };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const logs: Array<{ step: string; data?: unknown }> = [];
  const log = (step: string, data?: unknown) => {
    console.log("[meta-sync-user-adaccounts]", step, data !== undefined ? sanitize(JSON.stringify(data)) : "");
    logs.push({ step, data });
  };

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let meta_app_id: string | null = null;

  const persist = async (summary: Record<string, unknown>, fb_error: any = null, http_status: number | null = null, endpoint = "multi") => {
    try {
      await supabase.from("meta_diagnostics_log").insert({
        meta_app_id,
        operation: "sync_adaccounts",
        endpoint,
        http_status,
        fb_error,
        summary,
        logs,
      });
    } catch (e) {
      console.warn("could not persist diagnostics", e);
    }
  };

  try {
    const payload = await req.json();
    meta_app_id = payload.meta_app_id;
    const dry_run = !!payload.dry_run;
    if (!meta_app_id) return json({ error: "meta_app_id obrigatório" }, 400);

    const { data: app } = await supabase.from("meta_apps").select("*").eq("id", meta_app_id).single();
    if (!app) return json({ error: "App não encontrado" }, 404);
    const token = app.user_access_token || app.system_user_token;
    if (!token) return json({ error: "Nenhum token configurado" }, 400);
    log("app", { label: app.label, token_type: app.user_access_token ? "user" : "system", token_scopes: app.token_scopes });

    const hasAdsRead = Array.isArray(app.token_scopes) && (app.token_scopes.includes("ads_read") || app.token_scopes.includes("ads_management"));
    const hasBM = Array.isArray(app.token_scopes) && app.token_scopes.includes("business_management");
    log("scope_check", { hasAdsRead, hasBM });

    const collected = new Map<string, any>();
    const sources: Record<string, number> = {};
    const endpointErrors: Array<{ endpoint: string; error: any }> = [];

    // 1) /me/adaccounts
    log("try /me/adaccounts");
    const meAcc = await fetchAll(`${META_API}/me/adaccounts?fields=${encodeURIComponent(AD_FIELDS)}`, token, (m, x) => log(`me/adaccounts:${m}`, x));
    if (meAcc.ok) {
      for (const a of meAcc.items) if (!collected.has(a.id)) collected.set(a.id, a);
      sources["me/adaccounts"] = meAcc.items.length;
    } else {
      endpointErrors.push({ endpoint: "me/adaccounts", error: meAcc.error });
    }

    // 2) /me/businesses  →  owned_ad_accounts + client_ad_accounts por BM
    log("try /me/businesses");
    const meBiz = await fetchAll(`${META_API}/me/businesses?fields=id,name`, token, (m, x) => log(`me/businesses:${m}`, x));
    if (!meBiz.ok) endpointErrors.push({ endpoint: "me/businesses", error: meBiz.error });
    const businesses = meBiz.items || [];
    log("businesses_found", { count: businesses.length, ids: businesses.map((b: any) => ({ id: b.id, name: b.name })) });

    for (const b of businesses) {
      const bid = b.id;
      const owned = await fetchAll(`${META_API}/${bid}/owned_ad_accounts?fields=${encodeURIComponent(AD_FIELDS)}`, token, (m, x) => log(`biz ${bid} owned:${m}`, x));
      if (owned.ok) {
        for (const a of owned.items) if (!collected.has(a.id)) collected.set(a.id, { ...a, business: a.business || { id: bid, name: b.name } });
        sources[`biz/${bid}/owned_ad_accounts`] = owned.items.length;
      } else {
        endpointErrors.push({ endpoint: `biz/${bid}/owned_ad_accounts`, error: owned.error });
      }
      const client = await fetchAll(`${META_API}/${bid}/client_ad_accounts?fields=${encodeURIComponent(AD_FIELDS)}`, token, (m, x) => log(`biz ${bid} client:${m}`, x));
      if (client.ok) {
        for (const a of client.items) if (!collected.has(a.id)) collected.set(a.id, { ...a, business: a.business || { id: bid, name: b.name } });
        sources[`biz/${bid}/client_ad_accounts`] = client.items.length;
      } else {
        endpointErrors.push({ endpoint: `biz/${bid}/client_ad_accounts`, error: client.error });
      }
    }

    const accounts = Array.from(collected.values());
    let active = 0, disabled = 0, upserted = 0;
    const rows = accounts.map((a: any) => {
      const status = Number(a.account_status);
      if (status === 1) active++; else disabled++;
      return {
        meta_app_id,
        meta_account_id: a.id,
        name: a.name || a.id,
        account_status: Number.isFinite(status) ? status : null,
        currency: a.currency || null,
        timezone_name: a.timezone_name || null,
        disable_reason: a.disable_reason ?? null,
        business_id: a.business?.id || null,
        business_name: a.business?.name || null,
        account_created_time: a.created_time || null,
        raw_json: a,
        last_synced_at: new Date().toISOString(),
      };
    });

    if (!dry_run && rows.length) {
      const { error: upErr, count } = await supabase
        .from("meta_ad_accounts")
        .upsert(rows, { onConflict: "meta_account_id", count: "exact" });
      if (upErr) {
        log("upsert_error", { message: upErr.message });
        await persist({ total: accounts.length, sources, endpointErrors, upsert_error: upErr.message }, null, null, "multi");
        return json({ ok: false, error: sanitize(upErr.message), sources, endpointErrors, logs }, 500);
      }
      upserted = count ?? rows.length;
    }

    const summary = {
      total: accounts.length,
      active,
      disabled,
      upserted,
      sources,
      businesses_count: businesses.length,
      endpointErrors,
      hint: accounts.length === 0
        ? (!hasAdsRead
            ? "Token não tem ads_read/ads_management — /me/adaccounts sempre volta vazio. Regenere o System User Token no BM marcando essas permissões, ou atribua o System User às contas de anúncio (aba Ativos)."
            : (businesses.length === 0
                ? "Token não retorna businesses. Perfil pode não ter cargo em nenhuma BM."
                : "Businesses encontradas, mas nenhuma conta atribuída ao System User dentro delas. Vá em BM → Usuários do Sistema → aba Ativos → adicione as contas de anúncio."))
        : null,
    };
    log("summary", summary);
    await persist(summary, null, null, "multi");

    return json({
      ok: true,
      ...summary,
      accounts: accounts.map((a: any) => ({ id: a.id, name: a.name, account_status: a.account_status, business: a.business || null, currency: a.currency })),
      logs,
    });
  } catch (e: any) {
    log("exception", { message: e?.message, stack: e?.stack });
    await persist({ exception: e?.message }, null, null, "multi");
    return json({ error: sanitize(e?.message || "internal error"), logs }, 500);
  }
});
