import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  RefreshCw, Search, Link2, Unlink, Building2, Calendar, Globe,
  CreditCard, Shield, AlertTriangle, Eye, DollarSign, ArrowUpDown, X,
} from "lucide-react";
import MetaKpiHero from "@/components/meta/MetaKpiHero";
import BmOverviewStrip from "@/components/meta/BmOverviewStrip";
import SystemUserHelp from "@/components/meta/SystemUserHelp";
import { Skeleton } from "@/components/ui/skeleton";

type BM = {
  id: string; meta_bm_id: string; name: string; status: string | null;
  verification_status: string | null; account_count: number | null;
  pixel_count: number | null; page_count: number | null;
  last_synced_at: string | null;
};
type Account = {
  id: string;
  meta_account_id: string;
  bm_id: string | null;
  name: string;
  status: string | null;
  account_status: number | null;
  currency: string | null;
  amount_spent: number | null;
  spend_cap: number | null;
  timezone_name: string | null;
  account_created_time: string | null;
  disable_reason: number | null;
  disable_reason_label: string | null;
  funding_source: string | null;
  billing_cycle: string | null;
  balance: number | null;
  business_country_code: string | null;
  age: number | null;
  owner_business_name: string | null;
  score: number | null;
  score_label: string | null;
};
type Assignment = { ad_account_id: string; client_id: string; active: boolean };
type Client = { id: string; name: string; email: string };

const scoreColor = (score: number) =>
  score >= 80 ? "text-primary" : score >= 60 ? "text-blue-400" : score >= 40 ? "text-yellow-400" : "text-destructive";

const scoreBadgeVariant = (label: string | null): "default" | "secondary" | "destructive" | "outline" => {
  if (!label) return "outline";
  if (label === "Crítico") return "destructive";
  if (label === "Atenção") return "secondary";
  return "default";
};

