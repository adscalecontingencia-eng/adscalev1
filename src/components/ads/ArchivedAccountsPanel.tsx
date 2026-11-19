import { useEffect, useMemo, useState } from "react";
import { tr, localizedMap } from '@/i18n';
import { getDateLocale, getNumberLocale } from '@/i18n/format';
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Archive, ChevronDown, ChevronUp, RotateCcw, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

type Row = {
  id: string;
  name: string;
  meta_account_id: string;
  last_sync_error_code: number | null;
  last_sync_error_message: string | null;
  last_sync_error_at: string | null;
  last_sync_error_source: string | null;
  archived_at: string | null;
};

const REASONS: Record<number, string> = localizedMap('ads.arch.reason', {
  200: "Sem permissão (ads_read)",
  190: "Token inválido/expirado",
  10: "Permissão negada",
  100: "Parâmetro/permissão inválida",
} as Record<string, string>);

type TokenFilter = "all" | "both" | "system" | "user" | "no_token";
type ReasonFilter = "all" | "200" | "190" | "10" | "100" | "other";

const fmt = (iso: string | null) => (iso ? format(new Date(iso), "P HH:mm", { locale: getDateLocale() }) : "—");

export default function ArchivedAccountsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [token, setToken] = useState<TokenFilter>("all");
  const [reason, setReason] = useState<ReasonFilter>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [retentionWeeks, setRetentionWeeks] = useState<number>(2);
  const [retentionInput, setRetentionInput] = useState<string>("2");
  const [savingRetention, setSavingRetention] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data, error }, cfg] = await Promise.all([
        supabase
          .from("meta_ad_accounts")
          .select("id,name,meta_account_id,last_sync_error_code,last_sync_error_message,last_sync_error_at,last_sync_error_source,archived_at")
          .not("archived_at", "is", null)
          .order("archived_at", { ascending: false })
          .limit(1000),
        supabase.from("support_settings").select("value").eq("key", "archived_retention_weeks").maybeSingle(),
      ]);
      if (!cancelled) {
        if (!error) setRows((data as any) || []);
        const w = Number((cfg.data as any)?.value ?? 2);
        if (Number.isFinite(w) && w > 0) { setRetentionWeeks(w); setRetentionInput(String(w)); }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refreshKey, tick]);

  const saveRetention = async () => {
    const w = Number(retentionInput);
    if (!Number.isFinite(w) || w < 1) {
      toast({ title: tr('ads.arch.invalid'), description: tr('ads.arch.min1'), variant: "destructive" });
      return;
    }
    setSavingRetention(true);
    const { error } = await supabase
      .from("support_settings")
      .upsert({ key: "archived_retention_weeks", value: w as any }, { onConflict: "key" });
    setSavingRetention(false);
    if (error) {
      toast({ title: tr('ads.arch.saveFail'), description: error.message, variant: "destructive" });
      return;
    }
    setRetentionWeeks(w);
    toast({ title: tr('ads.arch.saved'), description: tr('ads.arch.savedDesc', { w }) });
  };


  // Contas arquivadas há mais de N semanas somem automaticamente do painel.
  const visibleRows = useMemo(() => {
    const cutoff = Date.now() - retentionWeeks * 7 * 86400000;
    return rows.filter((r) => (r.archived_at ? new Date(r.archived_at).getTime() >= cutoff : true));
  }, [rows, retentionWeeks]);

  const expiredCount = rows.length - visibleRows.length;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() + 86400000 : null;
    return visibleRows.filter((r) => {

      if (term && !`${r.name} ${r.meta_account_id}`.toLowerCase().includes(term)) return false;
      if (token !== "all" && (r.last_sync_error_source || "no_token") !== token) return false;
      const code = r.last_sync_error_code;
      if (reason !== "all") {
        if (reason === "other") {
          if (code != null && [200, 190, 10, 100].includes(code)) return false;
        } else if (String(code ?? "") !== reason) return false;
      }
      if (r.last_sync_error_at) {
        const t = new Date(r.last_sync_error_at).getTime();
        if (fromTs && t < fromTs) return false;
        if (toTs && t > toTs) return false;
      } else if (fromTs || toTs) {
        return false;
      }
      return true;
    });
  }, [visibleRows, q, token, reason, from, to]);

  const unarchive = async (id: string) => {
    setBusy(id);
    try {
      const { data, error } = await supabase.functions.invoke("meta-sync", {
        body: { action: "unarchive_account", account_id: id },
      });
      if (error) throw error;
      if ((data as any)?.erro) throw new Error((data as any).erro);
      toast({ title: tr('ads.arch.restored'), description: tr('ads.arch.restoredDesc') });
      setTick((t) => t + 1);
    } catch (e: any) {
      toast({ title: tr('ads.arch.restoreFail'), description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (loading && rows.length === 0) return null;
  if (rows.length === 0) return null;

  return (
    <Card className="border-zinc-500/30 bg-zinc-500/5">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-3 p-3 text-left">
        <div className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-zinc-300" />
          <span className="text-sm font-medium text-zinc-200">{tr('ads.arch.title', { n: visibleRows.length })}</span>
          <span className="text-[10px] text-muted-foreground">
            {tr('ads.arch.removed')}
            {expiredCount > 0 && ` ${tr('ads.arch.hidden', { n: expiredCount, w: retentionWeeks })}`}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-zinc-300" /> : <ChevronDown className="h-4 w-4 text-zinc-300" />}
      </button>

      {open && (
        <div className="border-t border-zinc-500/20">
          <div className="flex flex-wrap items-center gap-2 px-3 pt-3">
            <span className="text-[11px] text-muted-foreground">{tr('ads.arch.autoRemove')}</span>
            <Input
              type="number"
              min={1}
              value={retentionInput}
              onChange={(e) => setRetentionInput(e.target.value)}
              className="h-8 w-[70px] text-xs"
            />
            <span className="text-[11px] text-muted-foreground">{tr('ads.arch.weeksAfter')}</span>
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={savingRetention} onClick={saveRetention}>
              {tr('ads.arch.save')}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 p-3">

            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('ads.arch.search')} className="pl-7 h-8 text-xs" />
            </div>
            <select value={reason} onChange={(e) => setReason(e.target.value as ReasonFilter)} className="h-8 rounded-md border bg-background px-2 text-xs">
              <option value="all">{tr('ads.arch.allReasons')}</option>
              <option value="200">{tr('ads.arch.r200')}</option>
              <option value="190">{tr('ads.arch.r190')}</option>
              <option value="10">{tr('ads.arch.r10')}</option>
              <option value="100">{tr('ads.arch.r100')}</option>
              <option value="other">{tr('ads.arch.others')}</option>
            </select>
            <select value={token} onChange={(e) => setToken(e.target.value as TokenFilter)} className="h-8 rounded-md border bg-background px-2 text-xs">
              <option value="all">{tr('ads.arch.allTokens')}</option>
              <option value="both">{tr('ads.arch.both')}</option>
              <option value="system">{tr('ads.arch.onlySystem')}</option>
              <option value="user">{tr('ads.arch.onlyUser')}</option>
              <option value="no_token">{tr('ads.arch.noToken')}</option>
            </select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-[140px] text-xs" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-[140px] text-xs" />
            <span className="text-[11px] text-muted-foreground ml-auto">{filtered.length} de {visibleRows.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-500/10 text-zinc-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">{tr('ads.arch.account')}</th>
                  <th className="text-left px-3 py-2 font-medium">{tr('ads.arch.reasonCol')}</th>
                  <th className="text-left px-3 py-2 font-medium">Token</th>
                  <th className="text-left px-3 py-2 font-medium">{tr('ads.arch.lastFail')}</th>
                  <th className="text-left px-3 py-2 font-medium">{tr('ads.arch.archivedAt')}</th>
                  <th className="text-right px-3 py-2 font-medium">{tr('ads.arch.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-500/10 hover:bg-zinc-500/5">
                    <td className="px-3 py-2 text-foreground">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-[10px] text-muted-foreground">{r.meta_account_id}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-foreground">
                        <span className="font-mono mr-1">#{r.last_sync_error_code ?? "?"}</span>
                        {r.last_sync_error_code ? REASONS[r.last_sync_error_code] || tr('ads.arch.other') : "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground line-clamp-1 max-w-md" title={r.last_sync_error_message || ""}>
                        {r.last_sync_error_message || ""}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.last_sync_error_source || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmt(r.last_sync_error_at)}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmt(r.archived_at)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => unarchive(r.id)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> {tr('ads.arch.restore')}
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">{tr('ads.arch.none')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
