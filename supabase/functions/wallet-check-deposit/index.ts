// Edge Function: wallet-check-deposit (polling fallback)
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const env = (Deno.env.get("MERCADO_PAGO_ENV") || "test").trim().toLowerCase();
    const isLive = ["live", "production", "prod"].includes(env);
    const accessToken = isLive
      ? Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_LIVE")
      : Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_TEST");
    if (!accessToken) return json({ error: `MP token missing (${isLive ? "LIVE" : "TEST"})` }, 500);

    const { deposit_id } = (await req.json()) as { deposit_id: string };
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: dep } = await admin.from("wallet_deposits").select("*").eq("id", deposit_id).maybeSingle();
    if (!dep) return json({ error: "not_found" }, 404);
    if (dep.credited_at) return json({ status: "approved", credited: true });

    const paymentId = dep.mercado_pago_payment_id;
    const orderId = dep.mercado_pago_order_id;
    if (!paymentId && !orderId) return json({ status: dep.status });

    // Always fetch the order when available (Orders API exposes the inner payment status)
    const url = orderId
      ? `https://api.mercadopago.com/v1/orders/${orderId}`
      : `https://api.mercadopago.com/v1/payments/${paymentId}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!r.ok) {
      const errBody = await r.text().catch(() => "");
      console.error("MP fetch failed", r.status, errBody.slice(0, 300));
      return json({ status: dep.status, mp_http: r.status });
    }
    const mpData = await r.json();
    const tx = mpData?.transactions?.payments?.[0] ?? {};
    const orderStatus = mpData?.status ?? null;
    const paymentStatus = tx?.status ?? null;
    const statusDetail = mpData?.status_detail ?? tx?.status_detail ?? null;
    const mpPaymentId = tx?.id?.toString() ?? paymentId ?? mpData?.id?.toString() ?? null;

    // Orders API: success = order "processed" OR inner payment "processed"/"approved"
    const isPaid =
      orderStatus === "processed" ||
      orderStatus === "approved" ||
      paymentStatus === "processed" ||
      paymentStatus === "approved";

    if (isPaid) {
      const { data: res } = await admin.rpc("credit_wallet_from_deposit", {
        _external_reference: dep.external_reference,
        _mp_payment_id: mpPaymentId,
        _raw: mpData,
      });
      return json({ status: "approved", credited: true, result: res });
    }

    const persistedStatus = paymentStatus ?? orderStatus ?? dep.status;
    await admin.from("wallet_deposits").update({ status: persistedStatus, status_detail: statusDetail, raw_response: mpData }).eq("id", dep.id);

    // Estados intermediários (pending/in_process/authorized) → registra lançamento pendente
    const intermediate = ["pending", "in_process", "authorized", "action_required"];
    if (intermediate.includes(String(persistedStatus))) {
      await admin.rpc("upsert_deposit_finance", { _deposit_id: dep.id, _status: "pendente" });
    }

    return json({ status: persistedStatus, order_status: orderStatus, payment_status: paymentStatus });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
