import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { email, password, accept_terms, terms_version } = await req.json();

    if (!email || !password) return json({ error: "E-mail e senha obrigatórios" }, 400);
    if (typeof email !== "string" || email.length > 255) return json({ error: "E-mail inválido" }, 400);
    if (typeof password !== "string" || password.length < 8 || password.length > 200)
      return json({ error: "A senha precisa de pelo menos 8 caracteres" }, 400);
    if (!accept_terms) return json({ error: "É necessário aceitar o termo de uso" }, 400);
    if (!terms_version || typeof terms_version !== "string") return json({ error: "Versão do termo ausente" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const normEmail = email.trim().toLowerCase();

    // Find existing client record (may have been pre-registered by admin)
    const { data: existing, error: cliErr } = await admin
      .from("clients")
      .select("id, email, auth_user_id, name")
      .ilike("email", normEmail)
      .maybeSingle();

    if (cliErr) return json({ error: "Erro ao consultar cadastro" }, 500);
    if (existing?.auth_user_id) return json({ error: "Este e-mail já possui acesso ativo. Faça login." }, 409);

    let client = existing;
    // Auto-register: if no client row exists, create a pending one
    if (!client) {
      const defaultName = normEmail.split("@")[0];
      const { data: created, error: insErr } = await admin
        .from("clients")
        .insert({
          name: defaultName,
          email: normEmail,
          password: "",
          payment_type: "fixed",
          fixed_value: 0,
          percentage_value: 0,
          ad_accounts: 0,
          used_accounts: 0,
          blocked_accounts: 0,
        })
        .select("id, email, auth_user_id, name")
        .single();
      if (insErr || !created) return json({ error: "Erro ao registrar cliente" }, 500);
      client = created;
    }

    // Create auth user
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email: normEmail,
      password,
      email_confirm: true,
      user_metadata: { name: client.name, role: "client" },
    });
    if (authErr || !created.user) return json({ error: authErr?.message || "Erro ao criar usuário" }, 400);

    const uid = created.user.id;

    // Link client + grant role
    await admin.from("clients").update({ auth_user_id: uid }).eq("id", client.id);
    await admin.from("user_roles").insert({ user_id: uid, role: "client" });

    // Capture connection info
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "";
    const ua = req.headers.get("user-agent") || "";
    const country = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || "";
    const city = req.headers.get("cf-ipcity") || req.headers.get("x-vercel-ip-city") || "";

    // Record terms acceptance
    await admin.from("client_terms_acceptances").insert({
      client_id: client.id,
      auth_user_id: uid,
      email: normEmail,
      terms_version,
      ip_address: ip,
      user_agent: ua,
    });

    // Record signup access log
    await admin.from("access_logs").insert({
      auth_user_id: uid,
      email: normEmail,
      role: "client",
      action: "signup",
      ip_address: ip,
      user_agent: ua,
      country,
      city,
      metadata: { terms_version },
    });

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
