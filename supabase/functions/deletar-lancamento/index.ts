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
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { chave, tipo_tabela, descricao_busca, cliente_id, valor, data, data_inicio, data_fim } = body;

    const secretKey = Deno.env.get("N8N_SECRET_KEY");
    if (!chave || chave !== secretKey) {
      return new Response(JSON.stringify({ erro: "Chave secreta inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tipo_tabela || !["transactions", "commissions"].includes(tipo_tabela)) {
      return new Response(JSON.stringify({ erro: "tipo_tabela deve ser 'transactions' ou 'commissions'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!descricao_busca && !cliente_id && !valor && !data && !data_inicio) {
      return new Response(JSON.stringify({ erro: "Informe pelo menos um critério de busca" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const isTransactions = tipo_tabela === "transactions";
    const textCol = isTransactions ? "description" : "note";

    let query = supabaseAdmin.from(tipo_tabela).select("*");

    if (descricao_busca) {
      query = query.ilike(textCol, `%${descricao_busca}%`);
    }
    if (cliente_id) {
      query = query.eq("client_id", cliente_id);
    }
    if (valor !== undefined && valor !== null) {
      query = query.eq("amount", valor);
    }
    if (data) {
      if (isTransactions) {
        query = query.eq("date", data);
      } else {
        query = query.gte("date", `${data}T00:00:00`).lt("date", `${data}T23:59:59.999`);
      }
    }

    const { data: records, error: searchError } = await query;

    if (searchError) {
      return new Response(JSON.stringify({ erro: searchError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ erro: "Nenhum lançamento encontrado com esses critérios" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (records.length > 1) {
      const lista = records.map((r: any) => ({
        id: r.id,
        descricao: isTransactions ? r.description : r.note,
        valor: r.amount,
        data: r.date,
      }));
      return new Response(JSON.stringify({ multiplos: true, total: records.length, registros: lista }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const record = records[0];
    const { error: deleteError } = await supabaseAdmin
      .from(tipo_tabela)
      .delete()
      .eq("id", record.id);

    if (deleteError) {
      return new Response(JSON.stringify({ erro: deleteError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sucesso: true, deletado: record }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
