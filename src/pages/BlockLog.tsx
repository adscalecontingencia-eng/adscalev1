import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Ban, RefreshCw, AlertTriangle, ShieldAlert, Search } from "lucide-react";
import { toast } from "sonner";

type BlockedAccount = {
  id: string;
  name: string;
  meta_account_id: string;
  account_status: number | null;
  disable_reason: number | null;
  disable_reason_label: string | null;
  status: string | null;
  updated_at: string;
  bm?: { name: string | null; verification_status: string | null } | null;
};

type BlockedBM = {
  id: string;
  name: string;
  meta_bm_id: string;
  verification_status: string | null;
  updated_at: string;
};

type LogItem = {
  key: string;
  kind: "account" | "bm";
  title: string;
  badge: string;
  badgeTone: "red" | "amber";
  meta_id: string;
  parent: string;
  updated_at: string;
  category: "not_approved" | "suspended";
  type: "account" | "bm";
};

const STATUS_LABEL: Record<number, { label: string; tone: "red" | "amber" }> = {
  1: { label: "ADS_INTEGRITY_POLICY · Violação de Política de Integridade", tone: "red" },
  2: { label: "ADS_IP_REVIEW · Revisão de IP", tone: "amber" },
  3: { label: "RISK_PAYMENT · Risco de Pagamento", tone: "red" },
  4: { label: "GRAY_ACCOUNT · Conta em zona cinza", tone: "amber" },
  5: { label: "ADS_AFC_REVIEW · Revisão AFC", tone: "amber" },
  6: { label: "BUSINESS_INTEGRITY_RAR · Integridade do negócio", tone: "red" },
  7: { label: "PERMANENT_CLOSE · Fechamento permanente", tone: "red" },
  11: { label: "BUSINESS_MANAGER_INTEGRITY · BM com restrição", tone: "red" },
  12: { label: "MISREPRESENTED_AD_ACCOUNT · Conta deturpada", tone: "red" },
  15: { label: "COMPROMISED_AD_ACCOUNT · Conta comprometida", tone: "red" },
};

const reasonForCode = (code: number | null, fallback: string | null) => {
  if (code && STATUS_LABEL[code]) return STATUS_LABEL[code];
  if (fallback && fallback !== "Nenhum") return { label: fallback, tone: "red" as const };
  return { label: "Conta suspensa", tone: "red" as const };
};

const fmtDate = (d: string) => {
  try {
    return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
  } catch { return d; }
};

