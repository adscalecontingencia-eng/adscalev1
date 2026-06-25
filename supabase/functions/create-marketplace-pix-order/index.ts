// Edge Function: create-marketplace-pix-order
// Creates a Pix charge for a marketplace product. Price is ALWAYS pulled from DB.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  product_id: string;
  customer_name: string;
  customer_email: string;
  customer_document?: string;
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
  const log = (...args: unknown[]) => console.log(`[mkt-pix ${reqId}]`, ...args);

  try {
    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_TEST");
    log("start", {
      mp_env: Deno.env.get("MERCADO_PAGO_ENV") || "(unset)",
      token: maskToken(accessToken),
      token_prefix: accessToken ? accessToken.split("-")[0] : null,
    });
    if (!accessToken) return json({ error: "MERCADO_PAGO_ACCESS_TOKEN_TEST not configured" }, 500);

    const body = (await req.json()) as Body;
    log("input", { product_id: body?.product_id, has_email: !!body?.customer_email, has_name: !!body?.customer_name });
    if (!body?.product_id || !body?.customer_name || !body?.customer_email) {
      return json({ error: "Campos obrigatórios: product_id, customer_name, customer_email" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data } = await anon.auth.getClaims(token);
      userId = data?.claims?.sub ?? null;
    }
    log("auth", { userId });

    const { data: product, error: prodErr } = await supabase
      .from("marketplace_products")
      .select("id, name, price, status")
      .eq("id", body.product_id)
      .maybeSingle();

    if (prodErr || !product) {
      log("product error", { prodErr, product });
      return json({ error: "Produto indisponível" }, 404);
    }
    if (product.status !== "active") return json({ error: "Produto indisponível" }, 400);

    const amount = Number(product.price);
    if (!(amount > 0)) return json({ error: "Preço inválido" }, 400);

    const externalReference = `mkt-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const idempotencyKey = crypto.randomUUID();
    const amountStr = amount.toFixed(2);
    const isSandbox = isMercadoPagoTestMode();
    const payerEmail = isSandbox
      ? (Deno.env.get("MP_TEST_BUYER_EMAIL")?.trim() || "test_user_adscale@testuser.com")
      : normalizeLivePayerEmail(body.customer_email);
    log("payer", { isSandbox, payerEmail });

    const mpPayload = {
      type: "online",
      processing_mode: "automatic",
      external_reference: externalReference,
      total_amount: amountStr,
      description: product.name,
      payer: { email: payerEmail, first_name: isSandbox ? "APRO" : body.customer_name },
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
      return json({ error: mercadoPagoErrorMessage(mpData), details: mpData }, 502);
    }

    const tx = mpData?.transactions?.payments?.[0] ?? {};
    const pmData = tx?.payment_method ?? {};
    const txData = tx?.point_of_interaction?.transaction_data ?? {};
    const pixQr = pmData?.qr_code ?? txData?.qr_code ?? null;
    const pixQrBase64 = pmData?.qr_code_base64 ?? txData?.qr_code_base64 ?? null;
    const pixTicketUrl = pmData?.ticket_url ?? txData?.ticket_url ?? null;
    const status = mpData?.status ?? tx?.status ?? "pending";
    log("parsed", { status, has_qr: !!pixQr, mp_order_id: mpData?.id, mp_payment_id: tx?.id });

    const { data: order, error: insertErr } = await supabase
      .from("marketplace_orders")
      .insert({
        user_id: userId,
        product_id: product.id,
        external_reference: externalReference,
        mercado_pago_order_id: mpData?.id?.toString() ?? null,
        mercado_pago_payment_id: tx?.id?.toString() ?? null,
        amount,
        status,
        status_detail: mpData?.status_detail ?? tx?.status_detail ?? null,
        customer_name: body.customer_name,
        customer_email: body.customer_email,
        customer_document: body.customer_document ?? null,
        raw_response: mpData,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error(`[mkt-pix ${reqId}] DB insert error`, insertErr);
      return json({ error: "Erro ao registrar compra", details: insertErr.message }, 500);
    }
    log("done", { order_id: order.id });

    return json({
      order_id: order.id,
      external_reference: externalReference,
      mercado_pago_order_id: mpData?.id?.toString() ?? null,
      mercado_pago_payment_id: tx?.id?.toString() ?? null,
      pix_qr_code: pixQr,
      pix_qr_code_base64: pixQrBase64,
      pix_ticket_url: pixTicketUrl,
      status,
    });
  } catch (err) {
    console.error("create-marketplace-pix-order error", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
