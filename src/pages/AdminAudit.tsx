import { useEffect, useMemo, useState } from "react";
import { tr } from '@/i18n';
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
{raw ? JSON.stringify(raw, null, 2) : tr('fin.aud.noPayload')}
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
      toast({ title: tr('fin.aud.done'), description: JSON.stringify(data?.result ?? data) });
      setOpen(false);
      setReason("");
      onDone?.();
    } catch (e: any) {
      toast({ title: tr('fin.aud.fail'), description: e.message ?? String(e), variant: "destructive" });
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
            <Label>{tr('fin.aud.reason')}</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tr('fin.aud.reasonPh')} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>{tr('fin.aud.cancel')}</Button>
            <Button onClick={run} disabled={busy}>{busy ? tr('fin.aud.running') : tr('fin.aud.confirm')}</Button>
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
          <h1 className="text-2xl font-bold">{tr('fin.aud.title')}</h1>
          <p className="text-muted-foreground text-sm">{tr('fin.aud.desc')}</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> {tr('fin.aud.refresh')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Label>{tr('fin.aud.search')}</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-3 text-muted-foreground" />
              <Input className="pl-8" placeholder={tr('fin.aud.searchPh')} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div><Label>{tr('fin.aud.from')}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>{tr('fin.aud.to')}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Tabs defaultValue="downloads">
        <TabsList>
          <TabsTrigger value="downloads">{tr('fin.aud.tabDl', { n: filteredDownloads.length })}</TabsTrigger>
          <TabsTrigger value="actions">{tr('fin.aud.tabActions', { n: filteredActions.length })}</TabsTrigger>
          <TabsTrigger value="orders">{tr('fin.aud.tabOrders', { n: filteredOrders.length })}</TabsTrigger>
          <TabsTrigger value="deposits">{tr('fin.aud.tabDeposits', { n: deposits.length })}</TabsTrigger>
        </TabsList>

        <TabsContent value="downloads">
          <Card>
            <CardHeader><CardTitle>{tr('fin.aud.signed')}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="p-2">{tr('fin.aud.when')}</th>
                    <th className="p-2">Order</th>
                    <th className="p-2">{tr('fin.aud.owner')}</th>
                    <th className="p-2">{tr('fin.aud.requester')}</th>
                    <th className="p-2">{tr('fin.aud.released')}</th>
                    <th className="p-2">{tr('fin.aud.success')}</th>
                    <th className="p-2">{tr('fin.aud.expires')}</th>
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
                      <td className="p-2">{r.download_released ? <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">{tr('fin.aud.yes')}</Badge> : <Badge variant="outline">{tr('fin.aud.no')}</Badge>}</td>
                      <td className="p-2">{r.success ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <span className="flex items-center gap-1 text-red-400"><XCircle className="h-4 w-4" />{r.error_message ?? "erro"}</span>}</td>
                      <td className="p-2 whitespace-nowrap">{fmtDate(r.signed_url_expires_at)}</td>
                      <td className="p-2 text-xs">{r.ip ?? "—"}</td>
                      <td className="p-2"><RawDialog raw={r} title="Download audit" /></td>
                    </tr>
                  ))}
                  {filteredDownloads.length === 0 && (
                    <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">{tr('fin.aud.none')}</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions">
          <Card>
            <CardHeader><CardTitle>{tr('fin.aud.historyTitle')}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="p-2">{tr('fin.aud.when')}</th>
                    <th className="p-2">{tr('fin.aud.type')}</th>
                    <th className="p-2">{tr('fin.aud.action')}</th>
                    <th className="p-2">{tr('fin.aud.target')}</th>
                    <th className="p-2">{tr('fin.aud.by')}</th>
                    <th className="p-2">Motivo</th>
                    <th className="p-2">{tr('fin.aud.details')}</th>
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
                      <td className="p-2"><RawDialog raw={r} title={tr('fin.aud.adminAction')} /></td>
                    </tr>
                  ))}
                  {filteredActions.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{tr('fin.aud.noActions')}</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader><CardTitle>{tr('fin.aud.ordersTitle')}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="p-2">{tr('fin.aud.when')}</th>
                    <th className="p-2">Order</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">{tr('fin.aud.value')}</th>
                    <th className="p-2">{tr('fin.aud.status')}</th>
                    <th className="p-2">Download</th>
                    <th className="p-2">{tr('fin.aud.actions')}</th>
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
                      <td className="p-2">{r.download_released ? tr('fin.aud.dlReleased') : tr('fin.aud.dlBlocked')}</td>
                      <td className="p-2 flex flex-wrap gap-1">
                        <ActionDialog targetType="marketplace_order" targetId={r.id} defaultAction="reprocess" label={tr('fin.aud.reprocess')} onDone={load} />
                        <ActionDialog targetType="marketplace_order" targetId={r.id} defaultAction="release_download" label={tr('fin.aud.releaseDl')} onDone={load} />
                        <ActionDialog targetType="marketplace_order" targetId={r.id} defaultAction="mark_credited" label={tr('fin.aud.markCredited')} onDone={load} />
                        <ActionDialog targetType="marketplace_order" targetId={r.id} defaultAction="refund" label={tr('fin.aud.refund')} onDone={load} />
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
            <CardHeader><CardTitle>{tr('fin.aud.depositsTitle')}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="p-2">{tr('fin.aud.when')}</th>
                    <th className="p-2">ID</th>
                    <th className="p-2">User</th>
                    <th className="p-2">{tr('fin.aud.value')}</th>
                    <th className="p-2">{tr('fin.aud.status')}</th>
                    <th className="p-2">{tr('fin.aud.credited')}</th>
                    <th className="p-2">{tr('fin.aud.actions')}</th>
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
                        <ActionDialog targetType="wallet_deposit" targetId={r.id} defaultAction="reprocess" label={tr('fin.aud.reprocess')} onDone={load} />
                        <ActionDialog targetType="wallet_deposit" targetId={r.id} defaultAction="mark_credited" label={tr('fin.aud.markCredited')} onDone={load} />
                        <ActionDialog targetType="wallet_deposit" targetId={r.id} defaultAction="refund" label={tr('fin.aud.refund')} onDone={load} />
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
