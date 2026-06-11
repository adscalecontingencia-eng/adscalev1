import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  RefreshCw, Search, AlertTriangle, X, Building2, Inbox, ShieldCheck,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import MetaKpiBar from "@/components/meta/MetaKpiBar";
import BmSidebar from "@/components/meta/BmSidebar";
import AccountCard, { type AccountCardData } from "@/components/meta/AccountCard";
import AccountDetailSheet from "@/components/meta/AccountDetailSheet";
import SystemUserHelp from "@/components/meta/SystemUserHelp";
import AreaResponsibles from "@/components/support/AreaResponsibles";

type BM = {
  id: string; meta_bm_id: string; name: string; status: string | null;
  verification_status: string | null; account_count: number | null;
  pixel_count: number | null; page_count: number | null;
  last_synced_at: string | null;
};
type Account = AccountCardData & {
  account_created_time: string | null;
  timezone_name: string | null;
  spend_cap: number | null;
  billing_cycle: string | null;
  owner_business_name: string | null;
  account_status: number | null;
};
type Assignment = { ad_account_id: string; client_id: string; active: boolean };
type Client = { id: string; name: string; email: string; company_name?: string | null };

export default function MetaConnections() {
  const [bms, setBms] = useState<BM[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [job, setJob] = useState<{
    id: string; status: string; progress_current: number; progress_total: number;
    synced_count: number; message: string | null; errors: any[];
  } | null>(null);

  const [selectedBm, setSelectedBm] = useState<string>("all"); // bmId | "all" | "none"
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterScore, setFilterScore] = useState<string>("all");
  const [detail, setDetail] = useState<Account | null>(null);
  const [mobileBmOpen, setMobileBmOpen] = useState(false);

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

  // Realtime sync job + polling fallback (caso realtime não esteja disponível)
  useEffect(() => {
    if (!job?.id) return;
    const jobId = job.id;
    let finished = false;

    const applyJob = (j: any) => {
      if (!j || finished) return;
      setJob({
        id: j.id, status: j.status, progress_current: j.progress_current,
        progress_total: j.progress_total, synced_count: j.synced_count,
        message: j.message, errors: j.errors || [],
      });
      if (j.status === "completed" || j.status === "failed") {
        finished = true;
        setSyncing(false);
        if (j.status === "completed") {
          toast.success(`${j.synced_count} contas sincronizadas`);
          load();
        } else {
          toast.error(j.message || "Sincronização falhou");
        }
        setTimeout(() => setJob(null), 5000);
      }
    };

    const channel = supabase
      .channel(`sync-job-${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "meta_sync_jobs", filter: `id=eq.${jobId}` },
        (payload) => applyJob(payload.new),
      )
      .subscribe();

    // Polling fallback a cada 3s — garante que a UI atualize mesmo sem realtime
    const interval = setInterval(async () => {
      if (finished) return;
      const { data } = await supabase.from("meta_sync_jobs").select("*").eq("id", jobId).maybeSingle();
      applyJob(data);
    }, 3000);

    return () => {
      finished = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [job?.id]);

  const sync = async () => {
    setSyncing(true);
    try {
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
    } catch (e: any) {
      toast.error(`Erro na sincronização: ${e.message}`);
      setSyncing(false);
    }
  };

  const assign = async (ad_account_id: string, client_id: string | null) => {
    try {
      const action = client_id ? "assign" : "unassign";
      // Optimistic update
      setAssignments((prev) => {
        const others = prev.filter((p) => p.ad_account_id !== ad_account_id);
        return client_id ? [...others, { ad_account_id, client_id, active: true }] : others;
      });
      const { data, error } = await supabase.functions.invoke("meta-assign-account", {
        body: { action, ad_account_id, client_id },
      });
      if (error) throw error;
      if ((data as any)?.erro) throw new Error((data as any).erro);
      toast.success(client_id ? "Cliente atribuído" : "Atribuição removida");
    } catch (e: any) {
      toast.error(`Falha: ${e.message}`);
      await load();
    }
  };

  const bmName = useMemo(() => {
    const m = new Map(bms.map((b) => [b.id, b.name]));
    return (id: string | null) => (id ? m.get(id) || "—" : "Sem BM");
  }, [bms]);

  const bmVerifiedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    bms.forEach((b) => m.set(b.id, (b.verification_status || "").toLowerCase().includes("verified")));
    return m;
  }, [bms]);

  const currentClient = useMemo(() => {
    const m = new Map(assignments.map((a) => [a.ad_account_id, a.client_id]));
    return (accId: string) => m.get(accId) || null;
  }, [assignments]);

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      // BM
      if (selectedBm === "none") { if (a.bm_id) return false; }
      else if (selectedBm !== "all" && a.bm_id !== selectedBm) return false;
      // Status
      if (filterStatus === "active" && a.status !== "active") return false;
      if (filterStatus === "blocked" && a.status === "active") return false;
      // Client
      const cId = currentClient(a.id);
      if (filterClient === "unassigned" && cId) return false;
      if (filterClient !== "all" && filterClient !== "unassigned" && cId !== filterClient) return false;
      // Score
      if (filterScore !== "all") {
        const lbl = a.score_label || "—";
        if (filterScore === "ok" && lbl !== "OK" && lbl !== "Bom" && (a.score || 0) < 70) return false;
        if (filterScore === "warn" && lbl !== "Atenção") return false;
        if (filterScore === "crit" && lbl !== "Crítico") return false;
      }
      if (search && !`${a.name} ${a.meta_account_id}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [accounts, selectedBm, filterStatus, filterClient, filterScore, search, currentClient]);

  const stats = useMemo(() => ({
    total: accounts.length,
    active: accounts.filter((a) => a.status === "active").length,
    blocked: accounts.filter((a) => a.status !== "active").length,
    assigned: assignments.length,
    unassigned: accounts.length - assignments.length,
  }), [accounts, assignments]);

  const lastSyncAt = useMemo(() => {
    const dates = bms.map((b) => b.last_synced_at).filter(Boolean) as string[];
    if (!dates.length) return null;
    return new Date(Math.max(...dates.map((d) => new Date(d).getTime())));
  }, [bms]);

  const hasFilters = filterStatus !== "all" || filterClient !== "all" || filterScore !== "all" || !!search;
  const clearFilters = () => { setFilterStatus("all"); setFilterClient("all"); setFilterScore("all"); setSearch(""); };

  const sidebarNode = (
    <BmSidebar
      bms={bms}
      accounts={accounts}
      selected={selectedBm}
      onSelect={(v) => { setSelectedBm(v); setMobileBmOpen(false); }}
    />
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Conexões Meta</h2>
          <p className="text-xs text-muted-foreground">
            {lastSyncAt
              ? <>Última sincronização há {formatDistanceToNowStrict(lastSyncAt, { locale: ptBR })}</>
              : "Sem sincronizações registradas"}
            {lastSyncAt && (Date.now() - lastSyncAt.getTime()) > 6 * 3600 * 1000 && (
              <Badge variant="secondary" className="ml-2 bg-yellow-500/15 text-yellow-400 border-yellow-500/30">stale</Badge>
            )}
          </p>
        </div>
        <Button size="sm" disabled={syncing} onClick={sync}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing && job
            ? `Sincronizando ${job.progress_total ? Math.round((job.progress_current / job.progress_total) * 100) : 0}%`
            : "Sincronizar BMs + Contas"}
        </Button>
      </div>

      <AreaResponsibles area="meta_connections" title="Responsáveis pelas contas" />

      {/* Sync job progress */}
      {job && (
        <Card className="p-3 border-primary/40 bg-primary/5 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <RefreshCw className={`h-4 w-4 text-primary ${job.status === "running" ? "animate-spin" : ""}`} />
              {job.status === "completed" ? "Sincronização concluída" :
               job.status === "failed" ? "Sincronização falhou" :
               "Sincronizando em segundo plano"}
            </div>
            <Badge variant={job.status === "failed" ? "destructive" : "default"}>
              {job.synced_count} contas
            </Badge>
          </div>
          {job.progress_total > 0 && (
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full transition-all ${job.status === "failed" ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${Math.min(100, (job.progress_current / job.progress_total) * 100)}%` }}
              />
            </div>
          )}
          {job.message && (
            <p className="text-xs text-muted-foreground">
              {job.message.startsWith("Retry") && <AlertTriangle className="inline h-3 w-3 mr-1 text-yellow-400" />}
              {job.message}
            </p>
          )}
        </Card>
      )}

      {/* KPIs */}
      <MetaKpiBar
        active={stats.active}
        total={stats.total}
        blocked={stats.blocked}
        assigned={stats.assigned}
        unassigned={stats.unassigned}
      />

      <SystemUserHelp />

      {/* Mobile BM selector */}
      <div className="lg:hidden">
        <Sheet open={mobileBmOpen} onOpenChange={setMobileBmOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full justify-start gap-2">
              <Building2 className="h-4 w-4" />
              {selectedBm === "all" ? "Todas as BMs" : selectedBm === "none" ? "Sem BM" : bmName(selectedBm)}
              <span className="ml-auto text-xs text-muted-foreground">trocar →</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-3">
            {sidebarNode}
          </SheetContent>
        </Sheet>
      </div>

      {/* Main layout */}
      <div className="grid lg:grid-cols-[260px_1fr] gap-4 items-start">
        <div className="hidden lg:block">{sidebarNode}</div>

        <div className="space-y-3 min-w-0">
          {/* Filters */}
          <Card className="p-3 space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-9"
                  placeholder="Buscar conta por nome ou ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="active">Ativas</SelectItem>
                  <SelectItem value="blocked">Bloqueadas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos clientes</SelectItem>
                  <SelectItem value="unassigned">— Sem cliente —</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterScore} onValueChange={setFilterScore}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Saúde" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda saúde</SelectItem>
                  <SelectItem value="ok">OK (≥70)</SelectItem>
                  <SelectItem value="warn">Atenção</SelectItem>
                  <SelectItem value="crit">Crítico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasFilters && (
              <div className="flex flex-wrap gap-1.5 items-center pt-1">
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
                {filterScore !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    Saúde: {filterScore === "ok" ? "OK" : filterScore === "warn" ? "Atenção" : "Crítico"}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterScore("all")} />
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
          </Card>

          {/* Result count */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              <ShieldCheck className="inline h-3 w-3 mr-1" />
              {filtered.length} {filtered.length === 1 ? "conta" : "contas"}
              {selectedBm !== "all" && <> em <span className="text-foreground font-medium">{selectedBm === "none" ? "Sem BM" : bmName(selectedBm)}</span></>}
            </span>
          </div>

          {/* Account cards */}
          {loading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[180px]" />)}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="p-10 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhuma conta encontrada
                {hasFilters && <> com esses filtros</>}.
              </p>
              {hasFilters && (
                <Button size="sm" variant="ghost" className="mt-3" onClick={clearFilters}>Limpar filtros</Button>
              )}
            </Card>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((a) => (
                <AccountCard
                  key={a.id}
                  account={a}
                  bmName={bmName(a.bm_id)}
                  bmVerified={a.bm_id ? bmVerifiedMap.get(a.bm_id) : false}
                  clients={clients}
                  currentClientId={currentClient(a.id)}
                  onAssign={(cid) => assign(a.id, cid)}
                  onOpenDetail={() => setDetail(a)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <AccountDetailSheet
        account={detail}
        bmName={detail ? bmName(detail.bm_id) : ""}
        clientName={detail ? clients.find((c) => c.id === currentClient(detail.id))?.name || null : null}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}
