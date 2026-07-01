// Sincroniza contas de anúncio de UM meta_app específico usando EXATAMENTE a
// mesma estratégia da função `meta-sync` (que já funciona com o app conectado
// via variáveis de ambiente). Preferência: user_access_token → system_user_token.
// Endpoints: /me/businesses → /{bm}/owned_ad_accounts + /{bm}/client_ad_accounts.
// Request: { meta_app_id: uuid, dry_run?: boolean }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const META_API = "https://graph.facebook.com/v21.0";

const ACCOUNT_FIELDS = [
  "id","account_id","name","account_status","currency","amount_spent","spend_cap",
  "timezone_name","created_time","disable_reason","funding_source",
  "funding_source_details","is_prepay_account",
  "balance","business_country_code","age","business",
  "agencies{id,name,verification_status}",
].join(",");

const DISABLE_REASONS: Record<number, string> = {
  0: "Nenhum", 1: "ADS_INTEGRITY_POLICY", 2: "ADS_IP_REVIEW", 3: "RISK_PAYMENT",
  4: "GRAY_ACCOUNT_SHUT_DOWN", 5: "ADS_AFC_REVIEW", 6: "BUSINESS_INTEGRITY_RAR",
  7: "PERMANENT_CLOSE", 8: "UNUSED_RESELLER_ACCOUNT", 9: "UNUSED_ACCOUNT",
  10: "UMBRELLA_AD_ACCOUNT", 11: "BUSINESS_MANAGER_INTEGRITY_POLICY",
  12: "MISREPRESENTED_AD_ACCOUNT", 13: "AOAB_DESHARE_LEGAL_ENTITY",
  14: "CTX_THREAD_REVIEW", 15: "COMPROMISED_AD_ACCOUNT",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const sanitize = (s: string) => String(s || "").replace(/access_token=[^&\s"']+/gi, "access_token=***");

const maskFunding = (acc: any): string | null => {
  const fsd = acc.funding_source_details;
  if (!fsd) return acc.funding_source ? "Vinculado" : null;
  const raw: string = fsd.display_string || "";
  const digits = (raw.match(/\d/g) || []).join("");
  const last4 = digits.slice(-4);
  const brand = (raw.match(/^([A-Za-z]+)/) || [])[1]?.toUpperCase() || "";
  if (last4) return `${brand || "CARTÃO"} •••• ${last4}`;
  return raw || "Vinculado";
};

async function paginateMeta(firstUrl: string, log: (m: string, x?: unknown) => void): Promise<any[]> {
  const out: any[] = [];
  let url: string | null = firstUrl;
  while (url) {
    log("GET", { url: sanitize(url) });
    const r = await fetch(url);
    const d = await r.json().catch(() => ({}));
    log("response", { status: r.status, count: Array.isArray(d?.data) ? d.data.length : null, error: d?.error || null });
    if (!r.ok || d.error) throw new Error(JSON.stringify(d.error || d));
    out.push(...(d.data || []));
    url = d.paging?.next || null;
  }
  return out;
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

  const persist = async (summary: Record<string, unknown>, fb_error: any = null, http_status: number | null = null) => {
    try {
      await supabase.from("meta_diagnostics_log").insert({
        meta_app_id, operation: "sync_adaccounts", endpoint: "multi",
        http_status, fb_error, summary, logs,
      });
    } catch (e) { console.warn("could not persist diagnostics", e); }
  };

  try {
    const payload = await req.json();
    meta_app_id = payload.meta_app_id;
    const dry_run = !!payload.dry_run;
    if (!meta_app_id) return json({ error: "meta_app_id obrigatório" }, 400);

    const { data: app } = await supabase.from("meta_apps").select("*").eq("id", meta_app_id).single();
    if (!app) return json({ error: "App não encontrado" }, 404);

    // Mesma escolha da função meta-sync (que já funciona): user token > system token
    const usr = (app.user_access_token || "").replace(/\s+/g, "").trim();
    const sys = (app.system_user_token || "").replace(/\s+/g, "").trim();
    const token = usr || sys;
    const tokenType = token === usr ? "user" : "system";
    if (!token) return json({ error: "Nenhum token configurado (user_access_token ou system_user_token)" }, 400);
    log("app", { label: app.label, token_type: tokenType, has_user: !!usr, has_system: !!sys });

    // 1) BMs do perfil
    log("fetching /me/businesses");
    let bms: any[] = [];
    try {
      bms = await paginateMeta(
        `${META_API}/me/businesses?access_token=${encodeURIComponent(token)}&fields=id,name,verification_status&limit=200`,
        (m, x) => log(`me/businesses:${m}`, x),
      );
    } catch (e: any) {
      log("me/businesses failed", { error: e?.message });
      await persist({ total: 0, businesses_count: 0, error: e?.message,
        hint: "Falha ao listar BMs. Confira se o token tem business_management e se o perfil está em pelo menos uma BM." });
      return json({ ok: false, error: sanitize(e?.message || "Falha /me/businesses"), logs }, 500);
    }
    log("businesses_found", { count: bms.length, ids: bms.map((b) => ({ id: b.id, name: b.name, verification: b.verification_status })) });

    if (bms.length === 0) {
      const hint = "Perfil sem BMs. Verifique se o token pertence a um usuário admin/employee de pelo menos uma Business Manager em business.facebook.com.";
      await persist({ total: 0, businesses_count: 0, hint });
      return json({ ok: true, total: 0, active: 0, disabled: 0, upserted: 0, businesses_count: 0, sources: {}, endpointErrors: [], hint, accounts: [], logs });
    }

    // Upsert BMs (mesma lógica de meta-sync)
    const bmRows = bms.map((bm: any) => ({
      meta_bm_id: bm.id, name: bm.name,
      status: bm.verification_status || "active",
      verification_status: bm.verification_status || null,
      meta_app_id, last_synced_at: new Date().toISOString(),
    }));
    await supabase.from("meta_business_managers").upsert(bmRows, { onConflict: "meta_bm_id" });
    const { data: bmsDb } = await supabase.from("meta_business_managers").select("id, meta_bm_id");
    const bmIdMap = new Map((bmsDb || []).map((b: any) => [b.meta_bm_id, b.id]));
    const bmStatusMap = new Map(bms.map((b: any) => [b.id, b.verification_status]));

    // 2) Contas de cada BM
    const sources: Record<string, number> = {};
    const endpointErrors: Array<{ endpoint: string; error: string }> = [];
    const allAccounts: any[] = [];

    for (const bm of bms) {
      for (const edge of ["owned_ad_accounts", "client_ad_accounts"]) {
        try {
          const items = await paginateMeta(
            `${META_API}/${bm.id}/${edge}?access_token=${encodeURIComponent(token)}&fields=${ACCOUNT_FIELDS}&limit=200`,
            (m, x) => log(`biz ${bm.id} ${edge}:${m}`, x),
          );
          sources[`biz/${bm.id}/${edge}`] = items.length;
          for (const acc of items) allAccounts.push({ ...acc, _bm_meta_id: bm.id });
        } catch (e: any) {
          endpointErrors.push({ endpoint: `biz/${bm.id}/${edge}`, error: e?.message });
        }
      }
    }

    const seen = new Set<string>();
    const unique = allAccounts.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
    log("collected_accounts", { total: unique.length });

    const computeScore = (acc: any) => {
      let s = 100;
      if (acc.account_status !== 1) s -= 60;
      if (acc.disable_reason && acc.disable_reason !== 0) s -= 40;
      if (!acc.funding_source) s -= 20;
      const bmVer = bmStatusMap.get(acc._bm_meta_id);
      if (bmVer && bmVer !== "verified") s -= 10;
      if (!acc.amount_spent || Number(acc.amount_spent) === 0) s -= 5;
      s = Math.max(0, Math.min(100, s));
      return { score: s, label: s >= 80 ? "Excelente" : s >= 60 ? "Bom" : s >= 40 ? "Atenção" : "Crítico" };
    };

    const accRows = unique.map((acc: any) => {
      const { score, label } = computeScore(acc);
      return {
        meta_account_id: acc.id,
        bm_id: bmIdMap.get(acc._bm_meta_id) || null,
        meta_app_id,
        name: acc.name,
        account_status: acc.account_status,
        status: acc.account_status === 1 ? "active" : "blocked",
        currency: acc.currency || "USD",
        amount_spent: acc.amount_spent ? Number(acc.amount_spent) / 100 : 0,
        spend_cap: acc.spend_cap ? Number(acc.spend_cap) / 100 : null,
        timezone_name: acc.timezone_name || null,
        account_created_time: acc.created_time || null,
        disable_reason: acc.disable_reason ?? null,
        disable_reason_label: acc.disable_reason ? (DISABLE_REASONS[acc.disable_reason] || `Código ${acc.disable_reason}`) : DISABLE_REASONS[0],
        funding_source: maskFunding(acc),
        billing_cycle: acc.is_prepay_account === true ? "Pré-paga" : acc.is_prepay_account === false ? "Pós-paga" : null,
        balance: acc.balance ? Number(acc.balance) / 100 : 0,
        business_country_code: acc.business_country_code || null,
        age: acc.age ?? null,
        owner_business_name: acc.business?.name || null,
        owner_business_id: acc.business?.id || null,
        shared_with_businesses: Array.isArray(acc.agencies?.data)
          ? acc.agencies.data.map((b: any) => ({ id: b.id, name: b.name, verification_status: b.verification_status || null }))
          : [],
        score, score_label: label,
        last_synced_at: new Date().toISOString(),
      };
    });

    let active = 0, disabled = 0, upserted = 0;
    accRows.forEach((r) => { if (r.account_status === 1) active++; else disabled++; });

    if (!dry_run && accRows.length) {
      const CHUNK = 200;
      for (let i = 0; i < accRows.length; i += CHUNK) {
        const { error } = await supabase.from("meta_ad_accounts")
          .upsert(accRows.slice(i, i + CHUNK), { onConflict: "meta_account_id" });
        if (error) {
          log("upsert_error", { message: error.message });
          await persist({ total: accRows.length, sources, endpointErrors, upsert_error: error.message });
          return json({ ok: false, error: sanitize(error.message), sources, endpointErrors, logs }, 500);
        }
      }
      upserted = accRows.length;
    }

    const hint = accRows.length === 0
      ? (bms.length > 0
          ? `Foram encontradas ${bms.length} BM(s) mas nenhuma conta de anúncio. O token/perfil não é admin nem tem acesso às contas dentro dessas BMs.`
          : "Nenhuma BM acessível pelo token.")
      : null;

    const summary = { total: accRows.length, active, disabled, upserted, sources, businesses_count: bms.length, endpointErrors, hint };
    log("summary", summary);
    await persist(summary);

    return json({
      ok: true, ...summary,
      accounts: accRows.map((a) => ({ id: a.meta_account_id, name: a.name, account_status: a.account_status, business: { id: a.owner_business_id, name: a.owner_business_name }, currency: a.currency })),
      logs,
    });
  } catch (e: any) {
    log("exception", { message: e?.message, stack: e?.stack });
    await persist({ exception: e?.message });
    return json({ error: sanitize(e?.message || "internal error"), logs }, 500);
  }
});
