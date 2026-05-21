import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface Props {
  data: { v: number }[];
  color?: string; // hsl var name without var()
  height?: number;
}

export default function MiniSparkline({ data, color = "hsl(var(--primary))", height = 40 }: Props) {
  if (!data || data.length === 0) {
    return <div style={{ height }} className="opacity-40" />;
  }
  const id = `spark-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.5} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${id})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
