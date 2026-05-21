import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Server, ShieldAlert, Link2, Gauge, Building2, Users, CreditCard, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  loading?: boolean;
  bms: number;
  accountsTotal: number;
  accountsActive: number;
  blocked: number;
  assigned: number;
  unassigned: number;
  withoutPayment: number;
  avgScore: number;
  lastSyncAt?: Date | null;
}

function PrimaryCard({
  label, value, sub, icon: Icon, tone,
}: { label: string; value: string; sub?: string; icon: any; tone: "primary" | "danger" | "info" | "warn" }) {
  const toneRing = {
    primary: "border-primary/40 shadow-[0_0_30px_-15px_hsl(var(--primary)/0.6)]",
    danger: "border-destructive/40",
    info: "border-blue-500/40",
    warn: "border-yellow-500/40",
  }[tone];
  const toneText = {
    primary: "text-primary glow-text",
    danger: "text-destructive",
    info: "text-blue-400",
    warn: "text-yellow-400",
  }[tone];
  return (
    <Card className={cn("relative overflow-hidden p-5", toneRing)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className={cn("text-3xl font-display font-bold leading-none", toneText)}>{value}</div>
          {sub && <div className="text-xs text-muted-foreground pt-1">{sub}</div>}
        </div>
        <Icon className={cn("h-5 w-5 opacity-70", toneText)} />
      </div>
    </Card>
  );
}

export default function MetaKpiHero(p: Props) {
  if (p.loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[108px]" />)}
        </div>
        <Skeleton className="h-12" />
      </div>
    );
  }

  const activePct = p.accountsTotal ? Math.round((p.accountsActive / p.accountsTotal) * 100) : 0;
  const blockedPct = p.accountsTotal ? Math.round((p.blocked / p.accountsTotal) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PrimaryCard
          label="Contas Ativas"
          value={String(p.accountsActive)}
          sub={`${activePct}% de ${p.accountsTotal} totais`}
          icon={Server}
          tone="primary"
        />
        <PrimaryCard
          label="Bloqueadas"
          value={String(p.blocked)}
          sub={`${blockedPct}% das contas`}
          icon={ShieldAlert}
          tone={p.blocked > 0 ? "danger" : "info"}
        />
        <PrimaryCard
          label="Atribuídas"
          value={String(p.assigned)}
          sub={`${p.unassigned} sem cliente`}
          icon={Link2}
          tone="info"
        />
        <PrimaryCard
          label="Score Médio"
          value={String(p.avgScore)}
          sub={p.avgScore >= 70 ? "Saudável" : p.avgScore >= 50 ? "Atenção" : "Crítico"}
          icon={Gauge}
          tone={p.avgScore >= 70 ? "primary" : p.avgScore >= 50 ? "warn" : "danger"}
        />
      </div>

      <Card className="px-4 py-2.5 flex flex-wrap gap-x-5 gap-y-2 items-center text-xs">
        <Chip icon={Building2} label="BMs" value={p.bms} />
        <Chip icon={Server} label="Contas totais" value={p.accountsTotal} />
        <Chip icon={Users} label="Sem cliente" value={p.unassigned} tone={p.unassigned > 0 ? "warn" : undefined} />
        <Chip icon={CreditCard} label="Sem pagamento" value={p.withoutPayment} tone={p.withoutPayment > 0 ? "warn" : undefined} />
        <div className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5" />
          {p.lastSyncAt
            ? <>Última sync · há {formatDistanceToNowStrict(p.lastSyncAt, { locale: ptBR })}</>
            : "Nenhuma sincronização registrada"}
          {p.lastSyncAt && (Date.now() - p.lastSyncAt.getTime()) > 6 * 3600 * 1000 && (
            <Badge variant="secondary" className="ml-1 bg-yellow-500/15 text-yellow-400 border-yellow-500/30">stale</Badge>
          )}
        </div>
      </Card>
    </div>
  );
}

function Chip({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone?: "warn" }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className={cn("h-3.5 w-3.5", tone === "warn" ? "text-yellow-400" : "text-muted-foreground")} />
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn("font-semibold", tone === "warn" ? "text-yellow-400" : "text-foreground")}>{value}</span>
    </span>
  );
}
