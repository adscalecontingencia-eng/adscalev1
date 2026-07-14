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

// Explicit allowlist — only these tables/views may be referenced. Anything
// touching Meta app secrets, wallets/payments, roles, auth/vault/storage
// schemas or unsubscribe tokens is rejected outright.
const ALLOWED_TABLES = new Set<string>([
  "transactions",
  "commissions",
  "clients",
  "partners",
  "partner_commissions",
  "meta_ad_accounts",
  "meta_business_managers",
  "meta_ad_insights",
  "marketplace_products",
  "marketplace_orders",
  "product_stock",
  "commission_tiers",
]);

// Words that must never appear (schema qualifiers, sensitive tables, cols).
const HARD_BLOCK_PATTERNS = [
  /\bauth\./i,
  /\bvault\./i,
  /\bstorage\./i,
  /\bpg_catalog\./i,
  /\binformation_schema\./i,
  /\bpg_\w+/i,
  /\bmeta_apps\b/i,
  /\buser_roles\b/i,
  /\bsupport_users\b/i,
  /\bwallets?\b/i,
  /\bwallet_deposits\b/i,
  /\bwallet_transactions\b/i,
  /\bmercadopago_payments\b/i,
  /\bemail_unsubscribe_tokens\b/i,
  /\bsuppressed_emails\b/i,
  /\btracking_pixels\b/i,
  /\bwebhook_events\b/i,
  /\baccess_logs\b/i,
  /\baudit_log\b/i,
  /\bapp_secret\b/i,
  /\bsystem_user_token\b/i,
  /\buser_access_token\b/i,
  /\bservice_role\b/i,
  /\bdecrypted_secret\b/i,
];

function stripCommentsAndNormalize(sql: string): string {
  let s = sql.replace(/\/\*[\s\S]*?\*\//g, " ");
  s = s.replace(/--[^\n\r]*/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// Extract every table name referenced after FROM / JOIN.
function referencedTables(cleaned: string): string[] {
  const out: string[] = [];
  const re = /\b(?:FROM|JOIN)\s+((?:"[^"]+"|[a-zA-Z_][\w]*)(?:\s*\.\s*(?:"[^"]+"|[a-zA-Z_][\w]*))?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    const raw = m[1].replace(/"/g, "").replace(/\s+/g, "");
    out.push(raw.toLowerCase());
  }
  return out;
}

const genericError = (status: number, msg: string) =>
  new Response(JSON.stringify({ erro: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") return genericError(405, "Método não permitido. Use POST.");

    const body = await req.json().catch(() => ({}));
    const { chave, sql } = body || {};

    const secretKey = Deno.env.get("N8N_SECRET_KEY");
    if (!chave || !secretKey || chave !== secretKey) return genericError(401, "Chave secreta inválida");

    if (!sql || typeof sql !== "string" || sql.trim().length === 0) return genericError(400, "Campo 'sql' é obrigatório");
    if (sql.length > 10000) return genericError(400, "SQL muito longa");

    const cleaned = stripCommentsAndNormalize(sql);
    const upper = cleaned.toUpperCase();

    const trimmedNoTrailingSemi = cleaned.replace(/;\s*$/, "");
    if (trimmedNoTrailingSemi.includes(";")) return genericError(403, "Múltiplas instruções não permitidas");

    if (!ALLOWED_PREFIXES.some((p) => upper.startsWith(p + " ") || upper === p)) {
      return genericError(403, "Apenas SELECT/WITH são permitidos");
    }

    for (const keyword of BLOCKED_KEYWORDS) {
      const regex = new RegExp(`\\b${keyword}\\b`, "i");
      if (regex.test(upper)) return genericError(403, "Query não permitida por segurança");
    }

    for (const pattern of HARD_BLOCK_PATTERNS) {
      if (pattern.test(cleaned)) return genericError(403, "Query referencia recurso proibido");
    }

    // Enforce table allowlist based on FROM/JOIN parsing.
    const refs = referencedTables(cleaned);
    if (refs.length === 0) return genericError(403, "Query sem tabela identificável");
    for (const t of refs) {
      // Strip schema qualifier (only public.* is acceptable and no schema at all).
      const parts = t.split(".");
      if (parts.length > 1 && parts[0] !== "public") return genericError(403, "Query referencia schema proibido");
      const tableName = parts[parts.length - 1];
      if (!ALLOWED_TABLES.has(tableName)) return genericError(403, "Tabela não permitida no allowlist");
    }

    // Execute via a scoped read-only transaction. Even though the URL grants
    // superuser, the allowlist above is what actually restricts data access.
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) return genericError(500, "Serviço indisponível");

    const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
    const pgSql = postgres(dbUrl, { max: 1 });

    try {
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
      console.error("[executar-sql] pg error:", (pgError as Error).message);
      return genericError(400, "Falha ao executar a consulta");
    }
  } catch (err) {
    console.error("[executar-sql] handler error:", (err as Error).message);
    return genericError(500, "Erro interno. Tente novamente.");
  }
});
