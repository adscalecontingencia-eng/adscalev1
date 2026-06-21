// Edge Function: get-marketplace-download-link
// Returns a short-lived signed URL for the product TXT after payment is approved.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { marketplace_order_id } = await req.json();
    if (!marketplace_order_id) return json({ error: "marketplace_order_id obrigatório" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error } = await supabase
      .from("marketplace_orders")
      .select("id, status, download_released, product_id, user_id")
      .eq("id", marketplace_order_id)
      .maybeSingle();

    if (error || !order) return json({ error: "Compra não encontrada" }, 404);
    if (order.status !== "approved") return json({ error: "Pagamento ainda pendente" }, 403);
    if (!order.download_released) return json({ error: "Compra não aprovada" }, 403);

    const { data: product } = await supabase
      .from("marketplace_products")
      .select("file_path, name")
      .eq("id", order.product_id)
      .maybeSingle();

    if (!product?.file_path) return json({ error: "Arquivo não disponível" }, 404);

    const { data: signed, error: signErr } = await supabase
      .storage
      .from("marketplace-files")
      .createSignedUrl(product.file_path, 60 * 10, {
        download: `${product.name.replace(/[^\w.-]+/g, "_")}.txt`,
      });

    if (signErr || !signed) {
      console.error("sign error", signErr);
      return json({ error: "Arquivo não disponível" }, 500);
    }

    return json({ url: signed.signedUrl, expires_in: 600 });
  } catch (err) {
    console.error("get-marketplace-download-link error", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
