import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PageHero } from "@/components/ui-kit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppWindow } from "lucide-react";
import { subDays, differenceInCalendarDays } from "date-fns";
import { parseDateLocal } from "@/lib/date-utils";

import AdsKpiHero, { AdsMetrics } from "@/components/ads/AdsKpiHero";
import AdsFiltersBar, { AdsRange, AccountStatus } from "@/components/ads/AdsFiltersBar";
import AdsTimeCharts from "@/components/ads/AdsTimeCharts";
import AdsBreakdownTable from "@/components/ads/AdsBreakdownTable";
import { resolveClientForSpend } from "@/lib/assignment-filter";

type MetaApp = { id: string; label: string; status: string | null; is_default: boolean | null };
type BM = { id: string; name: string; meta_app_id: string | null };
type Account = {
  id: string; name: string; meta_account_id: string; bm_id: string | null;
  currency: string | null; status: string | null; last_synced_at: string | null;
  meta_app_id: string | null;
};
type Client = { id: string; name: string };
type Assignment = { ad_account_id: string; client_id: string; active: boolean; effective_from?: string | null; effective_to?: string | null };
type Insight = {
  ad_account_id: string; date: string; spend: number; impressions: number; clicks: number;
  cpm: number; cpc: number; ctr: number; reach: number; purchases: number; revenue: number;
};

const APP_STORAGE_KEY = "sales_ads_meta_app_id";

const fmtISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

function rangeToDates(r: AdsRange, customStart?: Date, customEnd?: Date): { since: string; until: string } {
  const today = new Date();
  if (r === "today") return { since: fmtISO(today), until: fmtISO(today) };
  if (r === "yesterday") {
    const y = subDays(today, 1);
    return { since: fmtISO(y), until: fmtISO(y) };
  }
  if (r === "custom" && customStart && customEnd) {
    return { since: fmtISO(customStart), until: fmtISO(customEnd) };
  }
  const days = r === "7d" ? 6 : r === "30d" ? 29 : r === "90d" ? 89 : 6;
  const start = subDays(today, days);
  return { since: fmtISO(start), until: fmtISO(today) };
}

function previousRange(since: string, until: string) {
  const a = parseDateLocal(since);
  const b = parseDateLocal(until);
  const diff = differenceInCalendarDays(b, a) + 1;
  const newEnd = subDays(a, 1);
  const newStart = subDays(newEnd, diff - 1);
  return { since: fmtISO(newStart), until: fmtISO(newEnd) };
}

function computeMetrics(rows: Insight[]): AdsMetrics {
  const spend = rows.reduce((s, i) => s + Number(i.spend || 0), 0);
  const revenue = rows.reduce((s, i) => s + Number(i.revenue || 0), 0);
  const purchases = rows.reduce((s, i) => s + Number(i.purchases || 0), 0);
  const clicks = rows.reduce((s, i) => s + Number(i.clicks || 0), 0);
  const impressions = rows.reduce((s, i) => s + Number(i.impressions || 0), 0);
  return {
    spend, revenue, purchases, clicks, impressions,
    cpa: purchases > 0 ? spend / purchases : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    roas: spend > 0 ? revenue / spend : 0,
    profit: revenue - spend,
    margin: revenue > 0 ? ((revenue - spend) / revenue) * 100 : 0,
  };
}

