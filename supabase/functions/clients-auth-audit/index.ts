import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await admin.auth.getUser(token);
    if (authError || !caller) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .in("role", ["admin", "support"]);
    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load all clients
    const { data: clients, error: cliErr } = await admin
      .from("clients")
      .select("id, name, email, auth_user_id, created_at")
      .order("name");
    if (cliErr) throw cliErr;

    // Load all auth users (paginated)
    const authUsers: any[] = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      authUsers.push(...(data.users || []));
      if (!data.users || data.users.length < perPage) break;
      page += 1;
      if (page > 50) break;
    }

    const byId = new Map<string, any>(authUsers.map((u) => [u.id, u]));
    const byEmail = new Map<string, any>(authUsers.map((u) => [(u.email || "").toLowerCase(), u]));

    // Load roles in one shot
    const { data: roles } = await admin.from("user_roles").select("user_id, role");
    const rolesByUser = new Map<string, string[]>();
    (roles || []).forEach((r: any) => {
      const arr = rolesByUser.get(r.user_id) || [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });

    const report = (clients || []).map((c: any) => {
      const email = (c.email || "").toLowerCase();
      const linked = c.auth_user_id ? byId.get(c.auth_user_id) : null;
      const matchedByEmail = byEmail.get(email);
      const authUser = linked || matchedByEmail || null;

      const issues: string[] = [];
      if (!c.auth_user_id) issues.push("sem_auth_user_id");
      if (!authUser) issues.push("usuario_auth_nao_encontrado");
      if (linked && matchedByEmail && linked.id !== matchedByEmail.id) issues.push("email_diverge_do_auth");
      if (!linked && matchedByEmail) issues.push("auth_existe_mas_nao_vinculado");
      if (authUser && !authUser.email_confirmed_at) issues.push("email_nao_confirmado");
      const userRoles = authUser ? (rolesByUser.get(authUser.id) || []) : [];
      if (authUser && !userRoles.includes("client")) issues.push("sem_role_client");
      if (authUser && authUser.email && authUser.email.toLowerCase() !== email) issues.push("email_difere_entre_tabelas");

      return {
        client_id: c.id,
        name: c.name,
        client_email: c.email,
        client_auth_user_id: c.auth_user_id,
        auth_user_id: authUser?.id || null,
        auth_email: authUser?.email || null,
        email_confirmed_at: authUser?.email_confirmed_at || null,
        last_sign_in_at: authUser?.last_sign_in_at || null,
        created_at_auth: authUser?.created_at || null,
        roles: userRoles,
        status: issues.length === 0 ? "ok" : "atencao",
        issues,
      };
    });

    // Auth users with role=client that have NO matching client row
    const orphanAuth = authUsers
      .filter((u) => (rolesByUser.get(u.id) || []).includes("client"))
      .filter((u) => !clients?.some((c: any) => c.auth_user_id === u.id))
      .map((u) => ({
        auth_user_id: u.id,
        auth_email: u.email,
        email_confirmed_at: u.email_confirmed_at,
        last_sign_in_at: u.last_sign_in_at,
        created_at_auth: u.created_at,
      }));

    const summary = {
      total_clients: clients?.length || 0,
      total_auth_users: authUsers.length,
      ok: report.filter((r) => r.status === "ok").length,
      with_issues: report.filter((r) => r.status === "atencao").length,
      orphan_auth_count: orphanAuth.length,
    };

    return new Response(JSON.stringify({ summary, report, orphan_auth: orphanAuth }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
