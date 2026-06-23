import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, RefreshCw, Search } from "lucide-react";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

interface Filters { userId: string; email: string; from: string; to: string; }
const emptyFilters: Filters = { userId: "", email: "", from: "", to: "" };

function StatusBadge({ s }: { s: string }) {
  const c =
    s === "approved" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
    s === "pending" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
    s === "rejected" ? "bg-red-500/15 text-red-400 border-red-500/30" :
    "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  return <Badge variant="outline" className={c}>{s}</Badge>;
}

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

export default function AdminPayments() {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const applyRange = (q: any, col = "created_at") => {
      if (applied.from) q = q.gte(col, new Date(applied.from).toISOString());
      if (applied.to) q = q.lte(col, new Date(applied.to + "T23:59:59").toISOString());
      return q;
    };
    let dq = supabase.from("wallet_deposits").select("*").order("created_at", { ascending: false }).limit(300);
    let oq = supabase.from("marketplace_orders").select("*, marketplace_products(name)").order("created_at", { ascending: false }).limit(300);
    let eq = supabase.from("webhook_events").select("*").order("created_at", { ascending: false }).limit(200);
    if (applied.userId) { dq = dq.eq("user_id", applied.userId); oq = oq.eq("user_id", applied.userId); }
    if (applied.email) { oq = oq.ilike("customer_email", `%${applied.email}%`); }
    dq = applyRange(dq); oq = applyRange(oq); eq = applyRange(eq);
    const [{ data: d }, { data: o }, { data: e }] = await Promise.all([dq, oq, eq]);
    setDeposits(d ?? []); setOrders(o ?? []); setEvents(e ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [applied]);

  const totals = useMemo(() => ({
    depApproved: deposits.filter(d => d.status === "approved").reduce((s, d) => s + Number(d.amount || 0), 0),
    depPending: deposits.filter(d => d.status !== "approved").reduce((s, d) => s + Number(d.amount || 0), 0),
    ordApproved: orders.filter(o => o.status === "approved").reduce((s, o) => s + Number(o.amount || 0), 0),
  }), [deposits, orders]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pagamentos & Carteira</h1>
          <p className="text-sm text-muted-foreground">Depósitos Pix, compras e eventos de webhook.</p>
        </div>
        <Button onClick={load} variant="outline" size="sm"><RefreshCw className="h-4 w-4 mr-1" /> Atualizar</Button>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">User ID</Label>
            <Input value={filters.userId} onChange={(e) => setFilters({ ...filters, userId: e.target.value })} placeholder="uuid do usuário" />
          </div>
          <div>
            <Label className="text-xs">Email (compras)</Label>
            <Input value={filters.email} onChange={(e) => setFilters({ ...filters, email: e.target.value })} placeholder="cliente@..." />
          </div>
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </div>
          <div className="md:col-span-5 flex gap-2">
            <Button onClick={() => setApplied(filters)} size="sm"><Search className="h-4 w-4 mr-1" /> Aplicar</Button>
            <Button onClick={() => { setFilters(emptyFilters); setApplied(emptyFilters); }} variant="ghost" size="sm">Limpar</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Depósitos aprovados</p><p className="text-2xl font-bold text-emerald-400">{fmtBRL(totals.depApproved)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Depósitos pendentes</p><p className="text-2xl font-bold text-amber-400">{fmtBRL(totals.depPending)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Compras aprovadas</p><p className="text-2xl font-bold">{fmtBRL(totals.ordApproved)}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="deposits">
        <TabsList>
          <TabsTrigger value="deposits">Depósitos ({deposits.length})</TabsTrigger>
          <TabsTrigger value="orders">Compras ({orders.length})</TabsTrigger>
          <TabsTrigger value="events">Eventos webhook ({events.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="deposits" className="mt-4">
          <Card><CardContent className="p-0 overflow-x-auto">
            {loading ? <div className="p-4"><Skeleton className="h-24 w-full" /></div> : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr><th className="text-left p-3">Data</th><th className="text-left p-3">User ID</th><th className="text-left p-3">Valor</th><th className="text-left p-3">Status</th><th className="text-left p-3">MP Payment</th><th className="text-left p-3">Ref</th><th className="text-right p-3">Raw</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deposits.map((d) => (
                    <tr key={d.id}>
                      <td className="p-3 whitespace-nowrap">{fmtDate(d.created_at)}</td>
                      <td className="p-3 font-mono text-xs">{d.user_id?.slice(0, 8)}…</td>
                      <td className="p-3 font-medium">{fmtBRL(Number(d.amount))}</td>
                      <td className="p-3"><StatusBadge s={d.status} /></td>
                      <td className="p-3 font-mono text-xs">{d.mercado_pago_payment_id ?? "—"}</td>
                      <td className="p-3 font-mono text-xs">{d.external_reference}</td>
                      <td className="p-3 text-right"><RawDialog raw={d.raw_response} title={`Depósito ${d.external_reference}`} /></td>
                    </tr>
                  ))}
                  {deposits.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhum depósito.</td></tr>}
                </tbody>
              </table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card><CardContent className="p-0 overflow-x-auto">
            {loading ? <div className="p-4"><Skeleton className="h-24 w-full" /></div> : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr><th className="text-left p-3">Data</th><th className="text-left p-3">User ID</th><th className="text-left p-3">Produto</th><th className="text-left p-3">Email</th><th className="text-left p-3">Valor</th><th className="text-left p-3">Status</th><th className="text-right p-3">Raw</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="p-3 whitespace-nowrap">{fmtDate(o.created_at)}</td>
                      <td className="p-3 font-mono text-xs">{o.user_id?.slice(0, 8) ?? "—"}…</td>
                      <td className="p-3">{o.marketplace_products?.name ?? "—"}</td>
                      <td className="p-3">{o.customer_email ?? "—"}</td>
                      <td className="p-3 font-medium">{fmtBRL(Number(o.amount))}</td>
                      <td className="p-3"><StatusBadge s={o.status} /></td>
                      <td className="p-3 text-right"><RawDialog raw={o.raw_response} title={`Pedido ${o.external_reference}`} /></td>
                    </tr>
                  ))}
                  {orders.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhuma compra.</td></tr>}
                </tbody>
              </table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <Card><CardContent className="p-0 overflow-x-auto">
            {loading ? <div className="p-4"><Skeleton className="h-24 w-full" /></div> : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr><th className="text-left p-3">Data</th><th className="text-left p-3">Tópico</th><th className="text-left p-3">Ref</th><th className="text-left p-3">Status</th><th className="text-left p-3">HTTP</th><th className="text-left p-3">Sig</th><th className="text-right p-3">Raw</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td className="p-3 whitespace-nowrap">{fmtDate(e.created_at)}</td>
                      <td className="p-3">{e.topic ?? "—"}</td>
                      <td className="p-3 font-mono text-xs">{e.external_reference ?? "—"}</td>
                      <td className="p-3">{e.status ?? "—"}</td>
                      <td className="p-3">{e.http_status ?? "—"}</td>
                      <td className="p-3">{e.signature_valid === null ? "—" : e.signature_valid ? "✓" : "✗"}</td>
                      <td className="p-3 text-right"><RawDialog raw={{ payload: e.payload, headers: e.headers, response: e.response }} title={`Evento ${e.event_key}`} /></td>
                    </tr>
                  ))}
                  {events.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhum evento.</td></tr>}
                </tbody>
              </table>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
