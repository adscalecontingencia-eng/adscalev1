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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_TEST");
    if (!accessToken) return json({ error: "MP token missing" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthenticated" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claims } = await anon.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    if (!userId) return json({ error: "Unauthenticated" }, 401);

    const body = (await req.json()) as { amount?: number; customer_name?: string; customer_email?: string };
    const amount = Number(body?.amount ?? 0);
    if (!(amount > 0) || amount < 1 || amount > 100000) return json({ error: "Valor inválido" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Resolve user email/name
    const { data: userInfo } = await admin.auth.admin.getUserById(userId);
    const email = body?.customer_email || userInfo?.user?.email || "user@example.com";
    const name =
      body?.customer_name ||
      (userInfo?.user?.user_metadata as any)?.name ||
      (userInfo?.user?.user_metadata as any)?.full_name ||
      email.split("@")[0];

    const externalReference = `dep-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const idempotencyKey = crypto.randomUUID();
    const amountStr = amount.toFixed(2);

    const mpPayload = {
      type: "online",
      processing_mode: "automatic",
      external_reference: externalReference,
      total_amount: amountStr,
      description: `Depósito carteira AD•SCALE`,
      payer: { email, first_name: name },
      transactions: { payments: [{ amount: amountStr, payment_method: { id: "pix", type: "bank_transfer" } }] },
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
      console.error("MP error", mpRes.status, mpData);
      return json({ error: "Erro ao gerar Pix", details: mpData }, 502);
    }

    const tx = mpData?.transactions?.payments?.[0] ?? {};
    const pm = tx?.payment_method ?? {};
    const pixQr = pm?.qr_code ?? tx?.point_of_interaction?.transaction_data?.qr_code ?? null;
    const pixQrBase64 = pm?.qr_code_base64 ?? tx?.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
    const pixTicketUrl = pm?.ticket_url ?? tx?.point_of_interaction?.transaction_data?.ticket_url ?? null;
    const status = mpData?.status ?? tx?.status ?? "pending";

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
      console.error("DB insert error", insErr);
      return json({ error: "Erro ao registrar depósito" }, 500);
    }

    return json({
      deposit_id: dep.id,
      external_reference: externalReference,
      pix_qr_code: pixQr,
      pix_qr_code_base64: pixQrBase64,
      pix_ticket_url: pixTicketUrl,
      status,
      amount,
    });
  } catch (err) {
    console.error("wallet-create-deposit error", err);
    return json({ error: (err as Error).message }, 500);
  }
});
