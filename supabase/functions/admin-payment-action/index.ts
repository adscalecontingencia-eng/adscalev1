// Edge Function: admin-payment-action
// Admin-only. Performs management actions on wallet deposits and marketplace orders,
// always writing an audit row in payment_admin_actions.
//
// Body: {
//   target_type: 'wallet_deposit' | 'marketplace_order',
//   target_id: uuid,
//   action: 'reprocess' | 'refund' | 'mark_credited' | 'release_download' | 'note',
//   reason?: string
// }
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return json({ error: "Não autenticado" }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Não autenticado" }, 401);
    const performer = userData.user;

    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: performer.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Acesso negado" }, 403);

    const body = await req.json();
    const { target_type, target_id, action, reason } = body ?? {};
    if (!target_type || !target_id || !action) {
      return json({ error: "target_type, target_id e action são obrigatórios" }, 400);
    }

    // Snapshot previous state
    let previous: any = null;
    if (target_type === "wallet_deposit") {
      const { data } = await admin.from("wallet_deposits").select("*").eq("id", target_id).maybeSingle();
      previous = data;
    } else if (target_type === "marketplace_order") {
      const { data } = await admin.from("marketplace_orders").select("*").eq("id", target_id).maybeSingle();
      previous = data;
    } else {
      return json({ error: "target_type inválido" }, 400);
    }
    if (!previous) return json({ error: "Registro não encontrado" }, 404);

    let result: any = { ok: true };
    let newState: any = previous;

    if (action === "note") {
      // No-op, just records the note via audit log.
    } else if (target_type === "wallet_deposit") {
      if (action === "reprocess") {
        // Re-check status against Mercado Pago via existing function
        const { data: invoke, error: invokeErr } = await admin.functions.invoke("wallet-check-deposit", {
          body: { deposit_id: target_id },
        });
        if (invokeErr) result = { ok: false, error: invokeErr.message };
        else result = invoke;
      } else if (action === "mark_credited") {
        if (previous.credited_at) {
          result = { ok: true, already_credited: true };
        } else {
          const rpc = await admin.rpc("credit_wallet_from_deposit", {
            _external_reference: previous.external_reference,
            _mp_payment_id: previous.mercado_pago_payment_id,
            _raw: previous.raw_response ?? {},
          });
          result = rpc.error ? { ok: false, error: rpc.error.message } : rpc.data;
        }
      } else if (action === "refund") {
        // Reverse the deposit: subtract from wallet (if previously credited) and mark refunded
        if (previous.credited_at) {
          const { data: wallet } = await admin
            .from("wallets")
            .select("balance")
            .eq("user_id", previous.user_id)
            .maybeSingle();
          const currentBalance = Number(wallet?.balance ?? 0);
          const newBalance = currentBalance - Number(previous.amount);
          await admin.from("wallets").update({ balance: newBalance, updated_at: new Date().toISOString() })
            .eq("user_id", previous.user_id);
          await admin.from("wallet_transactions").insert({
            user_id: previous.user_id,
            type: "refund",
            amount: -Number(previous.amount),
            balance_after: newBalance,
            status: "completed",
            reference_type: "wallet_deposit",
            reference_id: previous.id,
            description: `Estorno depósito: ${reason ?? "ação admin"}`,
            metadata: { performed_by: performer.id },
          });
          result = { ok: true, new_balance: newBalance };
        }
        await admin.from("wallet_deposits").update({
          status: "refunded",
          updated_at: new Date().toISOString(),
        }).eq("id", target_id);
      } else {
        return json({ error: "Ação não suportada para wallet_deposit" }, 400);
      }
      const { data: after } = await admin.from("wallet_deposits").select("*").eq("id", target_id).maybeSingle();
      newState = after;
    } else if (target_type === "marketplace_order") {
      if (action === "release_download") {
        await admin.from("marketplace_orders").update({
          download_released: true,
          status: "approved",
          updated_at: new Date().toISOString(),
        }).eq("id", target_id);
        result = { ok: true };
      } else if (action === "refund") {
        await admin.from("marketplace_orders").update({
          status: "refunded",
          download_released: false,
          updated_at: new Date().toISOString(),
        }).eq("id", target_id);
        result = { ok: true };
      } else if (action === "reprocess") {
        const { data: invoke, error: invokeErr } = await admin.functions.invoke("check-marketplace-order-status", {
          body: { marketplace_order_id: target_id },
        });
        result = invokeErr ? { ok: false, error: invokeErr.message } : invoke;
      } else if (action === "mark_credited") {
        await admin.from("marketplace_orders").update({
          status: "approved",
          download_released: true,
          updated_at: new Date().toISOString(),
        }).eq("id", target_id);
        result = { ok: true };
      } else {
        return json({ error: "Ação não suportada para marketplace_order" }, 400);
      }
      const { data: after } = await admin.from("marketplace_orders").select("*").eq("id", target_id).maybeSingle();
      newState = after;
    }

    await admin.from("payment_admin_actions").insert({
      target_type,
      target_id,
      action,
      performed_by: performer.id,
      performed_by_email: performer.email,
      reason: reason ?? null,
      previous_state: previous,
      new_state: newState,
      result,
    });

    return json({ ok: true, result });
  } catch (err) {
    console.error("admin-payment-action error", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
