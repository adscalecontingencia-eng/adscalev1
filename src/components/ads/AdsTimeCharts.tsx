import { useState } from "react";
import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { format, startOfWeek } from "date-fns";
import { parseDateLocal } from "@/lib/date-utils";

interface DailyRow {
  date: string; // YYYY-MM-DD
  spend: number;
  revenue: number;
  profit: number;
  roas: number;
}

interface Props {
  daily: DailyRow[];
}

const fmtUSD = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function aggregateWeekly(daily: DailyRow[]): DailyRow[] {
  const map = new Map<string, { spend: number; revenue: number }>();
  daily.forEach((d) => {
    const ws = startOfWeek(parseDateLocal(d.date), { weekStartsOn: 4 });
    const key = format(ws, "yyyy-MM-dd");
    const cur = map.get(key) || { spend: 0, revenue: 0 };
    cur.spend += d.spend;
    cur.revenue += d.revenue;
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
}

export default function AdsTimeCharts({ daily }: Props) {
  const [granularity, setGranularity] = useState<"daily" | "weekly">("daily");
  const data = granularity === "weekly" ? aggregateWeekly(daily) : daily;
  const formatTick = (d: string) => {
    try {
      return format(parseDateLocal(d), granularity === "weekly" ? "dd/MM" : "dd/MM");
    } catch { return d; }
  };

  if (daily.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-display font-semibold text-foreground/90 uppercase tracking-wider">
          Evolução temporal
        </h2>
        <div className="flex gap-1">
          <Button size="sm" variant={granularity === "daily" ? "default" : "outline"} className="h-7" onClick={() => setGranularity("daily")}>Diário</Button>
          <Button size="sm" variant={granularity === "weekly" ? "default" : "outline"} className="h-7" onClick={() => setGranularity("weekly")}>Semanal</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Gasto · Faturamento · Lucro</span>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmtUSD(v)} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(l) => formatTick(l as string)}
                  formatter={(v: any, name: string) => [fmtUSD(Number(v)), name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="revenue" name="Faturamento" stroke="hsl(var(--primary))" fill="url(#gRev)" strokeWidth={2} />
                <Area type="monotone" dataKey="spend" name="Gasto" stroke="hsl(var(--destructive))" fill="url(#gSpend)" strokeWidth={2} />
                <Line type="monotone" dataKey="profit" name="Lucro" stroke="hsl(var(--foreground))" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">ROAS</span>
            <span className="text-[10px] text-muted-foreground">Referência: 1.0x (breakeven)</span>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${Number(v).toFixed(1)}x`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(l) => formatTick(l as string)}
                  formatter={(v: any) => [`${Number(v).toFixed(2)}x`, "ROAS"]}
                />
                <ReferenceLine y={1} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="roas" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
