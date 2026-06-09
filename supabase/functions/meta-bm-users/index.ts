// Lista usuários (business_users + system_users) vinculados a uma BM Meta
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

    // Try to get a token: prefer a saved meta_app token, fallback to env system user token
    let token = Deno.env.get("META_SYSTEM_USER_TOKEN") || Deno.env.get("META_USER_ACCESS_TOKEN");
    const { data: app } = await supabase
      .from("meta_apps")
      .select("system_user_token,user_access_token")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (app?.system_user_token) token = app.system_user_token;
    else if (app?.user_access_token) token = app.user_access_token;
    if (!token) return json({ erro: "Sem token Meta configurado" }, 400);

    const fetchEdge = async (edge: string) => {
      const url = `${GRAPH}/${meta_bm_id}/${edge}?fields=id,name,email,role&limit=200&access_token=${token}`;
      const r = await fetch(url);
      const j = await r.json();
      if (!r.ok) return { error: j?.error?.message || `Falha em ${edge}`, data: [] };
      return { data: j.data || [] };
    };

    const [bu, su] = await Promise.all([fetchEdge("business_users"), fetchEdge("system_users")]);

    const users = [
      ...(bu.data || []).map((u: any) => ({ id: u.id, name: u.name, email: u.email || null, role: u.role || null, kind: "business" })),
      ...(su.data || []).map((u: any) => ({ id: u.id, name: u.name, email: null, role: u.role || null, kind: "system" })),
    ];

    return json({ sucesso: true, usuarios: users, erros: [bu.error, su.error].filter(Boolean) });
  } catch (e) {
    return json({ erro: (e as Error).message }, 500);
  }
});
