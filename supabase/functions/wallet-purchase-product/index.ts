// Edge Function: wallet-purchase-product
// Debits user's wallet balance and creates an approved marketplace_orders row.
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
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthenticated" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { product_id, quantity } = (await req.json()) as { product_id: string; quantity?: number };
    if (!product_id) return json({ error: "product_id obrigatório" }, 400);

    // Use RPC under user's JWT so auth.uid() works inside the function
    const { data, error } = await userClient.rpc("purchase_with_wallet", {
      _product_id: product_id,
      _quantity: quantity ?? 1,
    });
    if (error) return json({ error: error.message }, 400);
    const r = data as { ok: boolean; reason?: string; order_id?: string; new_balance?: number; balance?: number; required?: number };
    if (!r?.ok) {
      if (r?.reason === "insufficient_balance")
        return json({ error: "Saldo insuficiente", balance: r.balance, required: r.required }, 402);
      return json({ error: r?.reason ?? "Falha na compra" }, 400);
    }
    return json({ ok: true, order_id: r.order_id, new_balance: r.new_balance });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
