import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Building2, ShieldAlert, Layers, AlertCircle, Search, X,
  BadgeCheck, ShieldQuestion, Clock, FileText, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BM {
  id: string;
  meta_bm_id: string;
  name: string;
  status: string | null;
  verification_status: string | null;
  account_count: number | null;
  pixel_count: number | null;
  page_count: number | null;
  last_synced_at: string | null;
}
interface Account { id: string; bm_id: string | null; status: string | null; }

interface Props {
  bms: BM[];
  accounts: Account[];
  selected: string;
  onSelect: (v: string) => void;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function VerifiedBadge({ status }: { status: string | null }) {
  const v = (status || "").toLowerCase();
  const verified = v === "verified" || v === "approved";
  const pending = v === "pending" || v === "not_started";
  if (verified) {
    return (
      <span
        title="Business Manager verificado"
        className="inline-flex items-center gap-0.5 text-primary"
      >
        <BadgeCheck className="h-3 w-3" />
      </span>
    );
  }
  if (pending) {
    return (
      <span
        title="Verificação pendente"
        className="inline-flex items-center gap-0.5 text-amber-400"
      >
        <ShieldQuestion className="h-3 w-3" />
      </span>
    );
  }
  return null;
}

export default function BmSidebar({ bms, accounts, selected, onSelect }: Props) {
  const [query, setQuery] = useState("");

  const totalAccounts = accounts.length;
  const totalBlocked = accounts.filter((a) => a.status !== "active").length;
  const orphanCount = accounts.filter((a) => !a.bm_id).length;

  const filteredBms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bms;
    return bms.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.meta_bm_id || "").toLowerCase().includes(q),
    );
  }, [bms, query]);

  return (
    <Card className="p-2.5 space-y-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <div className="px-2 pt-1 pb-0.5 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center justify-between">
        <span>Business Managers</span>
        <span className="text-muted-foreground/70 normal-case tracking-normal">
          {bms.length}
        </span>
      </div>

      <div className="relative px-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome ou ID..."
          className="h-8 pl-8 pr-7 text-xs bg-card/60"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {!query && (
          <button
            onClick={() => onSelect("all")}
            className={cn(
              "w-full text-left rounded-lg border px-3 py-2.5 transition-all flex items-start gap-2.5",
              selected === "all"
                ? "border-primary bg-primary/10 shadow-[0_0_18px_-10px_hsl(var(--primary)/0.8)]"
                : "border-border bg-card/40 hover:border-primary/50 hover:bg-card",
            )}
          >
            <Layers className={cn(
              "h-4 w-4 mt-0.5 shrink-0",
              selected === "all" ? "text-primary" : "text-foreground/70"
            )} />
            <div className="min-w-0 flex-1">
              <div className={cn(
                "text-sm font-medium",
                selected === "all" ? "text-primary" : "text-foreground"
              )}>
                Todas as BMs
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                <span>{totalAccounts} contas</span>
                {totalBlocked > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-destructive">
                    <ShieldAlert className="h-3 w-3" /> {totalBlocked}
                  </span>
                )}
              </div>
            </div>
          </button>
        )}

        {filteredBms.map((bm) => {
          const bmAccs = accounts.filter((a) => a.bm_id === bm.id);
          const bmBlocked = bmAccs.filter((a) => a.status !== "active").length;
          const active = selected === bm.id;
          return (
            <button
              key={bm.id}
              onClick={() => onSelect(bm.id)}
              className={cn(
                "w-full text-left rounded-lg border px-3 py-2.5 transition-all group",
                active
                  ? "border-primary bg-primary/10 shadow-[0_0_18px_-10px_hsl(var(--primary)/0.8)]"
                  : "border-border bg-card/40 hover:border-primary/50 hover:bg-card",
              )}
            >
              <div className="flex items-start gap-2.5">
                <Building2 className={cn(
                  "h-4 w-4 mt-0.5 shrink-0",
                  active ? "text-primary" : "text-foreground/70"
                )} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn(
                      "text-sm font-medium truncate",
                      active ? "text-primary" : "text-foreground"
                    )}>
                      {bm.name}
                    </span>
                    <VerifiedBadge status={bm.verification_status} />
                  </div>

                  <div className="text-[10px] text-muted-foreground/80 font-mono truncate mt-0.5">
                    ID {bm.meta_bm_id}
                  </div>

                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-1 flex-wrap">
                    <span>{bmAccs.length} {bmAccs.length === 1 ? "conta" : "contas"}</span>
                    {bmBlocked > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-destructive">
                        <ShieldAlert className="h-3 w-3" /> {bmBlocked}
                      </span>
                    )}
                    {(bm.page_count ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-0.5" title="Páginas">
                        <FileText className="h-3 w-3" /> {bm.page_count}
                      </span>
                    )}
                    {(bm.pixel_count ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-0.5" title="Pixels">
                        <Target className="h-3 w-3" /> {bm.pixel_count}
                      </span>
                    )}
                    <span
                      className="inline-flex items-center gap-0.5 ml-auto"
                      title={bm.last_synced_at ? `Sincronizado em ${new Date(bm.last_synced_at).toLocaleString()}` : "Nunca sincronizado"}
                    >
                      <Clock className="h-3 w-3" /> {timeAgo(bm.last_synced_at)}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}

        {filteredBms.length === 0 && query && (
          <div className="text-center text-xs text-muted-foreground py-6 px-2">
            Nenhuma BM encontrada para "{query}"
          </div>
        )}

        {!query && orphanCount > 0 && (
          <button
            onClick={() => onSelect("none")}
            className={cn(
              "w-full text-left rounded-lg border px-3 py-2.5 transition-all flex items-start gap-2.5",
              selected === "none"
                ? "border-primary bg-primary/10 shadow-[0_0_18px_-10px_hsl(var(--primary)/0.8)]"
                : "border-dashed border-border bg-card/40 hover:border-primary/50 hover:bg-card",
            )}
          >
            <AlertCircle className={cn(
              "h-4 w-4 mt-0.5 shrink-0",
              selected === "none" ? "text-primary" : "text-muted-foreground"
            )} />
            <div className="min-w-0 flex-1">
              <div className={cn(
                "text-sm font-medium",
                selected === "none" ? "text-primary" : "text-foreground"
              )}>
                Sem BM
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {orphanCount} contas órfãs
              </div>
            </div>
          </button>
        )}
      </div>
    </Card>
  );
}
