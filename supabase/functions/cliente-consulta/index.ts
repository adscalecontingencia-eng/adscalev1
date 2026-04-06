import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "GET") {
      return new Response(JSON.stringify({ erro: "Método não permitido. Use GET." }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const chave = url.searchParams.get("chave");
    const nome = url.searchParams.get("nome");
    const periodo = url.searchParams.get("periodo");
    const customStart = url.searchParams.get("start");
    const customEnd = url.searchParams.get("end");

    const secretKey = Deno.env.get("N8N_SECRET_KEY");
    if (!chave || chave !== secretKey) {
      return new Response(JSON.stringify({ erro: "Chave secreta inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!nome) {
      return new Response(JSON.stringify({ erro: "Parâmetro 'nome' é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Search client by partial name
    const { data: clients, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("*")
      .ilike("name", `%${nome}%`)
      .limit(1);

    if (clientError) {
      return new Response(JSON.stringify({ erro: clientError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ erro: "Cliente não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = clients[0];

    // Calculate date range
    let startDate: string;
    let endDate: string;
    const now = new Date();
    endDate = now.toISOString().split("T")[0];

    if (periodo === "custom" && customStart && customEnd) {
      startDate = customStart;
      endDate = customEnd;
    } else if (periodo === "mes") {
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    } else {
      // Default: semana
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
      startDate = monday.toISOString().split("T")[0];
    }

    // Fetch transactions
    const { data: transactions, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("client_id", client.id)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });

    if (txError) {
      return new Response(JSON.stringify({ erro: txError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalReceitas = (transactions || [])
      .filter((t: any) => t.type === "receita")
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

    const totalGastos = (transactions || [])
      .filter((t: any) => t.type === "gasto")
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

    return new Response(JSON.stringify({
      cliente: {
        id: client.id,
        nome: client.name,
        empresa: client.company_name,
        tipo_pagamento: client.payment_type,
        valor_fixo: client.fixed_value,
        percentual: client.percentage_value,
        contas_anuncio: client.ad_accounts,
        contas_usadas: client.used_accounts,
        observacoes: client.observations,
      },
      transacoes: transactions || [],
      total_receitas: totalReceitas,
      total_gastos: totalGastos,
      saldo: totalReceitas - totalGastos,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
