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
    const periodo = url.searchParams.get("periodo");
    const tipo = url.searchParams.get("tipo");
    const clienteId = url.searchParams.get("cliente_id");
    const customStart = url.searchParams.get("start");
    const customEnd = url.searchParams.get("end");

    // Validate secret key
    const secretKey = Deno.env.get("N8N_SECRET_KEY");
    if (!chave || chave !== secretKey) {
      return new Response(JSON.stringify({ erro: "Chave secreta inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let startDate: string;
    let endDate: string;

    if (customStart && customEnd) {
      startDate = customStart;
      endDate = customEnd;
    } else {
      const now = new Date();
      endDate = now.toISOString().split("T")[0];
      const p = periodo || "hoje";

      if (p === "hoje") {
        startDate = endDate;
      } else if (p === "semana") {
        const dayOfWeek = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
        startDate = monday.toISOString().split("T")[0];
      } else if (p === "mes") {
        startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      } else {
        return new Response(JSON.stringify({ erro: "Período inválido. Use: hoje, semana ou mes" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = supabaseAdmin
      .from("transactions")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });

    if (tipo) {
      query = query.eq("type", tipo);
    }

    if (clienteId) {
      query = query.eq("client_id", clienteId);
    }

    const { data, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ erro: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ total: data.length, transacoes: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
