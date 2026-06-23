// Edge Function: get-marketplace-download-link
// Returns a short-lived signed URL for the product TXT after payment is approved.
// Logs every attempt into download_audit_log.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  // Identify requester from JWT if present
  let requesterId: string | null = null;
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    requesterId = data?.user?.id ?? null;
  }

  let marketplace_order_id: string | null = null;
  let orderRow: any = null;
  let productRow: any = null;

  const logAttempt = async (success: boolean, errorMessage: string | null, expiresAt: Date | null) => {
    try {
      await supabase.from("download_audit_log").insert({
        marketplace_order_id,
        product_id: orderRow?.product_id ?? null,
        user_id: orderRow?.user_id ?? null,
        requested_by: requesterId,
        file_path: productRow?.file_path ?? null,
        signed_url_expires_at: expiresAt?.toISOString() ?? null,
        download_released: !!orderRow?.download_released,
        success,
        error_message: errorMessage,
        ip,
        user_agent: userAgent,
      });
    } catch (e) {
      console.error("audit log error", e);
    }
  };

  try {
    const body = await req.json();
    marketplace_order_id = body?.marketplace_order_id ?? null;
    if (!marketplace_order_id) {
      await logAttempt(false, "marketplace_order_id obrigatório", null);
      return json({ error: "marketplace_order_id obrigatório" }, 400);
    }

    const { data: order, error } = await supabase
      .from("marketplace_orders")
      .select("id, status, download_released, product_id, user_id")
      .eq("id", marketplace_order_id)
      .maybeSingle();

    orderRow = order;

    if (error || !order) {
      await logAttempt(false, "Compra não encontrada", null);
      return json({ error: "Compra não encontrada" }, 404);
    }
    if (order.status !== "approved") {
      await logAttempt(false, "Pagamento ainda pendente", null);
      return json({ error: "Pagamento ainda pendente" }, 403);
    }
    if (!order.download_released) {
      await logAttempt(false, "Compra não aprovada", null);
      return json({ error: "Compra não aprovada" }, 403);
    }

    const { data: product } = await supabase
      .from("marketplace_products")
      .select("file_path, name")
      .eq("id", order.product_id)
      .maybeSingle();

    productRow = product;

    if (!product?.file_path) {
      await logAttempt(false, "Arquivo não disponível", null);
      return json({ error: "Arquivo não disponível" }, 404);
    }

    const expiresIn = 60 * 10;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const { data: signed, error: signErr } = await supabase
      .storage
      .from("marketplace-files")
      .createSignedUrl(product.file_path, expiresIn, {
        download: `${product.name.replace(/[^\w.-]+/g, "_")}.txt`,
      });

    if (signErr || !signed) {
      console.error("sign error", signErr);
      await logAttempt(false, signErr?.message ?? "sign error", null);
      return json({ error: "Arquivo não disponível" }, 500);
    }

    await logAttempt(true, null, expiresAt);
    return json({ url: signed.signedUrl, expires_in: expiresIn });
  } catch (err) {
    console.error("get-marketplace-download-link error", err);
    await logAttempt(false, (err as Error).message, null);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
