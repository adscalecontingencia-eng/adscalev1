// Exchanges the short-lived user access token stored in meta_apps for a long-lived one.
// Request: { meta_app_id: uuid }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const META_API = "https://graph.facebook.com/v21.0";
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function sanitizeErr(msg: string): string {
  return String(msg || "").replace(/access_token=[^&\s"']+/gi, "access_token=***");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { meta_app_id } = await req.json();
    if (!meta_app_id) return json({ error: "meta_app_id obrigatório" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: app } = await supabase.from("meta_apps").select("*").eq("id", meta_app_id).single();
    if (!app) return json({ error: "App não encontrado" }, 404);
    if (!app.app_id || !app.app_secret || !app.user_access_token) {
      return json({ error: "App ID, App Secret e User Access Token são obrigatórios" }, 400);
    }

    const url = `${META_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(app.app_id)}&client_secret=${encodeURIComponent(app.app_secret)}&fb_exchange_token=${encodeURIComponent(app.user_access_token)}`;
    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));

    if (body?.error || !body?.access_token) {
      return json({ ok: false, error: sanitizeErr(body?.error?.message || "Falha ao trocar por token longo"), fb_error: body?.error || null }, 200);
    }

    const newToken = body.access_token as string;
    const expiresIn = Number(body.expires_in || 0);
    const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

    await supabase.from("meta_apps").update({
      user_access_token: newToken,
      token_expires_at: expiresAt,
      token_issued_at: new Date().toISOString(),
      token_type: "user",
    }).eq("id", meta_app_id);

    // Validate the new token
    const appAccessToken = `${app.app_id}|${app.app_secret}`;
    const dbgUrl = `${META_API}/debug_token?input_token=${encodeURIComponent(newToken)}&access_token=${encodeURIComponent(appAccessToken)}`;
    const dbg = await fetch(dbgUrl).then((r) => r.json()).catch(() => ({}));
    const d = dbg?.data || {};
    const scopes: string[] = Array.isArray(d.scopes) ? d.scopes : [];
    const finalExp = d.expires_at ? new Date(d.expires_at * 1000).toISOString() : expiresAt;

    await supabase.from("meta_apps").update({
      token_scopes: scopes,
      token_expires_at: finalExp,
      token_user_id: d.user_id || null,
      last_validated_at: new Date().toISOString(),
      validation_status: { is_valid: !!d.is_valid, expires_at: finalExp, missing_scopes: ["ads_read","ads_management","business_management"].filter(s => !scopes.includes(s)) },
    }).eq("id", meta_app_id);

    return json({ ok: true, expires_at: finalExp, expires_in: expiresIn, scopes });
  } catch (e: any) {
    return json({ error: sanitizeErr(e?.message || "internal error") }, 500);
  }
});
