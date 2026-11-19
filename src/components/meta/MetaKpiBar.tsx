import { Card } from "@/components/ui/card";
import { tr } from '@/i18n';
import { Server, ShieldAlert, Link2, UserX } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  active: number; total: number; blocked: number; assigned: number; unassigned: number;
}

function Mini({ label, value, sub, icon: Icon, tone }: {
  label: string; value: number; sub?: string; icon: any;
  tone: "primary" | "danger" | "info" | "warn" | "muted";
}) {
  const text = {
    primary: "text-primary", danger: "text-destructive",
    info: "text-blue-400", warn: "text-yellow-400", muted: "text-foreground",
  }[tone];
  const border = {
    primary: "border-primary/40", danger: "border-destructive/40",
    info: "border-blue-500/30", warn: "border-yellow-500/30", muted: "",
  }[tone];
  return (
    <Card className={cn("p-3 flex items-center gap-3", border)}>
      <Icon className={cn("h-5 w-5 shrink-0", text)} />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">{label}</div>
        <div className={cn("text-xl font-display font-bold leading-tight", text)}>{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground leading-none">{sub}</div>}
      </div>
    </Card>
  );
}

export default function MetaKpiBar({ active, total, blocked, assigned, unassigned }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
      <Mini label={tr('meta.kpi.active')} value={active} sub={tr('meta.kpi.ofTotal', { n: total })} icon={Server} tone="primary" />
      <Mini label={tr('meta.kpi.blocked')} value={blocked} sub={blocked ? tr('meta.kpi.attention') : tr('meta.kpi.allOk')} icon={ShieldAlert} tone={blocked > 0 ? "danger" : "muted"} />
      <Mini label={tr('meta.kpi.assigned')} value={assigned} sub={tr('meta.kpi.pctTotal', { pct: total ? Math.round((assigned/total)*100) : 0 })} icon={Link2} tone="info" />
      <Mini label={tr('meta.kpi.noClient')} value={unassigned} sub={unassigned ? tr('meta.kpi.assign') : tr('meta.kpi.allAssigned')} icon={UserX} tone={unassigned > 0 ? "warn" : "muted"} />
    </div>
  );
}
