// Edge Function: mercado-pago-validate
// Admin-only. Validates current Mercado Pago credentials and optionally creates a real R$1 Pix to confirm production setup.
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

function maskToken(t?: string | null) {
  if (!t) return "(missing)";
  return `${t.slice(0, 8)}…${t.slice(-4)} (len=${t.length})`;
}

function isTestEnv() {
  const env = (Deno.env.get("MERCADO_PAGO_ENV") || "test").trim().toLowerCase();
  return !["live", "production", "prod"].includes(env);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const reqId = crypto.randomUUID().slice(0, 8);
  const log = (...args: unknown[]) => console.log(`[mp-validate ${reqId}]`, ...args);

  try {
    // Auth: must be admin
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthenticated" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claims } = await anon.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    if (!userId) return json({ error: "Unauthenticated" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden (admin only)" }, 403);

    const body = (await req.json().catch(() => ({}))) as { create_pix?: boolean; amount?: number };
    const doPix = body?.create_pix !== false; // default true
    const amount = Number(body?.amount ?? 1);

    const env = (Deno.env.get("MERCADO_PAGO_ENV") || "test").trim().toLowerCase();
    const isSandbox = isTestEnv();
    const tokenName = isSandbox ? "MERCADO_PAGO_ACCESS_TOKEN_TEST" : "MERCADO_PAGO_ACCESS_TOKEN_LIVE";
    const accessToken = Deno.env.get(tokenName);

    const result: any = {
      env,
      mode: isSandbox ? "sandbox" : "production",
      token_source: tokenName,
      token_masked: maskToken(accessToken),
      token_prefix: accessToken ? accessToken.split("-")[0] : null,
      token_present: !!accessToken,
      checks: {} as Record<string, any>,
    };

    if (!accessToken) {
      result.checks.token = { ok: false, error: `Secret ${tokenName} não configurado.` };
      return json(result, 200);
    }

    // 1) Validate token via /users/me
    log("calling /users/me");
    const meRes = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const meData = await meRes.json().catch(() => ({}));
    result.checks.users_me = {
      ok: meRes.ok,
      http_status: meRes.status,
      user_id: meData?.id ?? null,
      nickname: meData?.nickname ?? null,
      email: meData?.email ?? null,
      site_id: meData?.site_id ?? null,
      country_id: meData?.country_id ?? null,
      tags: meData?.tags ?? null,
      error: meRes.ok ? null : (meData?.message || meData?.error || "Falha na validação do token"),
    };
    log("users/me", { ok: meRes.ok, status: meRes.status });

    // Sanity: prefix must match env
    if (!isSandbox && accessToken.startsWith("TEST-")) {
      result.checks.prefix = { ok: false, error: "MERCADO_PAGO_ENV=live mas o token começa com TEST-. Atualize MERCADO_PAGO_ACCESS_TOKEN_LIVE." };
    } else if (isSandbox && accessToken.startsWith("APP_USR-")) {
      result.checks.prefix = { ok: false, error: "MERCADO_PAGO_ENV=test mas o token começa com APP_USR-. Use o token TEST- em MERCADO_PAGO_ACCESS_TOKEN_TEST." };
    } else {
      result.checks.prefix = { ok: true };
    }

    // 2) Try creating a small Pix order to confirm end-to-end
    if (doPix && meRes.ok && result.checks.prefix.ok) {
      const externalReference = `validate-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const idempotencyKey = crypto.randomUUID();
      const amountStr = amount.toFixed(2);
      const payerEmail = isSandbox
        ? (Deno.env.get("MP_TEST_BUYER_EMAIL")?.trim() || "test_user_adscale@testuser.com")
        : (meData?.email || "pagamentos@adscale.app");

      const mpPayload = {
        type: "online",
        processing_mode: "automatic",
        external_reference: externalReference,
        total_amount: amountStr,
        description: `Validação integração AD•SCALE`,
        payer: { email: payerEmail, first_name: isSandbox ? "APRO" : "AD SCALE" },
        transactions: { payments: [{ amount: amountStr, payment_method: { id: "pix", type: "bank_transfer" } }] },
      };
      log("creating validation pix", { externalReference, amount: amountStr });

      const mpRes = await fetch("https://api.mercadopago.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(mpPayload),
      });
      const mpData = await mpRes.json().catch(() => ({}));
      const tx = mpData?.transactions?.payments?.[0] ?? {};
      const pm = tx?.payment_method ?? {};
      const txData = tx?.point_of_interaction?.transaction_data ?? {};
      const qr = pm?.qr_code ?? txData?.qr_code ?? null;

      result.checks.pix_create = {
        ok: mpRes.ok,
        http_status: mpRes.status,
        mp_order_id: mpData?.id ?? null,
        mp_payment_id: tx?.id ?? null,
        status: mpData?.status ?? tx?.status ?? null,
        has_qr: !!qr,
        external_reference: externalReference,
        error: mpRes.ok ? null : (mpData?.message || mpData?.cause?.[0]?.description || JSON.stringify(mpData).slice(0, 400)),
      };
      log("validation pix", { ok: mpRes.ok, status: mpRes.status });
    }

    result.ok = result.checks.users_me?.ok && result.checks.prefix?.ok && (!doPix || result.checks.pix_create?.ok);
    return json(result);
  } catch (err) {
    console.error("mercado-pago-validate error", err);
    return json({ error: (err as Error).message }, 500);
  }
});
