import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Strict: only read-only single-statement SELECT/WITH queries allowed.
const ALLOWED_PREFIXES = ["SELECT", "WITH"];
const BLOCKED_KEYWORDS = [
  "DROP", "TRUNCATE", "ALTER", "CREATE", "GRANT", "REVOKE",
  "INSERT", "UPDATE", "DELETE", "MERGE", "CALL", "DO",
  "COPY", "VACUUM", "REINDEX", "CLUSTER", "LISTEN", "NOTIFY",
  "PG_READ_FILE", "PG_READ_BINARY_FILE", "PG_LS_DIR",
  "PG_SLEEP", "DBLINK", "LO_IMPORT", "LO_EXPORT",
];

function stripCommentsAndNormalize(sql: string): string {
  // Remove /* ... */ (including nested-like) and -- line comments
  let s = sql.replace(/\/\*[\s\S]*?\*\//g, " ");
  s = s.replace(/--[^\n\r]*/g, " ");
  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

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
    if (!chave || !secretKey || chave !== secretKey) {
      return new Response(JSON.stringify({ erro: "Chave secreta inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!sql || typeof sql !== "string" || sql.trim().length === 0) {
      return new Response(JSON.stringify({ erro: "Campo 'sql' é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (sql.length > 10000) {
      return new Response(JSON.stringify({ erro: "SQL muito longa" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strip comments first so bypass tricks (DR/**/OP) don't work
    const cleaned = stripCommentsAndNormalize(sql);
    const upper = cleaned.toUpperCase();

    // Reject multi-statement queries (no semicolons except optional trailing)
    const trimmedNoTrailingSemi = cleaned.replace(/;\s*$/, "");
    if (trimmedNoTrailingSemi.includes(";")) {
      return new Response(JSON.stringify({ erro: "Múltiplas instruções não permitidas" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Must start with SELECT or WITH (read-only)
    if (!ALLOWED_PREFIXES.some((p) => upper.startsWith(p + " ") || upper === p)) {
      return new Response(JSON.stringify({ erro: "Apenas SELECT/WITH são permitidos" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Block dangerous keywords/functions anywhere in the (cleaned) query
    for (const keyword of BLOCKED_KEYWORDS) {
      const regex = new RegExp(`\\b${keyword}\\b`, "i");
      if (regex.test(upper)) {
        return new Response(JSON.stringify({ erro: "Query não permitida por segurança" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Execute via service-role PostgREST is not flexible enough; use pg with READ ONLY transaction.
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      return new Response(JSON.stringify({ erro: "SUPABASE_DB_URL não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
    const pgSql = postgres(dbUrl, { max: 1 });

    try {
      // Wrap in a READ ONLY transaction with short timeout as defense-in-depth.
      const result = await pgSql.begin(async (tx: any) => {
        await tx.unsafe("SET TRANSACTION READ ONLY");
        await tx.unsafe("SET LOCAL statement_timeout = '15s'");
        return await tx.unsafe(trimmedNoTrailingSemi);
      });

      await pgSql.end();

      return new Response(JSON.stringify({ dados: result, total: (result as any).length ?? 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (pgError) {
      await pgSql.end();
      return new Response(JSON.stringify({ erro: (pgError as Error).message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ erro: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
