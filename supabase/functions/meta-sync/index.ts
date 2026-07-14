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
const FETCH_TIMEOUT_MS = 8000;
const RETRY_ATTEMPTS = 2;
const JOB_TIMEOUT_MS = 45000;
const MAX_PAGINATION_PAGES = 30;
const META_RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);

// Pacing global — evita bursts que estouram o quota da Meta.
// Importante: precisa ser serializado. A versão anterior tinha corrida quando
// havia Promise.all/worker e várias chamadas passavam pelo mesmo lastRequestAt,
// gerando rajadas que consumiam 100% da cota do app em uma única sincronização.
const MIN_REQUEST_INTERVAL_MS = 1200;
let lastRequestAt = 0;
let requestPaceQueue = Promise.resolve();
async function paceRequest() {
  requestPaceQueue = requestPaceQueue.then(async () => {
    const now = Date.now();
    const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - now;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
  });
  await requestPaceQueue;
}

// Erro sintético lançado quando a Meta indica que o app/conta está muito
// próximo do limite. Tratado como rate-limit no motor de sync.
class MetaQuotaExceeded extends Error {
  code = 4;
  usage: number;
  regainSeconds: number;
  constructor(msg: string, usage = 0, regainSeconds = 0) {
    super(`Meta API error: {"code":4,"message":"${msg}"}`);
    this.name = "MetaQuotaExceeded";
    this.usage = usage;
    this.regainSeconds = regainSeconds;
  }
}

/** Extrai segundos de regain de uma mensagem de erro que pode vir da Meta
 *  ("(regain in 900s)") — usado para dimensionar cooldown por app. */
function extractRegainSeconds(err: unknown): number {
  if (err instanceof MetaQuotaExceeded && err.regainSeconds > 0) return err.regainSeconds;
  const msg = (err as Error)?.message || "";
  const m = msg.match(/regain in (\d+)s/i);
  return m ? parseInt(m[1], 10) : 0;
}

function parseUsageHeader(raw: string | null): number {
  if (!raw) return 0;
  try {
    const data = JSON.parse(raw);
    let max = 0;
    const walk = (v: any) => {
      if (v == null) return;
      if (typeof v === "number") { if (v > max) max = v; return; }
      if (Array.isArray(v)) { v.forEach(walk); return; }
      if (typeof v === "object") {
        for (const k of ["call_count", "total_cputime", "total_time", "acc_id_util_pct", "estimated_time_to_regain_access"]) {
          if (typeof v[k] === "number" && k !== "estimated_time_to_regain_access" && v[k] > max) max = v[k];
        }
        Object.values(v).forEach(walk);
      }
    };
    walk(data);
    return max;
  } catch { return 0; }
}

function parseRegainSeconds(raw: string | null): number {
  if (!raw) return 0;
  try {
    const data = JSON.parse(raw);
    let max = 0;
    const walk = (v: any) => {
      if (v == null) return;
      if (Array.isArray(v)) { v.forEach(walk); return; }
      if (typeof v === "object") {
        if (typeof v.estimated_time_to_regain_access === "number" && v.estimated_time_to_regain_access > max) {
          max = v.estimated_time_to_regain_access;
        }
        Object.values(v).forEach(walk);
      }
    };
    walk(data);
    return max;
  } catch { return 0; }
}

