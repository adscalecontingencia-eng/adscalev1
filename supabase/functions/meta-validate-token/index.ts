// Validates a Meta access token stored in meta_apps using /debug_token.
// Request: { meta_app_id: uuid, token_type?: "user" | "system" }
// Returns validation info and updates meta_apps with cached metadata.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const META_API = "https://graph.facebook.com/v21.0";
const REQUIRED_SCOPES = ["ads_read", "ads_management", "business_management"];

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function sanitizeErr(msg: string): string {
  return String(msg || "").replace(/access_token=[^&\s"']+/gi, "access_token=***");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { meta_app_id, token_type = "user" } = await req.json();
    if (!meta_app_id) return json({ error: "meta_app_id obrigatório" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: app, error } = await supabase.from("meta_apps").select("*").eq("id", meta_app_id).single();
    if (error || !app) return json({ error: "App não encontrado" }, 404);

    const token = token_type === "system" ? app.system_user_token : app.user_access_token;
    if (!token) return json({ error: `${token_type === "system" ? "System User Token" : "User Access Token"} não configurado` }, 400);
    if (!app.app_id || !app.app_secret) return json({ error: "app_id/app_secret ausentes" }, 400);

    const appAccessToken = `${app.app_id}|${app.app_secret}`;
    const url = `${META_API}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appAccessToken)}`;
    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));

    if (body?.error) {
      return json({ ok: false, valid: false, error: sanitizeErr(body.error.message || "Erro debug_token"), fb_error: body.error }, 200);
    }

    const d = body?.data || {};
    const isValid = !!d.is_valid;
    const scopes: string[] = Array.isArray(d.scopes) ? d.scopes : [];
    const missing = REQUIRED_SCOPES.filter((s) => !scopes.includes(s));
    const expiresAt = d.expires_at ? new Date(d.expires_at * 1000).toISOString() : null;
    const issuedAt = d.issued_at ? new Date(d.issued_at * 1000).toISOString() : null;
    const dataAccessExp = d.data_access_expires_at ? new Date(d.data_access_expires_at * 1000).toISOString() : null;

    await supabase.from("meta_apps").update({
      token_scopes: scopes,
      token_expires_at: expiresAt,
      token_issued_at: issuedAt,
      data_access_expires_at: dataAccessExp,
      token_user_id: d.user_id || null,
      token_type,
      last_validated_at: new Date().toISOString(),
      validation_status: {
        is_valid: isValid,
        app_id: d.app_id,
        type: d.type,
        missing_scopes: missing,
        expires_at: expiresAt,
      },
    }).eq("id", meta_app_id);

    return json({
      ok: true,
      valid: isValid,
      app_id: d.app_id,
      token_type: d.type,
      user_id: d.user_id,
      scopes,
      missing_scopes: missing,
      expires_at: expiresAt,
      issued_at: issuedAt,
      data_access_expires_at: dataAccessExp,
      granular_scopes: d.granular_scopes || null,
    });
  } catch (e: any) {
    return json({ error: sanitizeErr(e?.message || "internal error") }, 500);
  }
});
