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
    const { action, email } = await req.json();
    const allowed = new Set(["login", "logout", "login_failed"]);
    if (!allowed.has(action)) return json({ error: "Invalid action" }, 400);
    if (email !== undefined && email !== null && (typeof email !== "string" || email.length > 255)) {
      return json({ error: "Invalid email" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Resolve auth user from Bearer token (required for 'login'/'logout', optional for 'login_failed')
    let authUserId: string | null = null;
    let authedEmail: string | null = null;
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data } = await admin.auth.getUser(token);
      if (data.user) {
        authUserId = data.user.id;
        authedEmail = data.user.email?.toLowerCase() || null;
      }
    }

    if ((action === "login" || action === "logout") && !authUserId) {
      return json({ error: "Authentication required" }, 401);
    }

    // Derive role server-side from user_roles — never trust client-provided role
    let derivedRole: string | null = null;
    if (authUserId) {
      const { data: roleRow } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", authUserId)
        .maybeSingle();
      derivedRole = (roleRow as any)?.role ?? null;
    }

    // For authenticated actions, force email to the authenticated user's email
    const finalEmail =
      authedEmail || (action === "login_failed" ? (typeof email === "string" ? email.toLowerCase() : null) : null);

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "";
    const ua = req.headers.get("user-agent") || "";
    const country = req.headers.get("cf-ipcountry") || "";
    const city = req.headers.get("cf-ipcity") || "";

    await admin.from("access_logs").insert({
      auth_user_id: authUserId,
      email: finalEmail,
      role: derivedRole,
      action,
      ip_address: ip,
      user_agent: ua,
      country,
      city,
      metadata: {},
    });

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
