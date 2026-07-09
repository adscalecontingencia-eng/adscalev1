// Meta Marketing API sync — pulls BMs, ad accounts, pages and daily insights
// Iterates over ALL active rows in meta_apps so that multiple Meta apps run
// simultaneously. Each synced asset is tagged with `meta_app_id` so the UI can
// trace it back to the originating app.
//
// Endpoints (POST):
//   { action: "sync_bms" }                       -> sync BMs for every active app
//   { action: "sync_accounts" }                  -> sync ad accounts for every active app
//   { action: "sync_pages" }                     -> sync pages for every active app
//   { action: "sync_insights", since?, until? }  -> sync daily insights for all accounts
//   { action: "start_sync_accounts" }            -> background job (all apps)
//
// Optional: { app_ids: ["uuid", ...] } restricts the run to a subset of apps.
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

type BackoffInfo = { attempt: number; waitMs: number; reason: string };
let onBackoff: ((info: BackoffInfo) => void) | null = null;

async function fetchWithRetry(url: string, init?: RequestInit, attempts = 6): Promise<Response> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429 || res.status >= 500) {
        const wait = Math.min(60000, 2000 * Math.pow(2, i));
        onBackoff?.({ attempt: i + 1, waitMs: wait, reason: `HTTP ${res.status}` });
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      const clone = res.clone();
      const data = await clone.json().catch(() => null);
      const code = data?.error?.code;
      const subcode = data?.error?.error_subcode;
      const transient = data?.error?.is_transient
        || [4, 17, 32, 613].includes(code)
        || [2446079, 1487390, 1487742].includes(subcode);
      if (transient && i < attempts - 1) {
        const wait = Math.min(90000, 3000 * Math.pow(2, i));
        onBackoff?.({ attempt: i + 1, waitMs: wait, reason: `Meta code ${code} (rate limit)` });
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      const wait = Math.min(30000, 1500 * Math.pow(2, i));
      onBackoff?.({ attempt: i + 1, waitMs: wait, reason: `network error` });
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  if (lastErr) throw lastErr;
  return fetch(url, init);
}

async function metaFetch(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${META_API}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetchWithRetry(url.toString());
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Meta API error: ${JSON.stringify(data.error || data)}`);
  }
  return data;
}

async function paginateMeta(firstUrl: string): Promise<any[]> {
  const out: any[] = [];
  let url: string | null = firstUrl;
  while (url) {
    const r = await fetchWithRetry(url);
    const d = await r.json();
    if (!r.ok || d.error) throw new Error(`Meta API error: ${JSON.stringify(d.error || d)}`);
    out.push(...(d.data || []));
    url = d.paging?.next || null;
  }
  return out;
}

const DISABLE_REASONS: Record<number, string> = {
  0: "Nenhum", 1: "ADS_INTEGRITY_POLICY", 2: "ADS_IP_REVIEW", 3: "RISK_PAYMENT",
  4: "GRAY_ACCOUNT_SHUT_DOWN", 5: "ADS_AFC_REVIEW", 6: "BUSINESS_INTEGRITY_RAR",
  7: "PERMANENT_CLOSE", 8: "UNUSED_RESELLER_ACCOUNT", 9: "UNUSED_ACCOUNT",
  10: "UMBRELLA_AD_ACCOUNT", 11: "BUSINESS_MANAGER_INTEGRITY_POLICY",
  12: "MISREPRESENTED_AD_ACCOUNT", 13: "AOAB_DESHARE_LEGAL_ENTITY",
  14: "CTX_THREAD_REVIEW", 15: "COMPROMISED_AD_ACCOUNT",
};

const ACCOUNT_FIELDS = [
  "id","account_id","name","account_status","currency","amount_spent","spend_cap",
  "timezone_name","created_time","disable_reason","funding_source",
  "funding_source_details","is_prepay_account",
  "balance","business_country_code","age","business",
  "agencies{id,name,verification_status}",
].join(",");

const maskFunding = (acc: any): string | null => {
  const fsd = acc.funding_source_details;
  if (!fsd) return acc.funding_source ? "Vinculado" : null;
  const raw: string = fsd.display_string || "";
  const digits = (raw.match(/\d/g) || []).join("");
  const last4 = digits.slice(-4);
  const type = fsd.type != null ? String(fsd.type) : "";
  const brandMatch = raw.match(/^([A-Za-z]+)/);
  const brand = brandMatch ? brandMatch[1].toUpperCase() : "";
  if (last4) return `${brand || "CARTÃO"} •••• ${last4}`;
  if (type) return type.replace(/_/g, " ");
  return raw || "Vinculado";
};

type AppRow = {
  id: string;
  label: string;
  app_id: string;
  system_user_token: string | null;
  user_access_token: string | null;
};

// Picks the best token for a given action. For pages we prefer the System User
// token (broader scope); for everything else the User Access token wins.
function pickToken(app: AppRow, action: string): string {
  const sys = (app.system_user_token || "").replace(/\s+/g, "").trim();
  const usr = (app.user_access_token || "").replace(/\s+/g, "").trim();
  if (action === "sync_pages") return sys || usr;
  return usr || sys;
}

// Loads every active app. If body.app_ids is provided, restrict to that subset.
async function loadActiveApps(supabase: any, appIds?: string[]): Promise<AppRow[]> {
  let q = supabase
    .from("meta_apps")
    .select("id, label, app_id, system_user_token, user_access_token, status")
    .eq("status", "active");
  if (appIds && appIds.length > 0) q = q.in("id", appIds);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data || []) as (AppRow & { status: string })[];

  // Back-compat: if there are no apps configured in DB, fall back to env vars
  // so existing setups keep working.
  if (rows.length === 0) {
    const envUser = (Deno.env.get("META_USER_ACCESS_TOKEN") || "").replace(/\s+/g, "").trim();
    const envSys = (Deno.env.get("META_SYSTEM_USER_TOKEN") || "").replace(/\s+/g, "").trim();
    if (envUser || envSys) {
      return [{
        id: "00000000-0000-0000-0000-000000000000",
        label: "ENV (legado)",
        app_id: Deno.env.get("META_APP_ID") || "",
        system_user_token: envSys || null,
        user_access_token: envUser || null,
      }];
    }
  }
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    app_id: r.app_id,
    system_user_token: r.system_user_token,
    user_access_token: r.user_access_token,
  }));
}

// ---- Per-app sync routines ----------------------------------------------------

async function syncAccountsForApp(supabase: any, app: AppRow) {
  const token = pickToken(app, "sync_accounts");
  if (!token) return { app: app.label, erro: "Sem token configurado" };

  const bms = await paginateMeta(
    `${META_API}/me/businesses?access_token=${encodeURIComponent(token)}&fields=id,name,verification_status&limit=200`
  );
  if (bms.length === 0) return { app: app.label, bms: 0, accounts: 0 };

  const bmRows = bms.map((bm: any) => ({
    meta_bm_id: bm.id,
    name: bm.name,
    status: bm.verification_status || "active",
    verification_status: bm.verification_status || null,
    meta_app_id: app.id.startsWith("00000000") ? null : app.id,
    last_synced_at: new Date().toISOString(),
  }));
  await supabase.from("meta_business_managers").upsert(bmRows, { onConflict: "meta_bm_id" });

  const { data: bmsDb } = await supabase.from("meta_business_managers").select("id, meta_bm_id");
  const bmIdMap = new Map((bmsDb || []).map((b: any) => [b.meta_bm_id, b.id]));

  const allAccounts: any[] = [];
  const errors: any[] = [];
  const bmStatusMap = new Map(bms.map((b: any) => [b.id, b.verification_status]));

  const tasks: { bmId: string; bmName: string; edge: string }[] = [];
  for (const bm of bms) {
    for (const e of ["owned_ad_accounts", "client_ad_accounts"]) {
      tasks.push({ bmId: bm.id, bmName: bm.name, edge: e });
    }
  }

  const CONCURRENCY = 4;
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= tasks.length) return;
      const t = tasks[i];
      const url = `${META_API}/${t.bmId}/${t.edge}?access_token=${encodeURIComponent(token)}&fields=${ACCOUNT_FIELDS}&limit=200`;
      try {
        const items = await paginateMeta(url);
        for (const acc of items) allAccounts.push({ ...acc, _bm_meta_id: t.bmId });
      } catch (e) {
        errors.push({ app: app.label, bm: t.bmName, edge: t.edge, erro: (e as Error).message });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, worker));

  // Also pull /me/adaccounts — accounts assigned directly to the System User
  // that don't surface through /me/businesses/{bm}/*_ad_accounts edges. Without
  // this, accounts shared to the SU (typical of BM-agnostic sharing) get lost.
  try {
    const meAccounts = await paginateMeta(
      `${META_API}/me/adaccounts?access_token=${encodeURIComponent(token)}&fields=${ACCOUNT_FIELDS}&limit=200`,
    );
    for (const acc of meAccounts) {
      allAccounts.push({ ...acc, _bm_meta_id: acc.business?.id || null });
    }
  } catch (e) {
    errors.push({ app: app.label, bm: "-", edge: "/me/adaccounts", erro: (e as Error).message });
  }

  // Auto-upsert any BM referenced by /me/adaccounts that we didn't get from
  // /me/businesses — otherwise bmIdMap lookup fails and bm_id ends up null.
  const knownBmIds = new Set(bms.map((b: any) => b.id));
  const extraBmIds = new Set<string>();
  const extraBmNames = new Map<string, string>();
  for (const acc of allAccounts) {
    const bid = acc._bm_meta_id;
    if (bid && !knownBmIds.has(bid) && acc.business?.name) {
      extraBmIds.add(bid);
      extraBmNames.set(bid, acc.business.name);
    }
  }
  if (extraBmIds.size > 0) {
    const extraRows = Array.from(extraBmIds).map((bid) => ({
      meta_bm_id: bid,
      name: extraBmNames.get(bid) || bid,
      status: "active",
      meta_app_id: app.id.startsWith("00000000") ? null : app.id,
      last_synced_at: new Date().toISOString(),
    }));
    await supabase.from("meta_business_managers").upsert(extraRows, { onConflict: "meta_bm_id" });
    const { data: refreshed } = await supabase
      .from("meta_business_managers")
      .select("id, meta_bm_id")
      .in("meta_bm_id", Array.from(extraBmIds));
    for (const b of refreshed || []) bmIdMap.set(b.meta_bm_id, b.id);
  }

  const seen = new Set<string>();
  const unique = allAccounts.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));

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
      meta_app_id: app.id.startsWith("00000000") ? null : app.id,
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
      score,
      score_label: label,
      last_synced_at: new Date().toISOString(),
    };
  });

  const CHUNK = 200;
  for (let i = 0; i < accRows.length; i += CHUNK) {
    const { error } = await supabase.from("meta_ad_accounts")
      .upsert(accRows.slice(i, i + CHUNK), { onConflict: "meta_account_id" });
    if (error) throw error;
  }

  return { app: app.label, bms: bms.length, accounts: accRows.length, erros: errors };
}

async function syncPagesForApp(supabase: any, app: AppRow) {
  const token = pickToken(app, "sync_pages");
  if (!token) return { app: app.label, erro: "Sem token configurado" };

  const PAGE_FIELDS = "id,name,category,fan_count,followers_count,picture.type(large),is_published,verification_status";
  const PAGE_FALLBACK_FIELDS = ["id,name,category,picture.type(large)", "id,name", "id"];
  const errors: any[] = [];
  const detailErrors: any[] = [];
  const allPages: any[] = [];
  const ownAppId = app.id.startsWith("00000000") ? null : app.id;

  const isMetaAccessBlocked = (message: string) =>
    message.includes("API access blocked") ||
    message.includes('"code":200') ||
    message.includes("Permissions error") ||
    message.includes("Unsupported get request");

  const edgeUrl = (ownerId: string, edge: string, fields: string) => {
    const url = new URL(`${META_API}/${ownerId}/${edge}`);
    url.searchParams.set("access_token", token);
    url.searchParams.set("fields", fields);
    url.searchParams.set("limit", "200");
    return url.toString();
  };

  const fetchPagesWithFallback = async (t: { ownerId: string; edge: string; label: string }) => {
    let lastError = "";
    for (const fields of PAGE_FALLBACK_FIELDS) {
      try {
        const items = await paginateMeta(edgeUrl(t.ownerId, t.edge, fields));
        return items.map((item: any) => ({ ...item, _partial: true }));
      } catch (e) {
        lastError = (e as Error).message;
        if (!isMetaAccessBlocked(lastError)) break;
      }
    }
    throw new Error(lastError || "Falha ao ler páginas da BM");
  };

  // Discover BMs directly via this app's token (each app = one Meta profile),
  // so we pull every BM that profile administers — regardless of which other
  // app may have synced the same BM earlier.
  let profileBms: any[] = [];
  try {
    profileBms = await paginateMeta(
      `${META_API}/me/businesses?access_token=${encodeURIComponent(token)}&fields=id,name&limit=200`
    );
  } catch (e) {
    errors.push({ source: `${app.label}:me/businesses`, erro: (e as Error).message });
  }

  // Map meta_bm_id -> our internal id so pages can be linked to the BM row.
  const { data: bmsDb } = await supabase
    .from("meta_business_managers")
    .select("id, meta_bm_id");
  const bmIdMap = new Map((bmsDb || []).map((b: any) => [b.meta_bm_id, b.id]));

  const tasks: { bmDbId: string | null; ownerId: string; edge: string; label: string }[] = [];
  for (const bm of profileBms) {
    for (const e of ["owned_pages", "client_pages"]) {
      tasks.push({ bmDbId: bmIdMap.get(bm.id) || null, ownerId: bm.id, edge: e, label: `${app.label}:${bm.name}/${e}` });
    }
  }
  tasks.push({ bmDbId: null, ownerId: "me", edge: "accounts", label: `${app.label}:me/accounts` });

  const CONCURRENCY = 3;
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= tasks.length) return;
      const t = tasks[i];
      try {
        const items = await fetchPagesWithFallback(t);
        for (const p of items) allPages.push({ ...p, _bm_db_id: t.bmDbId });
      } catch (e) {
        errors.push({ source: t.label, erro: (e as Error).message });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, worker));

  const seen = new Set<string>();
  const unique = allPages.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));

  const needsDetails = unique.filter((p: any) => p._partial || p.followers_count == null || p.fan_count == null);
  let detailCursor = 0;
  const detailWorker = async () => {
    while (true) {
      const i = detailCursor++;
      if (i >= needsDetails.length) return;
      const p = needsDetails[i];
      try {
        const details = await metaFetch(`/${p.id}`, token, { fields: PAGE_FIELDS });
        Object.assign(p, details, { _partial: false });
      } catch (e) {
        if (detailErrors.length < 8) detailErrors.push({ page_id: p.id, erro: (e as Error).message });
      }
    }
  };
  if (needsDetails.length > 0) {
    await Promise.all(Array.from({ length: Math.min(5, needsDetails.length) }, detailWorker));
  }

  const rows = unique.map((p: any) => ({
    meta_page_id: p.id,
    bm_id: p._bm_db_id,
    meta_app_id: ownAppId,
    name: p.name || `Página ${p.id}`,
    category: p.category || null,
    fan_count: p.fan_count ?? null,
    followers_count: p.followers_count ?? p.fan_count ?? null,
    created_time: p.created_time || null,
    picture_url: p.picture?.data?.url || null,
    is_published: p.is_published ?? null,
    is_restricted: false,
    status: "active",
    last_synced_at: new Date().toISOString(),
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from("meta_pages").upsert(rows, { onConflict: "meta_page_id" });
    if (error) throw error;
  }

  return { app: app.label, pages: rows.length, erros: errors, detalhes_bloqueados: detailErrors.length };
}

// ---- Background job (multi-app) ---------------------------------------------

async function runAccountsSyncJob(supabase: any, jobId: string, appIds?: string[]) {
  const update = (patch: Record<string, any>) =>
    supabase.from("meta_sync_jobs").update(patch).eq("id", jobId);

  onBackoff = (info) => {
    update({ message: `Retry ${info.attempt} em ${Math.round(info.waitMs / 1000)}s — ${info.reason}` });
  };

  try {
    const apps = await loadActiveApps(supabase, appIds);
    if (apps.length === 0) {
      await update({ status: "failed", finished_at: new Date().toISOString(), message: "Nenhum aplicativo Meta ativo." });
      return;
    }

    await update({
      status: "running",
      started_at: new Date().toISOString(),
      progress_total: apps.length,
      progress_current: 0,
      message: `Sincronizando ${apps.length} aplicativo(s) em paralelo...`,
    });

    let done = 0;
    let totalAccounts = 0;
    const allErrors: any[] = [];

    // Run apps in parallel — each one is rate-limited internally per token.
    await Promise.all(apps.map(async (app) => {
      try {
        const r = await syncAccountsForApp(supabase, app);
        totalAccounts += (r.accounts || 0);
        if (r.erros && r.erros.length) allErrors.push(...r.erros);
      } catch (e) {
        allErrors.push({ app: app.label, fatal: (e as Error).message });
      } finally {
        done++;
        await update({
          progress_current: done,
          synced_count: totalAccounts,
          message: `${done}/${apps.length} app(s) concluído(s) · ${totalAccounts} contas`,
          errors: allErrors,
        });
      }
    }));

    await update({
      status: "completed",
      finished_at: new Date().toISOString(),
      progress_current: apps.length,
      synced_count: totalAccounts,
      message: `Concluído: ${totalAccounts} contas em ${apps.length} aplicativo(s)${allErrors.length ? ` (${allErrors.length} erros)` : ""}`,
      errors: allErrors,
    });
  } catch (e) {
    await update({
      status: "failed",
      finished_at: new Date().toISOString(),
      message: `Falhou: ${(e as Error).message}`,
    });
  } finally {
    onBackoff = null;
  }
}

// -----------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "Use POST" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ---- Auth: admin/support JWT OR shared internal secret -----------------
    const authHeader = req.headers.get("authorization") || "";
    const sharedSecret = Deno.env.get("N8N_SECRET_KEY") || "";
    const providedSecret = req.headers.get("x-internal-secret") || "";
    let authorized = false;

    if (sharedSecret && providedSecret && providedSecret === sharedSecret) {
      authorized = true;
    } else if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .in("role", ["admin", "support"])
          .maybeSingle();
        if (roleRow) authorized = true;
      }
    }
    if (!authorized) return json({ erro: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const appIds: string[] | undefined = Array.isArray(body.app_ids) && body.app_ids.length > 0 ? body.app_ids : undefined;

    // ===== Background job =====
    if (action === "start_sync_accounts") {
      const { data: job, error: jobErr } = await supabase
        .from("meta_sync_jobs")
        .insert({ kind: "accounts", status: "pending", message: "Aguardando início..." })
        .select("id")
        .single();
      if (jobErr) throw jobErr;
      // @ts-ignore EdgeRuntime is provided by Supabase runtime
      EdgeRuntime.waitUntil(runAccountsSyncJob(supabase, job.id, appIds));
      return json({ sucesso: true, job_id: job.id });
    }

    // ===== Multi-app sync of BMs + accounts =====
    if (action === "sync_bms" || action === "sync_accounts") {
      const apps = await loadActiveApps(supabase, appIds);
      if (apps.length === 0) return json({ erro: "Nenhum aplicativo Meta ativo configurado" }, 400);

      const results = await Promise.all(apps.map(async (app) => {
        try {
          return await syncAccountsForApp(supabase, app);
        } catch (e) {
          return { app: app.label, erro: (e as Error).message };
        }
      }));

      const totalBms = results.reduce((s, r: any) => s + (r.bms || 0), 0);
      const totalAccounts = results.reduce((s, r: any) => s + (r.accounts || 0), 0);
      return json({
        sucesso: true,
        aplicativos: apps.length,
        bms_sincronizadas: totalBms,
        contas_sincronizadas: totalAccounts,
        por_aplicativo: results,
      });
    }

    // ===== Multi-app sync of pages =====
    if (action === "sync_pages") {
      const apps = await loadActiveApps(supabase, appIds);
      if (apps.length === 0) return json({ erro: "Nenhum aplicativo Meta ativo configurado" }, 400);

      const results = await Promise.all(apps.map(async (app) => {
        try {
          return await syncPagesForApp(supabase, app);
        } catch (e) {
          return { app: app.label, erro: (e as Error).message };
        }
      }));
      const totalPages = results.reduce((s, r: any) => s + (r.pages || 0), 0);
      return json({
        sucesso: true,
        aplicativos: apps.length,
        paginas_sincronizadas: totalPages,
        por_aplicativo: results,
      });
    }

    // ===== Insights (account-level, app-agnostic — uses whichever token works) =====
    if (action === "sync_insights") {
      const apps = await loadActiveApps(supabase, appIds);
      if (apps.length === 0) return json({ erro: "Nenhum aplicativo Meta ativo configurado" }, 400);

      const yday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const since: string = body.since || body.date || yday;
      const until: string = body.until || body.date || yday;

      // Freshness check: if any active account hasn't been re-discovered in
      // the last 6h, run sync_accounts first. Meta occasionally drops accounts
      // from a BM's edges silently; without a fresh discovery we'd keep hitting
      // the API for accounts the token can no longer see (they return errors
      // and their spend never lands in the DB — the exact Quantum 05/09 bug).
      const staleCutoff = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
      const { count: staleCount } = await supabase
        .from("meta_ad_accounts")
        .select("id", { head: true, count: "exact" })
        .eq("status", "active")
        .or(`last_synced_at.is.null,last_synced_at.lt.${staleCutoff}`);
      const skipRefresh = body.skip_refresh === true;
      if (!skipRefresh && (staleCount || 0) > 0) {
        try {
          await Promise.all(apps.map((app) => syncAccountsForApp(supabase, app).catch(() => null)));
        } catch { /* discovery best-effort — insights still runs */ }
      }

      // Only pull insights for accounts that Meta will actually respond to.
      // Blocked/disabled accounts return errors that don't help the operator
      // and burn through the edge-function timeout for nothing.
      //
      // Regra:
      // - account_status = 1 (ACTIVE) — Meta responde normalmente.
      // - disable_reason ∈ {1,4,7,11,12,13,15} = banimento PERMANENTE
      //   (integridade, permanent_close, misrepresented, compromised).
      //   Nunca mais volta; não faz sentido bater na API.
      // - disable_reason = 3 (RISK_PAYMENT) NÃO é permanente — pode voltar
      //   assim que o cliente ajustar o meio de pagamento; mantemos fora do
      //   sync porque hoje retorna erro, mas expomos o rótulo na UI para
      //   diferenciar de banimento definitivo.
      const PERMANENT_DISABLE_REASONS = [1, 4, 7, 11, 12, 13, 15];
      const { data: accountsRaw, error: accErr } = await supabase
        .from("meta_ad_accounts")
        .select("id, meta_account_id, name, meta_app_id, status, account_status, disable_reason, last_synced_at")
        .eq("status", "active")
        .eq("account_status", 1)
        .or(
          `disable_reason.is.null,disable_reason.not.in.(${PERMANENT_DISABLE_REASONS.join(",")})`
        );
      if (accErr) throw accErr;

      let accounts = accountsRaw || [];

      // Skip accounts that weren't seen in the latest discovery run. If Meta
      // no longer returns them via /me/businesses edges, the token has lost
      // access — repeated insight calls will only produce errors.
      const freshnessCutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const staleAccounts = accounts.filter(
        (a: any) => !a.last_synced_at || a.last_synced_at < freshnessCutoff,
      );
      accounts = accounts.filter(
        (a: any) => a.last_synced_at && a.last_synced_at >= freshnessCutoff,
      );

      // Optional filter: only accounts that spent in the last 7 days.
      if (body.only_recent_spenders === true && accounts.length > 0) {
        const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const { data: recent, error: recErr } = await supabase
          .from("meta_ad_insights")
          .select("ad_account_id, spend")
          .gte("date", sevenAgo)
          .gt("spend", 0);
        if (recErr) throw recErr;
        const active = new Set((recent || []).map((r: any) => r.ad_account_id));
        accounts = accounts.filter((a: any) => active.has(a.id));
      }

      // Optional filter: explicit list of account ids (internal PK).
      if (Array.isArray(body.account_ids) && body.account_ids.length > 0) {
        const wanted = new Set(body.account_ids);
        accounts = accounts.filter((a: any) => wanted.has(a.id));
      }

      const purchasePriority = [
        "omni_purchase",
        "purchase",
        "offsite_conversion.fb_pixel_purchase",
      ];
      const pickByPriority = (arr: any[]) => {
        if (!arr || arr.length === 0) return 0;
        for (const t of purchasePriority) {
          const found = arr.find((a) => a.action_type === t);
          if (found) return Number(found.value || 0);
        }
        return 0;
      };

      // Group accounts by app so each request uses the correct token.
      const appTokens = new Map(apps.map((a) => [a.id, pickToken(a, "sync_insights")]));
      const fallbackToken = Array.from(appTokens.values()).find((t) => !!t) || "";

      const errors: any[] = [];
      const allRows: any[] = [];
      let idx = 0;
      const list = accounts || [];

      const worker = async () => {
        while (true) {
          const i = idx++;
          if (i >= list.length) return;
          const acc: any = list[i];
          const tok = (acc.meta_app_id && appTokens.get(acc.meta_app_id)) || fallbackToken;
          if (!tok) { errors.push({ account: acc.name, erro: "Sem token disponível" }); continue; }
          try {
            const data = await metaFetch(`/${acc.meta_account_id}/insights`, tok, {
              fields: "spend,impressions,clicks,cpm,cpc,ctr,reach,actions,action_values",
              time_range: JSON.stringify({ since, until }),
              level: "account",
              time_increment: "1",
              limit: "500",
            });
            for (const row of data.data || []) {
              allRows.push({
                ad_account_id: acc.id,
                date: row.date_start,
                spend: Number(row.spend || 0),
                impressions: Number(row.impressions || 0),
                clicks: Number(row.clicks || 0),
                cpm: Number(row.cpm || 0),
                cpc: Number(row.cpc || 0),
                ctr: Number(row.ctr || 0),
                reach: Number(row.reach || 0),
                actions: row.actions || null,
                purchases: pickByPriority(row.actions),
                revenue: pickByPriority(row.action_values),
              });
            }
          } catch (e) {
            errors.push({ account: acc.name, erro: (e as Error).message });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(8, list.length) }, worker));

      let totalRows = 0;
      const CHUNK = 500;
      for (let i = 0; i < allRows.length; i += CHUNK) {
        const chunk = allRows.slice(i, i + CHUNK);
        const { error } = await supabase
          .from("meta_ad_insights")
          .upsert(chunk, { onConflict: "ad_account_id,date" });
        if (error) throw error;
        totalRows += chunk.length;
      }

      return json({
        sucesso: true,
        since, until,
        aplicativos: apps.length,
        contas: list.length,
        linhas_upsertadas: totalRows,
        erros: errors,
        contas_stale: staleAccounts.length,
        contas_stale_nomes: staleAccounts.slice(0, 20).map((a: any) => a.name),
      });
    }

    return json({ erro: "action inválida. Use: sync_bms | sync_accounts | sync_pages | sync_insights | start_sync_accounts" }, 400);
  } catch (err) {
    return json({ erro: (err as Error).message }, 500);
  }
});
