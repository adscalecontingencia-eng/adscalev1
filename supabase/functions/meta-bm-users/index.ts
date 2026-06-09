// Lista usuários business_users vinculados a uma BM Meta usando o token do perfil.
// POST { meta_bm_id: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GRAPH = "https://graph.facebook.com/v21.0";
const cleanToken = (token?: string | null) => (token || "").replace(/\s+/g, "").trim();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function logAudit(supabase: any, metadata: Record<string, unknown>, actor_id?: string | null, actor_email?: string | null) {
  try {
    await supabase.from("audit_log").insert({
      actor_id: actor_id ?? null,
      actor_email: actor_email ?? null,
      action: "meta_bm_users_error",
      entity: "meta_business_managers",
      metadata: {
        ...metadata,
        solucao_sugerida: "Use o token do perfil Admin da BM e evite buscar system_users quando o token não tiver VIEW_SYSTEM_USERS.",
      },
    });
  } catch (_) { /* silencioso */ }
}

async function fetchJson(url: string) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    const msg = j?.error?.message || (!r.ok ? `HTTP ${r.status}` : "");
    const code = Number(j?.error?.code);
    const retry = r.status === 429 || r.status >= 500 || [4, 17, 32, 613].includes(code) || /rate|limit|throttl/i.test(msg);
    if ((!r.ok || j?.error) && retry && i < 3) {
      await sleep(Math.min(60000, 8000 * Math.pow(2, i)));
      continue;
    }
    if (!r.ok || j?.error) return { data: null, error: msg || "Erro Meta" };
    return { data: j, error: null };
  }
  return { data: null, error: "Meta em rate limit" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "Use POST" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ erro: "Não autenticado" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ erro: "Não autenticado" }, 401);
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const ok = (roles || []).some((r: any) => r.role === "admin" || r.role === "support");
    if (!ok) return json({ erro: "Acesso negado" }, 403);

    const { meta_bm_id } = await req.json();
    if (!meta_bm_id) return json({ erro: "meta_bm_id é obrigatório" }, 400);

    // PRIORIDADE: User Access Token do perfil (cobre todas as BMs onde o usuário é Admin)
    let token = cleanToken(Deno.env.get("META_USER_ACCESS_TOKEN"));
    const { data: app } = await supabase
      .from("meta_apps")
      .select("system_user_token,user_access_token")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!token && app?.user_access_token) token = cleanToken(app.user_access_token);
    if (!token && app?.system_user_token) token = cleanToken(app.system_user_token);
    if (!token) token = cleanToken(Deno.env.get("META_SYSTEM_USER_TOKEN"));
    if (!token) return json({ erro: "Sem token Meta configurado" }, 400);

    const fields = "id,name,business_users.limit(200){id,name,email,role}";
    const url = `${GRAPH}/${meta_bm_id}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`;
    const bu = await fetchJson(url);
    if (bu.error) {
      await logAudit(supabase, { meta_bm_id, erro: bu.error, endpoint: `/${meta_bm_id}?fields=business_users` }, user.id, user.email ?? null);
      return json({ sucesso: false, erro: bu.error, usuarios: [], erros: [bu.error] }, 400);
    }

    const users = [
      ...((bu.data?.business_users?.data || []).map((u: any) => ({ id: u.id, name: u.name, email: u.email || null, role: u.role || null, kind: "business" }))),
    ];

    return json({ sucesso: true, usuarios: users, erros: [] });
  } catch (e) {
    const msg = (e as Error).message;
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await logAudit(supabase, { erro: msg, stack: (e as Error).stack?.slice(0, 2000) });
    } catch (_) { /* silencioso */ }
    return json({ erro: msg }, 500);
  }
});
