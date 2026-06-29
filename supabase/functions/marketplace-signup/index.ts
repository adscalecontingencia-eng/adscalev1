import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const normalizePhone = (raw: string) => {
  const digits = (raw || "").replace(/\D+/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { email, password, name, phone, terms_accepted, terms_version } = await req.json();
    if (!email || !password) return json({ error: "E-mail e senha obrigatórios" }, 400);
    if (typeof email !== "string" || email.length > 255) return json({ error: "E-mail inválido" }, 400);
    if (typeof password !== "string" || password.length < 8) return json({ error: "Senha precisa de 8+ caracteres" }, 400);
    if (!name || typeof name !== "string") return json({ error: "Nome obrigatório" }, 400);
    const normalizedPhone = normalizePhone(phone || "");
    if (!normalizedPhone) return json({ error: "Telefone inválido (DDD + número)" }, 400);
    if (!terms_accepted) return json({ error: "Você precisa aceitar os Termos de Uso e a Política de Publicidade" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const normEmail = email.trim().toLowerCase();

    // Check existing role for this email via auth
    const { data: existing } = await admin.auth.admin.listUsers();
    const dup = existing?.users?.find((u) => (u.email || "").toLowerCase() === normEmail);
    if (dup) return json({ error: "Este e-mail já está cadastrado. Faça login." }, 409);

    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email: normEmail,
      password,
      email_confirm: true,
      user_metadata: { name: name.trim(), role: "marketplace_client", phone: normalizedPhone },
    });
    if (authErr || !created.user) return json({ error: authErr?.message || "Erro ao criar usuário" }, 400);

    const uid = created.user.id;
    await admin.from("user_roles").insert({ user_id: uid, role: "marketplace_client" });

    // Initialize wallet
    await admin.from("wallets").insert({ user_id: uid, balance: 0 }).select().maybeSingle();

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    const ua = req.headers.get("user-agent") || "";
    await admin.from("access_logs").insert({
      auth_user_id: uid,
      email: normEmail,
      role: "marketplace_client",
      action: "signup",
      ip_address: ip,
      user_agent: ua,
      metadata: { phone: normalizedPhone, source: "marketplace" },
    });

    // Register terms acceptance
    await admin.from("client_terms_acceptances").insert({
      auth_user_id: uid,
      email: normEmail,
      terms_version: terms_version || "marketplace.v1",
      ip_address: ip,
      user_agent: ua,
    });

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
