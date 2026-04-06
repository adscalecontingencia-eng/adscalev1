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
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const chave = url.searchParams.get("chave");
    const tipo = url.searchParams.get("tipo");

    const secretKey = Deno.env.get("N8N_SECRET_KEY");
    if (!chave || chave !== secretKey) {
      return new Response(JSON.stringify({ erro: "Chave secreta inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tipo || !["pendentes", "pagas", "resumo"].includes(tipo)) {
      return new Response(JSON.stringify({ erro: "Tipo inválido. Use: pendentes, pagas ou resumo" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const json = (data: unknown) =>
      new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const getPendentes = async () => {
      const { data, error } = await supabaseAdmin
        .from("commissions")
        .select("client_id, amount, valor_pago, valor_pendente, status, clients!inner(name, company_name)")
        .in("status", ["pendente", "parcial"]);

      if (error) throw error;

      const byClient: Record<string, { nome: string; empresa: string; valor_pendente: number }> = {};
      for (const r of data || []) {
        const c = r.clients as unknown as { name: string; company_name: string | null };
        const key = r.client_id;
        if (!byClient[key]) {
          byClient[key] = { nome: c.name, empresa: c.company_name || "", valor_pendente: 0 };
        }
        byClient[key].valor_pendente += Number(r.valor_pendente || 0);
      }

      const clientes_pendentes = Object.values(byClient);
      const total_pendente = clientes_pendentes.reduce((s, c) => s + c.valor_pendente, 0);
      return { clientes_pendentes, total_pendente };
    };

    const getPagas = async () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
      const startDate = monday.toISOString().split("T")[0];
      const endDate = now.toISOString().split("T")[0];

      const { data, error } = await supabaseAdmin
        .from("commissions")
        .select("client_id, amount, valor_pago, status, date, clients!inner(name, company_name)")
        .eq("status", "pago")
        .gte("date", startDate)
        .lte("date", endDate);

      if (error) throw error;

      const byClient: Record<string, { nome: string; empresa: string; valor_pago: number }> = {};
      for (const r of data || []) {
        const c = r.clients as unknown as { name: string; company_name: string | null };
        const key = r.client_id;
        if (!byClient[key]) {
          byClient[key] = { nome: c.name, empresa: c.company_name || "", valor_pago: 0 };
        }
        byClient[key].valor_pago += Number(r.valor_pago || 0);
      }

      const clientes_pagos = Object.values(byClient);
      const total_pago = clientes_pagos.reduce((s, c) => s + c.valor_pago, 0);
      return { clientes_pagos, total_pago };
    };

    if (tipo === "pendentes") return json(await getPendentes());
    if (tipo === "pagas") return json(await getPagas());

    // resumo
    const [pendentes, pagas] = await Promise.all([getPendentes(), getPagas()]);
    return json({ ...pendentes, ...pagas });
  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
