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

    // Validate secret key
    const secretKey = Deno.env.get("N8N_SECRET_KEY");
    if (!chave || chave !== secretKey) {
      return new Response(JSON.stringify({ erro: "Chave secreta inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate required fields
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

    // If apenas_comissao = true, treat amount as ad_spend, calculate commission from client contract
    if (apenas_comissao && type === 'receita' && (category === 'Comissão Fixa' || category === 'Comissão Semanal')) {
      if (!client_id) {
        return new Response(JSON.stringify({ erro: "client_id é obrigatório quando apenas_comissao = true" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch client contract to calculate commission
      const { data: clientData, error: clientError } = await supabaseAdmin
        .from("clients")
        .select("payment_type, fixed_value, percentage_value")
        .eq("id", client_id)
        .single();

      if (clientError || !clientData) {
        return new Response(JSON.stringify({ erro: "Cliente não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const adSpend = amount; // the amount sent is the ad spend
      let commission = 0;
      const pt = clientData.payment_type;
      if (pt === 'fixed' || pt === 'both') {
        commission += Number(clientData.fixed_value) || 0;
      }
      if (pt === 'percentage' || pt === 'both') {
        commission += adSpend * ((Number(clientData.percentage_value) || 0) / 100);
      }
      const percentApplied = (pt === 'percentage' || pt === 'both') ? (Number(clientData.percentage_value) || 0) : 0;

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

      return new Response(JSON.stringify({ sucesso: true, comissao: data, ad_spend: adSpend, comissao_calculada: commission }), {
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
