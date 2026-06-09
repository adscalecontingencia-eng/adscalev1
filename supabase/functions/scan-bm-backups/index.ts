// Background-job scan: identifica perfis em todas as BMs Meta via Graph API.
// Mesma estratégia de meta-sync: dispara, registra job em meta_sync_jobs e roda
// via EdgeRuntime.waitUntil — a UI acompanha por realtime + polling.
//
// POST actions:
//   { action: "start" }   -> cria job (kind='detect_profiles') e retorna { job_id }
//   { action: "status", job_id } -> retorna o job atual
//   (sem action / corpo vazio) -> compat: roda sincronamente uma única BM se { bm_id }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GRAPH = "https://graph.facebook.com/v21.0";
const REQUEST_DELAY_MS = 900;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cleanToken = (token?: string | null) => (token || "").replace(/\s+/g, "").trim();

function isRateLimit(code?: number, msg = "") {
  return [4, 17, 32, 613].includes(Number(code)) || /rate|limit|throttl|Application request limit/i.test(msg);
}

async function fetchJsonWithRetry(url: string, onBackoff: (msg: string) => Promise<void>, attempts = 5) {
  let last: { error: string; code?: number; rateLimited?: boolean } | null = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url);
      const j = await r.json().catch(() => ({}));
      const err = j?.error;
      const msg = err?.message || (!r.ok ? `HTTP ${r.status}` : "");
      const code = err?.code;
      const retry = r.status === 429 || r.status >= 500 || isRateLimit(code, msg) || err?.is_transient;
      if ((!r.ok || err) && retry && i < attempts - 1) {
        const wait = Math.min(90000, (isRateLimit(code, msg) ? 12000 : 2500) * Math.pow(2, i));
        await onBackoff(`Meta em limite de requisições. Aguardando ${Math.round(wait / 1000)}s antes de continuar...`);
        await sleep(wait);
        continue;
      }
      if (!r.ok || err) return { data: null, error: msg || "Erro Meta", code, rateLimited: isRateLimit(code, msg) };
      return { data: j, error: null, code: undefined, rateLimited: false };
    } catch (e) {
      last = { error: (e as Error).message };
      if (i < attempts - 1) {
        const wait = Math.min(30000, 1500 * Math.pow(2, i));
        await onBackoff(`Falha temporária de rede. Nova tentativa em ${Math.round(wait / 1000)}s...`);
        await sleep(wait);
      }
    }
  }
  return { data: null, error: last?.error || "Falha ao chamar Meta", code: last?.code, rateLimited: last?.rateLimited || false };
}

async function logAudit(admin: any, entry: {
  actor_id?: string | null; actor_email?: string | null;
  action: string; entity: string; entity_id?: string | null;
  metadata: Record<string, unknown>;
}) {
  try {
    await admin.from("audit_log").insert({
      actor_id: entry.actor_id ?? null,
      actor_email: entry.actor_email ?? null,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entity_id ?? null,
      metadata: entry.metadata,
    });
  } catch (_) { /* silencioso */ }
}

function diagnoseError(msg: string): string {
  if (!msg) return "Erro desconhecido.";
  if (/access token/i.test(msg)) return "Token Meta inválido/expirado. Atualize META_USER_ACCESS_TOKEN com novo token (Graph API Explorer · business_management).";
  if (/permission|not authorized|do not have/i.test(msg)) return "O usuário do token não é Admin nessa BM. Adicione-o em Business Settings > Users.";
  if (/rate|limit|throttl/i.test(msg)) return "Rate limit do Meta. Aguarde alguns minutos e tente de novo.";
  if (/timeout|timed out|fetch/i.test(msg)) return "Timeout de rede com a Meta. Tente novamente.";
  return "Verifique logs da edge function scan-bm-backups.";
}