async function honorMetaUsageHeaders(res: Response) {
  const app = parseUsageHeader(res.headers.get("x-app-usage"));
  const buc = parseUsageHeader(res.headers.get("x-business-use-case-usage"));
  const acc = parseUsageHeader(res.headers.get("x-ad-account-usage"));
  const usage = Math.max(app, buc, acc);
  const regain = Math.max(
    parseRegainSeconds(res.headers.get("x-app-usage")),
    parseRegainSeconds(res.headers.get("x-business-use-case-usage")),
    parseRegainSeconds(res.headers.get("x-ad-account-usage")),
  );
  if (usage >= 90 || regain > 0) {
    throw new MetaQuotaExceeded(`Meta usage ${usage}% (regain in ${regain}s) — pausando app.`, usage, regain);
  }
  if (usage >= 75) {
    // desacelera exponencialmente ao se aproximar do teto
    const extra = Math.min(15000, Math.round((usage - 70) * 500));
    await new Promise((r) => setTimeout(r, extra));
  } else if (usage >= 50) {
    await new Promise((r) => setTimeout(r, 1500));
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} excedeu ${Math.round(ms / 1000)}s`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type BackoffInfo = { attempt: number; waitMs: number; reason: string };
let onBackoff: ((info: BackoffInfo) => void) | null = null;

type SyncStageEvent = {
  app: string;
  endpoint: string;
  status: "running" | "done" | "error" | "skipped";
  token?: string;
  detail?: string;
  found?: number;
};
type SyncReporter = (event: SyncStageEvent) => Promise<void> | void;

async function fetchWithRetry(url: string, init?: RequestInit, attempts = RETRY_ATTEMPTS): Promise<Response> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      await paceRequest();
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (res.status === 429 || res.status >= 500) {
        const wait = Math.min(10000, 1500 * Math.pow(2, i));
        onBackoff?.({ attempt: i + 1, waitMs: wait, reason: `HTTP ${res.status}` });
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      // Se a Meta indicar consumo crítico via headers, aborta com rate-limit
      // sintético — assim o motor de sync coloca o app em cooldown em vez de
      // continuar drenando a cota.
      try { await honorMetaUsageHeaders(res); } catch (quotaErr) { throw quotaErr; }
      const clone = res.clone();
      const data = await clone.json().catch(() => null);
      const code = data?.error?.code;
      const subcode = data?.error?.error_subcode;
      // Code #4 é quota global do app — retry só piora. Outros erros
      // transitórios podem se recuperar após uma espera curta.
      const transient = code !== 4 && (data?.error?.is_transient
        || [17, 32, 613].includes(code)
        || [2446079, 1487390, 1487742].includes(subcode));
      if (transient && i < attempts - 1) {
        const wait = Math.min(10000, 2000 * Math.pow(2, i));
        onBackoff?.({ attempt: i + 1, waitMs: wait, reason: `Meta code ${code} (rate limit)` });
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      return res;
    } catch (e) {
      // Não faz retry para quota sinalizada por header — devolve imediatamente
      // ao motor para aplicar cooldown.
      if (e instanceof MetaQuotaExceeded) throw e;
      lastErr = e;
      const wait = Math.min(8000, 1000 * Math.pow(2, i));
      const reason = (e as Error)?.name === "TimeoutError" ? "timeout Meta API" : "network error";
      onBackoff?.({ attempt: i + 1, waitMs: wait, reason });
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  if (lastErr) throw lastErr;
  await paceRequest();
  return fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
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
  let pages = 0;
  while (url) {
    pages++;
    if (pages > MAX_PAGINATION_PAGES) {
      throw new Error(`Meta API pagination limit reached (${MAX_PAGINATION_PAGES} pages)`);
    }
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

// Campos mínimos para descoberta rápida/leve. Evita puxar payment/funding,
// agencies e outros dados pesados quando a meta é apenas detectar contas novas.
const LIGHT_ACCOUNT_FIELDS = [
  "id","account_id","name","account_status","currency","amount_spent",
  "timezone_name","created_time","disable_reason","business",
].join(",");

const accountFieldsForMode = (mode?: SyncMode) => mode === "deep" ? ACCOUNT_FIELDS : LIGHT_ACCOUNT_FIELDS;

type SyncMode = "light" | "deep";

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

// Policy: use the personal profile User Token as the primary token for BM +
// account discovery/insights. The System User token is only tried as a fallback
// when the user token is missing/empty — user tokens reflect the exact set of
// ad accounts assigned to the connected profile and avoid System User role
// gaps in BMs that don't own the account.
function pickToken(app: AppRow, _action: string): string {
  const sys = (app.system_user_token || "").replace(/\s+/g, "").trim();
  const usr = (app.user_access_token || "").replace(/\s+/g, "").trim();
  return usr || sys;
}

function tokenCandidates(apps: AppRow[], preferredAppId?: string | null): string[] {
  const ordered = preferredAppId
    ? [...apps.filter((a) => a.id === preferredAppId), ...apps.filter((a) => a.id !== preferredAppId)]
    : apps;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const app of ordered) {
    const sys = (app.system_user_token || "").replace(/\s+/g, "").trim();
    const usr = (app.user_access_token || "").replace(/\s+/g, "").trim();
    for (const tok of [usr, sys]) {
      if (tok && !seen.has(tok)) {
        seen.add(tok);
        out.push(tok);
      }
    }
  }
  return out;
}

function tokenChoicesForApp(app: AppRow): { token: string; label: string }[] {
  const sys = (app.system_user_token || "").replace(/\s+/g, "").trim();
  const usr = (app.user_access_token || "").replace(/\s+/g, "").trim();
  const seen = new Set<string>();
  const out: { token: string; label: string }[] = [];
  for (const item of [
    { token: usr, label: "Usuário" },
    { token: sys, label: "System User" },
  ]) {
    if (item.token && !seen.has(item.token)) {
      seen.add(item.token);
      out.push(item);
    }
  }
  return out;
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

async function syncAccountsForApp(supabase: any, app: AppRow, report?: SyncReporter) {
  const choices = tokenChoicesForApp(app);
  if (choices.length === 0) return { app: app.label, erro: "Sem token configurado" };

  const errors: any[] = [];
  const allAccounts: any[] = [];
  const bmsById = new Map<string, any>();
  const bmStatusMap = new Map<string, string | null>();

  const reportStage = async (
    endpoint: string,
    status: SyncStageEvent["status"],
    token?: string,
    detail?: string,
    found?: number,
  ) => {
    await report?.({ app: app.label, endpoint, status, token, detail, found });
  };

  const rememberBms = (bms: any[]) => {
    for (const bm of bms || []) {
      if (!bm?.id) continue;
      bmsById.set(bm.id, bm);
      bmStatusMap.set(bm.id, bm.verification_status || null);
    }
  };

  const pullBmAccounts = async (
    token: string,
    tokenLabel: string,
    bms: any[],
    recordErrors = true,
  ) => {
    const tasks: { bmId: string; bmName: string; edge: string }[] = [];
    for (const bm of bms) {
      if (!bm?.id) continue;
      for (const e of ["owned_ad_accounts", "client_ad_accounts"]) {
        tasks.push({ bmId: bm.id, bmName: bm.name || bm.id, edge: e });
      }
    }

    let cursor = 0;
    const worker = async () => {
      while (true) {
        const i = cursor++;
        if (i >= tasks.length) return;
        const t = tasks[i];
        const url = `${META_API}/${t.bmId}/${t.edge}?access_token=${encodeURIComponent(token)}&fields=${ACCOUNT_FIELDS}&limit=200`;
        try {
          const items = await paginateMeta(url);
          for (const acc of items) allAccounts.push({ ...acc, _bm_meta_id: t.bmId, _source_token: token });
        } catch (e) {
          if (recordErrors) errors.push({ app: app.label, token: tokenLabel, bm: t.bmName, edge: t.edge, erro: (e as Error).message });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(1, tasks.length) }, worker));
  };

  const pullSystemUserAssignedAccounts = async (
    token: string,
    tokenLabel: string,
    bms: any[],
    recordErrors = true,
  ) => {
    const systemUsers: { id: string; name: string; bmId: string; bmName: string }[] = [];
    let bmCursor = 0;
    const bmWorker = async () => {
      while (true) {
        const i = bmCursor++;
        if (i >= bms.length) return;
        const bm = bms[i];
        if (!bm?.id) continue;
        try {
          const users = await paginateMeta(
            `${META_API}/${bm.id}/system_users?access_token=${encodeURIComponent(token)}&fields=id,name,role&limit=200`,
          );
          for (const su of users) {
            if (su?.id) systemUsers.push({ id: su.id, name: su.name || su.id, bmId: bm.id, bmName: bm.name || bm.id });
          }
        } catch (e) {
          if (recordErrors) errors.push({ app: app.label, token: tokenLabel, bm: bm.name || bm.id, edge: "system_users", erro: (e as Error).message });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(1, bms.length) }, bmWorker));

    const seenSystemUsers = new Set<string>();
    const uniqueSystemUsers = systemUsers.filter((su) => {
      if (seenSystemUsers.has(su.id)) return false;
      seenSystemUsers.add(su.id);
      return true;
    });

    let suCursor = 0;
    const suWorker = async () => {
      while (true) {
        const i = suCursor++;
        if (i >= uniqueSystemUsers.length) return;
        const su = uniqueSystemUsers[i];
        try {
          const items = await paginateMeta(
            `${META_API}/${su.id}/assigned_ad_accounts?access_token=${encodeURIComponent(token)}&fields=${ACCOUNT_FIELDS}&limit=200`,
          );
          for (const acc of items) {
            allAccounts.push({ ...acc, _bm_meta_id: acc.business?.id || su.bmId, _source_token: token });
          }
        } catch (e) {
          if (recordErrors) errors.push({ app: app.label, token: tokenLabel, bm: su.bmName, edge: `system_user:${su.name}`, erro: (e as Error).message });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(1, uniqueSystemUsers.length) }, suWorker));
  };

  for (const choice of choices) {
    let bms: any[] = [];
    await reportStage("/me/businesses", "running", choice.label, "Varrendo BMs do perfil");
    try {
      bms = await paginateMeta(
        `${META_API}/me/businesses?access_token=${encodeURIComponent(choice.token)}&fields=id,name,verification_status&limit=200`
      );
      rememberBms(bms);
      await reportStage("/me/businesses", "done", choice.label, `${bms.length} BM(s) encontradas`, bms.length);
    } catch (e) {
      const msg = (e as Error).message;
      errors.push({ app: app.label, token: choice.label, bm: "-", edge: "/me/businesses", erro: msg });
      await reportStage("/me/businesses", "error", choice.label, msg);
    }

    // Do NOT early-return when bms is empty: a System User token may have
    // asset-level access only (no BM employee role), and accounts must still
    // be discovered via direct account edges and the fallback user token.
    const beforeBmAccounts = allAccounts.length;
    await reportStage("BM ad accounts", "running", choice.label, `Varrendo owned_ad_accounts/client_ad_accounts em ${bms.length} BM(s)`);
    await pullBmAccounts(choice.token, choice.label, bms);
    await reportStage("BM ad accounts", "done", choice.label, `${allAccounts.length - beforeBmAccounts} conta(s) via BMs`, allAccounts.length - beforeBmAccounts);

    const beforeSystemUser = allAccounts.length;
    await reportStage("/system_users/assigned_ad_accounts", "running", choice.label, "Varrendo contas atribuídas a system users das BMs");
    await pullSystemUserAssignedAccounts(choice.token, choice.label, bms, false);
    await reportStage("/system_users/assigned_ad_accounts", "done", choice.label, `${allAccounts.length - beforeSystemUser} conta(s) via system users`, allAccounts.length - beforeSystemUser);

    await reportStage("/me/adaccounts", "running", choice.label, "Varrendo contas diretamente acessíveis");
    try {
      const meAccounts = await paginateMeta(
        `${META_API}/me/adaccounts?access_token=${encodeURIComponent(choice.token)}&fields=${ACCOUNT_FIELDS}&limit=200`,
      );
      for (const acc of meAccounts) {
        allAccounts.push({ ...acc, _bm_meta_id: acc.business?.id || null, _source_token: choice.token });
      }
      await reportStage("/me/adaccounts", "done", choice.label, `${meAccounts.length} conta(s) encontradas`, meAccounts.length);
    } catch (e) {
      const msg = (e as Error).message;
      errors.push({ app: app.label, token: choice.label, bm: "-", edge: "/me/adaccounts", erro: msg });
      await reportStage("/me/adaccounts", "error", choice.label, msg);
    }

    // This edge behaves differently for user tokens and system-user tokens, so
    // try both /me/assigned_ad_accounts and /{me.id}/assigned_ad_accounts.
    await reportStage("/me/assigned_ad_accounts", "running", choice.label, "Varrendo contas atribuídas ao usuário/token");
    try {
      const assigned = await paginateMeta(
        `${META_API}/me/assigned_ad_accounts?access_token=${encodeURIComponent(choice.token)}&fields=${ACCOUNT_FIELDS}&limit=200`,
      );
      for (const acc of assigned) {
        allAccounts.push({ ...acc, _bm_meta_id: acc.business?.id || null, _source_token: choice.token });
      }
      await reportStage("/me/assigned_ad_accounts", "done", choice.label, `${assigned.length} conta(s) encontradas`, assigned.length);
    } catch (e) {
      await reportStage("/me/assigned_ad_accounts", "skipped", choice.label, (e as Error).message);
    }

    await reportStage("/{me.id}/assigned_ad_accounts", "running", choice.label, "Resolvendo ID do token e varrendo atribuições diretas");
    try {
      const me = await metaFetch("/me", choice.token, { fields: "id,name" });
      if (me?.id) {
        const assignedByNode = await paginateMeta(
          `${META_API}/${me.id}/assigned_ad_accounts?access_token=${encodeURIComponent(choice.token)}&fields=${ACCOUNT_FIELDS}&limit=200`,
        );
        for (const acc of assignedByNode) {
          allAccounts.push({ ...acc, _bm_meta_id: acc.business?.id || null, _source_token: choice.token });
        }
        await reportStage("/{me.id}/assigned_ad_accounts", "done", choice.label, `${assignedByNode.length} conta(s) encontradas`, assignedByNode.length);
      } else {
        await reportStage("/{me.id}/assigned_ad_accounts", "skipped", choice.label, "Token sem ID retornado em /me");
      }
    } catch (e) {
      await reportStage("/{me.id}/assigned_ad_accounts", "skipped", choice.label, (e as Error).message);
    }
  }

  const ownAppId = app.id.startsWith("00000000") ? null : app.id;
  const bms = Array.from(bmsById.values());
  await reportStage("Salvar BMs", "running", undefined, `${bms.length} BM(s) para salvar`);
  if (bms.length > 0) {
    const bmRows = bms.map((bm: any) => ({
      meta_bm_id: bm.id,
      name: bm.name,
      status: bm.verification_status || "active",
      verification_status: bm.verification_status || null,
      meta_app_id: ownAppId,
      last_synced_at: new Date().toISOString(),
    }));
    await supabase.from("meta_business_managers").upsert(bmRows, { onConflict: "meta_bm_id" });
  }
  await reportStage("Salvar BMs", "done", undefined, `${bms.length} BM(s) salvas`, bms.length);

  const { data: bmsDb } = await supabase.from("meta_business_managers").select("id, meta_bm_id");
  const bmIdMap = new Map<string, string>((bmsDb || []).map((b: any) => [String(b.meta_bm_id), String(b.id)]));

  // Auto-upsert any BM referenced by direct account edges that we didn't get
  // from /me/businesses — otherwise bmIdMap lookup fails and bm_id ends up null.
  const knownBmIds = new Set(bms.map((b: any) => b.id));
  const extraBmIds = new Set<string>();
  const extraBmNames = new Map<string, string>();
  const extraBmToken = new Map<string, string>();
  for (const acc of allAccounts) {
    const bid = acc._bm_meta_id;
    if (bid && !knownBmIds.has(bid)) {
      extraBmIds.add(bid);
      extraBmNames.set(bid, acc.business?.name || bid);
      if (acc._source_token && !extraBmToken.has(bid)) extraBmToken.set(bid, acc._source_token);
    }
  }
  if (extraBmIds.size > 0) {
    const extraRows = Array.from(extraBmIds).map((bid) => ({
      meta_bm_id: bid,
      name: extraBmNames.get(bid) || bid,
      status: "active",
      meta_app_id: ownAppId,
      last_synced_at: new Date().toISOString(),
    }));
    await supabase.from("meta_business_managers").upsert(extraRows, { onConflict: "meta_bm_id" });
    const { data: refreshed } = await supabase
      .from("meta_business_managers")
      .select("id, meta_bm_id")
      .in("meta_bm_id", Array.from(extraBmIds));
    for (const b of refreshed || []) bmIdMap.set(b.meta_bm_id, b.id);

    // Second discovery pass: for BMs surfaced via direct account edges, scan
    // owned_ad_accounts + client_ad_accounts with the token that found that BM.
    const extraTasks = Array.from(extraBmIds)
      .map((bid) => ({ id: bid, name: extraBmNames.get(bid) || bid, verification_status: null, _token: extraBmToken.get(bid) }))
      .filter((bm) => !!bm._token);
    for (const bm of extraTasks) {
      const beforeFallback = allAccounts.length;
      await reportStage("Fallback BM ad accounts", "running", "Fallback", `Varrendo BM descoberta: ${bm.name}`);
      await pullBmAccounts(bm._token as string, "Fallback", [bm], false);
      await pullSystemUserAssignedAccounts(bm._token as string, "Fallback", [bm], false);
      await reportStage("Fallback BM ad accounts", "done", "Fallback", `${allAccounts.length - beforeFallback} conta(s) adicionais`, allAccounts.length - beforeFallback);
    }
  }

  const accountCompleteness = (acc: any) => {
    let score = 0;
    if (acc._bm_meta_id) score += 10;
    if (acc.business?.id) score += 10;
    if (acc.business?.name) score += 10;
    if (Array.isArray(acc.agencies?.data) && acc.agencies.data.length) score += 5;
    if (acc.account_status != null) score += 3;
    if (acc.amount_spent != null) score += 2;
    return score;
  };
  const byAccountId = new Map<string, any>();
  for (const acc of allAccounts) {
    if (!acc?.id) continue;
    const current = byAccountId.get(acc.id);
    if (!current || accountCompleteness(acc) > accountCompleteness(current)) {
      byAccountId.set(acc.id, acc);
    }
  }
  const unique = Array.from(byAccountId.values());

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
      meta_app_id: ownAppId,
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
  await reportStage("Salvar contas", "running", undefined, `${accRows.length} conta(s) únicas para salvar`);
  for (let i = 0; i < accRows.length; i += CHUNK) {
    const { error } = await supabase.from("meta_ad_accounts")
      .upsert(accRows.slice(i, i + CHUNK), { onConflict: "meta_account_id" });
    if (error) throw error;
  }
  await reportStage("Salvar contas", "done", undefined, `${accRows.length} conta(s) salvas`, accRows.length);

  return { app: app.label, bms: bms.length + extraBmIds.size, accounts: accRows.length, erros: errors };
}

async function syncLightAccountsForApp(supabase: any, app: AppRow) {
  const choice = directTokenChoicesForApp(app)[0];
  if (!choice) return { app: app.label, bms: 0, accounts: 0, erros: [{ erro: "Sem token configurado" }] };
  const items = await paginateMeta(
    `${META_API}/me/adaccounts?access_token=${encodeURIComponent(choice.token)}&fields=${LIGHT_ACCOUNT_FIELDS}&limit=100`,
  );
  const saved = await saveDiscoveredAccounts(
    supabase,
    app,
    items.map((acc: any) => ({ ...acc, _bm_meta_id: acc.business?.id || null, _source_token: choice.token })),
    "light",
  );
  return { app: app.label, bms: 0, accounts: saved, erros: [] };
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
  const bmIdMap = new Map<string, string>((bmsDb || []).map((b: any) => [String(b.meta_bm_id), String(b.id)]));

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

// ---- Resumable account sync ---------------------------------------------------
// The old account sync could exceed the edge runtime wall-clock limit when a
// profile had many BMs/accounts. This worker processes one small slice at a
// time, persists its cursor in meta_sync_jobs.errors, and invokes itself again
// until every endpoint has been scanned.

type AccountsSyncState = {
  kind: "state";
  version: 2;
  mode?: SyncMode;
  appIndex: number;
  choiceIndex: number;
  phase: "me_businesses" | "bm_edges" | "bm_system_users" | "me_adaccounts" | "me_assigned" | "me_id_assigned";
  bmIndex: number;
  edgeIndex: number;
  syncedCount: number;
  completedStages: number;
  totalStages: number;
  loops: number;
  systemUsers?: { id: string; name: string; bmId: string; bmName: string }[];
  systemUsersBmId?: string;
  systemUserIndex?: number;
  /** Timestamp (ms) até quando cada app está em cooldown por rate-limit. */
  appCooldownUntil?: Record<string, number>;
  /** Passo leve executado no início para contas novas aparecerem antes da varredura pesada de BMs. */
  fastPassDone?: boolean;
  fastAppIndex?: number;
  fastChoiceIndex?: number;
  fastEndpointIndex?: number;
  /** Cursores de varredura profunda: só algumas BMs antigas por execução. */
  deepBmAppIndex?: number;
  deepBmChoiceIndex?: number;
  deepBmIndex?: number;
  deepBmEdgeIndex?: number;
  lightBmScanned?: number;
};

const RESUMABLE_SLICE_MS = 18000;
const MAX_STAGE_EVENTS = 140;
const BM_ACCOUNT_EDGES = ["owned_ad_accounts", "client_ad_accounts"];
const LIGHT_BM_SCAN_LIMIT_PER_JOB = 3;
// A descoberta rápida de /me/adaccounts e /me/assigned_ad_accounts roda antes
// da varredura pesada. Depois daqui ficam só etapas caras/estruturais.
const ACCOUNT_PHASES: AccountsSyncState["phase"][] = [
  "me_businesses",
  "bm_edges",
  "bm_system_users",
];
const DIRECT_ACCOUNT_PHASES_LIGHT: AccountsSyncState["phase"][] = [
  "me_adaccounts",
];
const DIRECT_ACCOUNT_PHASES_DEEP: AccountsSyncState["phase"][] = [
  "me_adaccounts",
  "me_assigned",
  "me_id_assigned",
];
const directAccountPhasesForMode = (mode?: SyncMode) => mode === "deep" ? DIRECT_ACCOUNT_PHASES_DEEP : DIRECT_ACCOUNT_PHASES_LIGHT;

function directTokenChoicesForApp(app: AppRow): { token: string; label: string }[] {
  const sys = (app.system_user_token || "").replace(/\s+/g, "").trim();
  const usr = (app.user_access_token || "").replace(/\s+/g, "").trim();
  const seen = new Set<string>();
  const out: { token: string; label: string }[] = [];
  // Para contas adicionadas no perfil, o token de usuário costuma enxergar a
  // novidade primeiro. System User continua como fallback sem duplicar token.
  for (const item of [
    { token: usr, label: "Usuário" },
    { token: sys, label: "System User" },
  ]) {
    if (item.token && !seen.has(item.token)) {
      seen.add(item.token);
      out.push(item);
    }
  }
  return out;
}

function initialAccountsSyncState(apps: AppRow[]): AccountsSyncState {
  const baseStages = apps.reduce((sum, app) => {
    const fastStages = Math.max(1, directTokenChoicesForApp(app).length) * DIRECT_ACCOUNT_PHASES_LIGHT.length;
    return sum + fastStages;
  }, 0);
  return {
    kind: "state",
    version: 2,
    mode: "light",
    appIndex: 0,
    choiceIndex: 0,
    phase: "me_businesses",
    bmIndex: 0,
    edgeIndex: 0,
    syncedCount: 0,
    completedStages: 0,
    totalStages: Math.max(baseStages, 1),
    loops: 0,
    fastPassDone: false,
    fastAppIndex: 0,
    fastChoiceIndex: 0,
    fastEndpointIndex: 0,
    deepBmAppIndex: 0,
    deepBmChoiceIndex: 0,
    deepBmIndex: 0,
    deepBmEdgeIndex: 0,
  };
}

function splitJobErrors(raw: any[], apps: AppRow[]) {
  const rows = Array.isArray(raw) ? raw : [];
  const state = rows.find((e: any) => e?.kind === "state" && e?.version === 2) as AccountsSyncState | undefined;
  const stageEvents = rows.filter((e: any) => e?.kind === "stage");
  const actualErrors = rows.filter((e: any) => e?.kind !== "state" && e?.kind !== "stage");
  return {
    state: state || initialAccountsSyncState(apps),
    stageEvents,
    actualErrors,
  };
}

function upsertStageEvent(stageEvents: any[], event: SyncStageEvent) {
  const key = `${event.app}|${event.token || "-"}|${event.endpoint}`;
  const item = {
    kind: "stage",
    key,
    app: event.app,
    endpoint: event.endpoint,
    status: event.status,
    token: event.token || null,
    detail: event.detail || null,
    found: event.found ?? null,
    at: new Date().toISOString(),
  };
  const existing = stageEvents.findIndex((s: any) => s.key === key);
  if (existing >= 0) stageEvents[existing] = item;
  else stageEvents.push(item);
  return item;
}

function phaseLabel(phase: AccountsSyncState["phase"]) {
  if (phase === "me_businesses") return "/me/businesses";
  if (phase === "bm_edges") return "BM ad accounts";
  if (phase === "bm_system_users") return "/system_users/assigned_ad_accounts";
  if (phase === "me_adaccounts") return "/me/adaccounts";
  if (phase === "me_assigned") return "/me/assigned_ad_accounts";
  return "/{me.id}/assigned_ad_accounts";
}

function extractMetaErrorPayload(message: string): any | null {
  const idx = message.indexOf("{");
  if (idx < 0) return null;
  try { return JSON.parse(message.slice(idx)); } catch { return null; }
}

function metaErrorCodeFromText(message: string): number | null {
  const payload = extractMetaErrorPayload(message);
  const code = Number(payload?.code ?? payload?.error?.code);
  return Number.isFinite(code) ? code : null;
}

function metaErrorCode(error: unknown): number | null {
  return metaErrorCodeFromText((error as Error)?.message || String(error || ""));
}

function isMetaRateLimit(error: unknown) {
  const code = metaErrorCode(error);
  return code != null && META_RATE_LIMIT_CODES.has(code);
}

function isMetaPermissionDenied(error: unknown) {
  const code = metaErrorCode(error);
  return code === 10 || code === 100 || code === 190 || code === 200;
}

function nextChoiceOrApp(state: AccountsSyncState, choicesLength: number) {
  state.phase = ACCOUNT_PHASES[0];
  state.bmIndex = 0;
  state.edgeIndex = 0;
  state.systemUsers = undefined;
  state.systemUsersBmId = undefined;
  state.systemUserIndex = 0;
  state.choiceIndex += 1;
  if (state.choiceIndex >= choicesLength) {
    state.choiceIndex = 0;
    state.appIndex += 1;
  }
}

/** Coloca o app atual em cooldown por N minutos e avança para o próximo,
 *  evitando esgotar as demais chamadas quando a Meta já sinalizou rate-limit. */
function cooldownCurrentApp(state: AccountsSyncState, appLabel: string, seconds?: number) {
  state.appCooldownUntil = state.appCooldownUntil || {};
  // Respeita o `estimated_time_to_regain_access` da Meta quando disponível
  // (limita entre 60s e 60min para não ficar cooldown eterno nem curto demais).
  const secs = Math.min(3600, Math.max(60, seconds || 300));
  state.appCooldownUntil[appLabel] = Date.now() + secs * 1000;
  state.phase = ACCOUNT_PHASES[0];
  state.bmIndex = 0;
  state.edgeIndex = 0;
  state.choiceIndex = 0;
  state.systemUsers = undefined;
  state.systemUsersBmId = undefined;
  state.systemUserIndex = 0;
  state.appIndex += 1;
}

function markAppCooldown(state: AccountsSyncState, appLabel: string, seconds?: number) {
  state.appCooldownUntil = state.appCooldownUntil || {};
  const secs = Math.min(3600, Math.max(60, seconds || 300));
  state.appCooldownUntil[appLabel] = Date.now() + secs * 1000;
}

function nextPhase(state: AccountsSyncState) {
  const idx = ACCOUNT_PHASES.indexOf(state.phase);
  state.completedStages += 1;
  state.bmIndex = 0;
  state.edgeIndex = 0;
  state.systemUsers = undefined;
  state.systemUsersBmId = undefined;
  state.systemUserIndex = 0;
  if (idx < ACCOUNT_PHASES.length - 1) {
    state.phase = ACCOUNT_PHASES[idx + 1];
    return;
  }
  state.phase = ACCOUNT_PHASES[0];
  state.choiceIndex += 1;
}

function normalizeAccountRows(app: AppRow, accounts: any[], bmIdMap: Map<string, any>, bmStatusMap: Map<string, string | null>) {
  const ownAppId = app.id.startsWith("00000000") ? null : app.id;
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

  const seen = new Set<string>();
  return accounts
    .filter((acc: any) => acc?.id && !seen.has(acc.id) && (seen.add(acc.id), true))
    .map((acc: any) => {
      const { score, label } = computeScore(acc);
      return {
        meta_account_id: acc.id,
        bm_id: bmIdMap.get(acc._bm_meta_id)?.id || null,
        meta_app_id: ownAppId,
        name: acc.name || acc.account_id || acc.id,
        account_status: acc.account_status ?? null,
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
}

async function saveDiscoveredAccounts(supabase: any, app: AppRow, accounts: any[], mode: SyncMode = "deep") {
  if (!accounts.length) return 0;
  const ownAppId = app.id.startsWith("00000000") ? null : app.id;
  const metaBmIds = new Set<string>();
  const bmNames = new Map<string, string>();
  for (const acc of accounts) {
    const bid = acc._bm_meta_id || acc.business?.id;
    if (!bid) continue;
    acc._bm_meta_id = bid;
    metaBmIds.add(bid);
    bmNames.set(bid, acc.business?.name || bid);
  }

  if (metaBmIds.size > 0) {
    const bmRows = Array.from(metaBmIds).map((bid) => ({
      meta_bm_id: bid,
      name: bmNames.get(bid) || bid,
      status: "active",
      meta_app_id: ownAppId,
    }));
    const { error } = await supabase.from("meta_business_managers").upsert(bmRows, { onConflict: "meta_bm_id" });
    if (error) throw error;
  }

  let bmsDb: any[] = [];
  if (metaBmIds.size > 0) {
    const { data, error: bmErr } = await supabase
      .from("meta_business_managers")
      .select("id, meta_bm_id, verification_status")
      .in("meta_bm_id", Array.from(metaBmIds));
    if (bmErr) throw bmErr;
    bmsDb = data || [];
  }
  const bmIdMap = new Map((bmsDb || []).map((b: any) => [b.meta_bm_id, b]));
  const bmStatusMap = new Map((bmsDb || []).map((b: any) => [b.meta_bm_id, b.verification_status || null]));
  const rows = normalizeAccountRows(app, accounts, bmIdMap, bmStatusMap);
  const upsertRows = mode === "light"
    ? rows.map((row: any) => ({
        meta_account_id: row.meta_account_id,
        bm_id: row.bm_id,
        meta_app_id: row.meta_app_id,
        name: row.name,
        account_status: row.account_status,
        status: row.status,
        currency: row.currency,
        amount_spent: row.amount_spent,
        timezone_name: row.timezone_name,
        account_created_time: row.account_created_time,
        disable_reason: row.disable_reason,
        disable_reason_label: row.disable_reason_label,
        owner_business_name: row.owner_business_name,
        owner_business_id: row.owner_business_id,
        score: row.score,
        score_label: row.score_label,
        last_synced_at: row.last_synced_at,
      }))
    : rows;
  for (let i = 0; i < upsertRows.length; i += 200) {
    const { error } = await supabase.from("meta_ad_accounts").upsert(upsertRows.slice(i, i + 200), { onConflict: "meta_account_id" });
    if (error) throw error;
  }
  return rows.length;
}

async function activeBmsForApp(supabase: any, app: AppRow) {
  const ownAppId = app.id.startsWith("00000000") ? null : app.id;
  let q = supabase
    .from("meta_business_managers")
    .select("id, meta_bm_id, name, verification_status, last_synced_at")
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .order("name");
  q = ownAppId ? q.eq("meta_app_id", ownAppId) : q;
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function markBmAccountsScanned(supabase: any, bmDbId: string) {
  const { count } = await supabase
    .from("meta_ad_accounts")
    .select("id", { head: true, count: "exact" })
    .eq("bm_id", bmDbId);
  await supabase
    .from("meta_business_managers")
    .update({
      last_synced_at: new Date().toISOString(),
      account_count: count ?? 0,
    })
    .eq("id", bmDbId);
}

async function invokeNextAccountsSlice(jobId: string, appIds?: string[]) {
  const baseUrl = Deno.env.get("SUPABASE_URL");
  if (!baseUrl) return;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const internalSecret = Deno.env.get("N8N_SECRET_KEY") || "";
  if (internalSecret) headers["x-internal-secret"] = internalSecret;
  else headers.Authorization = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}`;
  const response = await fetch(`${baseUrl}/functions/v1/meta-sync`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "continue_sync_accounts", job_id: jobId, app_ids: appIds }),
  }).catch(() => null);
  if (response) await response.text().catch(() => null);
}

