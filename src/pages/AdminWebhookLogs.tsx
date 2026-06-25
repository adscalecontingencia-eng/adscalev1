import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, Search, ExternalLink, Webhook } from "lucide-react";

type Row = {
  id: string;
  created_at: string;
  topic: string | null;
  data_id: string | null;
  status: string | null;
  http_status: number | null;
  signature_valid: boolean | null;
  external_reference: string | null;
  payload: any;
  response: any;
};

type DepositLink = { id: string; amount: number; status: string; user_id: string };

const fmtDate = (s: string) => new Date(s).toLocaleString("pt-BR");

function statusVariant(status: string | null, http: number | null): "default" | "secondary" | "destructive" | "outline" {
  if (!status) return "secondary";
  if (status === "deposit_processed") return "default";
  if (status.startsWith("deposit_")) return "secondary";
  if (status.includes("ignored")) return "outline";
  if (status.includes("invalid") || status.includes("missing") || (http && http >= 400)) return "destructive";
  return "secondary";
}

function reasonFor(row: Row): string {
  const s = row.status ?? "";
  if (s === "ignored_no_id") return "Webhook não trouxe data.id";
  if (s === "ignored_no_ref") return "Pagamento não tinha external_reference nem order.id (provavelmente simulação do painel ou pagamento de outra conta MP)";
  if (s === "invalid_signature") return "Assinatura HMAC do MP não bateu — verifique MERCADO_PAGO_WEBHOOK_SECRET";
  if (s === "token_missing") return "Variável MERCADO_PAGO_ACCESS_TOKEN_* ausente";
  if (s === "order_not_found") return "Order não localizada no banco para esse external_reference";
  if (s === "already_approved") return "Pedido já estava aprovado e liberado";
  if (s?.startsWith("deposit_")) {
    if (s === "deposit_processed") return "Depósito creditado com sucesso";
    return `Depósito em estado ${s.replace("deposit_", "")}`;
  }
  return "—";
}

