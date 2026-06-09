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
  if (/não retornada|não retornou BMs/i.test(msg)) return "O token do perfil não lista essa BM em /me/businesses. Sincronize Conexões Meta e confirme que o perfil do token é Admin na BM.";
  if (/timeout|timed out|fetch/i.test(msg)) return "Timeout de rede com a Meta. Tente novamente.";
  return "Verifique logs da edge function scan-bm-backups.";
}

async function runScanJob(admin: any, jobId: string, actorId: string | null, actorEmail: string | null) {
  const update = (patch: Record<string, any>) =>
    admin.from("meta_sync_jobs").update(patch).eq("id", jobId);

  try {
    const setMessage = async (message: string) => { await update({ message }); };

    // ---- Fontes Meta: igual Conexões Meta, começa pelo token do perfil ----
    const { data: appRows } = await admin
      .from("meta_apps")
      .select("id, label, system_user_token, user_access_token, status, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    const seenTokens = new Set<string>();
    let sources: any[] = [];
    const addSource = (source: any) => {
      if (!source.token || seenTokens.has(source.token)) return;
      seenTokens.add(source.token);
      sources.push(source);
    };
    addSource({ id: null, label: "Token do perfil", token: cleanToken(Deno.env.get("META_USER_ACCESS_TOKEN")) });
    (appRows || [])
      .map((a: any) => ({ id: a.id, label: a.label || "Meta App", token: cleanToken(a.user_access_token) || cleanToken(a.system_user_token) }))
      .forEach(addSource);
    if (sources.length === 0) {
      const envToken = cleanToken(Deno.env.get("META_SYSTEM_USER_TOKEN"));
      if (envToken) sources = [{ id: null, label: "Token do perfil", token: envToken }];
    }

    if (sources.length === 0) {
      const msg = "Sem token Meta configurado";
      await update({ status: "failed", finished_at: new Date().toISOString(), message: msg });
      await logAudit(admin, {
        actor_id: actorId, actor_email: actorEmail,
        action: "scan_bm_backups_failed", entity: "meta_business_managers",
        metadata: { erro: msg, solucao_sugerida: "Configure META_USER_ACCESS_TOKEN ou cadastre um app em /meta-apps com token salvo." },
      });
      return;
    }

    // ---- Lista local de BMs ----
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
      message: `Lendo BMs e perfis diretamente do token do perfil...`,
    });

    const fetchBusinessesWithUsers = async (token: string) => {
      const out: any[] = [];
      const fields = "id,name,verification_status,business_users.limit(200){id,name,email,role}";
      let url: string | null = `${GRAPH}/me/businesses?fields=${encodeURIComponent(fields)}&limit=100&access_token=${encodeURIComponent(token)}`;
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
    const failures: any[] = [];
    const bmByMetaId = new Map((bms as any[]).map((b: any) => [String(b.meta_bm_id), b]));
    const touchedBmIds = new Set<string>();
    const seenBusinessIds = new Set<string>();

    for (const source of sources as any[]) {
      await setMessage(`Lendo BMs acessíveis pelo token: ${source.label}`);
      const result = await fetchBusinessesWithUsers(source.token);
      if (result.error) {
        failures.push({ bm_name: source.label, meta_bm_id: "me/businesses", erros: [result.error] });
        continue;
      }

      const bmRows = result.data.map((bm: any) => ({
        meta_bm_id: String(bm.id),
        name: bm.name || `BM ${bm.id}`,
        status: bm.verification_status || "active",
        verification_status: bm.verification_status || null,
        ...(source.id ? { meta_app_id: source.id } : {}),
        last_synced_at: new Date().toISOString(),
      }));
      if (bmRows.length) await admin.from("meta_business_managers").upsert(bmRows, { onConflict: "meta_bm_id" });

      const { data: refreshed } = await admin.from("meta_business_managers").select("id, meta_bm_id, name, status, meta_app_id");
      for (const b of refreshed || []) bmByMetaId.set(String(b.meta_bm_id), b);

      for (const metaBm of result.data) {
        const bm = bmByMetaId.get(String(metaBm.id));
        if (!bm || touchedBmIds.has(bm.id)) continue;
        const users = (metaBm.business_users?.data || [])
          .filter((u: any) => u?.id)
          .map((u: any) => ({ id: String(u.id), name: u.name, email: u.email || null, role: u.role || null, kind: "business" }));
        await admin.from("bm_detected_users").delete().eq("bm_id", bm.id);
        if (users.length) {
          const rows = users.map((u: any) => ({
            bm_id: bm.id,
            meta_user_id: u.id,
            user_name: u.name || null,
            user_email: u.email,
            user_role: u.role,
            user_kind: u.kind,
          }));
          await admin.from("bm_detected_users").upsert(rows, { onConflict: "bm_id,meta_user_id" });
        }
        touchedBmIds.add(bm.id);
        seenBusinessIds.add(String(metaBm.id));
        totalUsers += users.length;
        done++;
        await update({
          progress_current: Math.min(done, bms.length), synced_count: totalUsers,
          message: `${Math.min(done, bms.length)}/${bms.length} BMs · ${totalUsers} perfis detectados`,
          errors: failures.slice(0, 20),
        });
      }
      await sleep(REQUEST_DELAY_MS);
    }

    for (const bm of bms as any[]) {
      if (touchedBmIds.has(bm.id)) continue;
      failures.push({
        bm_id: bm.id,
        bm_name: bm.name,
        meta_bm_id: bm.meta_bm_id,
        erros: [seenBusinessIds.size === 0 ? "Token não retornou BMs acessíveis" : "BM não retornada por /me/businesses para os tokens configurados"],
      });
      done++;
      await update({
        progress_current: Math.min(done, bms.length), synced_count: totalUsers,
        message: `${Math.min(done, bms.length)}/${bms.length} BMs · ${totalUsers} perfis detectados`,
        errors: failures.slice(0, 20),
      });
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
