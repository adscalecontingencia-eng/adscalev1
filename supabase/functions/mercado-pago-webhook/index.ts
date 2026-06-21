// Edge Function: mercado-pago-webhook
// Receives Mercado Pago notifications, validates and updates marketplace_orders.
// Idempotent: if order already approved, it's a no-op.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function verifySignature(req: Request, dataId: string): Promise<boolean> {
  const secret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");
  if (!secret) return true; // signature optional until configured
  const sigHeader = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    }),
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === v1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_TEST");
    if (!accessToken) return json({ error: "token missing" }, 500);

    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const topic = url.searchParams.get("topic") ?? body?.type ?? body?.topic;
    const dataId =
      url.searchParams.get("id") ?? body?.data?.id?.toString() ?? body?.resource?.toString();

    if (!dataId) return json({ ok: true, ignored: true });

    const sigOk = await verifySignature(req, dataId);
    if (!sigOk) {
      console.warn("Invalid signature");
      return json({ error: "invalid signature" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Try to fetch as payment first, fall back to order
    let mpOrder: any = null;
    let mpPayment: any = null;
    if (topic === "payment" || (topic ?? "").includes("payment")) {
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (r.ok) mpPayment = await r.json();
    } else {
      const r = await fetch(`https://api.mercadopago.com/v1/orders/${dataId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (r.ok) mpOrder = await r.json();
    }

    const externalReference =
      mpOrder?.external_reference ?? mpPayment?.external_reference ?? null;
    const mpOrderId = mpOrder?.id?.toString() ?? mpPayment?.order?.id?.toString() ?? null;

    if (!externalReference && !mpOrderId) return json({ ok: true, ignored: true });

    const query = supabase.from("marketplace_orders").select("*");
    const { data: order } = externalReference
      ? await query.eq("external_reference", externalReference).maybeSingle()
      : await query.eq("mercado_pago_order_id", mpOrderId!).maybeSingle();

    if (!order) {
      console.warn("Order not found for webhook", { externalReference, mpOrderId });
      return json({ ok: true, ignored: true });
    }

    // Idempotency
    if (order.status === "approved" && order.download_released) {
      return json({ ok: true, already_approved: true });
    }

    const tx = mpOrder?.transactions?.payments?.[0] ?? {};
    const status =
      mpPayment?.status ?? mpOrder?.status ?? tx?.status ?? order.status;
    const statusDetail =
      mpPayment?.status_detail ?? mpOrder?.status_detail ?? tx?.status_detail ?? null;
    const paidAmount = Number(
      mpPayment?.transaction_amount ?? tx?.amount ?? mpOrder?.total_paid_amount ?? 0,
    );

    const patch: Record<string, unknown> = {
      status,
      status_detail: statusDetail,
      mercado_pago_payment_id:
        mpPayment?.id?.toString() ?? tx?.id?.toString() ?? order.mercado_pago_payment_id,
      mercado_pago_order_id: mpOrderId ?? order.mercado_pago_order_id,
      raw_response: mpOrder ?? mpPayment,
    };

    if (status === "approved") {
      if (paidAmount > 0 && Math.abs(paidAmount - Number(order.amount)) > 0.01) {
        console.warn("Amount mismatch", { paidAmount, expected: order.amount });
        patch.status = "amount_mismatch";
      } else {
        patch.paid_at = new Date().toISOString();
        patch.download_released = true;
      }
    }

    await supabase.from("marketplace_orders").update(patch).eq("id", order.id);
    return json({ ok: true });
  } catch (err) {
    console.error("webhook error", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