async function runScanJob(admin: any, jobId: string, actorId: string | null, actorEmail: string | null) {
  const update = (patch: Record<string, any>) =>
    admin.from("meta_sync_jobs").update(patch).eq("id", jobId);

  try {
    const setMessage = async (message: string) => { await update({ message }); };

    // ---- Tokens (mesma base de Conexões Meta: apps ativos + fallback env) ----
    const { data: apps } = await admin
      .from("meta_apps")
      .select("id, label, system_user_token, user_access_token, status, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    const tokenByApp = new Map<string, string>();
    for (const a of apps || []) {
      const t = cleanToken(a.user_access_token) || cleanToken(a.system_user_token);
      if (t) tokenByApp.set(a.id, t);
    }
    const fallbackToken =
      cleanToken(Deno.env.get("META_USER_ACCESS_TOKEN")) ||
      (apps || []).map((a: any) => cleanToken(a.user_access_token)).find(Boolean) ||
      cleanToken(Deno.env.get("META_SYSTEM_USER_TOKEN")) ||
      (apps || []).map((a: any) => cleanToken(a.system_user_token)).find(Boolean);

    if (!fallbackToken && tokenByApp.size === 0) {
      const msg = "Sem token Meta configurado";
      await update({ status: "failed", finished_at: new Date().toISOString(), message: msg });
      await logAudit(admin, {
        actor_id: actorId, actor_email: actorEmail,
        action: "scan_bm_backups_failed", entity: "meta_business_managers",
        metadata: { erro: msg, solucao_sugerida: "Configure META_USER_ACCESS_TOKEN ou cadastre um app em /meta-apps com token salvo." },
      });
      return;
    }

    // ---- Lista BMs ----
    const { data: bms } = await admin
      .from("meta_business_managers")
      .select("id, meta_bm_id, name, status, meta_app_id");

    if (!bms?.length) {
      await update({ status: "completed", finished_at: new Date().toISOString(), message: "Nenhuma BM cadastrada", progress_total: 0, progress_current: 0, synced_count: 0 });
      return;
    }

    await update({
      status: "running", started_at: new Date().toISOString(),
      progress_total: bms.length, progress_current: 0, synced_count: 0,
      message: `Escaneando ${bms.length} BMs em fila segura para evitar rate limit...`,
    });

    const fetchEdge = async (metaBmId: string, edge: string, token: string) => {
      const out: any[] = [];
      let url: string | null = `${GRAPH}/${metaBmId}/${edge}?fields=id,name,email,role&limit=100&access_token=${token}`;
      while (url) {
        const res = await fetchJsonWithRetry(url, setMessage);
        if (res.error) return { data: out, error: res.error, code: res.code, rateLimited: res.rateLimited };
        out.push(...(res.data?.data || []));
        url = res.data?.paging?.next || null;
        if (url) await sleep(REQUEST_DELAY_MS);
      }
      return { data: out, error: null, code: undefined, rateLimited: false };
    };

    let totalUsers = 0;
    let done = 0;
    const detectedRows: any[] = [];
    const failures: any[] = [];

    for (const bm of bms as any[]) {
      const token = (bm.meta_app_id && tokenByApp.get(bm.meta_app_id)) || fallbackToken!;
      const bu = await fetchEdge(bm.meta_bm_id, "business_users", token);
      await sleep(REQUEST_DELAY_MS);
      let su = { data: [] as any[], error: null as string | null, code: undefined as number | undefined, rateLimited: false };
      if (!bu.rateLimited) {
        su = await fetchEdge(bm.meta_bm_id, "system_users", token);
      } else {
        su = { data: [], error: "system_users pulado para preservar rate limit após business_users", code: undefined, rateLimited: false };
      }
        const users = [
          ...bu.data.map((u: any) => ({ id: u.id, name: u.name, email: u.email || null, role: u.role || null, kind: "business" })),
          ...su.data.map((u: any) => ({ id: u.id, name: u.name, email: null, role: u.role || null, kind: "system" })),
        ];
        totalUsers += users.length;
        await admin.from("bm_detected_users").delete().eq("bm_id", bm.id);
        for (const u of users) {
          if (!u.id) continue;
          detectedRows.push({
            bm_id: bm.id,
            meta_user_id: String(u.id),
            user_name: u.name || null,
            user_email: u.email,
            user_role: u.role,
            user_kind: u.kind,
          });
        }
        const errs = [bu.error, su.error].filter(Boolean);
        if (users.length === 0 && errs.length) {
          failures.push({ bm_id: bm.id, bm_name: bm.name, meta_bm_id: bm.meta_bm_id, erros: errs });
        }
      done++;
      await update({
        progress_current: done, synced_count: totalUsers,
        message: `${done}/${bms.length} BMs · ${totalUsers} usuários detectados`,
        errors: failures.slice(0, 20),
      });
      if (bu.rateLimited || su.rateLimited) await sleep(45000);
      else await sleep(REQUEST_DELAY_MS);
    }

    if (detectedRows.length) {
      for (let i = 0; i < detectedRows.length; i += 500) {
        await admin.from("bm_detected_users").upsert(detectedRows.slice(i, i + 500), { onConflict: "bm_id,meta_user_id" });
      }
    }

    // ---- Auto-link backups via whitelist ----
    const { data: wl } = await admin.from("meta_user_whitelist").select("meta_user_id, backup_id").not("backup_id", "is", null);
    let backupLinks = 0;
    if (wl?.length) {
      const ids = wl.map((w: any) => w.meta_user_id);
      const { data: hits } = await admin.from("bm_detected_users").select("bm_id, meta_user_id").in("meta_user_id", ids);
      const { data: existing } = await admin.from("bm_backup_assignments").select("bm_id, backup_id");
      const have = new Set((existing || []).map((e: any) => `${e.bm_id}::${e.backup_id}`));
      const toInsert: any[] = [];
      for (const h of hits || []) {
        const w = wl.find((x: any) => x.meta_user_id === h.meta_user_id);
        if (!w?.backup_id) continue;
        const key = `${h.bm_id}::${w.backup_id}`;
        if (!have.has(key)) { have.add(key); toInsert.push({ bm_id: h.bm_id, backup_id: w.backup_id }); }
      }
      if (toInsert.length) { await admin.from("bm_backup_assignments").insert(toInsert); backupLinks = toInsert.length; }
    }

    // ---- Auditoria ----
    if (failures.length) {
      const byMsg: Record<string, number> = {};
      for (const f of failures) for (const m of f.erros) byMsg[m] = (byMsg[m] || 0) + 1;
      const principal = Object.entries(byMsg).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
      await logAudit(admin, {
        actor_id: actorId, actor_email: actorEmail,
        action: "scan_bm_backups_partial_failure", entity: "meta_business_managers",
        metadata: {
          bms_totais: bms.length, bms_com_falha: failures.length,
          usuarios_detectados: totalUsers, backups_vinculados: backupLinks,
          erro_principal: principal, ocorrencias_por_erro: byMsg,
          solucao_sugerida: diagnoseError(principal),
          falhas_amostra: failures.slice(0, 10),
        },
      });
    } else {
      await logAudit(admin, {
        actor_id: actorId, actor_email: actorEmail,
        action: "scan_bm_backups_success", entity: "meta_business_managers",
        metadata: { bms_varridas: bms.length, usuarios_detectados: totalUsers, backups_vinculados: backupLinks },
      });
    }

    await update({
      status: "completed", finished_at: new Date().toISOString(),
      progress_current: bms.length, synced_count: totalUsers,
      message: `Concluído: ${totalUsers} usuários em ${bms.length} BMs${failures.length ? ` · ${failures.length} BM(s) com falha` : ""} · ${backupLinks} backup(s) vinculados`,
      errors: failures.slice(0, 20),
    });
  } catch (e) {
    const msg = (e as Error).message;
    await update({ status: "failed", finished_at: new Date().toISOString(), message: `Falhou: ${msg}` });
    await logAudit(admin, {
      actor_id: actorId, actor_email: actorEmail,
      action: "scan_bm_backups_fatal_error", entity: "meta_business_managers",
      metadata: { erro: msg, stack: (e as Error).stack?.slice(0, 2000), solucao_sugerida: diagnoseError(msg) },
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "Use POST" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ erro: "Não autenticado" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ erro: "Não autenticado" }, 401);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const ok = (roles || []).some((r: any) => r.role === "admin" || r.role === "support");
    if (!ok) return json({ erro: "Acesso negado" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action || "start";

    if (action === "status") {
      const { data } = await admin.from("meta_sync_jobs").select("*").eq("id", body.job_id).maybeSingle();
      return json({ sucesso: true, job: data });
    }

    // action === "start" → cria job e dispara em background
    const { data: job, error: jobErr } = await admin
      .from("meta_sync_jobs")
      .insert({ kind: "detect_profiles", status: "pending", message: "Aguardando início..." })
      .select("id")
      .single();
    if (jobErr) throw jobErr;

    // @ts-ignore EdgeRuntime é provido pelo Supabase runtime
    EdgeRuntime.waitUntil(runScanJob(admin, job.id, user.id, user.email ?? null));
    return json({ sucesso: true, job_id: job.id });
  } catch (e) {
    const msg = (e as Error).message;
    await logAudit(admin, {
      action: "scan_bm_backups_dispatch_error", entity: "meta_business_managers",
      metadata: { erro: msg, solucao_sugerida: diagnoseError(msg) },
    });
    return json({ erro: msg }, 500);
  }
});
