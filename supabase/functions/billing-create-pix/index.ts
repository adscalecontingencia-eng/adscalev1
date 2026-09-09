// Edge Function: billing-create-pix
// Gera o Pix (QR Code + copia e cola) de uma fatura semanal sob demanda,
// quando o cliente clica no botão do painel.
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

function mpToken() {
  return isTestMode()
    ? Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_TEST")
    : Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_LIVE");
}

function fmtBR(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const reqId = crypto.randomUUID().slice(0, 8);
  const log = (...a: unknown[]) => console.log(`[billing-create-pix ${reqId}]`, ...a);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const invoiceId: string | null = body?.invoice_id ?? null;
    if (!invoiceId) return json({ error: "invoice_id obrigatório" }, 400);

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    if (!jwt) return json({ error: "Unauthenticated" }, 401);
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claims } = await anon.auth.getClaims(jwt);
    const uid = claims?.claims?.sub;
    if (!uid) return json({ error: "Unauthenticated" }, 401);

    const { data: invoice, error: invErr } = await admin
      .from("billing_invoices")
      .select("id, client_id, week_start, week_end, amount_usd, amount_brl, fx_rate, status, external_reference, qr_code, qr_code_base64, ticket_url, clients(name, email, auth_user_id)")
      .eq("id", invoiceId)
      .maybeSingle();
    if (invErr) throw invErr;
    if (!invoice) return json({ error: "Fatura não encontrada" }, 404);

    const isOwner = (invoice as any).clients?.auth_user_id === uid;
    if (!isOwner) {
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", uid);
      const staff = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "support");
      if (!staff) return json({ error: "Forbidden" }, 403);
    }

    if (!["aberta", "vencida"].includes(String(invoice.status))) {
      return json({ error: "Esta fatura não está em aberto" }, 400);
    }

    // Já existe Pix gerado — devolve o mesmo
    if (invoice.qr_code) {
      return json({
        ok: true,
        reused: true,
        qr_code: invoice.qr_code,
        qr_code_base64: invoice.qr_code_base64,
        ticket_url: invoice.ticket_url,
      });
    }

    const token = mpToken();
    if (!token) return json({ error: "Mercado Pago token ausente" }, 500);

    const amountBrl = Number(invoice.amount_brl ?? 0);
    if (!(amountBrl > 0)) return json({ error: "Valor da fatura indisponível" }, 400);

    const client: any = (invoice as any).clients ?? {};
    const payerEmail = isTestMode()
      ? (Deno.env.get("MP_TEST_BUYER_EMAIL")?.trim() || "test_user_adscale@testuser.com")
      : (client.email || "pagamentos@adscale.app");

    const mpRes = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        type: "online",
        processing_mode: "automatic",
        external_reference: invoice.external_reference,
        total_amount: amountBrl.toFixed(2),
        description: `AD•SCALE — semana ${fmtBR(invoice.week_start)} a ${fmtBR(invoice.week_end)}`,
        payer: { email: payerEmail, first_name: isTestMode() ? "APRO" : (client.name || "Cliente") },
        transactions: {
          payments: [{ amount: amountBrl.toFixed(2), payment_method: { id: "pix", type: "bank_transfer" } }],
        },
      }),
    });
    const mpData = await mpRes.json().catch(() => ({}));
    if (!mpRes.ok) {
      log("mp error", mpRes.status, mpData);
      return json({ error: mpData?.message ?? `Mercado Pago retornou ${mpRes.status}` }, 502);
    }

    const tx = mpData?.transactions?.payments?.[0] ?? {};
    const pm = tx?.payment_method ?? {};
    const td = tx?.point_of_interaction?.transaction_data ?? {};

    const qrCode = pm?.qr_code ?? td?.qr_code ?? null;
    const qrBase64 = pm?.qr_code_base64 ?? td?.qr_code_base64 ?? null;
    const ticketUrl = pm?.ticket_url ?? td?.ticket_url ?? null;

    const { error: updErr } = await admin
      .from("billing_invoices")
      .update({
        mercado_pago_payment_id: tx?.id?.toString() ?? null,
        qr_code: qrCode,
        qr_code_base64: qrBase64,
        ticket_url: ticketUrl,
        raw_response: mpData,
      })
      .eq("id", invoice.id);
    if (updErr) throw updErr;

    return json({ ok: true, qr_code: qrCode, qr_code_base64: qrBase64, ticket_url: ticketUrl });
  } catch (err) {
    console.error("billing-create-pix error", err);
    console.error("unhandled error", err_generic_log);
    return json({ error: "Erro interno. Tente novamente." }, 500);
  }
});
