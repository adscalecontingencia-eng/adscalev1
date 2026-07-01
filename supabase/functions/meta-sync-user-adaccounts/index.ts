// Syncs ALL ad accounts accessible by the User Access Token of a meta_app.
// Request: { meta_app_id: uuid, dry_run?: boolean }
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

async function fetchJson(url: string) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && !body?.error, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { meta_app_id, dry_run = false } = await req.json();
    if (!meta_app_id) return json({ error: "meta_app_id obrigatório" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: app } = await supabase.from("meta_apps").select("*").eq("id", meta_app_id).single();
    if (!app) return json({ error: "App não encontrado" }, 404);
    const token = app.user_access_token;
    if (!token) return json({ error: "User Access Token não configurado" }, 400);

    const fields = "id,name,account_id,account_status,business,currency,timezone_name,disable_reason,created_time";
    let url: string | null = `${META_API}/me/adaccounts?fields=${encodeURIComponent(fields)}&limit=200&access_token=${encodeURIComponent(token)}`;
    const accounts: any[] = [];

    while (url) {
      const { ok, body } = await fetchJson(url);
      if (!ok) {
        return json({ ok: false, error: sanitizeErr(body?.error?.message || "Erro ao buscar contas"), fb_error: body?.error || null }, 200);
      }
      const chunk = Array.isArray(body?.data) ? body.data : [];
      accounts.push(...chunk);
      url = body?.paging?.next || null;
    }

    let active = 0, disabled = 0, upserted = 0;
    const rows = accounts.map((a: any) => {
      const status = Number(a.account_status);
      if (status === 1) active++; else disabled++;
      return {
        meta_app_id,
        meta_account_id: a.id, // "act_123"
        name: a.name || a.id,
        account_status: Number.isFinite(status) ? status : null,
        currency: a.currency || null,
        timezone_name: a.timezone_name || null,
        disable_reason: a.disable_reason ?? null,
        business_id: a.business?.id || null,
        business_name: a.business?.name || null,
        account_created_time: a.created_time || null,
        raw_json: a,
        last_synced_at: new Date().toISOString(),
      };
    });

    if (!dry_run && rows.length) {
      // Upsert by meta_account_id (unique globally). Also carries meta_app_id.
      const { error: upErr, count } = await supabase
        .from("meta_ad_accounts")
        .upsert(rows, { onConflict: "meta_account_id", count: "exact" });
      if (upErr) return json({ ok: false, error: sanitizeErr(upErr.message) }, 500);
      upserted = count ?? rows.length;
    }

    return json({
      ok: true,
      total: accounts.length,
      active,
      disabled,
      upserted,
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        account_status: a.account_status,
        business: a.business || null,
        currency: a.currency,
      })),
    });
  } catch (e: any) {
    return json({ error: sanitizeErr(e?.message || "internal error") }, 500);
  }
});