export default function SalesAdsDashboard() {
  const [apps, setApps] = useState<MetaApp[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>(() => localStorage.getItem(APP_STORAGE_KEY) || "");
  const [bms, setBms] = useState<BM[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [prevInsights, setPrevInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [autoSyncError, setAutoSyncError] = useState<string | null>(null);

  const [range, setRange] = useState<AdsRange>("7d");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [filterBm, setFilterBm] = useState<string>("all");
  const [filterClients, setFilterClients] = useState<string[]>([]);
  const [filterAccounts, setFilterAccounts] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<AccountStatus>("all");
  const [syncScope, setSyncScope] = useState<"active" | "recent_spenders">("active");

  // Load apps once and pick a sensible default (persisted → default → first active).
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("meta_apps")
        .select("id, label, status, is_default")
        .eq("status", "active")
        .order("is_default", { ascending: false })
        .order("label");
      const list = (data as MetaApp[]) || [];
      setApps(list);
      if (list.length === 0) return;
      const stored = localStorage.getItem(APP_STORAGE_KEY);
      const pick = (stored && list.find((a) => a.id === stored)?.id)
        || list.find((a) => a.is_default)?.id
        || list[0].id;
      setSelectedAppId(pick);
    })();
  }, []);

  useEffect(() => {
    if (selectedAppId) localStorage.setItem(APP_STORAGE_KEY, selectedAppId);
  }, [selectedAppId]);

  const loadMeta = async () => {
    if (!selectedAppId) return;
    const [b, a, c, asn] = await Promise.all([
      supabase.from("meta_business_managers").select("id, name, meta_app_id").eq("meta_app_id", selectedAppId).order("name"),
      supabase.from("meta_ad_accounts").select("id, name, meta_account_id, bm_id, currency, status, last_synced_at, meta_app_id").eq("meta_app_id", selectedAppId).order("name"),
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("meta_ad_account_assignments")
        .select("ad_account_id, client_id, active, effective_from, effective_to")
        .order("effective_from", { ascending: false, nullsFirst: false }),
    ]);
    setBms((b.data as BM[]) || []);
    const accs = (a.data as Account[]) || [];
    setAccounts(accs);
    setClients((c.data as Client[]) || []);
    setAssignments((asn.data as Assignment[]) || []);
    const maxSync = accs
      .map((x) => x.last_synced_at ? new Date(x.last_synced_at).getTime() : 0)
      .reduce((m, t) => Math.max(m, t), 0);
    setLastSyncAt(maxSync > 0 ? new Date(maxSync) : null);
  };

  const loadGen = useRef(0);

  const loadInsights = async (opts?: { background?: boolean; accountIds?: string[] }): Promise<Insight[]> => {
    const myGen = ++loadGen.current;
    if (!opts?.background) setLoading(true);
    try {
      const accountIds = opts?.accountIds ?? accounts.map((a) => a.id);
      if (accountIds.length === 0) {
        setInsights([]);
        setPrevInsights([]);
        return [];
      }
      const { since, until } = rangeToDates(range, customStart, customEnd);
      const prev = previousRange(since, until);
      const [curRes, prevRes] = await Promise.all([
        supabase.from("meta_ad_insights")
          .select("ad_account_id, date, spend, impressions, clicks, cpm, cpc, ctr, reach, purchases, revenue")
          .in("ad_account_id", accountIds)
          .gte("date", since).lte("date", until)
          .order("date", { ascending: true })
          .range(0, 99999),
        supabase.from("meta_ad_insights")
          .select("ad_account_id, date, spend, impressions, clicks, cpm, cpc, ctr, reach, purchases, revenue")
          .in("ad_account_id", accountIds)
          .gte("date", prev.since).lte("date", prev.until)
          .order("date", { ascending: true })
          .range(0, 99999),
      ]);
      if (myGen !== loadGen.current) return [];
      if (curRes.error && !opts?.background) toast.error(curRes.error.message);
      const rows = (curRes.data as Insight[]) || [];
      setInsights(rows);
      setPrevInsights((prevRes.data as Insight[]) || []);
      return rows;
    } finally {
      if (!opts?.background) setLoading(false);
    }
  };

  // Reload metadata when app changes
  useEffect(() => {
    if (!selectedAppId) return;
    // Reset filters scoped to previous app
    setFilterBm("all");
    setFilterAccounts([]);
    setFilterClients([]);
    loadMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAppId]);

  const didAutoSync = useRef<string>("");
  useEffect(() => {
    if (!selectedAppId) return;
    (async () => {
      const ids = accounts.map((a) => a.id);
      const rows = await loadInsights({ accountIds: ids });
      const today = fmtISO(new Date());
      const hasToday = rows.some((i) => i.date === today);
      const isShortRange = range === "today" || range === "yesterday";

      if (isShortRange && rows.length === 0 && ids.length > 0) {
        didAutoSync.current = selectedAppId;
        setLoading(true);
        try { await sync({ silent: false, forceRecent: true }); } finally { setLoading(false); }
        return;
      }

      const shouldAutoSync = ids.length > 0 && (didAutoSync.current !== selectedAppId || !hasToday);
      if (shouldAutoSync) {
        didAutoSync.current = selectedAppId;
        const gen = loadGen.current;
        sync({ silent: true, forceRecent: true }).then(() => {
          if (gen === loadGen.current) loadInsights({ background: true });
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, customStart, customEnd, accounts.length, selectedAppId]);

  const clientByAccount = useMemo(() => {
    const m = new Map<string, string>();
    assignments.forEach((a) => { if (!m.has(a.ad_account_id)) m.set(a.ad_account_id, a.client_id); });
    return m;
  }, [assignments]);

  const resolveClient = useMemo(
    () => (accountId: string, date: string) => resolveClientForSpend(assignments, accountId, date),
    [assignments]
  );

  const accountLevelIds = useMemo(() => {
    return new Set(
      accounts.filter((a) => {
        if (filterBm !== "all" && a.bm_id !== filterBm) return false;
        if (filterAccounts.length > 0 && !filterAccounts.includes(a.id)) return false;
        if (statusFilter === "active" && a.status !== "active") return false;
        if (statusFilter === "blocked" && a.status === "active") return false;
        return true;
      }).map((a) => a.id)
    );
  }, [accounts, filterBm, filterAccounts, statusFilter]);

  const matchesClientFilter = (accountId: string, date: string): boolean => {
    if (filterClients.length === 0) return true;
    const cid = resolveClient(accountId, date);
    const wantsUnassigned = filterClients.includes("__unassigned__");
    if (!cid) return wantsUnassigned;
    return filterClients.includes(cid);
  };

  const filteredInsights = useMemo(
    () => insights.filter((i) => accountLevelIds.has(i.ad_account_id) && matchesClientFilter(i.ad_account_id, i.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [insights, accountLevelIds, filterClients, assignments]
  );
  const filteredPrevInsights = useMemo(
    () => prevInsights.filter((i) => accountLevelIds.has(i.ad_account_id) && matchesClientFilter(i.ad_account_id, i.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prevInsights, accountLevelIds, filterClients, assignments]
  );

  const metrics = useMemo(() => computeMetrics(filteredInsights), [filteredInsights]);
  const prevMetrics = useMemo(
    () => filteredPrevInsights.length > 0 ? computeMetrics(filteredPrevInsights) : null,
    [filteredPrevInsights]
  );

  const daily = useMemo(() => {
    const map = new Map<string, { spend: number; revenue: number }>();
    filteredInsights.forEach((i) => {
      const key = i.date;
      const cur = map.get(key) || { spend: 0, revenue: 0 };
      cur.spend += Number(i.spend || 0);
      cur.revenue += Number(i.revenue || 0);
      map.set(key, cur);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date, spend: v.spend, revenue: v.revenue,
        profit: v.revenue - v.spend,
        roas: v.spend > 0 ? v.revenue / v.spend : 0,
      }));
  }, [filteredInsights]);

  const sync = async (opts?: { silent?: boolean; forceRecent?: boolean }) => {
    if (!selectedAppId) return;
    const silent = opts?.silent === true;
    setSyncing(true);
    try {
      let since: string; let until: string;
      if (opts?.forceRecent) {
        const today = new Date();
        since = fmtISO(subDays(today, 2));
        until = fmtISO(today);
      } else {
        ({ since, until } = rangeToDates(range, customStart, customEnd));
      }
      const { data, error } = await supabase.functions.invoke("meta-sync", {
        body: { action: "sync_insights", since, until, app_ids: [selectedAppId], only_recent_spenders: syncScope === "recent_spenders" },
      });
      if (error) throw error;
      if ((data as any)?.erro) throw new Error((data as any).erro);
      const rows = (data as any)?.linhas_upsertadas ?? 0;
      const errs = (data as any)?.erros || [];
      if (!silent) toast.success(`Sincronizado: ${rows} registro(s)`);
      setLastSyncAt(new Date());
      setAutoSyncError(errs.length > 0 ? `Meta retornou erro em ${errs.length} conta(s). Clique em "Sincronizar" para tentar de novo.` : null);
      await loadInsights({ background: silent });
    } catch (e: any) {
      if (!silent) toast.error(`Falha: ${e.message}`);
      else setAutoSyncError(`Falha ao sincronizar com a Meta: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const selectedApp = apps.find((a) => a.id === selectedAppId);

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Venda · Performance"
        title={<><span className="text-primary glow-text">Ads de Venda</span></>}
        description={`Métricas do aplicativo Meta selecionado — ${accountLevelIds.size} conta(s).`}
      />

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <AppWindow size={14} className="text-primary" />
          Aplicativo Meta
        </div>
        <Select value={selectedAppId} onValueChange={setSelectedAppId}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Selecione um aplicativo Meta" />
          </SelectTrigger>
          <SelectContent>
            {apps.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.label}{a.is_default ? " · padrão" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedApp && (
          <span className="text-[11px] text-muted-foreground ml-auto">
            {accounts.length} conta(s) · {bms.length} BM(s) vinculadas a este app
          </span>
        )}
      </Card>

      {!selectedAppId ? (
        <Card className="p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum aplicativo Meta ativo. Cadastre em <span className="text-primary">Aplicativos Meta</span>.
          </p>
        </Card>
      ) : (
        <>
          <AdsFiltersBar
            range={range}
            onRangeChange={setRange}
            customStart={customStart}
            customEnd={customEnd}
            onCustomChange={(s, e) => { setCustomStart(s); setCustomEnd(e); }}
            bms={bms}
            accounts={accounts}
            clients={clients}
            filterBm={filterBm}
            onFilterBmChange={setFilterBm}
            filterClients={filterClients}
            onFilterClientsChange={setFilterClients}
            filterAccounts={filterAccounts}
            onFilterAccountsChange={setFilterAccounts}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            lastSyncAt={lastSyncAt}
            syncing={syncing}
            onSync={() => sync()}
            syncScope={syncScope}
            onSyncScopeChange={setSyncScope}
            activeAccountsCount={accountLevelIds.size}
          />

          {autoSyncError && (
            <Card className="p-3 border-amber-500/40 bg-amber-500/10 flex items-center justify-between gap-3">
              <p className="text-xs text-amber-200">{autoSyncError}</p>
              <button
                onClick={() => sync()}
                disabled={syncing}
                className="text-xs px-3 py-1.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
              >
                {syncing ? "Sincronizando..." : "Tentar novamente"}
              </button>
            </Card>
          )}

          {loading ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20" />)}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Skeleton className="h-[300px]" />
                <Skeleton className="h-[300px]" />
              </div>
            </div>
          ) : filteredInsights.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Nenhum insight encontrado para os filtros selecionados.
              </p>
              <button
                onClick={() => sync()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/40 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
              >
                Sincronizar agora
              </button>
            </Card>
          ) : (
            <>
              <AdsKpiHero current={metrics} previous={prevMetrics} daily={daily} />
              <AdsTimeCharts daily={daily} />
              <AdsBreakdownTable
                insights={filteredInsights}
                accounts={accounts}
                bms={bms}
                clients={clients}
                clientByAccount={clientByAccount}
                resolveClient={resolveClient}
                onPickClient={(id) => setFilterClients([id])}
                onPickAccount={(id) => setFilterAccounts([id])}
                onPickBm={(id) => setFilterBm(id)}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
