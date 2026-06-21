// Edge Function: check-marketplace-order-status
// Polls the order status. Optionally queries Mercado Pago if still pending.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { order_id, external_reference } = await req.json();
    if (!order_id && !external_reference) {
      return json({ error: "order_id ou external_reference obrigatório" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_TEST");

    const query = supabase
      .from("marketplace_orders")
      .select("id, status, download_released, mercado_pago_order_id, amount, paid_at, external_reference");

    const { data: order, error } = order_id
      ? await query.eq("id", order_id).maybeSingle()
      : await query.eq("external_reference", external_reference).maybeSingle();

    if (error || !order) return json({ error: "Compra não encontrada" }, 404);

    // If still pending and we have access token, query Mercado Pago to refresh
    if (order.status !== "approved" && accessToken && order.mercado_pago_order_id) {
      try {
        const r = await fetch(
          `https://api.mercadopago.com/v1/orders/${order.mercado_pago_order_id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (r.ok) {
          const mp = await r.json();
          const tx = mp?.transactions?.payments?.[0] ?? {};
          const mpStatus = mp?.status ?? tx?.status ?? order.status;
          const mpPaymentId = tx?.id?.toString() ?? null;
          if (mpStatus !== order.status) {
            const patch: Record<string, unknown> = {
              status: mpStatus,
              status_detail: mp?.status_detail ?? tx?.status_detail ?? null,
              mercado_pago_payment_id: mpPaymentId,
            };
            if (mpStatus === "approved") {
              const paidAmount = Number(tx?.amount ?? mp?.total_paid_amount ?? mp?.total_amount ?? 0);
              if (paidAmount > 0 && Math.abs(paidAmount - Number(order.amount)) < 0.01) {
                patch.paid_at = new Date().toISOString();
                patch.download_released = true;
              }
            }
            await supabase.from("marketplace_orders").update(patch).eq("id", order.id);
            order.status = mpStatus;
            if (patch.download_released) order.download_released = true;
          }
        }
      } catch (e) {
        console.warn("MP refresh failed", e);
      }
    }

    return json({
      order_id: order.id,
      status: order.status,
      download_released: order.download_released,
    });
  } catch (err) {
    console.error("check-marketplace-order-status error", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
