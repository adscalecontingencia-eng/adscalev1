import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

function toCsv(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return rows.map((r) => r.map(esc).join(";")).join("\r\n");
}

function download(filename: string, csv: string) {
  // BOM para Excel abrir em UTF-8
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportActiveAccountsCsv() {
  const [accRes, asnRes, cliRes, bmRes] = await Promise.all([
    supabase
      .from("meta_ad_accounts")
      .select(
        "id,meta_account_id,name,status,account_status,currency,amount_spent,score,score_label,owner_business_name,owner_business_id,bm_id,last_synced_at,last_sync_error_code,last_sync_error_message"
      )
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("meta_ad_account_assignments")
      .select("ad_account_id, client_id, active")
      .eq("active", true),
    supabase
      .from("clients")
      .select("id,name,company_name,payment_type,percentage_value,fixed_value"),
    supabase.from("meta_business_managers").select("id,name,meta_bm_id"),
  ]);

  const accounts = (accRes.data as any[]) || [];
  const asnByAcc = new Map<string, string>();
  ((asnRes.data as any[]) || []).forEach((a) => asnByAcc.set(a.ad_account_id, a.client_id));
  const clientById = new Map<string, any>();
  ((cliRes.data as any[]) || []).forEach((c) => clientById.set(c.id, c));
  const bmById = new Map<string, any>();
  ((bmRes.data as any[]) || []).forEach((b) => bmById.set(b.id, b));

  const header = [
    "Conta",
    "Meta Account ID",
    "Status",
    "BM",
    "BM ID (Meta)",
    "Owner Business",
    "Cliente",
    "Empresa",
    "Tipo Pagamento",
    "% Comissão",
    "Valor Fixo",
    "Moeda",
    "Gasto Acumulado",
    "Comissão Estimada",
    "Score",
    "Score Label",
    "Última Sincronização",
    "Último Erro (código)",
    "Último Erro (msg)",
  ];

  const rows: (string | number | null)[][] = [header];

  for (const a of accounts) {
    const clientId = asnByAcc.get(a.id);
    const client = clientId ? clientById.get(clientId) : null;
    const bm = a.bm_id ? bmById.get(a.bm_id) : null;
    const spend = Number(a.amount_spent) || 0;
    const pct = Number(client?.percentage_value) || 0;
    const usesPct = client?.payment_type === "percentage" || client?.payment_type === "both";
    const commission = usesPct ? +(spend * pct / 100).toFixed(2) : 0;

    rows.push([
      a.name || "",
      a.meta_account_id || "",
      a.status || "",
      bm?.name || "",
      bm?.meta_bm_id || "",
      a.owner_business_name || "",
      client?.name || "",
      client?.company_name || "",
      client?.payment_type || "",
      pct || 0,
      Number(client?.fixed_value) || 0,
      a.currency || "",
      spend,
      commission,
      a.score ?? "",
      a.score_label ?? "",
      a.last_synced_at ? format(new Date(a.last_synced_at), "dd/MM/yyyy HH:mm") : "",
      a.last_sync_error_code ?? "",
      a.last_sync_error_message ?? "",
    ]);
  }

  const stamp = format(new Date(), "yyyy-MM-dd_HH-mm");
  download(`contas-ativas_${stamp}.csv`, toCsv(rows));
}

export async function exportArchivedAccountsCsv() {
  const { data } = await supabase
    .from("meta_ad_accounts")
    .select(
      "meta_account_id,name,status,currency,amount_spent,owner_business_name,last_sync_error_code,last_sync_error_message,last_sync_error_source,last_sync_error_at,archived_at,last_synced_at"
    )
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });

  const header = [
    "Conta",
    "Meta Account ID",
    "Status",
    "Owner Business",
    "Moeda",
    "Gasto Acumulado",
    "Motivo (código)",
    "Motivo (mensagem)",
    "Origem do Erro",
    "Data do Último Erro",
    "Arquivada em",
    "Última Sincronização",
  ];

  const rows: (string | number | null)[][] = [header];
  for (const a of (data as any[]) || []) {
    rows.push([
      a.name || "",
      a.meta_account_id || "",
      a.status || "",
      a.owner_business_name || "",
      a.currency || "",
      Number(a.amount_spent) || 0,
      a.last_sync_error_code ?? "",
      a.last_sync_error_message ?? "",
      a.last_sync_error_source ?? "",
      a.last_sync_error_at ? format(new Date(a.last_sync_error_at), "dd/MM/yyyy HH:mm") : "",
      a.archived_at ? format(new Date(a.archived_at), "dd/MM/yyyy HH:mm") : "",
      a.last_synced_at ? format(new Date(a.last_synced_at), "dd/MM/yyyy HH:mm") : "",
    ]);
  }

  const stamp = format(new Date(), "yyyy-MM-dd_HH-mm");
  download(`contas-arquivadas_${stamp}.csv`, toCsv(rows));
}
