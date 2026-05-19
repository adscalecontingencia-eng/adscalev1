import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, BarChart3, DollarSign, Target, MousePointerClick, TrendingUp, ShoppingCart, Activity, Users, X, Search } from "lucide-react";
import { motion } from "framer-motion";
import { PageHero } from "@/components/ui-kit";

type Range = "today" | "yesterday" | "7d" | "30d" | "90d";
type BM = { id: string; name: string };
type Account = { id: string; name: string; meta_account_id: string; bm_id: string | null; currency: string | null };
type Client = { id: string; name: string };
type Assignment = { ad_account_id: string; client_id: string; active: boolean };
type Insight = {
  ad_account_id: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  cpm: number;
  cpc: number;
  ctr: number;
  reach: number;
  purchases: number;
  revenue: number;
};

function rangeToDates(r: Range): { since: string; until: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (r === "today") return { since: fmt(today), until: fmt(today) };
  if (r === "yesterday") {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    return { since: fmt(y), until: fmt(y) };
  }
  const days = r === "7d" ? 6 : r === "30d" ? 29 : 89;
  const start = new Date(today); start.setDate(start.getDate() - days);
  return { since: fmt(start), until: fmt(today) };
}

export default function AdsDashboard() {
  const [bms, setBms] = useState<BM[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [range, setRange] = useState<Range>("7d");
  const [filterBm, setFilterBm] = useState<string>("all");
  const [filterClients, setFilterClients] = useState<string[]>([]); // [] = all; ["__unassigned__"] = sem cliente
  const [filterAccounts, setFilterAccounts] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [accountSearch, setAccountSearch] = useState("");

  const loadMeta = async () => {
    const [b, a, c, asn] = await Promise.all([
      supabase.from("meta_business_managers").select("id, name").order("name"),
      supabase.from("meta_ad_accounts").select("id, name, meta_account_id, bm_id, currency").order("name"),
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("meta_ad_account_assignments").select("ad_account_id, client_id, active").eq("active", true),
    ]);
    setBms((b.data as BM[]) || []);
    setAccounts((a.data as Account[]) || []);
    setClients((c.data as Client[]) || []);
    setAssignments((asn.data as Assignment[]) || []);
  };

  const loadInsights = async (opts?: { background?: boolean }) => {
    if (!opts?.background) setLoading(true);
    const { since, until } = rangeToDates(range);
    const { data, error } = await supabase
      .from("meta_ad_insights")
      .select("ad_account_id, date, spend, impressions, clicks, cpm, cpc, ctr, reach, purchases, revenue")
      .gte("date", since)
      .lte("date", until);
    if (error && !opts?.background) toast.error(error.message);
    setInsights((data as Insight[]) || []);
    if (!opts?.background) setLoading(false);
  };

  useEffect(() => { loadMeta(); }, []);
  useEffect(() => {
    // 1) Mostra imediatamente o que já está no banco
    // 2) Em paralelo, dispara sync em background e recarrega quando terminar
    (async () => {
      await loadInsights();
      sync({ silent: true }).then(() => loadInsights({ background: true }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const clientByAccount = useMemo(() => {
    const m = new Map<string, string>();
    assignments.forEach((a) => m.set(a.ad_account_id, a.client_id));
    return m;
  }, [assignments]);

  const filteredAccountIds = useMemo(() => {
    const includeAll = filterClients.length === 0;
    const onlyUnassigned = filterClients.length === 1 && filterClients[0] === "__unassigned__";
    const clientSet = new Set(filterClients.filter((c) => c !== "__unassigned__"));
    const includeUnassigned = filterClients.includes("__unassigned__");

    return new Set(
      accounts
        .filter((a) => {
          if (filterBm !== "all" && a.bm_id !== filterBm) return false;
          if (filterAccounts.length > 0 && !filterAccounts.includes(a.id)) return false;
          if (!includeAll) {
            const cid = clientByAccount.get(a.id);
            if (onlyUnassigned) {
              if (cid) return false;
            } else {
              const matchesClient = cid && clientSet.has(cid);
              const matchesUnassigned = includeUnassigned && !cid;
              if (!matchesClient && !matchesUnassigned) return false;
            }
          }
          return true;
        })
        .map((a) => a.id)
    );
  }, [accounts, filterBm, filterAccounts, filterClients, clientByAccount]);

  const filteredInsights = useMemo(
    () => insights.filter((i) => filteredAccountIds.has(i.ad_account_id)),
    [insights, filteredAccountIds]
  );

  const metrics = useMemo(() => {
    const spend = filteredInsights.reduce((s, i) => s + Number(i.spend || 0), 0);
    const revenue = filteredInsights.reduce((s, i) => s + Number(i.revenue || 0), 0);
    const purchases = filteredInsights.reduce((s, i) => s + Number(i.purchases || 0), 0);
    const clicks = filteredInsights.reduce((s, i) => s + Number(i.clicks || 0), 0);
    const impressions = filteredInsights.reduce((s, i) => s + Number(i.impressions || 0), 0);
    const cpa = purchases > 0 ? spend / purchases : 0;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const roas = spend > 0 ? revenue / spend : 0;
    const profit = revenue - spend;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { spend, revenue, purchases, clicks, impressions, cpa, cpm, cpc, ctr, roas, profit, margin };
  }, [filteredInsights]);

  const sync = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    setSyncing(true);
    try {
      const { since, until } = rangeToDates(range);
      const { data, error } = await supabase.functions.invoke("meta-sync", {
        body: { action: "sync_insights", since, until },
      });
      if (error) throw error;
      if ((data as any)?.erro) throw new Error((data as any).erro);
      const rows = (data as any)?.linhas_upsertadas ?? 0;
      if (!silent) toast.success(`Sincronizado: ${rows} registro(s)`);
      await loadInsights({ background: silent });
    } catch (e: any) {
      if (!silent) toast.error(`Falha: ${e.message}`);
      else console.error("auto-sync falhou:", e.message);
    } finally {
      setSyncing(false);
    }
  };

  const fmtUSD = (v: number) =>
    v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  const fmtNum = (v: number) => v.toLocaleString("pt-BR");
  const fmtPct = (v: number) => `${v.toFixed(2)}%`;

  const accountOptions = accounts.filter((a) => filterBm === "all" || a.bm_id === filterBm);

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Performance"
        title={<><span className="text-primary glow-text">Ads</span></>}
        description={`Métricas consolidadas das contas do Meta Ads — ${filteredAccountIds.size} conta(s).`}
        actions={
          <Button size="sm" disabled={syncing} onClick={() => sync()}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>
        }
      />

      {/* Filters */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(["today", "yesterday", "7d", "30d", "90d"] as Range[]).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={range === r ? "default" : "outline"}
              onClick={() => setRange(r)}
            >
              {r === "today" ? "Hoje" : r === "yesterday" ? "Ontem" : r === "7d" ? "7 dias" : r === "30d" ? "30 dias" : "90 dias"}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={filterBm} onValueChange={(v) => { setFilterBm(v); setFilterAccounts([]); }}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Todas as BMs" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as BMs</SelectItem>
              {bms.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[260px] justify-between font-normal">
                <span className="flex items-center gap-2 truncate">
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  {filterClients.length === 0
                    ? "Todos clientes"
                    : filterClients.length === 1
                      ? (filterClients[0] === "__unassigned__"
                          ? "Sem cliente"
                          : clients.find((c) => c.id === filterClients[0])?.name || "1 cliente")
                      : `${filterClients.length} clientes`}
                </span>
                {filterClients.length > 0 && (
                  <X
                    className="h-4 w-4 text-muted-foreground hover:text-foreground"
                    onClick={(e) => { e.stopPropagation(); setFilterClients([]); }}
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="pl-7 h-8 text-xs"
                    placeholder="Buscar cliente..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between px-3 py-2 border-b border-border text-xs">
                <button
                  className="text-primary hover:underline"
                  onClick={() => setFilterClients(clients.map((c) => c.id))}
                >
                  Selecionar todos
                </button>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setFilterClients([])}
                >
                  Limpar
                </button>
              </div>
              <div className="max-h-[280px] overflow-y-auto p-1">
                <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary cursor-pointer text-sm">
                  <Checkbox
                    checked={filterClients.includes("__unassigned__")}
                    onCheckedChange={(v) => {
                      setFilterClients((prev) =>
                        v ? [...prev, "__unassigned__"] : prev.filter((x) => x !== "__unassigned__")
                      );
                    }}
                  />
                  <span className="italic text-muted-foreground">— Sem cliente —</span>
                </label>
                {clients
                  .filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                  .map((c) => (
                    <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary cursor-pointer text-sm">
                      <Checkbox
                        checked={filterClients.includes(c.id)}
                        onCheckedChange={(v) => {
                          setFilterClients((prev) =>
                            v ? [...prev, c.id] : prev.filter((x) => x !== c.id)
                          );
                        }}
                      />
                      <span className="truncate">{c.name}</span>
                    </label>
                  ))}
              </div>
            </PopoverContent>
          </Popover>
          {filterClients.length > 0 && (
            <div className="flex flex-wrap gap-1 items-center">
              {filterClients.slice(0, 3).map((cid) => (
                <Badge key={cid} variant="secondary" className="gap-1">
                  {cid === "__unassigned__" ? "Sem cliente" : clients.find((c) => c.id === cid)?.name || cid}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setFilterClients((prev) => prev.filter((x) => x !== cid))}
                  />
                </Badge>
              ))}
              {filterClients.length > 3 && (
                <Badge variant="outline">+{filterClients.length - 3}</Badge>
              )}
            </div>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[260px] justify-between font-normal">
                <span className="flex items-center gap-2 truncate">
                  <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
                  {filterAccounts.length === 0
                    ? "Todas as contas"
                    : filterAccounts.length === 1
                      ? (accounts.find((a) => a.id === filterAccounts[0])?.name || "1 conta")
                      : `${filterAccounts.length} contas`}
                </span>
                {filterAccounts.length > 0 && (
                  <X
                    className="h-4 w-4 text-muted-foreground hover:text-foreground"
                    onClick={(e) => { e.stopPropagation(); setFilterAccounts([]); }}
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="pl-7 h-8 text-xs"
                    placeholder="Buscar conta..."
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between px-3 py-2 border-b border-border text-xs">
                <button
                  className="text-primary hover:underline"
                  onClick={() => setFilterAccounts(accountOptions.map((a) => a.id))}
                >
                  Selecionar todos
                </button>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setFilterAccounts([])}
                >
                  Limpar
                </button>
              </div>
              <div className="max-h-[280px] overflow-y-auto p-1">
                {accountOptions
                  .filter((a) => a.name.toLowerCase().includes(accountSearch.toLowerCase()))
                  .map((a) => (
                    <label key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary cursor-pointer text-sm">
                      <Checkbox
                        checked={filterAccounts.includes(a.id)}
                        onCheckedChange={(v) => {
                          setFilterAccounts((prev) =>
                            v ? [...prev, a.id] : prev.filter((x) => x !== a.id)
                          );
                        }}
                      />
                      <span className="truncate">{a.name}</span>
                    </label>
                  ))}
              </div>
            </PopoverContent>
          </Popover>
          {filterAccounts.length > 0 && (
            <div className="flex flex-wrap gap-1 items-center">
              {filterAccounts.slice(0, 3).map((aid) => (
                <Badge key={aid} variant="secondary" className="gap-1">
                  {accounts.find((a) => a.id === aid)?.name || aid}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setFilterAccounts((prev) => prev.filter((x) => x !== aid))}
                  />
                </Badge>
              ))}
              {filterAccounts.length > 3 && (
                <Badge variant="outline">+{filterAccounts.length - 3}</Badge>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Metric grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Metric icon={TrendingUp} label="Faturamento" value={fmtUSD(metrics.revenue)} accent />
        <Metric icon={DollarSign} label="Gasto Total" value={fmtUSD(metrics.spend)} />
        <Metric icon={DollarSign} label="Lucro" value={fmtUSD(metrics.profit)} accent={metrics.profit > 0} danger={metrics.profit < 0} />
        <Metric icon={Activity} label="Margem" value={fmtPct(metrics.margin)} accent={metrics.margin > 0} danger={metrics.margin < 0} />
        <Metric icon={Activity} label="ROAS" value={`${metrics.roas.toFixed(2)}x`} accent={metrics.roas >= 1} danger={metrics.roas > 0 && metrics.roas < 1} />
        <Metric icon={ShoppingCart} label="Compras" value={fmtNum(metrics.purchases)} />
        <Metric icon={Target} label="CPA" value={fmtUSD(metrics.cpa)} />
        <Metric icon={Activity} label="CTR" value={fmtPct(metrics.ctr)} />
        <Metric icon={DollarSign} label="CPC" value={fmtUSD(metrics.cpc)} />
        <Metric icon={DollarSign} label="CPM" value={fmtUSD(metrics.cpm)} />
        <Metric icon={MousePointerClick} label="Cliques" value={fmtNum(metrics.clicks)} />
        <Metric icon={BarChart3} label="Impressões" value={fmtNum(metrics.impressions)} />
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground text-center py-4">Carregando insights...</p>
      )}
      {!loading && filteredInsights.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum insight encontrado para os filtros selecionados. Clique em "Sincronizar período" para puxar os dados do Meta.
        </Card>
      )}
    </div>
  );
}

function Metric({
  icon: Icon, label, value, accent, danger,
}: { icon: any; label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={`p-4 ${accent ? "border-primary/40" : ""} ${danger ? "border-destructive/40" : ""}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${accent ? "text-primary" : danger ? "text-destructive" : "text-muted-foreground"}`} />
        </div>
        <div className={`text-xl font-display font-bold ${accent ? "text-primary glow-text" : danger ? "text-destructive" : "text-foreground"}`}>
          {value}
        </div>
      </Card>
    </motion.div>
  );
}