async function runAccountsSyncJobResumable(supabase: any, jobId: string, appIds?: string[], mode?: SyncMode) {
  const updateJob = async (patch: Record<string, any>) => {
    await supabase.from("meta_sync_jobs").update(patch).eq("id", jobId);
  };

  const { data: job, error: jobErr } = await supabase
    .from("meta_sync_jobs")
    .select("id, status, errors")
    .eq("id", jobId)
    .maybeSingle();
  if (jobErr) throw jobErr;
  if (!job || !["pending", "running"].includes(job.status)) return;

  const apps = await loadActiveApps(supabase, appIds);
  if (apps.length === 0) {
    await updateJob({ status: "failed", finished_at: new Date().toISOString(), message: "Nenhum aplicativo Meta ativo." });
    return;
  }

  const { state, stageEvents, actualErrors } = splitJobErrors(job.errors || [], apps);
  if (mode && state.loops === 0) state.mode = mode;
  state.loops += 1;
  const deadline = Date.now() + RESUMABLE_SLICE_MS;

  const persist = async (event?: SyncStageEvent) => {
    if (event) upsertStageEvent(stageEvents, event);
    const statusLabel = event?.status === "running" ? "Varrendo" : event?.status === "done" ? "Concluído" : event?.status === "error" ? "Erro" : event?.status === "skipped" ? "Ignorado" : "Sincronizando";
    const message = event
      ? `${statusLabel} ${event.endpoint}${event.token ? ` (${event.token})` : ""}${event.detail ? ` — ${event.detail}` : ""}`
      : "Sincronização em andamento...";
    await updateJob({
      status: "running",
      started_at: new Date().toISOString(),
      progress_current: Math.min(state.completedStages, state.totalStages),
      progress_total: Math.max(state.totalStages, state.completedStages + 1),
      synced_count: state.syncedCount,
      message,
      errors: [state, ...stageEvents.slice(-MAX_STAGE_EVENTS), ...actualErrors.slice(-40)],
    });
  };

  await persist();

  while (!state.fastPassDone && Date.now() < deadline) {
    const fastAppIndex = state.fastAppIndex || 0;
    if (fastAppIndex >= apps.length) {
      state.fastPassDone = true;
      await persist({ app: "Meta", endpoint: "descoberta rápida", status: "done", detail: "Contas diretas verificadas; iniciando varredura estrutural das BMs" });
      break;
    }

    const currentApp = apps[fastAppIndex];
    const cooldownTs = state.appCooldownUntil?.[currentApp.label] || 0;
    if (cooldownTs && Date.now() < cooldownTs) {
      const remainingMin = Math.ceil((cooldownTs - Date.now()) / 60000);
      await persist({ app: currentApp.label, endpoint: "descoberta rápida", status: "skipped", detail: `Em cooldown por ${remainingMin} min (quota Meta atingida)` });
      state.fastAppIndex = fastAppIndex + 1;
      state.fastChoiceIndex = 0;
      state.fastEndpointIndex = 0;
      continue;
    }

    const choices = (state.mode || "light") === "deep"
      ? directTokenChoicesForApp(currentApp)
      : directTokenChoicesForApp(currentApp).slice(0, 1);
    if (choices.length === 0) {
      actualErrors.push({ app: currentApp.label, erro: "Sem token configurado" });
      state.completedStages += 1;
      state.fastAppIndex = fastAppIndex + 1;
      await persist({ app: currentApp.label, endpoint: "tokens", status: "error", detail: "Sem token configurado" });
      continue;
    }

    const choiceIndex = state.fastChoiceIndex || 0;
    const endpointIndex = state.fastEndpointIndex || 0;
    const choice = choices[choiceIndex] || choices[0];
    const directPhases = directAccountPhasesForMode(state.mode);
    const phase = directPhases[endpointIndex] || directPhases[0];
    const endpoint = phaseLabel(phase);

    const advanceFastPass = () => {
      state.fastEndpointIndex = (state.fastEndpointIndex || 0) + 1;
      if (state.fastEndpointIndex >= directPhases.length) {
        state.fastEndpointIndex = 0;
        state.fastChoiceIndex = (state.fastChoiceIndex || 0) + 1;
        if (state.fastChoiceIndex >= choices.length) {
          state.fastChoiceIndex = 0;
          state.fastAppIndex = (state.fastAppIndex || 0) + 1;
        }
      }
    };

    try {
      await persist({ app: currentApp.label, endpoint, status: "running", token: choice.label, detail: "Descoberta rápida de contas novas" });
      let items: any[] = [];
      if (phase === "me_adaccounts") {
        items = await paginateMeta(`${META_API}/me/adaccounts?access_token=${encodeURIComponent(choice.token)}&fields=${LIGHT_ACCOUNT_FIELDS}&limit=100`);
      } else if (phase === "me_assigned") {
        items = await paginateMeta(`${META_API}/me/assigned_ad_accounts?access_token=${encodeURIComponent(choice.token)}&fields=${LIGHT_ACCOUNT_FIELDS}&limit=100`);
      } else {
        const me = await metaFetch("/me", choice.token, { fields: "id,name" });
        items = me?.id
          ? await paginateMeta(`${META_API}/${me.id}/assigned_ad_accounts?access_token=${encodeURIComponent(choice.token)}&fields=${LIGHT_ACCOUNT_FIELDS}&limit=100`)
          : [];
      }
      const saved = await saveDiscoveredAccounts(supabase, currentApp, items.map((acc: any) => ({ ...acc, _bm_meta_id: acc.business?.id || null, _source_token: choice.token })), "light");
      state.syncedCount += saved;
      state.completedStages += 1;
      advanceFastPass();
      await persist({ app: currentApp.label, endpoint, status: "done", token: choice.label, detail: `${saved} conta(s) salvas`, found: saved });
    } catch (e) {
      const msg = (e as Error).message;
      if (isMetaRateLimit(e)) {
        actualErrors.push({ app: currentApp.label, token: choice.label, edge: endpoint, erro: msg, code: metaErrorCode(e) });
        markAppCooldown(state, currentApp.label, extractRegainSeconds(e));
        state.fastAppIndex = fastAppIndex + 1;
        state.fastChoiceIndex = 0;
        state.fastEndpointIndex = 0;
        await persist({ app: currentApp.label, endpoint, status: "error", token: choice.label, detail: "Limite da API Meta atingido; descoberta rápida pausada." });
      } else {
        state.completedStages += 1;
        advanceFastPass();
        await persist({ app: currentApp.label, endpoint, status: "skipped", token: choice.label, detail: msg });
      }
    }
  }

  if (!state.fastPassDone) {
    const fastApp = apps[state.fastAppIndex || 0] || apps[0];
    const directPhases = directAccountPhasesForMode(state.mode);
    const endpoint = phaseLabel(directPhases[state.fastEndpointIndex || 0] || "me_adaccounts");
    await persist({
      app: fastApp?.label || "Meta",
      endpoint,
      status: "running",
      token: directTokenChoicesForApp(fastApp || apps[0])[state.fastChoiceIndex || 0]?.label,
      detail: "Continuando descoberta rápida em nova fatia para evitar timeout",
    });
    await invokeNextAccountsSlice(jobId, appIds);
    return;
  }

  // Modo padrão: para aqui. A descoberta rápida já identifica contas novas
  // (caso BKP 2: /me/adaccounts) com poucas chamadas. A varredura estrutural
  // completa de BMs/system users é cara e deve ser acionada só em modo deep,
  // evitando consumir 100% da API em uma sincronização comum.
  if ((state.mode || "light") !== "deep") {
    state.completedStages = Math.max(state.completedStages, state.totalStages);
    await updateJob({
      status: "completed",
      finished_at: new Date().toISOString(),
      progress_current: state.completedStages,
      progress_total: state.completedStages,
      synced_count: state.syncedCount,
      message: `Concluído: ${state.syncedCount} contas verificadas com sincronização leve`,
      errors: [state, ...stageEvents.slice(-MAX_STAGE_EVENTS), ...actualErrors.slice(-40)],
    });
    return;
  }

  const finishCurrentChoiceIfNeeded = (choicesLength: number) => {
    if (state.choiceIndex >= choicesLength) {
      state.choiceIndex = 0;
      state.phase = "me_businesses";
      state.bmIndex = 0;
      state.edgeIndex = 0;
      state.appIndex += 1;
    }
  };

  while (Date.now() < deadline) {
    if (state.appIndex >= apps.length) {
      state.completedStages = Math.max(state.completedStages, state.totalStages);
      const failedWithoutAccounts = state.syncedCount === 0 && actualErrors.length > 0;
      // Detecta caso específico: TODOS os erros foram rate-limit da Meta (code 4).
      // Nesse cenário a falha é 100% do lado do Facebook — não adianta reprocessar
      // agora; o admin precisa esperar o regain time. Mostra mensagem clara.
      const onlyQuotaErrors = actualErrors.length > 0
        && actualErrors.every((er: any) => er?.code === 4 || /usage \d+%/i.test(er?.erro || ""));
      const maxRegain = actualErrors.reduce(
        (m: number, er: any) => Math.max(m, extractRegainSeconds({ message: er?.erro || "" } as any)),
        0,
      );
      const waitMin = maxRegain > 0 ? Math.ceil(maxRegain / 60) : Math.ceil((Math.max(...Object.values(state.appCooldownUntil || { x: 0 })) - Date.now()) / 60000);
      await updateJob({
        status: failedWithoutAccounts ? "failed" : "completed",
        finished_at: new Date().toISOString(),
        progress_current: state.completedStages,
        progress_total: state.completedStages,
        synced_count: state.syncedCount,
        message: failedWithoutAccounts
          ? (onlyQuotaErrors
              ? `Limite de uso da API do Facebook atingido em todos os apps (100%+ da cota). Aguarde ~${Math.max(1, waitMin)} min e tente novamente — não é falha do sistema, é o Facebook pausando as requisições.`
              : `Falhou: nenhuma conta sincronizada. Último erro: ${(actualErrors.at(-1)?.erro || actualErrors.at(-1)?.fatal || "ver diagnóstico").slice(0, 240)}`)
          : `Concluído: ${state.syncedCount} contas sincronizadas`,
        errors: [state, ...stageEvents.slice(-MAX_STAGE_EVENTS), ...actualErrors.slice(-40)],
      });
      return;
    }

    const app = apps[state.appIndex];
    // Se este app está em cooldown (quota estourada em fatia anterior), pula
    // sem gastar novas chamadas — o job segue completando os outros apps.
    const cooldownTs = state.appCooldownUntil?.[app.label] || 0;
    if (cooldownTs && Date.now() < cooldownTs) {
      const remainingMin = Math.ceil((cooldownTs - Date.now()) / 60000);
      await persist({ app: app.label, endpoint: "rate-limit", status: "skipped", detail: `Em cooldown por ${remainingMin} min (quota Meta atingida)` });
      state.appIndex += 1;
      state.choiceIndex = 0;
      state.phase = ACCOUNT_PHASES[0];
      continue;
    }
    const choices = tokenChoicesForApp(app);
    if (choices.length === 0) {
      actualErrors.push({ app: app.label, erro: "Sem token configurado" });
      state.completedStages += 1;
      state.appIndex += 1;
      await persist({ app: app.label, endpoint: "tokens", status: "error", detail: "Sem token configurado" });
      continue;
    }
    finishCurrentChoiceIfNeeded(choices.length);
    if (state.appIndex >= apps.length) continue;

    const currentApp = apps[state.appIndex];
    const choice = tokenChoicesForApp(currentApp)[state.choiceIndex];
    if (!choice) continue;

    try {
      if (state.phase === "me_businesses") {
        await persist({ app: currentApp.label, endpoint: "/me/businesses", status: "running", token: choice.label, detail: "Buscando Business Managers" });
        const bms = await paginateMeta(`${META_API}/me/businesses?access_token=${encodeURIComponent(choice.token)}&fields=id,name,verification_status&limit=200`);
        const ownAppId = currentApp.id.startsWith("00000000") ? null : currentApp.id;
        if (bms.length > 0) {
          const { error } = await supabase.from("meta_business_managers").upsert(bms.map((bm: any) => ({
            meta_bm_id: bm.id,
            name: bm.name || bm.id,
            status: bm.verification_status || "active",
            verification_status: bm.verification_status || null,
            meta_app_id: ownAppId,
          })), { onConflict: "meta_bm_id" });
          if (error) throw error;
        }
        nextPhase(state);
        await persist({ app: currentApp.label, endpoint: "/me/businesses", status: "done", token: choice.label, detail: `${bms.length} BM(s) encontradas`, found: bms.length });
        continue;
      }

      if (state.phase === "bm_edges") {
        const bms = await activeBmsForApp(supabase, currentApp);
        if (state.bmIndex >= bms.length) {
          nextPhase(state);
          await persist({ app: currentApp.label, endpoint: "BM ad accounts", status: "done", token: choice.label, detail: "Todas as BMs varridas" });
          continue;
        }
        const bm = bms[state.bmIndex];
        const edge = BM_ACCOUNT_EDGES[state.edgeIndex] || BM_ACCOUNT_EDGES[0];
        await persist({ app: currentApp.label, endpoint: `${edge}`, status: "running", token: choice.label, detail: bm.name || bm.meta_bm_id });
        const items = await paginateMeta(`${META_API}/${bm.meta_bm_id}/${edge}?access_token=${encodeURIComponent(choice.token)}&fields=${accountFieldsForMode(state.mode)}&limit=${state.mode === "deep" ? 200 : 100}`);
        const saved = await saveDiscoveredAccounts(supabase, currentApp, items.map((acc: any) => ({ ...acc, _bm_meta_id: bm.meta_bm_id, _source_token: choice.token })));
        state.syncedCount += saved;
        state.completedStages += 1;
        state.edgeIndex += 1;
        if (state.edgeIndex >= BM_ACCOUNT_EDGES.length) {
          state.edgeIndex = 0;
          state.bmIndex += 1;
          await markBmAccountsScanned(supabase, bm.id);
        }
        state.totalStages = Math.max(state.totalStages, state.completedStages + ((bms.length - state.bmIndex) * BM_ACCOUNT_EDGES.length));
        await persist({ app: currentApp.label, endpoint: `${edge}`, status: "done", token: choice.label, detail: `${bm.name || bm.meta_bm_id}: ${saved} conta(s) salvas`, found: saved });
        continue;
      }

      if (state.phase === "bm_system_users") {
        const bms = await activeBmsForApp(supabase, currentApp);
        if (state.bmIndex >= bms.length) {
          nextPhase(state);
          await persist({ app: currentApp.label, endpoint: "/system_users/assigned_ad_accounts", status: "done", token: choice.label, detail: "System users varridos" });
          continue;
        }
        const bm = bms[state.bmIndex];
        await persist({ app: currentApp.label, endpoint: "/system_users/assigned_ad_accounts", status: "running", token: choice.label, detail: bm.name || bm.meta_bm_id });
        let savedTotal = 0;
        try {
          if (state.systemUsersBmId !== bm.meta_bm_id) {
            const users = await paginateMeta(`${META_API}/${bm.meta_bm_id}/system_users?access_token=${encodeURIComponent(choice.token)}&fields=id,name,role&limit=100`);
            state.systemUsers = (users || [])
              .filter((su: any) => !!su?.id)
              .map((su: any) => ({ id: su.id, name: su.name || su.id, bmId: bm.meta_bm_id, bmName: bm.name || bm.meta_bm_id }));
            state.systemUsersBmId = bm.meta_bm_id;
            state.systemUserIndex = 0;
            if (!state.systemUsers.length) {
              state.completedStages += 1;
              state.bmIndex += 1;
              state.systemUsers = undefined;
              state.systemUsersBmId = undefined;
              state.systemUserIndex = 0;
              await persist({ app: currentApp.label, endpoint: "/system_users/assigned_ad_accounts", status: "done", token: choice.label, detail: `${bm.name || bm.meta_bm_id}: 0 system users`, found: 0 });
              continue;
            }
          }
          const su = state.systemUsers?.[state.systemUserIndex || 0];
          if (!su) {
            state.completedStages += 1;
            state.bmIndex += 1;
            state.systemUsers = undefined;
            state.systemUsersBmId = undefined;
            state.systemUserIndex = 0;
            await persist({ app: currentApp.label, endpoint: "/system_users/assigned_ad_accounts", status: "done", token: choice.label, detail: `${bm.name || bm.meta_bm_id}: ${savedTotal} conta(s)`, found: savedTotal });
            continue;
          }
          const items = await paginateMeta(`${META_API}/${su.id}/assigned_ad_accounts?access_token=${encodeURIComponent(choice.token)}&fields=${accountFieldsForMode(state.mode)}&limit=${state.mode === "deep" ? 200 : 100}`);
          savedTotal += await saveDiscoveredAccounts(supabase, currentApp, items.map((acc: any) => ({ ...acc, _bm_meta_id: acc.business?.id || bm.meta_bm_id, _source_token: choice.token })));
          state.systemUserIndex = (state.systemUserIndex || 0) + 1;
          if (state.systemUserIndex >= (state.systemUsers?.length || 0)) {
            state.completedStages += 1;
            state.bmIndex += 1;
            state.systemUsers = undefined;
            state.systemUsersBmId = undefined;
            state.systemUserIndex = 0;
          }
        } catch (e) {
          const msg = (e as Error).message;
          actualErrors.push({ app: currentApp.label, token: choice.label, bm: bm.name || bm.meta_bm_id, edge: "system_users", erro: msg, code: metaErrorCode(e) });
          if (isMetaRateLimit(e)) {
            cooldownCurrentApp(state, currentApp.label, extractRegainSeconds(e));
            await persist({ app: currentApp.label, endpoint: "/system_users/assigned_ad_accounts", status: "error", token: choice.label, detail: "Limite da API Meta atingido; token pulado para não travar." });
            continue;
          }
          if (isMetaPermissionDenied(e)) {
            state.completedStages += 1;
            state.bmIndex += 1;
            state.systemUsers = undefined;
            state.systemUsersBmId = undefined;
            state.systemUserIndex = 0;
          } else {
            // Timeout/erro transitório em system_users não pode deixar o job
            // preso na mesma BM por várias fatias (foi o travamento em 5%).
            state.completedStages += 1;
            state.bmIndex += 1;
            state.systemUsers = undefined;
            state.systemUsersBmId = undefined;
            state.systemUserIndex = 0;
          }
        }
        state.syncedCount += savedTotal;
        state.totalStages = Math.max(state.totalStages, state.completedStages + (bms.length - state.bmIndex));
        await persist({ app: currentApp.label, endpoint: "/system_users/assigned_ad_accounts", status: "done", token: choice.label, detail: `${bm.name || bm.meta_bm_id}: ${savedTotal} conta(s)`, found: savedTotal });
        continue;
      }

      if (state.phase === "me_adaccounts") {
        await persist({ app: currentApp.label, endpoint: "/me/adaccounts", status: "running", token: choice.label, detail: "Contas diretas" });
        const items = await paginateMeta(`${META_API}/me/adaccounts?access_token=${encodeURIComponent(choice.token)}&fields=${ACCOUNT_FIELDS}&limit=200`);
        const saved = await saveDiscoveredAccounts(supabase, currentApp, items.map((acc: any) => ({ ...acc, _bm_meta_id: acc.business?.id || null, _source_token: choice.token })));
        state.syncedCount += saved;
        nextPhase(state);
        await persist({ app: currentApp.label, endpoint: "/me/adaccounts", status: "done", token: choice.label, detail: `${saved} conta(s) salvas`, found: saved });
        continue;
      }

      if (state.phase === "me_assigned") {
        await persist({ app: currentApp.label, endpoint: "/me/assigned_ad_accounts", status: "running", token: choice.label, detail: "Contas atribuídas" });
        try {
          const items = await paginateMeta(`${META_API}/me/assigned_ad_accounts?access_token=${encodeURIComponent(choice.token)}&fields=${ACCOUNT_FIELDS}&limit=200`);
          const saved = await saveDiscoveredAccounts(supabase, currentApp, items.map((acc: any) => ({ ...acc, _bm_meta_id: acc.business?.id || null, _source_token: choice.token })));
          state.syncedCount += saved;
          nextPhase(state);
          await persist({ app: currentApp.label, endpoint: "/me/assigned_ad_accounts", status: "done", token: choice.label, detail: `${saved} conta(s) salvas`, found: saved });
        } catch (e) {
          if (isMetaRateLimit(e)) {
            actualErrors.push({ app: currentApp.label, token: choice.label, edge: "/me/assigned_ad_accounts", erro: (e as Error).message, code: metaErrorCode(e) });
            cooldownCurrentApp(state, currentApp.label, extractRegainSeconds(e));
            await persist({ app: currentApp.label, endpoint: "/me/assigned_ad_accounts", status: "error", token: choice.label, detail: "Limite da API Meta atingido; token pulado para não travar." });
          } else {
            nextPhase(state);
            await persist({ app: currentApp.label, endpoint: "/me/assigned_ad_accounts", status: "skipped", token: choice.label, detail: (e as Error).message });
          }
        }
        continue;
      }

      if (state.phase === "me_id_assigned") {
        await persist({ app: currentApp.label, endpoint: "/{me.id}/assigned_ad_accounts", status: "running", token: choice.label, detail: "Contas atribuídas pelo ID do token" });
        try {
          const me = await metaFetch("/me", choice.token, { fields: "id,name" });
          const items = me?.id ? await paginateMeta(`${META_API}/${me.id}/assigned_ad_accounts?access_token=${encodeURIComponent(choice.token)}&fields=${ACCOUNT_FIELDS}&limit=200`) : [];
          const saved = await saveDiscoveredAccounts(supabase, currentApp, items.map((acc: any) => ({ ...acc, _bm_meta_id: acc.business?.id || null, _source_token: choice.token })));
          state.syncedCount += saved;
          nextPhase(state);
          await persist({ app: currentApp.label, endpoint: "/{me.id}/assigned_ad_accounts", status: "done", token: choice.label, detail: `${saved} conta(s) salvas`, found: saved });
        } catch (e) {
          if (isMetaRateLimit(e)) {
            actualErrors.push({ app: currentApp.label, token: choice.label, edge: "/{me.id}/assigned_ad_accounts", erro: (e as Error).message, code: metaErrorCode(e) });
            cooldownCurrentApp(state, currentApp.label, extractRegainSeconds(e));
            await persist({ app: currentApp.label, endpoint: "/{me.id}/assigned_ad_accounts", status: "error", token: choice.label, detail: "Limite da API Meta atingido; token pulado para não travar." });
          } else {
            nextPhase(state);
            await persist({ app: currentApp.label, endpoint: "/{me.id}/assigned_ad_accounts", status: "skipped", token: choice.label, detail: (e as Error).message });
          }
        }
      }
    } catch (e) {
      const failedPhase = phaseLabel(state.phase);
      const msg = (e as Error).message;
      actualErrors.push({ app: currentApp.label, token: choice.label, edge: failedPhase, erro: msg, code: metaErrorCode(e) });
      if (isMetaRateLimit(e)) {
        cooldownCurrentApp(state, currentApp.label, extractRegainSeconds(e));
        await persist({ app: currentApp.label, endpoint: failedPhase, status: "error", token: choice.label, detail: "Limite da API Meta atingido; token pulado para não travar." });
      } else {
        nextPhase(state);
        await persist({ app: currentApp.label, endpoint: failedPhase, status: "error", token: choice.label, detail: msg });
      }
    }
  }

  await persist({
    app: apps[state.appIndex]?.label || "Meta",
    endpoint: phaseLabel(state.phase),
    status: "running",
    token: tokenChoicesForApp(apps[state.appIndex] || apps[0])[state.choiceIndex]?.label,
    detail: "Continuando em nova fatia para evitar timeout",
  });
  await invokeNextAccountsSlice(jobId, appIds);
}

