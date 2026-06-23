import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Eye, RefreshCw, ShieldCheck, RotateCcw, Search, CheckCircle2, XCircle } from "lucide-react";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

function RawDialog({ raw, title }: { raw: unknown; title: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Eye className="h-4 w-4 mr-1" /> Raw</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <pre className="text-xs bg-muted/50 p-3 rounded overflow-auto flex-1 font-mono">
{raw ? JSON.stringify(raw, null, 2) : "(sem payload)"}
        </pre>
      </DialogContent>
    </Dialog>
  );
}

function ActionDialog({
  targetType, targetId, defaultAction, label, onDone,
}: {
  targetType: "wallet_deposit" | "marketplace_order";
  targetId: string;
  defaultAction: "reprocess" | "refund" | "mark_credited" | "release_download";
  label: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-payment-action", {
        body: { target_type: targetType, target_id: targetId, action: defaultAction, reason },
      });
      if (error) throw error;
      toast({ title: "Ação executada", description: JSON.stringify(data?.result ?? data) });
      setOpen(false);
      setReason("");
      onDone?.();
    } catch (e: any) {
      toast({ title: "Falha", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">{label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label} — {targetType}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">ID: {targetId}</div>
          <div>
            <Label>Motivo / observação</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Descreva o motivo desta ação" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={run} disabled={busy}>{busy ? "Executando..." : "Confirmar"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminAudit() {
  const [downloads, setDownloads] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      let dq = supabase.from("download_audit_log").select("*").order("created_at", { ascending: false }).limit(500);
      let aq = supabase.from("payment_admin_actions").select("*").order("created_at", { ascending: false }).limit(500);
      let oq = supabase.from("marketplace_orders").select("id, user_id, customer_email, amount, status, download_released, created_at, product_id, external_reference").order("created_at", { ascending: false }).limit(300);
      let depQ = supabase.from("wallet_deposits").select("id, user_id, amount, status, credited_at, external_reference, mercado_pago_payment_id, created_at").order("created_at", { ascending: false }).limit(300);
      if (from) { dq = dq.gte("created_at", from); aq = aq.gte("created_at", from); oq = oq.gte("created_at", from); depQ = depQ.gte("created_at", from); }
      if (to) { const end = `${to}T23:59:59`; dq = dq.lte("created_at", end); aq = aq.lte("created_at", end); oq = oq.lte("created_at", end); depQ = depQ.lte("created_at", end); }
      const [d, a, o, dep] = await Promise.all([dq, aq, oq, depQ]);
      setDownloads(d.data ?? []);
      setActions(a.data ?? []);
      setOrders(o.data ?? []);
      setDeposits(dep.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [from, to]);

  const filteredDownloads = useMemo(() => downloads.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return [r.user_id, r.requested_by, r.marketplace_order_id, r.error_message, r.file_path]
      .some((v) => (v ?? "").toString().toLowerCase().includes(s));
  }), [downloads, search]);

  const filteredActions = useMemo(() => actions.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return [r.target_id, r.performed_by, r.performed_by_email, r.action, r.reason]
      .some((v) => (v ?? "").toString().toLowerCase().includes(s));
  }), [actions, search]);

  const filteredOrders = useMemo(() => orders.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return [r.id, r.user_id, r.customer_email, r.external_reference, r.status]
      .some((v) => (v ?? "").toString().toLowerCase().includes(s));
  }), [orders, search]);

  return (
    <div className="space-y-6 p-2 md:p-4">
      <div className="flex flex-col md:flex-row md:items-end gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold">Auditoria de Pagamentos</h1>
          <p className="text-muted-foreground text-sm">Liberações de download, ações administrativas e gerenciamento.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-3 text-muted-foreground" />
              <Input className="pl-8" placeholder="user_id, email, order_id, ação..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Tabs defaultValue="downloads">
        <TabsList>
          <TabsTrigger value="downloads">Downloads ({filteredDownloads.length})</TabsTrigger>
          <TabsTrigger value="actions">Ações Admin ({filteredActions.length})</TabsTrigger>
          <TabsTrigger value="orders">Gerenciar Compras ({filteredOrders.length})</TabsTrigger>
          <TabsTrigger value="deposits">Gerenciar Depósitos ({deposits.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="downloads">
          <Card>
            <CardHeader><CardTitle>Liberações de Link Assinado (TXT)</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="p-2">Quando</th>
                    <th className="p-2">Order</th>
                    <th className="p-2">Dono da compra</th>
                    <th className="p-2">Solicitante</th>
                    <th className="p-2">Liberado?</th>
                    <th className="p-2">Sucesso</th>
                    <th className="p-2">Expira</th>
                    <th className="p-2">IP</th>
                    <th className="p-2">Raw</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDownloads.map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="p-2 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                      <td className="p-2 font-mono text-xs">{r.marketplace_order_id?.slice(0, 8) ?? "—"}</td>
                      <td className="p-2 font-mono text-xs">{r.user_id?.slice(0, 8) ?? "—"}</td>
                      <td className="p-2 font-mono text-xs">{r.requested_by?.slice(0, 8) ?? "—"}</td>
                      <td className="p-2">{r.download_released ? <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">sim</Badge> : <Badge variant="outline">não</Badge>}</td>
                      <td className="p-2">{r.success ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <span className="flex items-center gap-1 text-red-400"><XCircle className="h-4 w-4" />{r.error_message ?? "erro"}</span>}</td>
                      <td className="p-2 whitespace-nowrap">{fmtDate(r.signed_url_expires_at)}</td>
                      <td className="p-2 text-xs">{r.ip ?? "—"}</td>
                      <td className="p-2"><RawDialog raw={r} title="Download audit" /></td>
                    </tr>
                  ))}
                  {filteredDownloads.length === 0 && (
                    <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Nenhum registro</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions">
          <Card>
            <CardHeader><CardTitle>Histórico de ações administrativas</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="p-2">Quando</th>
                    <th className="p-2">Tipo</th>
                    <th className="p-2">Ação</th>
                    <th className="p-2">Alvo</th>
                    <th className="p-2">Por</th>
                    <th className="p-2">Motivo</th>
                    <th className="p-2">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActions.map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="p-2 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                      <td className="p-2">{r.target_type}</td>
                      <td className="p-2"><Badge variant="outline">{r.action}</Badge></td>
                      <td className="p-2 font-mono text-xs">{r.target_id?.slice(0, 8)}</td>
                      <td className="p-2 text-xs">{r.performed_by_email ?? r.performed_by?.slice(0, 8) ?? "—"}</td>
                      <td className="p-2 text-xs max-w-[260px] truncate">{r.reason ?? "—"}</td>
                      <td className="p-2"><RawDialog raw={r} title="Ação admin" /></td>
                    </tr>
                  ))}
                  {filteredActions.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma ação registrada</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader><CardTitle>Compras — ações administrativas</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="p-2">Quando</th>
                    <th className="p-2">Order</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">Valor</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Download</th>
                    <th className="p-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="p-2 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                      <td className="p-2 font-mono text-xs">{r.id.slice(0, 8)}</td>
                      <td className="p-2 text-xs">{r.customer_email ?? "—"}</td>
                      <td className="p-2">{fmtBRL(Number(r.amount))}</td>
                      <td className="p-2"><Badge variant="outline">{r.status}</Badge></td>
                      <td className="p-2">{r.download_released ? "Liberado" : "Bloqueado"}</td>
                      <td className="p-2 flex flex-wrap gap-1">
                        <ActionDialog targetType="marketplace_order" targetId={r.id} defaultAction="reprocess" label="Reprocessar" onDone={load} />
                        <ActionDialog targetType="marketplace_order" targetId={r.id} defaultAction="release_download" label="Liberar Download" onDone={load} />
                        <ActionDialog targetType="marketplace_order" targetId={r.id} defaultAction="mark_credited" label="Marcar Creditado" onDone={load} />
                        <ActionDialog targetType="marketplace_order" targetId={r.id} defaultAction="refund" label="Estornar" onDone={load} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deposits">
          <Card>
            <CardHeader><CardTitle>Depósitos — ações administrativas</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="p-2">Quando</th>
                    <th className="p-2">ID</th>
                    <th className="p-2">User</th>
                    <th className="p-2">Valor</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Creditado</th>
                    <th className="p-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="p-2 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                      <td className="p-2 font-mono text-xs">{r.id.slice(0, 8)}</td>
                      <td className="p-2 font-mono text-xs">{r.user_id?.slice(0, 8) ?? "—"}</td>
                      <td className="p-2">{fmtBRL(Number(r.amount))}</td>
                      <td className="p-2"><Badge variant="outline">{r.status}</Badge></td>
                      <td className="p-2 text-xs">{fmtDate(r.credited_at)}</td>
                      <td className="p-2 flex flex-wrap gap-1">
                        <ActionDialog targetType="wallet_deposit" targetId={r.id} defaultAction="reprocess" label="Reprocessar" onDone={load} />
                        <ActionDialog targetType="wallet_deposit" targetId={r.id} defaultAction="mark_credited" label="Marcar Creditado" onDone={load} />
                        <ActionDialog targetType="wallet_deposit" targetId={r.id} defaultAction="refund" label="Estornar" onDone={load} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
