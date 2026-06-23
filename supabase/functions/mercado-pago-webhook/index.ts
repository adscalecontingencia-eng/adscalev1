// Edge Function: mercado-pago-webhook
// Receives Mercado Pago notifications, validates signature, persists telemetry
// and updates marketplace_orders / wallet_deposits idempotently.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function verifySignature(req: Request, dataId: string): Promise<{ ok: boolean; required: boolean }> {
  const secret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");
  if (!secret) return { ok: true, required: false }; // signature optional until configured
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
  if (!ts || !v1) return { ok: false, required: true };
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
  return { ok: hex === v1, required: true };
}

function headersToObject(req: Request) {
  const obj: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    // Redact sensitive headers
    if (/authorization|cookie/i.test(k)) return;
    obj[k] = v;
  });
  return obj;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Read body ONCE
  const rawText = await req.text();
  let body: any = {};
  try { body = rawText ? JSON.parse(rawText) : {}; } catch { body = { _raw: rawText }; }
  const url = new URL(req.url);
  const topic = url.searchParams.get("topic") ?? body?.type ?? body?.topic ?? null;
  const dataId =
    url.searchParams.get("id") ?? body?.data?.id?.toString() ?? body?.resource?.toString() ?? null;
  const requestId = req.headers.get("x-request-id") ?? body?.id?.toString() ?? null;
  const headersObj = headersToObject(req);

  // Build idempotency key — same provider event delivered twice will collide on unique index
  const eventKey =
    requestId
      ? `req:${requestId}`
      : dataId
        ? `data:${topic ?? "unknown"}:${dataId}:${body?.action ?? ""}`
        : `body:${rawText.slice(0, 200)}`;

  const logEvent = async (patch: Record<string, unknown>) => {
    try {
      await supabase.from("webhook_events").upsert(
        {
          provider: "mercado_pago",
          event_key: eventKey,
          topic,
          data_id: dataId,
          request_id: requestId,
          external_reference: (patch.external_reference as string | null) ?? null,
          status: (patch.status as string | null) ?? null,
          http_status: (patch.http_status as number | null) ?? null,
          signature_valid: (patch.signature_valid as boolean | null) ?? null,
          response: (patch.response as unknown) ?? null,
          headers: headersObj,
          payload: body,
        },
        { onConflict: "provider,event_key", ignoreDuplicates: false },
      );
    } catch (e) {
      console.error("logEvent failed", e);
    }
  };

  // Idempotency check — if we already processed this event successfully, no-op
  if (eventKey) {
    const { data: prev } = await supabase
      .from("webhook_events")
      .select("id, http_status, status, response")
      .eq("provider", "mercado_pago")
      .eq("event_key", eventKey)
      .maybeSingle();
    if (prev && prev.http_status && prev.http_status < 400) {
      console.log("Duplicate webhook ignored", eventKey);
      return json({ ok: true, duplicate: true, replay_of: prev.id }, 200);
    }
  }

  try {
    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_TEST");
    if (!accessToken) {
      await logEvent({ http_status: 500, status: "token_missing" });
      return json({ error: "token missing" }, 500);
    }

    if (!dataId) {
      await logEvent({ http_status: 200, status: "ignored_no_id" });
      return json({ ok: true, ignored: true });
    }

    const sig = await verifySignature(req, dataId);
    if (!sig.ok) {
      await logEvent({ http_status: 401, status: "invalid_signature", signature_valid: false });
      console.warn("Invalid signature for event", eventKey);
      return json({ error: "invalid signature" }, 401);
    }

    // Fetch from Mercado Pago
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

    if (!externalReference && !mpOrderId) {
      await logEvent({ http_status: 200, status: "ignored_no_ref", signature_valid: sig.required });
      return json({ ok: true, ignored: true });
    }

    // Wallet deposits use prefix "dep-"
    if (externalReference?.startsWith("dep-")) {
      const tx2 = mpOrder?.transactions?.payments?.[0] ?? {};
      const status2 = mpPayment?.status ?? mpOrder?.status ?? tx2?.status;
      if (status2 === "approved") {
        const mpPaymentId = mpPayment?.id?.toString() ?? tx2?.id?.toString() ?? null;
        const { data: res } = await supabase.rpc("credit_wallet_from_deposit", {
          _external_reference: externalReference,
          _mp_payment_id: mpPaymentId,
          _raw: mpOrder ?? mpPayment,
        });
        await logEvent({
          http_status: 200,
          status: "deposit_processed",
          external_reference: externalReference,
          signature_valid: sig.required,
          response: res,
        });
        return json({ ok: true, deposit: res });
      }
      await supabase
        .from("wallet_deposits")
        .update({ status: status2, raw_response: mpOrder ?? mpPayment })
        .eq("external_reference", externalReference);
      await logEvent({
        http_status: 200,
        status: `deposit_${status2 ?? "pending"}`,
        external_reference: externalReference,
        signature_valid: sig.required,
      });
      return json({ ok: true, deposit_pending: true });
    }

    const query = supabase.from("marketplace_orders").select("*");
    const { data: order } = externalReference
      ? await query.eq("external_reference", externalReference).maybeSingle()
      : await query.eq("mercado_pago_order_id", mpOrderId!).maybeSingle();

    if (!order) {
      await logEvent({
        http_status: 200,
        status: "order_not_found",
        external_reference: externalReference,
        signature_valid: sig.required,
      });
      return json({ ok: true, ignored: true });
    }

    if (order.status === "approved" && order.download_released) {
      await logEvent({
        http_status: 200,
        status: "already_approved",
        external_reference: externalReference,
        signature_valid: sig.required,
      });
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
    await logEvent({
      http_status: 200,
      status: `order_${patch.status}`,
      external_reference: externalReference,
      signature_valid: sig.required,
      response: { paidAmount, expected: order.amount },
    });
    return json({ ok: true });
  } catch (err) {
    console.error("webhook error", err);
    await logEvent({ http_status: 500, status: "error", response: { message: (err as Error).message } });
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
