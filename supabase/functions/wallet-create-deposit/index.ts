// Edge Function: wallet-create-deposit
// Creates a Pix charge to credit the authenticated user's wallet.
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

async function resolveSandboxPayerEmail(accessToken: string) {
  const cached = Deno.env.get("MP_TEST_BUYER_EMAIL")?.trim();
  if (cached) return cached;

  const tuRes = await fetch("https://api.mercadopago.com/users/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ site_id: "MLB", description: `AD SCALE buyer ${crypto.randomUUID().slice(0, 8)}` }),
  });
  const tuData = await tuRes.json().catch(() => ({}));
  if (!tuRes.ok || !tuData?.email) {
    console.error("MP test_user error", tuRes.status, tuData);
    throw new Error("Falha ao criar usuário de teste do Mercado Pago");
  }

  console.log("MP test buyer created", { email: tuData.email, id: tuData.id });
  return tuData.email as string;
}

function isMercadoPagoTestMode() {
  const env = (Deno.env.get("MERCADO_PAGO_ENV") || "test").trim().toLowerCase();
  return !["live", "production", "prod"].includes(env);
}

function mercadoPagoErrorMessage(data: any) {
  const message = data?.message || data?.error || data?.cause?.[0]?.description;
  const detail = data?.errors?.[0]?.details?.[0] || data?.errors?.[0]?.message;
  if (`${message} ${detail}`.toLowerCase().includes("unauthorized use of live credentials")) {
    return "Credencial Mercado Pago incorreta: use um Access Token de TESTE que comece com TEST- no segredo MERCADO_PAGO_ACCESS_TOKEN_TEST.";
  }
  if (`${message} ${detail}`.toLowerCase().includes("invalid_users_involved")) {
    return "Mercado Pago recusou o pagador de teste. Atualize o segredo MERCADO_PAGO_ACCESS_TOKEN_TEST com o token TEST- da mesma aplicação.";
  }
  return message || detail || "Erro ao gerar Pix";
}

function normalizeLivePayerEmail(email: string) {
  const clean = email.trim().toLowerCase();
  if (!clean || clean.endsWith("@testuser.com")) return "pagamentos@adscale.app";
  return clean;
}

function maskToken(t?: string | null) {
  if (!t) return "(missing)";
  return `${t.slice(0, 8)}…${t.slice(-4)} (len=${t.length})`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const reqId = crypto.randomUUID().slice(0, 8);
  const log = (...args: unknown[]) => console.log(`[wallet-deposit ${reqId}]`, ...args);
  try {
    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_TEST");
    log("start", {
      mp_env: Deno.env.get("MERCADO_PAGO_ENV") || "(unset)",
      token: maskToken(accessToken),
      token_prefix: accessToken ? accessToken.split("-")[0] : null,
    });
    if (!accessToken) return json({ error: "MP token missing" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthenticated" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claims } = await anon.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    log("auth", { userId });
    if (!userId) return json({ error: "Unauthenticated" }, 401);

    const body = (await req.json()) as { amount?: number; customer_name?: string; customer_email?: string };
    const amount = Number(body?.amount ?? 0);
    log("input", { amount, has_email: !!body?.customer_email, has_name: !!body?.customer_name });
    if (!(amount > 0) || amount < 1 || amount > 100000) return json({ error: "Valor inválido" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: userInfo } = await admin.auth.admin.getUserById(userId);
    const rawEmail = body?.customer_email || userInfo?.user?.email || "user@example.com";
    const name =
      body?.customer_name ||
      (userInfo?.user?.user_metadata as any)?.name ||
      (userInfo?.user?.user_metadata as any)?.full_name ||
      rawEmail.split("@")[0];

    const isSandbox = isMercadoPagoTestMode();
    const payerEmail = isSandbox
      ? (Deno.env.get("MP_TEST_BUYER_EMAIL")?.trim() || "test_user_adscale@testuser.com")
      : normalizeLivePayerEmail(rawEmail);
    log("payer", { isSandbox, payerEmail, name });

    const externalReference = `dep-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const idempotencyKey = crypto.randomUUID();
    const amountStr = amount.toFixed(2);

    const mpPayload = {
      type: "online",
      processing_mode: "automatic",
      external_reference: externalReference,
      total_amount: amountStr,
      description: `Depósito carteira AD•SCALE`,
      payer: { email: payerEmail, first_name: isSandbox ? "APRO" : name },
      transactions: { payments: [{ amount: amountStr, payment_method: { id: "pix", type: "bank_transfer" } }] },
    };
    log("MP request →", { url: "https://api.mercadopago.com/v1/orders", idempotencyKey, payload: mpPayload });

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
    log("MP response ←", { status: mpRes.status, ok: mpRes.ok, body: mpData });

    if (!mpRes.ok) {
      console.error("MP error", mpRes.status, mpData);
      return json({ error: mercadoPagoErrorMessage(mpData), details: mpData }, 502);
    }

    const tx = mpData?.transactions?.payments?.[0] ?? {};
    const pm = tx?.payment_method ?? {};
    const txData = tx?.point_of_interaction?.transaction_data ?? {};
    const pixQr = pm?.qr_code ?? txData?.qr_code ?? null;
    const pixQrBase64 = pm?.qr_code_base64 ?? txData?.qr_code_base64 ?? null;
    const pixTicketUrl = pm?.ticket_url ?? txData?.ticket_url ?? null;
    const status = mpData?.status ?? tx?.status ?? "pending";
    log("parsed", { status, has_qr: !!pixQr, mp_order_id: mpData?.id, mp_payment_id: tx?.id });

    const { data: dep, error: insErr } = await admin
      .from("wallet_deposits")
      .insert({
        user_id: userId,
        amount,
        status,
        status_detail: mpData?.status_detail ?? tx?.status_detail ?? null,
        external_reference: externalReference,
        mercado_pago_order_id: mpData?.id?.toString() ?? null,
        mercado_pago_payment_id: tx?.id?.toString() ?? null,
        pix_qr_code: pixQr,
        pix_qr_code_base64: pixQrBase64,
        pix_ticket_url: pixTicketUrl,
        raw_response: mpData,
      })
      .select("id")
      .single();
    if (insErr) {
      console.error(`[wallet-deposit ${reqId}] DB insert error`, insErr);
      return json({ error: "Erro ao registrar depósito", details: insErr.message }, 500);
    }
    log("done", { deposit_id: dep.id });

    return json({
      deposit_id: dep.id,
      external_reference: externalReference,
      mercado_pago_payment_id: tx?.id?.toString() ?? null,
      pix_qr_code: pixQr,
      pix_qr_code_base64: pixQrBase64,
      pix_ticket_url: pixTicketUrl,
      status,
      amount,
      test_mode: isSandbox,
    });
  } catch (err) {
    console.error("wallet-create-deposit error", err);
    return json({ error: (err as Error).message }, 500);
  }
});
