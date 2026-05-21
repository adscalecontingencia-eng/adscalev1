import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  TrendingUp, DollarSign, Activity, ShoppingCart, Target, MousePointerClick, BarChart3,
  ArrowDownRight, ArrowUpRight,
} from "lucide-react";
import MiniSparkline from "./MiniSparkline";

export interface AdsMetrics {
  spend: number;
  revenue: number;
  profit: number;
  margin: number;
  roas: number;
  purchases: number;
  cpa: number;
  ctr: number;
  cpc: number;
  cpm: number;
  clicks: number;
  impressions: number;
}

interface Props {
  current: AdsMetrics;
  previous?: AdsMetrics | null;
  daily: { date: string; spend: number; revenue: number; profit: number; roas: number }[];
}

const fmtUSD = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const fmtNum = (v: number) => v.toLocaleString("pt-BR");
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

function delta(cur: number, prev?: number | null): { value: number; up: boolean } | null {
  if (prev == null || prev === 0) return null;
  const v = ((cur - prev) / Math.abs(prev)) * 100;
  return { value: v, up: v >= 0 };
}

function DeltaBadge({ d, invert = false }: { d: ReturnType<typeof delta>; invert?: boolean }) {
  if (!d) return null;
  const positive = invert ? !d.up : d.up;
  const color = positive ? "text-primary" : "text-destructive";
  const Icon = d.up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(d.value).toFixed(1)}%
    </span>
  );
}

function PrimaryCard({
  label, value, icon: Icon, sparkKey, daily, delta: d, invertDelta = false, accent = false, danger = false,
}: {
  label: string;
  value: string;
  icon: any;
  sparkKey: "spend" | "revenue" | "profit" | "roas";
  daily: Props["daily"];
  delta: ReturnType<typeof delta>;
  invertDelta?: boolean;
  accent?: boolean;
  danger?: boolean;
}) {
  const sparkData = daily.map((d) => ({ v: Number((d as any)[sparkKey] || 0) }));
  const color = danger
    ? "hsl(var(--destructive))"
    : accent
      ? "hsl(var(--primary))"
      : "hsl(var(--muted-foreground))";
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card
        className={`relative overflow-hidden p-4 backdrop-blur-md bg-gradient-to-br from-card via-card to-card/60 ${accent ? "border-primary/40" : danger ? "border-destructive/40" : "border-border"}`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${accent ? "text-primary" : danger ? "text-destructive" : "text-muted-foreground"}`} />
        </div>
        <div className={`text-2xl font-display font-bold ${accent ? "text-primary glow-text" : danger ? "text-destructive" : "text-foreground"}`}>
          {value}
        </div>
        <div className="flex items-center justify-between mt-1 min-h-[14px]">
          <DeltaBadge d={d} invert={invertDelta} />
          <span className="text-[10px] text-muted-foreground">vs período anterior</span>
        </div>
        <div className="mt-2 -mx-1">
          <MiniSparkline data={sparkData} color={color} height={36} />
        </div>
      </Card>
    </motion.div>
  );
}

function SecondaryCard({
  label, value, icon: Icon, delta: d, invertDelta = false,
}: {
  label: string;
  value: string;
  icon: any;
  delta: ReturnType<typeof delta>;
  invertDelta?: boolean;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="text-base font-display font-semibold text-foreground">{value}</div>
      <div className="mt-0.5 min-h-[14px]">
        <DeltaBadge d={d} invert={invertDelta} />
      </div>
    </Card>
  );
}

export default function AdsKpiHero({ current, previous, daily }: Props) {
  const d = (k: keyof AdsMetrics) => delta(current[k] as number, previous?.[k] as number | undefined);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PrimaryCard
          label="Faturamento"
          value={fmtUSD(current.revenue)}
          icon={TrendingUp}
          sparkKey="revenue"
          daily={daily}
          delta={d("revenue")}
          accent
        />
        <PrimaryCard
          label="Gasto Total"
          value={fmtUSD(current.spend)}
          icon={DollarSign}
          sparkKey="spend"
          daily={daily}
          delta={d("spend")}
          invertDelta
        />
        <PrimaryCard
          label="Lucro"
          value={fmtUSD(current.profit)}
          icon={DollarSign}
          sparkKey="profit"
          daily={daily}
          delta={d("profit")}
          accent={current.profit > 0}
          danger={current.profit < 0}
        />
        <PrimaryCard
          label="ROAS"
          value={`${current.roas.toFixed(2)}x`}
          icon={Activity}
          sparkKey="roas"
          daily={daily}
          delta={d("roas")}
          accent={current.roas >= 1}
          danger={current.roas > 0 && current.roas < 1}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <SecondaryCard label="Margem" value={fmtPct(current.margin)} icon={Activity} delta={d("margin")} />
        <SecondaryCard label="Compras" value={fmtNum(current.purchases)} icon={ShoppingCart} delta={d("purchases")} />
        <SecondaryCard label="CPA" value={fmtUSD(current.cpa)} icon={Target} delta={d("cpa")} invertDelta />
        <SecondaryCard label="CTR" value={fmtPct(current.ctr)} icon={Activity} delta={d("ctr")} />
        <SecondaryCard label="CPC" value={fmtUSD(current.cpc)} icon={DollarSign} delta={d("cpc")} invertDelta />
        <SecondaryCard label="CPM" value={fmtUSD(current.cpm)} icon={DollarSign} delta={d("cpm")} invertDelta />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground px-1">
        <span className="inline-flex items-center gap-1.5">
          <MousePointerClick className="h-3.5 w-3.5" />
          {fmtNum(current.clicks)} cliques
        </span>
        <span className="inline-flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5" />
          {fmtNum(current.impressions)} impressões
        </span>
      </div>
    </div>
  );
}
