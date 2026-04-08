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
    const { chave, tipo_tabela, descricao_busca, cliente_id, valor, data, data_inicio, data_fim, ad_spend, deletar_tudo } = body;

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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Deletar tudo
    if (deletar_tudo === true) {
      const { data: allRecords, error: fetchErr } = await supabaseAdmin.from(tipo_tabela).select("id");
      if (fetchErr) {
        return new Response(JSON.stringify({ erro: fetchErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const total = allRecords?.length || 0;
      if (total === 0) {
        return new Response(JSON.stringify({ sucesso: true, total_deletado: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ids = allRecords.map((r: any) => r.id);
      const { error: delErr } = await supabaseAdmin.from(tipo_tabela).delete().in("id", ids);
      if (delErr) {
        return new Response(JSON.stringify({ erro: delErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ sucesso: true, total_deletado: total }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!descricao_busca && !cliente_id && !valor && !data && !data_inicio) {
      return new Response(JSON.stringify({ erro: "Informe pelo menos um critério de busca" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isTransactions = tipo_tabela === "transactions";

    let query = supabaseAdmin.from(tipo_tabela).select("*");

    if (isTransactions) {
      if (descricao_busca) {
        query = query.or(`description.ilike.%${descricao_busca}%,category.ilike.%${descricao_busca}%`);
      }
    } else {
      if (cliente_id && (valor !== undefined && valor !== null)) {
        // use only cliente_id + valor (applied below)
      } else if (descricao_busca) {
        query = query.or(`note.ilike.%${descricao_busca}%,type.ilike.%${descricao_busca}%`);
      }
    }
    if (cliente_id) {
      query = query.eq("client_id", cliente_id);
    }
    if (valor !== undefined && valor !== null) {
      query = query.eq("amount", valor);
    }
    if (!isTransactions && ad_spend !== undefined && ad_spend !== null) {
      query = query.eq("ad_spend", ad_spend);
    }
    if (data_inicio && data_fim) {
      query = query.gte("date", data_inicio).lte("date", data_fim);
    } else if (data) {
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
        descricao: isTransactions ? r.description : (r.type === 'daily' ? 'Gasto em Ads' : r.note),
        valor: isTransactions ? r.amount : (r.ad_spend ?? r.amount),
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