// ---- Background job (multi-app) ---------------------------------------------

async function runAccountsSyncJob(supabase: any, jobId: string, appIds?: string[]) {
  const update = (patch: Record<string, any>) =>
    supabase.from("meta_sync_jobs").update(patch).eq("id", jobId);

  const stageEvents: any[] = [];
  const stageStarted = new Set<string>();
  const stageFinished = new Set<string>();
  let estimatedStageTotal = 1;
  let acceptingStageUpdates = true;
  const stageKey = (event: SyncStageEvent) => `${event.app}|${event.token || "-"}|${event.endpoint}`;

  const publishStage = async (event: SyncStageEvent, actualErrors: any[] = []) => {
    if (!acceptingStageUpdates) return;
    const key = stageKey(event);
    stageStarted.add(key);
    if (["done", "error", "skipped"].includes(event.status)) stageFinished.add(key);
    const item = {
      kind: "stage",
      key,
      app: event.app,
      endpoint: event.endpoint,
      status: event.status,
      token: event.token || null,
      detail: event.detail || null,
      found: event.found ?? null,
      at: new Date().toISOString(),
    };
    const existing = stageEvents.findIndex((s) => s.key === key);
    if (existing >= 0) stageEvents[existing] = item;
    else stageEvents.push(item);

    const statusLabel = event.status === "running" ? "Varrendo" : event.status === "done" ? "Concluído" : event.status === "error" ? "Erro" : "Ignorado";
    await update({
      progress_current: stageFinished.size,
      progress_total: Math.max(estimatedStageTotal, stageStarted.size, 1),
      message: `${statusLabel} ${event.endpoint}${event.token ? ` (${event.token})` : ""}${event.detail ? ` — ${event.detail}` : ""}`,
      errors: [...stageEvents, ...actualErrors],
    });
  };

  onBackoff = (info) => {
    update({ message: `Retry ${info.attempt} em ${Math.round(info.waitMs / 1000)}s — ${info.reason}` });
  };

  try {
    const apps = await loadActiveApps(supabase, appIds);
    if (apps.length === 0) {
      await update({ status: "failed", finished_at: new Date().toISOString(), message: "Nenhum aplicativo Meta ativo." });
      return;
    }
    estimatedStageTotal = apps.reduce((sum, app) => sum + (tokenChoicesForApp(app).length * 6) + 2, 0);

    await update({
      status: "running",
      started_at: new Date().toISOString(),
      progress_total: Math.max(estimatedStageTotal, 1),
      progress_current: 0,
      message: `Sincronizando ${apps.length} aplicativo(s) em paralelo...`,
      errors: [],
    });

    let done = 0;
    let totalAccounts = 0;
    const allErrors: any[] = [];

    // Run apps in parallel, but never let a single Meta app leave the job stuck
    // forever. Edge runtimes have hard wall-clock limits; timing out here lets
    // the UI receive a failed/completed state instead of looping at 0%.
    await Promise.all(apps.map(async (app) => {
      try {
        await update({ message: `Sincronizando ${app.label}...` });
        const r = await withTimeout(
          syncAccountsForApp(supabase, app, (event) => publishStage(event, allErrors)),
          Math.max(30000, Math.floor(JOB_TIMEOUT_MS / Math.max(1, apps.length))),
          `Sync de ${app.label}`,
        );
        totalAccounts += (r.accounts || 0);
        if (r.erros && r.erros.length) allErrors.push(...r.erros);
      } catch (e) {
        allErrors.push({ app: app.label, fatal: (e as Error).message });
        await publishStage({ app: app.label, endpoint: "timeout/fatal", status: "error", detail: (e as Error).message }, allErrors);
      } finally {
        done++;
        await update({
          progress_current: Math.max(stageFinished.size, done),
          progress_total: Math.max(estimatedStageTotal, stageStarted.size, apps.length),
          synced_count: totalAccounts,
          message: `${done}/${apps.length} app(s) concluído(s) · ${totalAccounts} contas`,
          errors: [...stageEvents, ...allErrors],
        });
      }
    }));

    const fatalCount = allErrors.filter((e) => e?.fatal).length;
    const finalStatus = fatalCount >= apps.length && totalAccounts === 0 ? "failed" : "completed";
    const finalProgressTotal = Math.max(estimatedStageTotal, stageFinished.size, apps.length);
    acceptingStageUpdates = false;
    await update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      progress_current: finalStatus === "completed" ? finalProgressTotal : Math.max(stageFinished.size, apps.length),
      progress_total: finalProgressTotal,
      synced_count: totalAccounts,
      message: finalStatus === "failed"
        ? `Falhou: ${fatalCount}/${apps.length} app(s) travaram antes de concluir`
        : `Concluído: ${totalAccounts} contas em ${apps.length} aplicativo(s)${allErrors.length ? ` (${allErrors.length} erros)` : ""}`,
      errors: [...stageEvents, ...allErrors],
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
    const syncMode: SyncMode = body.mode === "deep" ? "deep" : "light";

    // ===== Background job =====
    if (action === "start_sync_accounts") {
      const staleCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      await supabase
        .from("meta_sync_jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          message: "Sincronização anterior expirou antes de finalizar. Iniciando nova tentativa...",
        })
        .in("status", ["pending", "running"])
        .lt("created_at", staleCutoff);

      const { data: job, error: jobErr } = await supabase
        .from("meta_sync_jobs")
        .insert({ kind: "accounts", status: "pending", message: "Aguardando início..." })
        .select("id")
        .single();
      if (jobErr) throw jobErr;
      // @ts-ignore EdgeRuntime is provided by Supabase runtime
      EdgeRuntime.waitUntil(runAccountsSyncJobResumable(supabase, job.id, appIds, syncMode));
      return json({ sucesso: true, job_id: job.id });
    }

    if (action === "continue_sync_accounts") {
      const jobId = body.job_id;
      if (!jobId) return json({ erro: "job_id obrigatório" }, 400);
      // @ts-ignore EdgeRuntime is provided by Supabase runtime
      EdgeRuntime.waitUntil(runAccountsSyncJobResumable(supabase, jobId, appIds, syncMode));
      return json({ sucesso: true, job_id: jobId });
    }

    // ===== Multi-app sync of BMs + accounts =====
    if (action === "sync_bms" || action === "sync_accounts") {
      const apps = await loadActiveApps(supabase, appIds);
      if (apps.length === 0) return json({ erro: "Nenhum aplicativo Meta ativo configurado" }, 400);

      const results: any[] = [];
      for (const app of apps) {
        try {
          results.push(syncMode === "deep"
            ? await syncAccountsForApp(supabase, app)
            : await syncLightAccountsForApp(supabase, app));
        } catch (e) {
          results.push({ app: app.label, erro: (e as Error).message });
        }
      }

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
      // Sync de métricas não deve disparar redescoberta estrutural de contas.
      // Essa chamada roda com frequência no dashboard; a redescoberta anterior
      // chamava syncAccountsForApp para todos os apps em paralelo e drenava a
      // cota da Meta antes mesmo de buscar insights.
      const skipRefresh = body.refresh_accounts !== true;
      if (!skipRefresh && (staleCount || 0) > 0) {
        try {
          for (const app of apps) await syncAccountsForApp(supabase, app).catch(() => null);
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

      // Só reportamos contas nunca descobertas (last_synced_at is null) como
      // "stale" — NÃO as excluímos do fetch. O filtro agressivo de 24h estava
      // descartando contas legítimas cuja descoberta ficou defasada (ex.: BM
      // rediscovery falhou por rate limit), zerando o gasto do cliente no
      // dashboard mesmo tendo campanha ativa. O filtro de banimento
      // permanente logo acima já elimina o desperdício real de API.
      const staleAccounts = accounts.filter((a: any) => !a.last_synced_at);


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

      const errors: any[] = [];
      const allRows: any[] = [];
      let idx = 0;
      const list = accounts || [];

      const worker = async () => {
        while (true) {
          const i = idx++;
          if (i >= list.length) return;
          const acc: any = list[i];
          // Tenta system-user token primeiro; se falhar por permissão (#200),
          // tenta o user access token do mesmo app. Só a partir do 3º candidato
          // (tokens de outros apps) é que evitamos, para não estourar a cota.
          const tokens = tokenCandidates(apps, acc.meta_app_id).slice(0, 2);
          if (tokens.length === 0) {
            errors.push({ account: acc.name, erro: "Sem token disponível" });
            await supabase.from("meta_ad_accounts").update({
              last_sync_error_code: null,
              last_sync_error_message: "Nenhum token (system/user) disponível para este app",
              last_sync_error_source: "no_token",
              last_sync_error_attempts: [],
              last_sync_error_at: new Date().toISOString(),
            }).eq("id", acc.id);
            continue;
          }
          const attempts: Array<{ source: string; code: number | null; message: string }> = [];
          try {
            let data: any = null;
            let lastError: unknown = null;
            for (let ti = 0; ti < tokens.length; ti++) {
              const tok = tokens[ti];
              // 0 = system-user token, 1 = user access token (fallback)
              const source = ti === 0 ? "system" : "user";
              try {
                data = await metaFetch(`/${acc.meta_account_id}/insights`, tok, {
                  fields: "spend,impressions,clicks,cpm,cpc,ctr,reach,actions,action_values",
                  time_range: JSON.stringify({ since, until }),
                  level: "account",
                  time_increment: "1",
                  limit: "500",
                });
                lastError = null;
                break;
              } catch (e) {
                lastError = e;
                const em = (e as Error).message || "";
                const mm = em.match(/"code"\s*:\s*(\d+)/);
                attempts.push({
                  source,
                  code: mm ? Number(mm[1]) : null,
                  message: em.slice(0, 300),
                });
              }
            }
            if (!data) throw lastError || new Error("Nenhum token conseguiu ler insights");
            const perAccount: any[] = [];
            for (const row of data.data || []) {
              const rowObj = {
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
              };
              allRows.push(rowObj);
              perAccount.push(rowObj);
            }
            if (perAccount.length > 0) {
              try {
                await supabase
                  .from("meta_ad_insights")
                  .upsert(perAccount, { onConflict: "ad_account_id,date" });
              } catch (_) { /* upsert final abaixo cobre o retry */ }
            }
            await supabase.from("meta_ad_accounts").update({
              last_sync_error_code: null,
              last_sync_error_message: null,
              last_sync_error_source: null,
              last_sync_error_attempts: null,
              last_sync_error_at: null,
              last_synced_at: new Date().toISOString(),
            }).eq("id", acc.id);
          } catch (e) {
            const msg = (e as Error).message || "";
            errors.push({ account: acc.name, erro: msg });
            let code: number | null = null;
            const m = msg.match(/"code"\s*:\s*(\d+)/);
            if (m) code = Number(m[1]);
            // Determina qual token(s) falhou. Se tentou 2, ambos falharam.
            const triedSources = attempts.map(a => a.source);
            let source: string = triedSources[0] || "system";
            if (triedSources.includes("system") && triedSources.includes("user")) source = "both";
            else if (triedSources.length === 1) source = triedSources[0];
            await supabase.from("meta_ad_accounts").update({
              last_sync_error_code: code,
              last_sync_error_message: msg.slice(0, 500),
              last_sync_error_source: source,
              last_sync_error_attempts: attempts,
              last_sync_error_at: new Date().toISOString(),
            }).eq("id", acc.id);
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(2, list.length) }, worker));

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
