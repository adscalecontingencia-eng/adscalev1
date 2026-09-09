// Edge Function: billing-invoice-status
// Consulta o status de uma fatura no Mercado Pago e dá baixa se estiver paga.
// Serve como fallback do webhook (o cliente pode clicar em "Já paguei").
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

function mpToken() {
  const env = (Deno.env.get("MERCADO_PAGO_ENV") || "test").trim().toLowerCase();
  const isLive = ["live", "production", "prod"].includes(env);
  return isLive
    ? Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_LIVE")
    : Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN_TEST");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthenticated" }, 401);
    const jwt = authHeader.replace("Bearer ", "");

    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claims } = await anon.auth.getClaims(jwt);
    const uid = claims?.claims?.sub;
    if (!uid) return json({ error: "Unauthenticated" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { invoice_id } = await req.json().catch(() => ({ invoice_id: null }));
    if (!invoice_id) return json({ error: "invoice_id obrigatório" }, 400);

    const { data: inv } = await admin
      .from("billing_invoices")
      .select("id, client_id, status, external_reference, mercado_pago_payment_id")
      .eq("id", invoice_id)
      .maybeSingle();
    if (!inv) return json({ error: "Fatura não encontrada" }, 404);

    // Autorização: dono da fatura ou admin/support
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", uid);
    const isStaff = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "support");
    if (!isStaff) {
      const { data: client } = await admin
        .from("clients")
        .select("id")
        .eq("id", inv.client_id)
        .eq("auth_user_id", uid)
        .maybeSingle();
      if (!client) return json({ error: "Forbidden" }, 403);
    }

    if (inv.status === "paga") return json({ ok: true, status: "paga" });

    const token = mpToken();
    if (!token) return json({ error: "Mercado Pago token ausente" }, 500);

    const search = await fetch(
      `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(inv.external_reference)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await search.json().catch(() => ({}));
    const payments: any[] = data?.results ?? [];
    const paid = payments.find((p) => ["approved", "processed"].includes(String(p?.status)));

    if (paid) {
      const { data: res } = await admin.rpc("settle_invoice_payment", {
        _invoice_id: inv.id,
        _mp_payment_id: paid?.id?.toString() ?? null,
        _raw: paid,
      });
      return json({ ok: true, status: "paga", settlement: res });
    }

    const current = payments[0]?.status ?? "pending";
    return json({ ok: true, status: inv.status, provider_status: current });
  } catch (err) {
    console.error("billing-invoice-status error", err);
    return json({ error: (err as Error).message }, 500);
  }
});