export default function AdminWebhookLogs() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "ok" | "ignored" | "error">("all");
  const [detail, setDetail] = useState<Row | null>(null);
  const [deposits, setDeposits] = useState<Record<string, DepositLink>>({});

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("webhook_events")
      .select("id, created_at, topic, data_id, status, http_status, signature_valid, external_reference, payload, response")
      .eq("provider", "mercado_pago")
      .order("created_at", { ascending: false })
      .limit(200);
    const list = (data ?? []) as Row[];
    setRows(list);
    setLoading(false);

    // Lookup matching deposits by external_reference OR by mp_payment_id
    const refs = Array.from(new Set(list.map((r) => r.external_reference).filter(Boolean) as string[]));
    const ids = Array.from(new Set(list.map((r) => r.data_id).filter(Boolean) as string[]));
    const map: Record<string, DepositLink> = {};
    if (refs.length) {
      const { data: d1 } = await supabase
        .from("wallet_deposits")
        .select("id, amount, status, user_id, external_reference, mercado_pago_payment_id")
        .in("external_reference", refs);
      (d1 ?? []).forEach((d: any) => {
        if (d.external_reference) map[`ref:${d.external_reference}`] = d;
        if (d.mercado_pago_payment_id) map[`pid:${d.mercado_pago_payment_id}`] = d;
      });
    }
    if (ids.length) {
      const { data: d2 } = await supabase
        .from("wallet_deposits")
        .select("id, amount, status, user_id, external_reference, mercado_pago_payment_id")
        .in("mercado_pago_payment_id", ids);
      (d2 ?? []).forEach((d: any) => {
        if (d.external_reference) map[`ref:${d.external_reference}`] = d;
        if (d.mercado_pago_payment_id) map[`pid:${d.mercado_pago_payment_id}`] = d;
      });
    }
    setDeposits(map);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-webhook-events")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "webhook_events" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "ok" && r.status !== "deposit_processed") return false;
      if (filter === "ignored" && !(r.status ?? "").includes("ignored")) return false;
      if (filter === "error" && !((r.http_status ?? 0) >= 400 || (r.status ?? "").match(/invalid|missing|not_found/))) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return [r.data_id, r.external_reference, r.status, r.topic].some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [rows, query, filter]);

  function depositFor(r: Row): DepositLink | null {
    if (r.external_reference && deposits[`ref:${r.external_reference}`]) return deposits[`ref:${r.external_reference}`];
    if (r.data_id && deposits[`pid:${r.data_id}`]) return deposits[`pid:${r.data_id}`];
    return null;
  }

  const stats = useMemo(() => {
    return {
      total: rows.length,
      ok: rows.filter((r) => r.status === "deposit_processed").length,
      ignored: rows.filter((r) => (r.status ?? "").includes("ignored")).length,
      error: rows.filter((r) => (r.http_status ?? 0) >= 400 || (r.status ?? "").match(/invalid|missing|not_found/)).length,
    };
  }, [rows]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Webhook className="w-6 h-6 text-primary" /> Logs de Webhook — Mercado Pago
          </h1>
          <p className="text-sm text-muted-foreground">Cada notificação recebida do MP, com motivo e link para o depósito.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, key: "all" as const },
          { label: "Processados", value: stats.ok, key: "ok" as const },
          { label: "Ignorados", value: stats.ignored, key: "ignored" as const },
          { label: "Erros", value: stats.error, key: "error" as const },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`rounded-xl border p-4 text-left transition ${filter === s.key ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="text-2xl font-bold text-foreground">{s.value}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Eventos recentes</CardTitle>
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9 h-9" placeholder="Buscar por data.id, ref, status…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Topic</th>
                  <th className="text-left p-3">data.id</th>
                  <th className="text-left p-3">Live</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Assinatura</th>
                  <th className="text-left p-3">Motivo</th>
                  <th className="text-left p-3">Depósito</th>
                  <th className="text-right p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Nenhum evento.</td></tr>
                )}
                {filtered.map((r) => {
                  const live = r.payload?.live_mode;
                  const dep = depositFor(r);
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                      <td className="p-3 whitespace-nowrap text-xs">{fmtDate(r.created_at)}</td>
                      <td className="p-3 text-xs">{r.topic ?? "—"}</td>
                      <td className="p-3 text-xs font-mono">{r.data_id ?? "—"}</td>
                      <td className="p-3">
                        {live === true && <Badge variant="default" className="text-[10px]">LIVE</Badge>}
                        {live === false && <Badge variant="outline" className="text-[10px]">TEST</Badge>}
                      </td>
                      <td className="p-3">
                        <Badge variant={statusVariant(r.status, r.http_status)} className="text-[10px]">
                          {r.status ?? "—"}{r.http_status ? ` · ${r.http_status}` : ""}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs">
                        {r.signature_valid === true && <span className="text-primary">✓ válida</span>}
                        {r.signature_valid === false && <span className="text-destructive">✗ inválida</span>}
                        {r.signature_valid === null && <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground max-w-xs">{reasonFor(r)}</td>
                      <td className="p-3 text-xs">
                        {dep ? (
                          <Link to={`/admin-payments?deposit=${dep.id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                            R$ {Number(dep.amount).toFixed(2)} <ExternalLink className="w-3 h-3" />
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDetail(r)}>Detalhes</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Evento {detail?.data_id ?? detail?.id}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-xs">
              <div><b>Motivo:</b> {reasonFor(detail)}</div>
              <div>
                <div className="font-semibold mb-1">Payload</div>
                <pre className="bg-muted/40 p-3 rounded-lg overflow-auto max-h-72">{JSON.stringify(detail.payload, null, 2)}</pre>
              </div>
              {detail.response && (
                <div>
                  <div className="font-semibold mb-1">Resposta</div>
                  <pre className="bg-muted/40 p-3 rounded-lg overflow-auto max-h-48">{JSON.stringify(detail.response, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
