import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BLOCKED_KEYWORDS = ["DROP", "TRUNCATE", "ALTER", "CREATE", "GRANT", "REVOKE"];
const ALLOWED_PREFIXES = ["SELECT", "INSERT", "UPDATE", "DELETE"];

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
    const { chave, sql } = body;

    const secretKey = Deno.env.get("N8N_SECRET_KEY");
    if (!chave || chave !== secretKey) {
      return new Response(JSON.stringify({ erro: "Chave secreta inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!sql || typeof sql !== "string" || sql.trim().length === 0) {
      return new Response(JSON.stringify({ erro: "Campo 'sql' é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedSql = sql.trim().toUpperCase();

    // Check blocked keywords
    for (const keyword of BLOCKED_KEYWORDS) {
      const regex = new RegExp(`\\b${keyword}\\b`, "i");
      if (regex.test(normalizedSql)) {
        return new Response(JSON.stringify({ erro: "Query não permitida por segurança" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check allowed prefixes
    const startsWithAllowed = ALLOWED_PREFIXES.some((prefix) =>
      normalizedSql.startsWith(prefix)
    );
    if (!startsWithAllowed) {
      return new Response(JSON.stringify({ erro: "Query não permitida por segurança" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine query type
    const isSelect = normalizedSql.startsWith("SELECT");

    // Use pg connection via SUPABASE_DB_URL
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      return new Response(JSON.stringify({ erro: "SUPABASE_DB_URL não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dynamic import of postgres driver for Deno
    const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");

    const pgSql = postgres(dbUrl, { max: 1 });

    try {
      const result = await pgSql.unsafe(sql);

      await pgSql.end();

      if (isSelect) {
        return new Response(JSON.stringify({ dados: result, total: result.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        return new Response(JSON.stringify({ sucesso: true, afetados: result.count ?? result.length ?? 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (pgError) {
      await pgSql.end();
      return new Response(JSON.stringify({ erro: pgError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ erro: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
