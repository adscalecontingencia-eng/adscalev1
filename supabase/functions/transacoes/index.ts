import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ erro: "Método não permitido. Use POST." }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { chave, date, type, category, client_id, amount, description, apenas_comissao, comissao_paga } = body;

    const secretKey = Deno.env.get("N8N_SECRET_KEY");
    if (!chave || chave !== secretKey) {
      return new Response(JSON.stringify({ erro: "Chave secreta inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!date || !type || !category || amount === undefined || amount === null) {
      return new Response(JSON.stringify({ erro: "Campos obrigatórios: date, type, category, amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // === COMISSÃO PAGA: insert transaction + distribute payment across pending commissions ===
    if (comissao_paga && client_id) {
      // Insert transaction
      const { data: txData, error: txError } = await supabaseAdmin
        .from("transactions")
        .insert({ date, type: 'receita', category, client_id, amount, description: description || "" })
        .select()
        .single();

      if (txError) {
        return new Response(JSON.stringify({ erro: txError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch pending commissions oldest first
      const { data: pendingComms, error: pcError } = await supabaseAdmin
        .from("commissions")
        .select("*")
        .eq("client_id", client_id)
        .in("status", ["pendente", "parcial"])
        .order("date", { ascending: true });

      if (pcError) {
        return new Response(JSON.stringify({ erro: pcError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let remaining = amount;
      const updated = [];

      for (const comm of (pendingComms || [])) {
        if (remaining <= 0) break;

        const pending = comm.valor_pendente || (comm.amount - (comm.valor_pago || 0));
        const payment = Math.min(remaining, pending);
        const newPago = (comm.valor_pago || 0) + payment;
        const newPendente = comm.amount - newPago;
        const newStatus = newPendente <= 0 ? 'pago' : 'parcial';

        const { error: updErr } = await supabaseAdmin
          .from("commissions")
          .update({ valor_pago: newPago, valor_pendente: Math.max(0, newPendente), status: newStatus })
          .eq("id", comm.id);

        if (!updErr) {
          updated.push({ id: comm.id, pago: newPago, pendente: Math.max(0, newPendente), status: newStatus });
        }
        remaining -= payment;
      }

      return new Response(JSON.stringify({
        sucesso: true,
        transacao: txData,
        comissoes_atualizadas: updated,
        valor_restante: remaining,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === APENAS COMISSÃO: treat amount as ad spend, calculate commission from contract ===
    if (apenas_comissao && type === 'receita' && (category === 'Comissão Fixa' || category === 'Comissão Semanal')) {
      if (!client_id) {
        return new Response(JSON.stringify({ erro: "client_id é obrigatório quando apenas_comissao = true" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: client, error: clientError } = await supabaseAdmin
        .from("clients")
        .select("payment_type, fixed_value, percentage_value, name")
        .eq("id", client_id)
        .single();

      if (clientError || !client) {
        return new Response(JSON.stringify({ erro: "Cliente não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const adSpend = amount;
      let commission = 0;
      const fixedVal = client.fixed_value || 0;
      const pctVal = client.percentage_value || 0;

      if (client.payment_type === 'fixed') commission = fixedVal;
      else if (client.payment_type === 'percentage') commission = adSpend * pctVal / 100;
      else commission = fixedVal + (adSpend * pctVal / 100);

      const percentApplied = (client.payment_type === 'percentage' || client.payment_type === 'both') ? pctVal : 0;

      const { data, error } = await supabaseAdmin
        .from("commissions")
        .insert({
          client_id, date, amount: commission, ad_spend: adSpend, type: 'daily',
          note: description || null, percentual_aplicado: percentApplied,
          valor_pago: 0, valor_pendente: commission, status: 'pendente',
        })
        .select().single();

      if (error) {
        return new Response(JSON.stringify({ erro: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        sucesso: true, ad_spend: adSpend, comissao_calculada: commission,
        percentual: percentApplied, comissao: data,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === DEFAULT: insert into transactions ===
    const { data, error } = await supabaseAdmin
      .from("transactions")
      .insert({ date, type, category, client_id: client_id || null, amount, description: description || "" })
      .select().single();

    if (error) {
      return new Response(JSON.stringify({ erro: error.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sucesso: true, transacao: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
