// Validates a Meta access token stored in meta_apps using /debug_token AND /me/permissions.
// Request: { meta_app_id: uuid, token_type?: "user" | "system" }
// Verbose logging is emitted at every step to help diagnose permission issues.
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

function sanitize(s: string): string {
  return String(s || "").replace(/access_token=[^&\s"']+/gi, "access_token=***");
}
function mask(t: string | null | undefined): string {
  if (!t) return "(vazio)";
  if (t.length < 12) return "***";
  return `${t.slice(0, 6)}…${t.slice(-4)} (len=${t.length})`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const logs: string[] = [];
  const log = (msg: string, extra?: unknown) => {
    const line = extra !== undefined ? `${msg} ${JSON.stringify(extra)}` : msg;
    console.log("[meta-validate-token]", sanitize(line));
    logs.push(sanitize(line));
  };

  try {
    const { meta_app_id, token_type = "user" } = await req.json();
    log("start", { meta_app_id, token_type });
    if (!meta_app_id) return json({ error: "meta_app_id obrigatório", logs }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: app, error } = await supabase.from("meta_apps").select("*").eq("id", meta_app_id).single();
    if (error || !app) {
      log("app not found", { error: error?.message });
      return json({ error: "App não encontrado", logs }, 404);
    }
    log("app loaded", { label: app.label, app_id: app.app_id, has_secret: !!app.app_secret });

    const token = token_type === "system" ? app.system_user_token : app.user_access_token;
    if (!token) return json({ error: `${token_type === "system" ? "System User Token" : "User Access Token"} não configurado`, logs }, 400);
    if (!app.app_id || !app.app_secret) return json({ error: "app_id/app_secret ausentes", logs }, 400);
    log("token", { masked: mask(token), token_type });

    const appAccessToken = `${app.app_id}|${app.app_secret}`;

    // 1) /debug_token
    const dbgUrl = `${META_API}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appAccessToken)}`;
    log("calling /debug_token", { url: sanitize(dbgUrl) });
    const dbgRes = await fetch(dbgUrl);
    const dbgBody = await dbgRes.json().catch(() => ({}));
    log("/debug_token response", { status: dbgRes.status, body: dbgBody });

    if (dbgBody?.error) {
      return json({ ok: false, valid: false, error: sanitize(dbgBody.error.message || "Erro debug_token"), fb_error: dbgBody.error, logs }, 200);
    }

    const d = dbgBody?.data || {};
    const isValid = !!d.is_valid;
    const flatScopes: string[] = Array.isArray(d.scopes) ? d.scopes : [];
    const granular: any[] = Array.isArray(d.granular_scopes) ? d.granular_scopes : [];
    const granularNames = granular.map((g) => g?.scope).filter((s: any): s is string => typeof s === "string");
    log("debug_token scopes", { flat: flatScopes, granular_names: granularNames, granular_raw: granular });

    // 2) /me/permissions — authoritative list of granted permissions
    let permGranted: string[] = [];
    let permDeclined: string[] = [];
    let permError: any = null;
    try {
      const permUrl = `${META_API}/me/permissions?access_token=${encodeURIComponent(token)}`;
      log("calling /me/permissions");
      const permRes = await fetch(permUrl);
      const permBody = await permRes.json().catch(() => ({}));
      log("/me/permissions response", { status: permRes.status, body: permBody });
      if (permBody?.error) {
        permError = permBody.error;
      } else if (Array.isArray(permBody?.data)) {
        for (const p of permBody.data) {
          if (p?.status === "granted" && typeof p.permission === "string") permGranted.push(p.permission);
          else if (p?.status === "declined" && typeof p.permission === "string") permDeclined.push(p.permission);
        }
      }
    } catch (e: any) {
      permError = { message: e?.message };
      log("/me/permissions failed", { error: e?.message });
    }

    const effectiveScopes = Array.from(new Set([...flatScopes, ...granularNames, ...permGranted]));
    const missing = REQUIRED_SCOPES.filter((s) => !effectiveScopes.includes(s));
    log("effective scopes", { effectiveScopes, missing, declined: permDeclined });

    const expiresAt = d.expires_at ? new Date(d.expires_at * 1000).toISOString() : null;
    const issuedAt = d.issued_at ? new Date(d.issued_at * 1000).toISOString() : null;
    const dataAccessExp = d.data_access_expires_at ? new Date(d.data_access_expires_at * 1000).toISOString() : null;

    await supabase.from("meta_apps").update({
      token_scopes: effectiveScopes,
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
        declined_scopes: permDeclined,
        expires_at: expiresAt,
        flat_scopes: flatScopes,
        granular_scopes: granular,
        permissions_granted: permGranted,
        permissions_declined: permDeclined,
        permissions_error: permError,
      },
    }).eq("id", meta_app_id);

    return json({
      ok: true,
      valid: isValid,
      app_id: d.app_id,
      token_type: d.type,
      user_id: d.user_id,
      scopes: effectiveScopes,
      flat_scopes: flatScopes,
      granular_scopes: granular,
      permissions_granted: permGranted,
      permissions_declined: permDeclined,
      permissions_error: permError,
      missing_scopes: missing,
      expires_at: expiresAt,
      issued_at: issuedAt,
      data_access_expires_at: dataAccessExp,
      debug_raw: d,
      logs,
    });
  } catch (e: any) {
    log("exception", { message: e?.message, stack: e?.stack });
    return json({ error: sanitize(e?.message || "internal error"), logs }, 500);
  }
});
