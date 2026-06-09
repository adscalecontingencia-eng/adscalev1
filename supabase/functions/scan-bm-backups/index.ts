// Varre todas as BMs em paralelo (concorrência limitada), lista usuários via Graph API,
// salva cache em bm_detected_users e auto-sincroniza bm_backup_assignments via meta_user_whitelist.
// Erros são registrados em audit_log com contexto detalhado para diagnóstico no painel de Auditoria.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GRAPH = "https://graph.facebook.com/v21.0";
const CONCURRENCY = 8;

// ------- helpers -------
async function pMap<T, R>(items: T[], limit: number, fn: (it: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function logAudit(admin: any, entry: {
  actor_id?: string | null;
  actor_email?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "Use POST" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let actorId: string | null = null;
  let actorEmail: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ erro: "Não autenticado" }, 401);

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ erro: "Não autenticado" }, 401);
    actorId = user.id; actorEmail = user.email ?? null;

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const ok = (roles || []).some((r: any) => r.role === "admin" || r.role === "support");
    if (!ok) return json({ erro: "Acesso negado" }, 403);

    // Tokens
    const { data: apps } = await admin
      .from("meta_apps")
      .select("id, system_user_token, user_access_token, created_at")
      .order("created_at", { ascending: false });
    const tokenByApp = new Map<string, string>();
    for (const a of apps || []) {
      const t = a.user_access_token || a.system_user_token;
      if (t) tokenByApp.set(a.id, t);
    }
    const fallbackToken =
      Deno.env.get("META_USER_ACCESS_TOKEN") ||
      (apps || []).map((a: any) => a.user_access_token).find(Boolean) ||
      Deno.env.get("META_SYSTEM_USER_TOKEN") ||
      (apps || []).map((a: any) => a.system_user_token).find(Boolean);

    if (!fallbackToken && tokenByApp.size === 0) {
      await logAudit(admin, {
        actor_id: actorId, actor_email: actorEmail,
        action: "scan_bm_backups_error", entity: "meta_business_managers",
        metadata: {
          erro: "Sem token Meta configurado",
          causa: "Nenhum META_USER_ACCESS_TOKEN/META_SYSTEM_USER_TOKEN no ambiente e nenhum meta_apps com token salvo.",
          solucao: "Adicionar o secret META_USER_ACCESS_TOKEN (Graph API Explorer com permissão business_management) OU cadastrar um app em /meta-apps com user_access_token.",
        },
      });
      return json({ erro: "Sem token Meta configurado" }, 400);
    }

    const body = await req.json().catch(() => ({}));
    const onlyBmId: string | undefined = body?.bm_id;

    let q = admin.from("meta_business_managers").select("id, meta_bm_id, name, status, meta_app_id");
    if (onlyBmId) q = q.eq("id", onlyBmId);
    const { data: bms } = await q;
    if (!bms?.length) return json({ sucesso: true, varridas: 0, usuarios: 0 });

    const fetchEdge = async (metaBmId: string, edge: string, token: string) => {
      const url = `${GRAPH}/${metaBmId}/${edge}?fields=id,name,email,role&limit=200&access_token=${token}`;
      try {
        const r = await fetch(url);
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return { data: [], error: j?.error?.message || `HTTP ${r.status}`, code: j?.error?.code, type: j?.error?.type, subcode: j?.error?.error_subcode };
        return { data: j.data || [], error: null };
      } catch (e) { return { data: [], error: (e as Error).message }; }
    };

    // Processa BMs em paralelo (concorrência limitada) — evita timeout de conexão
    const results = await pMap(bms, CONCURRENCY, async (bm: any) => {
      const token = (bm.meta_app_id && tokenByApp.get(bm.meta_app_id)) || fallbackToken!;
      const [bu, su] = await Promise.all([
        fetchEdge(bm.meta_bm_id, "business_users", token),
        fetchEdge(bm.meta_bm_id, "system_users", token),
      ]);
      const users = [
        ...bu.data.map((u: any) => ({ id: u.id, name: u.name, email: u.email || null, role: u.role || null, kind: "business" })),
        ...su.data.map((u: any) => ({ id: u.id, name: u.name, email: null, role: u.role || null, kind: "system" })),
      ];
      return { bm, users, bu, su };
    });

    let totalUsers = 0;
    const detectedRows: any[] = [];
    const report: any[] = [];
    const auditErrors: any[] = [];

    for (const { bm, users, bu, su } of results) {
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
      const errors = [bu.error, su.error].filter(Boolean);
      report.push({
        bm_id: bm.id, name: bm.name, meta_bm_id: bm.meta_bm_id,
        users: users.length, business_users: bu.data.length, system_users: su.data.length,
        errors,
        used_app_token: bm.meta_app_id && tokenByApp.has(bm.meta_app_id) ? "per-app" : "fallback",
      });
      if (errors.length && users.length === 0) {
        auditErrors.push({
          bm_id: bm.id, bm_name: bm.name, meta_bm_id: bm.meta_bm_id,
          erro_business_users: bu.error, codigo_bu: bu.code, tipo_bu: bu.type,
          erro_system_users: su.error, codigo_su: su.code, tipo_su: su.type,
        });
      }
    }

    if (detectedRows.length) {
      for (let i = 0; i < detectedRows.length; i += 500) {
        await admin.from("bm_detected_users").upsert(detectedRows.slice(i, i + 500), { onConflict: "bm_id,meta_user_id" });
      }
    }

    // Auto-sync de backups via whitelist
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

    const failed = report.filter(r => r.users === 0 && r.errors.length > 0);

    // Audit: resumo + amostra de falhas para fácil diagnóstico
    if (auditErrors.length) {
      // Agrupa erros por mensagem para sugerir solução genérica
      const byMsg: Record<string, number> = {};
      for (const e of auditErrors) {
        const m = e.erro_business_users || e.erro_system_users || "desconhecido";
        byMsg[m] = (byMsg[m] || 0) + 1;
      }
      const principal = Object.entries(byMsg).sort((a,b) => b[1]-a[1])[0]?.[0] || "";
      let solucao = "Verifique o token Meta e a permissão do usuário na BM.";
      if (/access token/i.test(principal)) solucao = "Token Meta inválido/expirado. Gere novo User Access Token no Graph API Explorer com permissão business_management e atualize o secret META_USER_ACCESS_TOKEN.";
      else if (/permission|do not have permission|not authorized/i.test(principal)) solucao = "O usuário do token não tem acesso de Admin a essas BMs. Adicione-o em Business Settings > Users de cada BM.";
      else if (/rate|limit/i.test(principal)) solucao = "Rate limit do Meta atingido. Aguarde alguns minutos e tente novamente.";

      await logAudit(admin, {
        actor_id: actorId, actor_email: actorEmail,
        action: "scan_bm_backups_partial_failure",
        entity: "meta_business_managers",
        metadata: {
          bms_totais: bms.length,
          bms_com_falha: failed.length,
          usuarios_detectados: totalUsers,
          erro_principal: principal,
          ocorrencias_por_erro: byMsg,
          solucao_sugerida: solucao,
          falhas_amostra: auditErrors.slice(0, 10),
        },
      });
    } else {
      await logAudit(admin, {
        actor_id: actorId, actor_email: actorEmail,
        action: "scan_bm_backups_success",
        entity: "meta_business_managers",
        metadata: { bms_varridas: bms.length, usuarios_detectados: totalUsers, backups_vinculados: backupLinks },
      });
    }

    return json({
      sucesso: true,
      bms_varridas: bms.length,
      usuarios_detectados: totalUsers,
      backups_vinculados: backupLinks,
      bms_com_falha: failed.length,
      falhas_amostra: failed.slice(0, 10),
      relatorio: report,
    });
  } catch (e) {
    const msg = (e as Error).message;
    await logAudit(admin, {
      actor_id: actorId, actor_email: actorEmail,
      action: "scan_bm_backups_fatal_error",
      entity: "meta_business_managers",
      metadata: {
        erro: msg,
        stack: (e as Error).stack?.slice(0, 2000),
        solucao_sugerida: /token/i.test(msg)
          ? "Verifique/atualize o secret META_USER_ACCESS_TOKEN."
          : "Confira logs da edge function scan-bm-backups para detalhes.",
      },
    });
    return json({ erro: msg }, 500);
  }
});
