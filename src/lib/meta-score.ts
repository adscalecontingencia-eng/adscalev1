export const scoreColor = (score: number) =>
  score >= 80 ? "text-primary" : score >= 60 ? "text-blue-400" : score >= 40 ? "text-yellow-400" : "text-destructive";

export const scoreBadgeVariant = (label: string | null): "default" | "secondary" | "destructive" | "outline" => {
  if (!label) return "outline";
  if (label === "Crítico") return "destructive";
  if (label === "Atenção") return "secondary";
  return "default";
};
