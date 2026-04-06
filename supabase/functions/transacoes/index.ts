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
    const { chave, date, type, category, client_id, amount, description, apenas_comissao } = body;

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

    // If apenas_comissao = true, treat amount as AD SPEND and calculate commission from client contract
    if (apenas_comissao && type === 'receita' && (category === 'Comissão Fixa' || category === 'Comissão Semanal')) {
      if (!client_id) {
        return new Response(JSON.stringify({ erro: "client_id é obrigatório quando apenas_comissao = true" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch client contract to calculate commission
      const { data: client, error: clientError } = await supabaseAdmin
        .from("clients")
        .select("payment_type, fixed_value, percentage_value, name")
        .eq("id", client_id)
        .single();

      if (clientError || !client) {
        return new Response(JSON.stringify({ erro: "Cliente não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const adSpend = amount;
      let commission = 0;
      const fixedVal = client.fixed_value || 0;
      const pctVal = client.percentage_value || 0;

      if (client.payment_type === 'fixed') {
        commission = fixedVal;
      } else if (client.payment_type === 'percentage') {
        commission = adSpend * pctVal / 100;
      } else {
        // both
        commission = fixedVal + (adSpend * pctVal / 100);
      }

      const percentApplied = (client.payment_type === 'percentage' || client.payment_type === 'both') ? pctVal : 0;

      const { data, error } = await supabaseAdmin
        .from("commissions")
        .insert({
          client_id,
          date,
          amount: commission,
          ad_spend: adSpend,
          type: 'daily',
          note: description || null,
          percentual_aplicado: percentApplied,
          valor_pago: 0,
          valor_pendente: commission,
          status: 'pendente',
        })
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ erro: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ 
        sucesso: true, 
        ad_spend: adSpend,
        comissao_calculada: commission,
        percentual: percentApplied,
        comissao: data 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabaseAdmin
      .from("transactions")
      .insert({
        date,
        type,
        category,
        client_id: client_id || null,
        amount,
        description: description || "",
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ erro: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sucesso: true, transacao: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
