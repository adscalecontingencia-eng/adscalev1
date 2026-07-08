import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PageHero } from "@/components/ui-kit";
import { format, subDays, differenceInCalendarDays } from "date-fns";
import { parseDateLocal } from "@/lib/date-utils";
import { getLastClosedBillingWeekRange } from "@/lib/billing-status";

import AdsKpiHero, { AdsMetrics } from "@/components/ads/AdsKpiHero";
import AdsFiltersBar, { AdsRange, AccountStatus } from "@/components/ads/AdsFiltersBar";
import AdsTimeCharts from "@/components/ads/AdsTimeCharts";
import AdsBreakdownTable from "@/components/ads/AdsBreakdownTable";
import { resolveClientForSpend } from "@/lib/assignment-filter";

type BM = { id: string; name: string };
type Account = {
  id: string; name: string; meta_account_id: string; bm_id: string | null;
  currency: string | null; status: string | null; last_synced_at: string | null;
};
type Client = { id: string; name: string };
type Assignment = { ad_account_id: string; client_id: string; active: boolean; effective_from?: string | null; effective_to?: string | null };
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

// Use LOCAL date (not UTC). toISOString() shifts the date in negative timezones
// (e.g. BRT after 21h becomes "tomorrow" in UTC), which made the sync request
// the wrong day and the DB filter return inconsistent values.
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
  if (r === "billing_week") {
    const range = getLastClosedBillingWeekRange(today);
    return {
      since: fmtISO(range.start),
      until: fmtISO(range.end),
    };
  }
  if (r === "custom" && customStart && customEnd) {
    return { since: fmtISO(customStart), until: fmtISO(customEnd) };
  }
  const days = r === "7d" ? 6 : r === "30d" ? 29 : r === "90d" ? 89 : 6;
  const start = subDays(today, days);
  return { since: fmtISO(start), until: fmtISO(today) };
}

