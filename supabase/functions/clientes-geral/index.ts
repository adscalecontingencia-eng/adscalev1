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
    const tipo = url.searchParams.get("tipo");

    const secretKey = Deno.env.get("N8N_SECRET_KEY");
    if (!chave || chave !== secretKey) {
      return new Response(JSON.stringify({ erro: "Chave secreta inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tipo || !["total", "contas_por_cliente", "clientes_ativos", "resumo_clientes"].includes(tipo)) {
      return new Response(JSON.stringify({ erro: "Parâmetro 'tipo' é obrigatório. Valores: total, contas_por_cliente, clientes_ativos, resumo_clientes" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (tipo === "total") {
      const { count, error } = await supabaseAdmin
        .from("clients")
        .select("*", { count: "exact", head: true });

      if (error) {
        return new Response(JSON.stringify({ erro: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ total_clientes: count }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tipo === "contas_por_cliente" || tipo === "clientes_ativos") {
      let query = supabaseAdmin
        .from("clients")
        .select("id, name, company_name, ad_accounts, used_accounts, blocked_accounts")
        .order("name");

      if (tipo === "clientes_ativos") {
        query = query.gt("ad_accounts", 0);
      }

      const { data, error } = await query;

      if (error) {
        return new Response(JSON.stringify({ erro: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        clientes: (data || []).map((c: any) => ({
          nome: c.name,
          id: c.id,
          empresa: c.company_name,
          contas_anuncio: c.ad_accounts,
          contas_usadas: c.used_accounts,
          contas_bloqueadas: c.blocked_accounts,
        })),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tipo === "resumo_clientes") {
      const { data, error } = await supabaseAdmin
        .from("clients")
        .select("id, name, company_name, payment_type, fixed_value, percentage_value, ad_accounts, used_accounts, blocked_accounts, observations")
        .order("name");

      if (error) {
        return new Response(JSON.stringify({ erro: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        clientes: (data || []).map((c: any) => ({
          id: c.id,
          nome: c.name,
          empresa: c.company_name,
          tipo_pagamento: c.payment_type,
          valor_fixo: c.fixed_value,
          percentual: c.percentage_value,
          contas_anuncio: c.ad_accounts,
          contas_usadas: c.used_accounts,
          contas_bloqueadas: c.blocked_accounts,
          observacoes: c.observations,
        })),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
