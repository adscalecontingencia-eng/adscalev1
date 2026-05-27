// Called after a Google OAuth sign-in to (a) ensure the user has a client row
// and the 'client' role, and (b) save the phone provided in the post-OAuth form.
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
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Sessão inválida" }, 401);

    const user = userData.user;
    const { phone, name } = await req.json().catch(() => ({}));
    const normalizedPhone = normalizePhone(phone || "");
    if (!normalizedPhone) return json({ error: "Telefone inválido" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const email = (user.email || "").toLowerCase();
    const displayName = (name && String(name).trim()) || user.user_metadata?.full_name || user.user_metadata?.name || email.split("@")[0];

    // Find or create the client row
    let { data: client } = await admin
      .from("clients")
      .select("id, auth_user_id, phone")
      .or(`auth_user_id.eq.${user.id},email.ilike.${email}`)
      .maybeSingle();

    if (!client) {
      const { data: created, error: insErr } = await admin
        .from("clients")
        .insert({
          name: displayName,
          email,
          password: "",
          payment_type: "fixed",
          fixed_value: 0,
          percentage_value: 0,
          ad_accounts: 0,
          used_accounts: 0,
          blocked_accounts: 0,
          phone: normalizedPhone,
          whatsapp_phone: normalizedPhone,
          auth_user_id: user.id,
        })
        .select("id")
        .single();
      if (insErr) return json({ error: "Erro ao criar cliente" }, 500);
      client = { id: created.id, auth_user_id: user.id, phone: normalizedPhone };
    } else {
      await admin
        .from("clients")
        .update({
          phone: normalizedPhone,
          whatsapp_phone: normalizedPhone,
          auth_user_id: user.id,
        })
        .eq("id", client.id);
    }

    // Ensure the 'client' role
    const { data: existingRole } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "client")
      .maybeSingle();
    if (!existingRole) {
      await admin.from("user_roles").insert({ user_id: user.id, role: "client" });
    }

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
