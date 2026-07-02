import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, ArrowUpDown, Users, BarChart3, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Insight {
  ad_account_id: string;
  date: string;
  spend: number;
  revenue: number;
  purchases: number;
}

interface Account {
  id: string;
  name: string;
  bm_id: string | null;
  status?: string | null;
  last_synced_at?: string | null;
}

interface BM { id: string; name: string }
interface Client { id: string; name: string }

interface Props {
  insights: Insight[];
  accounts: Account[];
  bms: BM[];
  clients: Client[];
  clientByAccount: Map<string, string>;
  /** Date-aware resolver — preferred over clientByAccount when provided. */
  resolveClient?: (accountId: string, date: string) => string | null;
  onPickClient?: (clientId: string) => void;
  onPickAccount?: (accountId: string) => void;
  onPickBm?: (bmId: string) => void;
}

type Tab = "client" | "account" | "bm";
type SortKey = "spend" | "revenue" | "roas" | "purchases";

const fmtUSD = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtNum = (v: number) => v.toLocaleString("pt-BR");

interface Row {
  id: string;
  label: string;
  sublabel?: string;
  spend: number;
  revenue: number;
  purchases: number;
  roas: number;
  profit: number;
  status?: string | null;
}

export default function AdsBreakdownTable({
  insights, accounts, bms, clients, clientByAccount, resolveClient,
  onPickClient, onPickAccount, onPickBm,
}: Props) {
  const [tab, setTab] = useState<Tab>("client");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("spend");

  const rows: Row[] = useMemo(() => {
    const acc = new Map<string, Row>();
    const getClient = (accountId: string, date: string) =>
      resolveClient ? resolveClient(accountId, date) : (clientByAccount.get(accountId) || null);

    insights.forEach((i) => {
      const account = accounts.find((a) => a.id === i.ad_account_id);
      let key: string;
      let label: string;
      let sublabel: string | undefined;
      let status: string | null | undefined;

      if (tab === "client") {
        const cid = getClient(i.ad_account_id, i.date);
        key = cid || "__unassigned__";
        label = cid ? (clients.find((c) => c.id === cid)?.name || cid) : "Sem cliente";
      } else if (tab === "account") {
        key = i.ad_account_id;
        label = account?.name || i.ad_account_id;
        const cid = getClient(i.ad_account_id, i.date) || clientByAccount.get(i.ad_account_id) || null;
        sublabel = cid ? (clients.find((c) => c.id === cid)?.name || "") : "Sem cliente";
        status = account?.status;
      } else {
        key = account?.bm_id || "__unassigned__";
        label = key === "__unassigned__" ? "Sem BM" : (bms.find((b) => b.id === key)?.name || key);
      }

      const cur = acc.get(key) || {
        id: key, label, sublabel, status,
        spend: 0, revenue: 0, purchases: 0, roas: 0, profit: 0,
      };
      cur.spend += Number(i.spend || 0);
      cur.revenue += Number(i.revenue || 0);
      cur.purchases += Number(i.purchases || 0);
      acc.set(key, cur);
    });

    return Array.from(acc.values()).map((r) => ({
      ...r,
      roas: r.spend > 0 ? r.revenue / r.spend : 0,
      profit: r.revenue - r.spend,
    }));
  }, [insights, accounts, bms, clients, clientByAccount, tab]);

  const totalSpend = rows.reduce((s, r) => s + r.spend, 0);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    const list = term
      ? rows.filter((r) => r.label.toLowerCase().includes(term) || r.sublabel?.toLowerCase().includes(term))
      : rows;
    return [...list].sort((a, b) => Number(b[sort]) - Number(a[sort]));
  }, [rows, search, sort]);

  const handleRowClick = (id: string) => {
    if (tab === "client" && onPickClient) onPickClient(id);
    if (tab === "account" && onPickAccount) onPickAccount(id);
    if (tab === "bm" && onPickBm && id !== "__unassigned__") onPickBm(id);
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "client", label: "Por Cliente", icon: Users },
    { key: "account", label: "Por Conta", icon: BarChart3 },
    { key: "bm", label: "Por BM", icon: Building2 },
  ];

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  tab === t.key
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-[240px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-7 h-8 text-xs"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground uppercase tracking-wider">
              <th className="text-left font-medium py-2 pr-2">{tabs.find((t) => t.key === tab)?.label.replace("Por ", "")}</th>
              {(["spend", "revenue", "roas", "purchases"] as SortKey[]).map((k) => (
                <th key={k} className="text-right font-medium py-2 px-2">
                  <button onClick={() => setSort(k)} className={cn("inline-flex items-center gap-1", sort === k && "text-primary")}>
                    {k === "spend" ? "Gasto" : k === "revenue" ? "Faturamento" : k === "roas" ? "ROAS" : "Compras"}
                    <ArrowUpDown className="h-3 w-3 opacity-60" />
                  </button>
                </th>
              ))}
              <th className="text-right font-medium py-2 pl-2">% do total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const pct = totalSpend > 0 ? (r.spend / totalSpend) * 100 : 0;
              return (
                <tr
                  key={r.id}
                  onClick={() => handleRowClick(r.id)}
                  className="border-b border-border/40 hover:bg-secondary/40 cursor-pointer transition-colors"
                >
                  <td className="py-2.5 pr-2">
                    <div className="font-medium text-foreground">{r.label}</div>
                    {r.sublabel && <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">{r.sublabel}</div>}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums">{fmtUSD(r.spend)}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-primary">{fmtUSD(r.revenue)}</td>
                  <td className={cn("py-2.5 px-2 text-right tabular-nums", r.roas >= 1 ? "text-primary" : r.roas > 0 ? "text-destructive" : "text-muted-foreground")}>
                    {r.roas.toFixed(2)}x
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums">{fmtNum(r.purchases)}</td>
                  <td className="py-2.5 pl-2 w-[140px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary/70" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums w-9 text-right">{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Sem dados para os filtros aplicados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
