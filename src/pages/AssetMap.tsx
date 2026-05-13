import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Building2, CreditCard, Search, ChevronDown, ChevronRight,
  ShieldCheck, ShieldAlert, Image as ImageIcon, FileText, Wallet,
} from "lucide-react";

type BM = {
  id: string; meta_bm_id: string; name: string;
  verification_status: string | null;
  account_count: number | null; pixel_count: number | null; page_count: number | null;
};
type Account = {
  id: string; bm_id: string | null; name: string; meta_account_id: string;
  status: string | null; account_status: number | null;
  amount_spent: number | null; balance: number | null; currency: string | null;
  funding_source: string | null; score: number | null; score_label: string | null;
  disable_reason_label: string | null;
};

const fmtMoney = (n: number | null, cur = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: cur || "USD" }).format(n || 0);

const statusDot = (acc: Account) => {
  if (acc.account_status === 1) return "bg-primary shadow-[0_0_8px_hsl(var(--primary))]";
  if (acc.account_status === 2 || acc.account_status === 3) return "bg-destructive shadow-[0_0_8px_hsl(var(--destructive))]";
  return "bg-muted-foreground";
};

const scoreColor = (s: number | null) => {
  const v = s ?? 0;
  if (v >= 80) return "text-primary";
  if (v >= 60) return "text-blue-400";
  if (v >= 40) return "text-yellow-400";
  return "text-destructive";
};

export default function AssetMap() {
  const [bms, setBms] = useState<BM[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<"all" | "active" | "blocked">("all");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [b, a] = await Promise.all([
      supabase.from("meta_business_managers").select("*").order("name"),
      supabase.from("meta_ad_accounts").select("*").order("name"),
    ]);
    setBms((b.data as any) || []);
    setAccounts((a.data as any) || []);
    // expand all by default
    const exp: Record<string, boolean> = {};
    (b.data || []).forEach((bm: any) => { exp[bm.id] = true; });
    setExpanded(exp);
    setLoading(false);
  };

  const accountsByBm = useMemo(() => {
    const map = new Map<string, Account[]>();
    for (const acc of accounts) {
      const k = acc.bm_id || "_orphan";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(acc);
    }
    return map;
  }, [accounts]);

  const filteredBms = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return bms;
    return bms.filter(b => {
      if (b.name.toLowerCase().includes(q)) return true;
      const accs = accountsByBm.get(b.id) || [];
      return accs.some(a => a.name.toLowerCase().includes(q) || a.meta_account_id.includes(q));
    });
  }, [bms, search, accountsByBm]);

  const totals = useMemo(() => {
    const active = accounts.filter(a => a.account_status === 1).length;
    const blocked = accounts.length - active;
    const spent = accounts.reduce((s, a) => s + (a.amount_spent || 0), 0);
    const balance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    return { active, blocked, spent, balance };
  }, [accounts]);

  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));
  const expandAll = (v: boolean) => {
    const e: Record<string, boolean> = {};
    bms.forEach(b => { e[b.id] = v; });
    setExpanded(e);
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground text-sm">Carregando mapa...</div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary glow-text">Mapa de Ativos</h1>
          <p className="text-sm text-muted-foreground">Estrutura completa: Business Managers → Contas → Recursos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => expandAll(true)}>Expandir tudo</Button>
          <Button variant="outline" size="sm" onClick={() => expandAll(false)}>Recolher</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-3"><div className="text-xs text-muted-foreground">BMs</div><div className="text-2xl font-bold text-primary">{bms.length}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Contas</div><div className="text-2xl font-bold">{accounts.length}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Ativas</div><div className="text-2xl font-bold text-primary">{totals.active}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Bloqueadas</div><div className="text-2xl font-bold text-destructive">{totals.blocked}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Saldo total</div><div className="text-2xl font-bold">{fmtMoney(totals.balance)}</div></Card>
      </div>

      {/* Search + filter */}
      <Card className="p-3 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input className="pl-9" placeholder="Buscar BM, conta ou ID..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {(["all", "active", "blocked"] as const).map(f => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
              {f === "all" ? "Todas" : f === "active" ? "Ativas" : "Bloqueadas"}
            </Button>
          ))}
        </div>
      </Card>

      {/* Tree */}
      <div className="space-y-3">
        {filteredBms.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">Nenhuma BM encontrada. Sincronize em Conexões Meta.</Card>
        )}
        {filteredBms.map(bm => {
          const accs = (accountsByBm.get(bm.id) || []).filter(a =>
            filter === "all" ? true : filter === "active" ? a.account_status === 1 : a.account_status !== 1
          );
          const isOpen = expanded[bm.id];
          const verified = bm.verification_status === "verified";
          return (
            <Card key={bm.id} className="overflow-hidden">
              {/* BM header */}
              <button
                onClick={() => toggle(bm.id)}
                className="w-full flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors text-left"
              >
                {isOpen ? <ChevronDown size={18} className="text-muted-foreground shrink-0" /> : <ChevronRight size={18} className="text-muted-foreground shrink-0" />}
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                  <Building2 size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{bm.name}</span>
                    {verified ? (
                      <Badge variant="default" className="gap-1"><ShieldCheck size={11} /> Verificada</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1"><ShieldAlert size={11} /> Não verificada</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">ID: {bm.meta_bm_id}</div>
                </div>
                <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><CreditCard size={13} /> {bm.account_count ?? accs.length} contas</span>
                  <span className="flex items-center gap-1"><ImageIcon size={13} /> {bm.pixel_count ?? 0} pixels</span>
                  <span className="flex items-center gap-1"><FileText size={13} /> {bm.page_count ?? 0} páginas</span>
                </div>
              </button>

              {/* Accounts grid */}
              {isOpen && (
                <div className="border-t border-border bg-background/30 p-4">
                  {accs.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4">Nenhuma conta neste filtro.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {accs.map(acc => (
                        <div key={acc.id} className="group relative p-3 rounded-lg border border-border bg-card hover:border-primary/40 transition-all">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(acc)}`} />
                              <span className="text-sm font-medium truncate">{acc.name}</span>
                            </div>
                            <span className={`text-xs font-bold ${scoreColor(acc.score)}`}>{acc.score ?? 0}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono truncate mb-2">{acc.meta_account_id}</div>
                          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                            <div className="bg-secondary/50 rounded px-2 py-1">
                              <div className="text-muted-foreground">Gasto</div>
                              <div className="font-semibold">{fmtMoney(acc.amount_spent, acc.currency || "USD")}</div>
                            </div>
                            <div className="bg-secondary/50 rounded px-2 py-1">
                              <div className="text-muted-foreground">Saldo</div>
                              <div className="font-semibold">{fmtMoney(acc.balance, acc.currency || "USD")}</div>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                            <Wallet size={10} className="shrink-0" />
                            <span className="truncate">{acc.funding_source || "Sem pagamento"}</span>
                          </div>
                          {acc.account_status !== 1 && acc.disable_reason_label && (
                            <div className="mt-2 text-[10px] text-destructive truncate" title={acc.disable_reason_label}>
                              {acc.disable_reason_label}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
