// Edge Function: create-pix-order
// Cria uma cobrança Pix via Mercado Pago Orders API e persiste em mercadopago_payments.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreatePixBody {
  amount: number;
  product_name: string;
  plan_id?: string;
  customer_name: string;
  customer_email: string;
  customer_document?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_TEST");
    if (!accessToken) {
      return json({ error: "MERCADO_PAGO_ACCESS_TOKEN_TEST not configured" }, 500);
    }

    const body = (await req.json()) as CreatePixBody;
    if (!body?.amount || !body?.customer_email || !body?.customer_name) {
      return json({ error: "Missing required fields" }, 400);
    }

    // Identifica usuário se houver token (não obrigatório p/ teste)
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await anon.auth.getClaims(token);
      userId = data?.claims?.sub ?? null;
    }

    const externalReference = `adscale-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const idempotencyKey = crypto.randomUUID();
    const amountStr = Number(body.amount).toFixed(2);

    const mpPayload = {
      type: "online",
      processing_mode: "automatic",
      external_reference: externalReference,
      total_amount: amountStr,
      description: body.product_name,
      payer: {
        email: body.customer_email,
        first_name: body.customer_name,
      },
      transactions: {
        payments: [
          {
            amount: amountStr,
            payment_method: {
              id: "pix",
              type: "bank_transfer",
            },
          },
        ],
      },
    };

    const mpRes = await fetch("https://api.mercadopago.com/v1/orders", {
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
      console.error("Mercado Pago error", mpRes.status, mpData);
      return json({ error: "Mercado Pago request failed", details: mpData }, 502);
    }

    // Extrai dados do Pix
    const tx = mpData?.transactions?.payments?.[0] ?? {};
    const pmData = tx?.payment_method ?? {};
    const pixQr = pmData?.qr_code ?? tx?.point_of_interaction?.transaction_data?.qr_code ?? null;
    const pixQrBase64 =
      pmData?.qr_code_base64 ?? tx?.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
    const pixTicketUrl =
      pmData?.ticket_url ?? tx?.point_of_interaction?.transaction_data?.ticket_url ?? null;

    const result = {
      mercado_pago_order_id: mpData?.id ?? null,
      mercado_pago_payment_id: tx?.id ?? null,
      pix_qr_code: pixQr,
      pix_qr_code_base64: pixQrBase64,
      pix_ticket_url: pixTicketUrl,
      status: mpData?.status ?? tx?.status ?? null,
      status_detail: mpData?.status_detail ?? tx?.status_detail ?? null,
    };

    const { error: insertErr } = await supabase.from("mercadopago_payments").insert({
      user_id: userId,
      external_reference: externalReference,
      customer_name: body.customer_name,
      customer_email: body.customer_email,
      customer_document: body.customer_document ?? null,
      product_name: body.product_name,
      plan_id: body.plan_id ?? null,
      amount: body.amount,
      mercado_pago_order_id: result.mercado_pago_order_id?.toString() ?? null,
      mercado_pago_payment_id: result.mercado_pago_payment_id?.toString() ?? null,
      pix_qr_code: result.pix_qr_code,
      pix_qr_code_base64: result.pix_qr_code_base64,
      pix_ticket_url: result.pix_ticket_url,
      status: result.status,
      status_detail: result.status_detail,
      raw_response: mpData,
    });

    if (insertErr) {
      console.error("DB insert error", insertErr);
    }

    return json({ ...result, external_reference: externalReference });
  } catch (err) {
    console.error("create-pix-order error", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