export default function MetaConnections() {
  const [bms, setBms] = useState<BM[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<"bms" | "accounts" | null>(null);
  const [job, setJob] = useState<{
    id: string;
    status: string;
    progress_current: number;
    progress_total: number;
    synced_count: number;
    message: string | null;
    errors: any[];
  } | null>(null);
  const [filterBm, setFilterBm] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<Account | null>(null);
  const [sortKey, setSortKey] = useState<"score" | "spend" | "age" | "balance" | "name">("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const load = async () => {
    setLoading(true);
    const [b, a, asn, cl] = await Promise.all([
      supabase.from("meta_business_managers").select("*").order("name"),
      supabase.from("meta_ad_accounts").select("*").order("score", { ascending: true }),
      supabase.from("meta_ad_account_assignments").select("ad_account_id, client_id, active").eq("active", true),
      supabase.from("clients").select("id, name, email").order("name"),
    ]);
    setBms((b.data as BM[]) || []);
    setAccounts((a.data as Account[]) || []);
    setAssignments((asn.data as Assignment[]) || []);
    setClients((cl.data as Client[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Realtime subscription to the active job
  useEffect(() => {
    if (!job?.id) return;
    const channel = supabase
      .channel(`sync-job-${job.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "meta_sync_jobs", filter: `id=eq.${job.id}` },
        (payload) => {
          const j = payload.new as any;
          setJob({
            id: j.id,
            status: j.status,
            progress_current: j.progress_current,
            progress_total: j.progress_total,
            synced_count: j.synced_count,
            message: j.message,
            errors: j.errors || [],
          });
          if (j.status === "completed" || j.status === "failed") {
            setSyncing(null);
            if (j.status === "completed") {
              toast.success(`${j.synced_count} contas sincronizadas`);
              load();
            } else {
              toast.error(j.message || "Sincronização falhou");
            }
            setTimeout(() => setJob(null), 5000);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [job?.id]);

  const sync = async (action: "sync_bms" | "sync_accounts") => {
    setSyncing(action === "sync_bms" ? "bms" : "accounts");
    try {
      if (action === "sync_accounts") {
        const { data, error } = await supabase.functions.invoke("meta-sync", {
          body: { action: "start_sync_accounts" },
        });
        if (error) throw error;
        if ((data as any)?.erro) throw new Error((data as any).erro);
        const jobId = (data as any).job_id;
        const { data: j } = await supabase.from("meta_sync_jobs").select("*").eq("id", jobId).single();
        if (j) {
          setJob({
            id: j.id, status: j.status, progress_current: j.progress_current,
            progress_total: j.progress_total, synced_count: j.synced_count,
            message: j.message, errors: (j.errors as any) || [],
          });
        }
        toast.info("Sincronização iniciada em segundo plano");
        return;
      }
      const { data, error } = await supabase.functions.invoke("meta-sync", { body: { action } });
      if (error) throw error;
      if ((data as any)?.erro) throw new Error((data as any).erro);
      toast.success(`${(data as any).bms_sincronizadas} BMs sincronizadas`);
      await load();
      setSyncing(null);
    } catch (e: any) {
      toast.error(`Erro na sincronização: ${e.message}`);
      setSyncing(null);
    }
  };


  const assign = async (ad_account_id: string, client_id: string | null) => {
    try {
      const action = client_id ? "assign" : "unassign";
      const { data, error } = await supabase.functions.invoke("meta-assign-account", {
        body: { action, ad_account_id, client_id },
      });
      if (error) throw error;
      if ((data as any)?.erro) throw new Error((data as any).erro);
      toast.success(client_id ? "Conta atribuída" : "Atribuição removida");
      await load();
    } catch (e: any) {
      toast.error(`Falha: ${e.message}`);
    }
  };

  const bmName = useMemo(() => {
    const m = new Map(bms.map((b) => [b.id, b.name]));
    return (id: string | null) => (id ? m.get(id) || "—" : "—");
  }, [bms]);

  const currentClient = useMemo(() => {
    const m = new Map(assignments.map((a) => [a.ad_account_id, a.client_id]));
    return (accId: string) => m.get(accId) || null;
  }, [assignments]);

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      const cId = currentClient(a.id);
      if (filterBm !== "all" && a.bm_id !== filterBm) return false;
      if (filterStatus === "active" && a.status !== "active") return false;
      if (filterStatus === "blocked" && a.status === "active") return false;
      if (filterClient === "unassigned" && cId) return false;
      if (filterClient !== "all" && filterClient !== "unassigned" && cId !== filterClient) return false;
      if (search && !`${a.name} ${a.meta_account_id}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [accounts, filterBm, filterStatus, filterClient, search, currentClient]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const va: any = a[sortKey === "spend" ? "amount_spent" : sortKey] ?? 0;
      const vb: any = b[sortKey === "spend" ? "amount_spent" : sortKey] ?? 0;
      if (typeof va === "string") return va.localeCompare(String(vb)) * dir;
      return ((va as number) - (vb as number)) * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const hasFilters = filterBm !== "all" || filterStatus !== "all" || filterClient !== "all" || !!search;
  const clearFilters = () => { setFilterBm("all"); setFilterStatus("all"); setFilterClient("all"); setSearch(""); };

  const ageBadge = (age: number | null) => {
    const a = Number(age || 0);
    if (a >= 180) return { cls: "border-primary/40 text-primary", label: `${a}d` };
    if (a >= 30) return { cls: "border-yellow-500/40 text-yellow-400", label: `${a}d` };
    return { cls: "border-destructive/40 text-destructive", label: a ? `${a}d` : "Nova" };
  };

  const stats = useMemo(() => {
    const avgScore = accounts.length
      ? Math.round(accounts.reduce((s, a) => s + (a.score || 0), 0) / accounts.length)
      : 0;
    return {
      bms: bms.length,
      accounts: accounts.length,
      assigned: assignments.length,
      blocked: accounts.filter((a) => a.status !== "active").length,
      avgScore,
    };
  }, [bms, accounts, assignments]);

  const lastSyncAt = useMemo(() => {
    const dates = accounts
      .map((a) => a.account_created_time)
      .filter(Boolean) as string[];
    // Prefer BM last_synced_at as global sync indicator
    const bmDates = bms.map((b) => b.last_synced_at).filter(Boolean) as string[];
    const all = bmDates.length ? bmDates : dates;
    if (!all.length) return null;
    return new Date(Math.max(...all.map((d) => new Date(d).getTime())));
  }, [bms, accounts]);

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Conexões Meta</h2>
          <p className="text-sm text-muted-foreground">
            Business Managers e contas de anúncio sincronizadas via API.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" disabled={!!syncing} onClick={() => sync("sync_accounts")}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing === "accounts" ? "animate-spin" : ""}`} />
            {syncing === "accounts" && job
              ? `Sincronizando... ${job.progress_total > 0 ? Math.round((job.progress_current / job.progress_total) * 100) : 0}%`
              : "Sincronizar BMs + Contas"}
          </Button>
        </div>
      </div>

      {job && (
        <Card className="p-4 border-primary/40 bg-primary/5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 text-primary ${job.status === "running" ? "animate-spin" : ""}`} />
              <span className="font-display font-bold text-sm text-foreground">
                {job.status === "completed" ? "Sincronização concluída" :
                 job.status === "failed" ? "Sincronização falhou" :
                 "Sincronizando contas em segundo plano"}
              </span>
            </div>
            <Badge variant={job.status === "failed" ? "destructive" : job.status === "completed" ? "default" : "secondary"}>
              {job.synced_count} contas
            </Badge>
          </div>
          {job.progress_total > 0 && (
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all ${job.status === "failed" ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, (job.progress_current / job.progress_total) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{job.progress_current}/{job.progress_total} BMs</span>
                <span>{Math.round((job.progress_current / job.progress_total) * 100)}%</span>
              </div>
            </div>
          )}
          {job.message && (
            <p className={`text-xs ${job.message.startsWith("Retry") ? "text-yellow-400" : "text-muted-foreground"}`}>
              {job.message.startsWith("Retry") && <AlertTriangle className="inline h-3 w-3 mr-1" />}
              {job.message}
            </p>
          )}
          {Array.isArray(job.errors) && job.errors.length > 0 && (
            <p className="text-xs text-destructive">{job.errors.length} erro(s) ao consultar BMs (sync continuou)</p>
          )}
        </Card>
      )}


      <MetaKpiHero
        loading={loading}
        bms={stats.bms}
        accountsTotal={stats.accounts}
        accountsActive={stats.accounts - stats.blocked}
        blocked={stats.blocked}
        assigned={stats.assigned}
        unassigned={stats.accounts - stats.assigned}
        withoutPayment={accounts.filter((a) => !a.funding_source).length}
        avgScore={stats.avgScore}
        lastSyncAt={lastSyncAt}
      />

      <SystemUserHelp />

      <BmOverviewStrip
        bms={bms}
        accounts={accounts}
        activeBmId={filterBm}
        onPick={setFilterBm}
      />

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome ou ID da conta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={filterBm} onValueChange={setFilterBm}>
            <SelectTrigger className="w-[220px]">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Todas as BMs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as BMs</SelectItem>
              {bms.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="blocked">Bloqueadas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Todos clientes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos clientes</SelectItem>
              <SelectItem value="unassigned">— Sem cliente —</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasFilters && (
          <div className="flex flex-wrap gap-1.5 items-center">
            {filterBm !== "all" && (
              <Badge variant="secondary" className="gap-1">
                BM: {bmName(filterBm)}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterBm("all")} />
              </Badge>
            )}
            {filterStatus !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Status: {filterStatus === "active" ? "Ativas" : "Bloqueadas"}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterStatus("all")} />
              </Badge>
            )}
            {filterClient !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Cliente: {filterClient === "unassigned" ? "Sem cliente" : clients.find((c) => c.id === filterClient)?.name}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterClient("all")} />
              </Badge>
            )}
            {search && (
              <Badge variant="secondary" className="gap-1">
                "{search}"
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSearch("")} />
              </Badge>
            )}
            <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground ml-1">
              Limpar tudo
            </button>
          </div>
        )}

        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button onClick={() => toggleSort("name")} className="inline-flex items-center gap-1 hover:text-foreground">
                    Conta <ArrowUpDown className="h-3 w-3 opacity-50" />
                  </button>
                </TableHead>
                <TableHead>BM</TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("score")} className="inline-flex items-center gap-1 hover:text-foreground">
                    Score <ArrowUpDown className="h-3 w-3 opacity-50" />
                  </button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("age")} className="inline-flex items-center gap-1 hover:text-foreground">
                    Idade <ArrowUpDown className="h-3 w-3 opacity-50" />
                  </button>
                </TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("balance")} className="inline-flex items-center gap-1 hover:text-foreground">
                    Saldo <ArrowUpDown className="h-3 w-3 opacity-50" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("spend")} className="inline-flex items-center gap-1 hover:text-foreground">
                    Gasto <ArrowUpDown className="h-3 w-3 opacity-50" />
                  </button>
                </TableHead>
                <TableHead className="min-w-[220px]">Cliente</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : sorted.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                  Nenhuma conta encontrada.{hasFilters && <> <button onClick={clearFilters} className="text-primary underline ml-1">Limpar filtros</button></>}
                </TableCell></TableRow>
              ) : (
                sorted.map((a) => {
                  const clientId = currentClient(a.id);
                  const score = a.score ?? 0;
                  const age = ageBadge(a.age);
                  const balance = Number(a.balance || 0);
                  const noFunding = !a.funding_source;
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{a.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{a.meta_account_id}</div>
                      </TableCell>
                      <TableCell className="text-sm">{bmName(a.bm_id)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`font-display font-bold ${scoreColor(score)}`}>{score}</span>
                          <Badge variant={scoreBadgeVariant(a.score_label)} className="text-[10px]">
                            {a.score_label || "—"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {a.status === "active" ? (
                          <Badge variant="default">Ativa</Badge>
                        ) : (
                          <Badge variant="destructive" title={a.disable_reason_label || ""}>
                            {a.disable_reason_label && a.disable_reason
                              ? a.disable_reason_label
                              : "Bloqueada"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${age.cls}`}>{age.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {a.funding_source ? (
                          <span className="text-foreground">Vinculado</span>
                        ) : (
                          <span className="text-yellow-400">Sem pagamento</span>
                        )}
                      </TableCell>
                      <TableCell className={`text-sm font-mono ${balance === 0 && noFunding ? "text-destructive" : "text-foreground"}`}>
                        {a.currency} {balance.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {a.currency} {(a.amount_spent || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 items-center">
                          <Select
                            value={clientId || "none"}
                            onValueChange={(v) => assign(a.id, v === "none" ? null : v)}
                          >
                            <SelectTrigger className="flex-1 h-9">
                              <SelectValue placeholder="Não atribuída" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Nenhum —</SelectItem>
                              {clients.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {clientId ? <Link2 className="h-4 w-4 text-primary" /> : <Unlink className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setDetail(a)} aria-label="Ver detalhes">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <AccountDetailDialog
        account={detail}
        bmName={detail ? bmName(detail.bm_id) : ""}
        clientName={
          detail
            ? clients.find((c) => c.id === currentClient(detail.id))?.name || null
            : null
        }
        onClose={() => setDetail(null)}
      />
    </div>
  );
}

function StatCard({ label, value, accent, danger }: { label: string; value: number; accent?: boolean; danger?: boolean }) {
  return (
    <Card className={`p-4 ${accent ? "border-primary/40" : ""} ${danger ? "border-destructive/40" : ""}`}>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-display font-bold mt-1 ${accent ? "text-primary glow-text" : danger ? "text-destructive" : ""}`}>
        {value}
      </div>
    </Card>
  );
}

function AccountDetailDialog({
  account, bmName, clientName, onClose,
}: { account: Account | null; bmName: string; clientName: string | null; onClose: () => void }) {
  if (!account) return null;
  const score = account.score ?? 0;
  const fmt = (v: any) => (v === null || v === undefined || v === "" ? "—" : v);
  const fmtMoney = (v: number | null) =>
    v === null || v === undefined ? "—" : `${account.currency || "USD"} ${Number(v).toFixed(2)}`;
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

  return (
    <Dialog open={!!account} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {account.name}
            <Badge variant={scoreBadgeVariant(account.score_label)}>
              <span className={scoreColor(score)}>{score}/100</span>
              <span className="ml-1">· {account.score_label || "—"}</span>
            </Badge>
          </DialogTitle>
          <p className="text-xs text-muted-foreground font-mono">ID: {account.meta_account_id}</p>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="p-4 grid grid-cols-2 gap-4 text-sm">
            <Info icon={Building2} label="BM" value={bmName} />
            <Info icon={Shield} label="Status" value={account.status === "active" ? "Ativa" : "Bloqueada"} danger={account.status !== "active"} />
            <Info icon={CreditCard} label="Pagamento" value={fmt(account.funding_source) || "Sem pagamento vinculado"} warning={!account.funding_source} />
            <Info icon={RefreshCw} label="Ciclo da BM" value={fmt(account.billing_cycle)} />
            <Info icon={Globe} label="Fuso horário" value={fmt(account.timezone_name)} />
            <Info icon={DollarSign} label="Saldo devedor" value={fmtMoney(account.balance)} />
            <Info icon={DollarSign} label="Gasto histórico" value={fmtMoney(account.amount_spent)} />
            <Info icon={DollarSign} label="Limite de gasto" value={fmtMoney(account.spend_cap)} />
            <Info icon={Calendar} label="Criada em" value={fmtDate(account.account_created_time)} />
            <Info icon={Building2} label="Dono" value={fmt(account.owner_business_name)} />
            <Info icon={Globe} label="País" value={fmt(account.business_country_code)} />
            <Info icon={Link2} label="Cliente atribuído" value={clientName || "Sem cliente"} warning={!clientName} />
          </Card>

          {account.disable_reason && account.disable_reason !== 0 && (
            <Card className="p-4 border-destructive/40">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium text-sm">
                  Bloqueio: {account.disable_reason_label} (código {account.disable_reason})
                </span>
              </div>
            </Card>
          )}

          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Score Meta · {score}/100
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full ${score >= 80 ? "bg-primary" : score >= 60 ? "bg-blue-400" : score >= 40 ? "bg-yellow-400" : "bg-destructive"}`}
                style={{ width: `${score}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Calculado a partir de sinais oficiais do Meta: status da conta, motivo de bloqueio,
              fonte de pagamento, verificação da BM e histórico de gasto.
            </p>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({
  icon: Icon, label, value, danger, warning,
}: { icon: any; label: string; value: any; danger?: boolean; warning?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={`text-sm ${danger ? "text-destructive" : warning ? "text-yellow-400" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}
