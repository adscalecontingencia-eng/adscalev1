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
    const { chave, nome, campos } = body;

    const secretKey = Deno.env.get("N8N_SECRET_KEY");
    if (!chave || chave !== secretKey) {
      return new Response(JSON.stringify({ erro: "Chave secreta inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!nome) {
      return new Response(JSON.stringify({ erro: "Campo 'nome' é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!campos || typeof campos !== "object") {
      return new Response(JSON.stringify({ erro: "Campo 'campos' é obrigatório e deve ser um objeto" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar cliente por nome parcial
    const { data: clients, error: searchError } = await supabaseAdmin
      .from("clients")
      .select("id, name, email, ad_accounts, used_accounts, blocked_accounts, percentage_value, fixed_value")
      .ilike("name", `%${nome}%`);

    if (searchError) {
      console.error("[atualizar-cliente] search error:", searchError.message);
      return new Response(JSON.stringify({ erro: "Falha ao buscar cliente" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ erro: "Cliente não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = clients[0];

    // Mapear campos recebidos para colunas do banco
    const fieldMap: Record<string, string> = {
      contas_disponiveis: "ad_accounts",
      contas_usadas: "used_accounts",
      contas_bloqueadas: "blocked_accounts",
      percentual: "percentage_value",
      valor_fixo: "fixed_value",
    };

    const updateObj: Record<string, unknown> = {};
    for (const [key, col] of Object.entries(fieldMap)) {
      if (campos[key] !== null && campos[key] !== undefined) {
        updateObj[col] = campos[key];
      }
    }

    if (Object.keys(updateObj).length === 0) {
      return new Response(JSON.stringify({ erro: "Nenhum campo válido para atualizar" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("clients")
      .update(updateObj)
      .eq("id", client.id)
      .select()
      .single();

    if (updateError) {
      console.error("[atualizar-cliente] update error:", updateError.message);
      return new Response(JSON.stringify({ erro: "Falha ao atualizar cliente" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sucesso: true, cliente: updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[atualizar-cliente] handler error:", (err as Error).message);
    return new Response(JSON.stringify({ erro: "Erro interno. Tente novamente." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
