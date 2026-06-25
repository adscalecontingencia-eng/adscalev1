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

  const tuRes = await fetch("https://api.mercadopago.com/users/test_user", {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_TEST");
    if (!accessToken) return json({ error: "MERCADO_PAGO_ACCESS_TOKEN_TEST not configured" }, 500);

    const body = (await req.json()) as Body;
    if (!body?.product_id || !body?.customer_name || !body?.customer_email) {
      return json({ error: "Campos obrigatórios: product_id, customer_name, customer_email" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Identify user if logged in (optional)
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data } = await anon.auth.getClaims(token);
      userId = data?.claims?.sub ?? null;
    }

    // Fetch product from DB - price comes from DB only
    const { data: product, error: prodErr } = await supabase
      .from("marketplace_products")
      .select("id, name, price, status")
      .eq("id", body.product_id)
      .maybeSingle();

    if (prodErr || !product) return json({ error: "Produto indisponível" }, 404);
    if (product.status !== "active") return json({ error: "Produto indisponível" }, 400);

    const amount = Number(product.price);
    if (!(amount > 0)) return json({ error: "Preço inválido" }, 400);

    const externalReference = `mkt-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const idempotencyKey = crypto.randomUUID();
    const amountStr = amount.toFixed(2);
    const isSandbox = accessToken.startsWith("TEST-");
    const payerEmail = isSandbox ? await resolveSandboxPayerEmail(accessToken) : body.customer_email;
    const notificationUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercado-pago-webhook`;

    const mpPayload = {
      transaction_amount: Number(amountStr),
      external_reference: externalReference,
      description: product.name,
      payment_method_id: "pix",
      notification_url: notificationUrl,
      payer: {
        email: payerEmail,
        first_name: isSandbox ? "APRO" : body.customer_name,
        last_name: "Cliente",
        identification: {
          type: "CPF",
          number: (body.customer_document ?? "19119119100").replace(/\D/g, "") || "19119119100",
        },
      },
    };

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(mpPayload),
    });
    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP error", mpRes.status, mpData);
      return json({ error: "Erro ao gerar Pix", details: mpData }, 502);
    }

    const txData = mpData?.point_of_interaction?.transaction_data ?? {};
    const pixQr = txData?.qr_code ?? null;
    const pixQrBase64 = txData?.qr_code_base64 ?? null;
    const pixTicketUrl = txData?.ticket_url ?? null;
    const status = mpData?.status ?? "pending";

    const { data: order, error: insertErr } = await supabase
      .from("marketplace_orders")
      .insert({
        user_id: userId,
        product_id: product.id,
        external_reference: externalReference,
        mercado_pago_order_id: mpData?.order?.id?.toString() ?? null,
        mercado_pago_payment_id: mpData?.id?.toString() ?? null,
        amount,
        status,
        status_detail: mpData?.status_detail ?? null,
        customer_name: body.customer_name,
        customer_email: body.customer_email,
        customer_document: body.customer_document ?? null,
        raw_response: mpData,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("DB insert error", insertErr);
      return json({ error: "Erro ao registrar compra" }, 500);
    }

    return json({
      order_id: order.id,
      external_reference: externalReference,
      mercado_pago_order_id: mpData?.order?.id?.toString() ?? null,
      mercado_pago_payment_id: mpData?.id?.toString() ?? null,
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