function previousRange(since: string, until: string): { since: string; until: string } {
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

export default function AdsDashboard() {
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

  const [range, setRange] = useState<AdsRange>("billing_week");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [filterBm, setFilterBm] = useState<string>("all");
  const [filterClients, setFilterClients] = useState<string[]>([]);
  const [filterAccounts, setFilterAccounts] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<AccountStatus>("all");
  const [syncScope, setSyncScope] = useState<"active" | "recent_spenders">("active");

  const loadMeta = async () => {
    const [b, a, c, asn] = await Promise.all([
      supabase.from("meta_business_managers").select("id, name").order("name"),
      supabase.from("meta_ad_accounts").select("id, name, meta_account_id, bm_id, currency, status, last_synced_at").order("name"),
      supabase.from("clients").select("id, name").order("name"),
      // Load ALL assignments (including inactive/expired) so historical spend
      // stays attributed to the client that owned the account on that date.
      // Order by effective_from desc so resolveClientForSpend picks the most
      // recent window that contains the insight date.
      supabase
        .from("meta_ad_account_assignments")
        .select("ad_account_id, client_id, active, effective_from, effective_to")
        .order("effective_from", { ascending: false, nullsFirst: false }),
    ]);
    setBms((b.data as BM[]) || []);
    setAccounts((a.data as Account[]) || []);
    setClients((c.data as Client[]) || []);
    setAssignments((asn.data as Assignment[]) || []);
    // last sync = max last_synced_at across accounts
    const maxSync = ((a.data as Account[]) || [])
      .map((x) => x.last_synced_at ? new Date(x.last_synced_at).getTime() : 0)
      .reduce((m, t) => Math.max(m, t), 0);
    if (maxSync > 0) setLastSyncAt(new Date(maxSync));
  };

  // Generation guard: drop responses from a previous range/sync race
  const loadGen = useRef(0);

  const loadInsights = async (opts?: { background?: boolean }): Promise<Insight[]> => {
    const myGen = ++loadGen.current;
    if (!opts?.background) setLoading(true);
    try {
      const { since, until } = rangeToDates(range, customStart, customEnd);
      const prev = previousRange(since, until);

      // IMPORTANT: explicit range to bypass Supabase's default 1000 rows limit.
      const [curRes, prevRes] = await Promise.all([
        supabase
          .from("meta_ad_insights")
          .select("ad_account_id, date, spend, impressions, clicks, cpm, cpc, ctr, reach, purchases, revenue")
          .gte("date", since).lte("date", until)
          .order("date", { ascending: true })
          .range(0, 99999),
        supabase
          .from("meta_ad_insights")
          .select("ad_account_id, date, spend, impressions, clicks, cpm, cpc, ctr, reach, purchases, revenue")
          .gte("date", prev.since).lte("date", prev.until)
          .order("date", { ascending: true })
          .range(0, 99999),
      ]);
      // Drop stale results from a previous range/sync race, but still release
      // loading in finally so the UI never gets stuck between skeleton and data.
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

  useEffect(() => { loadMeta(); }, []);

  // Reload on period change. Decide auto-sync based on the rows we just
  // loaded (NOT the `insights` state, which is stale in this closure).
  const didAutoSync = useRef(false);
  useEffect(() => {
    (async () => {
      const rows = await loadInsights();
      const today = fmtISO(new Date());
      const hasToday = rows.some((i) => i.date === today);
      const isShortRange = range === "today" || range === "yesterday";

      // If the user is on Hoje/Ontem and DB has no rows for this window,
      // run a FOREGROUND sync (keeps the skeleton up) and reload — avoids
      // flashing the empty state while the Meta call is in flight.
      if (isShortRange && rows.length === 0) {
        didAutoSync.current = true;
        setLoading(true);
        try {
          await sync({ silent: false, forceRecent: true });
        } finally {
          setLoading(false);
        }
        return;
      }

      const shouldAutoSync = !didAutoSync.current || !hasToday;
      if (shouldAutoSync) {
        didAutoSync.current = true;
        const gen = loadGen.current;
        sync({ silent: true, forceRecent: true }).then(() => {
          // Abort the follow-up reload if range changed mid-sync.
          if (gen === loadGen.current) loadInsights({ background: true });
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, customStart, customEnd]);

  // Current (latest) client per account — used only for chip labels and for
  // the "Por Conta" sublabel. NEVER use it to attribute spend to a client:
  // do that per-insight via resolveClientForSpend so historical spend is
  // credited to whoever owned the account on that date.
  const clientByAccount = useMemo(() => {
    const m = new Map<string, string>();
    // assignments is ordered by effective_from desc → first hit is the newest
    assignments.forEach((a) => {
      if (!m.has(a.ad_account_id)) m.set(a.ad_account_id, a.client_id);
    });
    return m;
  }, [assignments]);

  const resolveClient = useMemo(
    () => (accountId: string, date: string) =>
      resolveClientForSpend(assignments, accountId, date),
    [assignments]
  );

  // Account-level filters (BM / status / explicit account picks) — client
  // filter is applied per-insight below so date windows are respected.
  const accountLevelIds = useMemo(() => {
    return new Set(
      accounts
        .filter((a) => {
          if (filterBm !== "all" && a.bm_id !== filterBm) return false;
          if (filterAccounts.length > 0 && !filterAccounts.includes(a.id)) return false;
          if (statusFilter === "active" && a.status !== "active") return false;
          if (statusFilter === "blocked" && a.status === "active") return false;
          return true;
        })
        .map((a) => a.id)
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
    () => insights.filter((i) =>
      accountLevelIds.has(i.ad_account_id) && matchesClientFilter(i.ad_account_id, i.date)
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [insights, accountLevelIds, filterClients, assignments]
  );
  const filteredPrevInsights = useMemo(
    () => prevInsights.filter((i) =>
      accountLevelIds.has(i.ad_account_id) && matchesClientFilter(i.ad_account_id, i.date)
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prevInsights, accountLevelIds, filterClients, assignments]
  );

  // Kept for the hero subtitle count — accounts that pass the non-client filters.
  const filteredAccountIds = accountLevelIds;

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
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        spend: v.spend,
        revenue: v.revenue,
        profit: v.revenue - v.spend,
        roas: v.spend > 0 ? v.revenue / v.spend : 0,
      }));
  }, [filteredInsights]);

  const sync = async (opts?: { silent?: boolean; forceRecent?: boolean }) => {
    const silent = opts?.silent === true;
    setSyncing(true);
    try {
      let since: string;
      let until: string;
      if (opts?.forceRecent) {
        // Always ingest today + 2 previous days to recover gaps after Meta outages.
        const today = new Date();
        since = fmtISO(subDays(today, 2));
        until = fmtISO(today);
      } else {
        ({ since, until } = rangeToDates(range, customStart, customEnd));
      }
      const { data, error } = await supabase.functions.invoke("meta-sync", {
        body: { action: "sync_insights", since, until, only_recent_spenders: syncScope === "recent_spenders" },
      });
      if (error) throw error;
      if ((data as any)?.erro) throw new Error((data as any).erro);
      const rows = (data as any)?.linhas_upsertadas ?? 0;
      const errs = (data as any)?.erros || [];
      if (!silent) toast.success(`Sincronizado: ${rows} registro(s)`);
      setLastSyncAt(new Date());
      // Surface partial failures even on the first silent run so the admin
      // sees why some accounts are missing (e.g. Meta API instability).
      if (errs.length > 0) {
        setAutoSyncError(`Meta retornou erro em ${errs.length} conta(s). Clique em "Sincronizar" para tentar de novo.`);
      } else {
        setAutoSyncError(null);
      }
      await loadInsights({ background: silent });
    } catch (e: any) {
      if (!silent) toast.error(`Falha: ${e.message}`);
      else {
        console.error("auto-sync falhou:", e.message);
        setAutoSyncError(`Falha ao sincronizar com a Meta: ${e.message}`);
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Performance"
        title={<><span className="text-primary glow-text">Ads</span></>}
        description={`Métricas consolidadas das contas do Meta Ads — ${filteredAccountIds.size} conta(s).`}
      />

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
        activeAccountsCount={filteredAccountIds.size}
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
    </div>
  );
}