const BlockLog: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [accounts, setAccounts] = useState<BlockedAccount[]>([]);
  const [bms, setBms] = useState<BlockedBM[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "not_approved" | "suspended">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "account" | "bm">("all");

  const load = async () => {
    setLoading(true);
    const [accRes, bmRes] = await Promise.all([
      supabase
        .from("meta_ad_accounts")
        .select("id, name, meta_account_id, account_status, disable_reason, disable_reason_label, status, updated_at, bm:meta_business_managers(name, verification_status)")
        .or("status.eq.blocked,disable_reason.gt.0,account_status.neq.1")
        .order("updated_at", { ascending: false }),
      supabase
        .from("meta_business_managers")
        .select("id, name, meta_bm_id, verification_status, updated_at")
        .neq("verification_status", "verified")
        .order("updated_at", { ascending: false }),
    ]);
    if (accRes.error) toast.error(accRes.error.message);
    if (bmRes.error) toast.error(bmRes.error.message);
    setAccounts((accRes.data as any) || []);
    setBms((bmRes.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const items: LogItem[] = useMemo(() => {
    const acc = accounts.map<LogItem>((a) => {
      const r = reasonForCode(a.disable_reason, a.disable_reason_label);
      return {
        key: `acc-${a.id}`,
        kind: "account",
        title: a.name,
        badge: r.label,
        badgeTone: r.tone,
        meta_id: a.meta_account_id,
        parent: a.bm?.name ? `BM: ${a.bm.name}` : "BM: —",
        updated_at: a.updated_at,
        category: "suspended",
        type: "account",
      };
    });
    const bb = bms.map<LogItem>((b) => ({
      key: `bm-${b.id}`,
      kind: "bm",
      title: b.name,
      badge: b.verification_status === "not_verified" || !b.verification_status ? "BM Não Verificada" : `Status: ${b.verification_status}`,
      badgeTone: "amber",
      meta_id: b.meta_bm_id,
      parent: "Business Manager",
      updated_at: b.updated_at,
      category: "not_approved",
      type: "bm",
    }));
    return [...acc, ...bb].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
  }, [accounts, bms]);

  const filtered = items.filter((it) => {
    if (statusFilter !== "all" && it.category !== statusFilter) return false;
    if (typeFilter !== "all" && it.type !== typeFilter) return false;
    if (search && !`${it.title} ${it.meta_id} ${it.parent}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all: items.length,
    not_approved: items.filter(i => i.category === "not_approved").length,
    suspended: items.filter(i => i.category === "suspended").length,
    type_account: items.filter(i => i.type === "account").length,
    type_bm: items.filter(i => i.type === "bm").length,
  };

  const sync = async () => {
    setSyncing(true);
    try {
      await supabase.functions.invoke("meta-sync", { body: { action: "sync_accounts" } });
      toast.success("Sincronização concluída");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const TabBtn = ({ active, onClick, children, count, tone = "primary" }: any) => (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 transition-all border ${
        active
          ? tone === "danger"
            ? "bg-destructive/15 text-destructive border-destructive/40"
            : "bg-primary/15 text-primary border-primary/40"
          : "bg-secondary/40 text-muted-foreground border-border hover:text-foreground"
      }`}>
      {children}
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-background/40" : "bg-background/60"}`}>{count}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Ban className="text-destructive" size={24} />
            Log de Bloqueios
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Contas e BMs com problemas identificados nas suas conexões Meta.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium flex items-center gap-2">
            <AlertTriangle size={14} />
            {items.length} eventos de bloqueio
          </div>
          <button onClick={sync} disabled={syncing}
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm flex items-center gap-2 hover:bg-secondary/70 disabled:opacity-50">
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <TabBtn active={statusFilter === "all"} onClick={() => setStatusFilter("all")} count={counts.all}>Todas</TabBtn>
          <TabBtn active={statusFilter === "not_approved"} onClick={() => setStatusFilter("not_approved")} count={counts.not_approved} tone="danger">Não aprovadas</TabBtn>
          <TabBtn active={statusFilter === "suspended"} onClick={() => setStatusFilter("suspended")} count={counts.suspended} tone="danger">Suspensas</TabBtn>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase text-muted-foreground tracking-wider mr-1">Tipo:</span>
          <TabBtn active={typeFilter === "all"} onClick={() => setTypeFilter("all")} count={counts.all}>Todos</TabBtn>
          <TabBtn active={typeFilter === "account"} onClick={() => setTypeFilter("account")} count={counts.type_account}>Contas de anúncio</TabBtn>
          <TabBtn active={typeFilter === "bm"} onClick={() => setTypeFilter("bm")} count={counts.type_bm}>Business Managers</TabBtn>
        </div>

        <div className="relative max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, BM ou ID..."
            className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        Bloqueios e restrições · Mais recentes primeiro
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto text-primary mb-3" size={32} />
          <p className="text-sm font-medium text-foreground">Nenhum bloqueio encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Todas as contas e BMs estão saudáveis com os filtros atuais.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((it) => (
            <div key={it.key} className="rounded-xl border border-border bg-card hover:border-primary/30 transition-all p-4">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <Ban className={it.badgeTone === "red" ? "text-destructive" : "text-amber-400"} size={18} />
                <h3 className="font-display text-base font-semibold text-foreground">{it.title}</h3>
                <span className={`text-[11px] px-2 py-1 rounded-md font-medium ${
                  it.badgeTone === "red"
                    ? "bg-destructive/15 text-destructive border border-destructive/30"
                    : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                }`}>
                  {it.badge}
                </span>
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {it.type === "account" ? "Conta ID" : "BM ID"}: {it.meta_id} · {it.parent}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Atualizado em {fmtDate(it.updated_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BlockLog;
