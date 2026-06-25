// Edge Function: wallet-simulate-payment
// SANDBOX ONLY: aprova manualmente um depósito Pix e credita a carteira.
// Bloqueado quando MERCADO_PAGO_ENV != "test".
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isTestMode() {
  const env = (Deno.env.get("MERCADO_PAGO_ENV") || "test").trim().toLowerCase();
  return !["live", "production", "prod"].includes(env);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const reqId = crypto.randomUUID().slice(0, 8);
  const log = (...a: unknown[]) => console.log(`[wallet-sim ${reqId}]`, ...a);

  try {
    if (!isTestMode()) {
      return json({ error: "Simulação desabilitada em produção" }, 403);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthenticated" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claims } = await anon.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    if (!userId) return json({ error: "Unauthenticated" }, 401);

    const body = (await req.json().catch(() => ({}))) as { deposit_id?: string };
    const depositId = body?.deposit_id;
    if (!depositId) return json({ error: "deposit_id obrigatório" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: dep, error: depErr } = await admin
      .from("wallet_deposits")
      .select("id, user_id, status, external_reference, mercado_pago_payment_id, credited_at")
      .eq("id", depositId)
      .maybeSingle();

    if (depErr || !dep) return json({ error: "Depósito não encontrado" }, 404);
    if (dep.user_id !== userId) return json({ error: "Acesso negado" }, 403);
    if (dep.credited_at) {
      return json({ ok: true, already_credited: true });
    }

    log("simulating approval", { depositId, externalReference: dep.external_reference });

    const { data: res, error: rpcErr } = await admin.rpc("credit_wallet_from_deposit", {
      _external_reference: dep.external_reference,
      _mp_payment_id: dep.mercado_pago_payment_id ?? `sim-${Date.now()}`,
      _raw: { simulated: true, at: new Date().toISOString() },
    });

    if (rpcErr) {
      console.error(`[wallet-sim ${reqId}] rpc error`, rpcErr);
      return json({ error: "Falha ao creditar", details: rpcErr.message }, 500);
    }

    log("done", res);
    return json({ ok: true, result: res });
  } catch (err) {
    console.error(`[wallet-sim ${reqId}] error`, err);
    return json({ error: (err as Error).message }, 500);
  }
});
