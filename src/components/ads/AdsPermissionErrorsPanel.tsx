import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { AlertTriangle, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Attempt = { source: string; code: number | null; message: string };

type Row = {
  id: string;
  name: string;
  meta_account_id: string;
  last_sync_error_code: number | null;
  last_sync_error_message: string | null;
  last_sync_error_at: string | null;
  last_synced_at: string | null;
  last_sync_error_source: string | null;
  last_sync_error_attempts: Attempt[] | null;
};

const fmt = (iso: string | null) =>
  iso ? format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—";

// Códigos de permissão retornados pela Meta durante o sync
const PERMISSION_CODES = [200, 190, 10, 100];

type Filter = "all" | "both" | "system" | "user" | "no_token";

const sourceLabel: Record<string, { text: string; cls: string }> = {
  both:     { text: "System + User", cls: "bg-red-500/25 text-red-100 border-red-400/50" },
  system:   { text: "System token",  cls: "bg-orange-500/20 text-orange-200 border-orange-400/40" },
  user:     { text: "User token",    cls: "bg-amber-500/20 text-amber-200 border-amber-400/40" },
  no_token: { text: "Sem token",     cls: "bg-zinc-500/20 text-zinc-200 border-zinc-400/40" },
};

export default function AdsPermissionErrorsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("both");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("meta_ad_accounts")
        .select("id,name,meta_account_id,last_sync_error_code,last_sync_error_message,last_sync_error_at,last_synced_at,last_sync_error_source,last_sync_error_attempts")
        .in("last_sync_error_code", PERMISSION_CODES)
        .is("archived_at", null)
        .order("last_sync_error_at", { ascending: false })
        .limit(200);
      if (!cancelled && !error) setRows((data as any) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const counts = useMemo(() => {
    const c = { all: rows.length, both: 0, system: 0, user: 0, no_token: 0 } as Record<Filter, number>;
    for (const r of rows) {
      const s = (r.last_sync_error_source || "system") as Filter;
      if (s in c) c[s] += 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter(r => (r.last_sync_error_source || "system") === filter);
  }, [rows, filter]);

  if (loading || rows.length === 0) return null;

  const FilterBtn = ({ f, label }: { f: Filter; label: string }) => (
    <button
      onClick={(e) => { e.stopPropagation(); setFilter(f); }}
      className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition ${
        filter === f
          ? "bg-red-500/30 text-red-100 border-red-400/60"
          : "bg-transparent text-red-200/80 border-red-500/30 hover:bg-red-500/10"
      }`}
    >
      {label} <span className="opacity-70">({counts[f]})</span>
    </button>
  );

  return (
    <Card className="border-red-500/40 bg-red-500/5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span className="text-sm font-medium text-red-200">
            Contas sem permissão na Meta ({rows.length})
          </span>
          {counts.both > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-red-500/30 text-red-100 border border-red-400/50">
              <ShieldAlert className="h-3 w-3" />
              {counts.both} sem system nem user
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-red-300" /> : <ChevronDown className="h-4 w-4 text-red-300" />}
      </button>

      {open && (
        <>
          <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2 border-t border-red-500/20 pt-2">
            <span className="text-[10px] uppercase tracking-wider text-red-300/70 mr-1">Filtrar:</span>
            <FilterBtn f="both" label="Ambos falharam" />
            <FilterBtn f="system" label="Só system" />
            <FilterBtn f="user" label="Só user" />
            <FilterBtn f="no_token" label="Sem token" />
            <FilterBtn f="all" label="Todos" />
          </div>

          <div className="overflow-x-auto border-t border-red-500/20">
            <table className="w-full text-xs">
              <thead className="bg-red-500/10 text-red-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Conta</th>
                  <th className="text-left px-3 py-2 font-medium">Token que falhou</th>
                  <th className="text-left px-3 py-2 font-medium">Código</th>
                  <th className="text-left px-3 py-2 font-medium">Erro</th>
                  <th className="text-left px-3 py-2 font-medium">Última sync</th>
                  <th className="text-left px-3 py-2 font-medium">Erro em</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const src = (r.last_sync_error_source || "system") as keyof typeof sourceLabel;
                  const badge = sourceLabel[src] || sourceLabel.system;
                  const isBoth = src === "both";
                  const attempts = Array.isArray(r.last_sync_error_attempts) ? r.last_sync_error_attempts : [];
                  const isOpen = expanded[r.id];
                  return (
                    <>
                      <tr
                        key={r.id}
                        className={`border-t border-red-500/10 hover:bg-red-500/5 ${isBoth ? "bg-red-500/10" : ""}`}
                      >
                        <td className="px-3 py-2 text-foreground">
                          <div className="font-medium">{r.name}</div>
                          <div className="text-[10px] text-muted-foreground">{r.meta_account_id}</div>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.cls}`}>
                            {badge.text}
                          </span>
                          {attempts.length > 0 && (
                            <button
                              onClick={() => setExpanded(m => ({ ...m, [r.id]: !m[r.id] }))}
                              className="ml-2 text-[10px] text-red-300 hover:text-red-100 underline"
                            >
                              {isOpen ? "ocultar" : "ver tentativas"}
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-red-500/20 text-red-200 font-mono">
                            {r.last_sync_error_code ?? "?"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-md">
                          <div className="line-clamp-2" title={r.last_sync_error_message || ""}>
                            {r.last_sync_error_message || "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmt(r.last_synced_at)}</td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmt(r.last_sync_error_at)}</td>
                      </tr>
                      {isOpen && attempts.length > 0 && (
                        <tr key={r.id + "-att"} className="bg-red-500/[0.03]">
                          <td colSpan={6} className="px-3 py-2">
                            <div className="space-y-1">
                              {attempts.map((a, i) => (
                                <div key={i} className="flex items-start gap-2 text-[11px]">
                                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] border ${sourceLabel[a.source]?.cls || sourceLabel.system.cls}`}>
                                    {a.source === "system" ? "System token" : a.source === "user" ? "User token" : a.source}
                                  </span>
                                  <span className="font-mono text-red-200">#{a.code ?? "?"}</span>
                                  <span className="text-muted-foreground flex-1 break-words">{a.message}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
            <div className="px-3 py-2 text-[10px] text-muted-foreground border-t border-red-500/20">
              Linhas em vermelho intenso: nem o System User nem o User Token conseguiram ler a conta — conceda "Ver desempenho" ou "Gerenciar campanhas" para ambos no Business Manager.
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
