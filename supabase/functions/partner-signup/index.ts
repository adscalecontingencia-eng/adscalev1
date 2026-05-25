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
    const { email, password, name, whatsapp_phone, pix_key } = await req.json();

    if (!email || !password || !name) return json({ error: "Nome, e-mail e senha são obrigatórios" }, 400);
    if (typeof email !== "string" || email.length > 255) return json({ error: "E-mail inválido" }, 400);
    if (typeof password !== "string" || password.length < 8 || password.length > 200)
      return json({ error: "A senha precisa de pelo menos 8 caracteres" }, 400);
    if (typeof name !== "string" || name.trim().length < 2 || name.length > 120)
      return json({ error: "Nome inválido" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const normEmail = email.trim().toLowerCase();

    const { data: existing } = await admin
      .from("partners")
      .select("id, auth_user_id")
      .ilike("email", normEmail)
      .maybeSingle();

    if (existing?.auth_user_id) return json({ error: "Este e-mail já está cadastrado. Faça login." }, 409);

    let partnerId = existing?.id as string | undefined;

    if (!partnerId) {
      const { data: created, error: insErr } = await admin
        .from("partners")
        .insert({
          name: name.trim(),
          email: normEmail,
          whatsapp_phone: whatsapp_phone || null,
          pix_key: pix_key || null,
          commission_pct: 5,
          status: "active",
        })
        .select("id")
        .single();
      if (insErr || !created) return json({ error: insErr?.message || "Erro ao registrar parceiro" }, 500);
      partnerId = created.id;
    }

    const { data: createdUser, error: authErr } = await admin.auth.admin.createUser({
      email: normEmail,
      password,
      email_confirm: true,
      user_metadata: { name, role: "partner" },
    });
    if (authErr || !createdUser.user) return json({ error: authErr?.message || "Erro ao criar usuário" }, 400);

    const uid = createdUser.user.id;

    await admin.from("partners").update({ auth_user_id: uid, status: "active" }).eq("id", partnerId);
    await admin.from("user_roles").insert({ user_id: uid, role: "partner" });

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "";
    const ua = req.headers.get("user-agent") || "";

    await admin.from("access_logs").insert({
      auth_user_id: uid,
      email: normEmail,
      role: "partner",
      action: "signup",
      ip_address: ip,
      user_agent: ua,
    });

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
