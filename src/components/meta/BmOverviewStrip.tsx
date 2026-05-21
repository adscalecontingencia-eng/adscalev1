import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, ShieldCheck, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BM {
  id: string; name: string; verification_status: string | null;
  last_synced_at: string | null;
}
interface Account { id: string; bm_id: string | null; status: string | null; score: number | null; }

interface Props {
  bms: BM[];
  accounts: Account[];
  activeBmId: string;
  onPick: (bmId: string) => void;
}

export default function BmOverviewStrip({ bms, accounts, activeBmId, onPick }: Props) {
  if (!bms.length) return null;

  const stats = bms.map((bm) => {
    const accs = accounts.filter((a) => a.bm_id === bm.id);
    const blocked = accs.filter((a) => a.status !== "active").length;
    const avg = accs.length
      ? Math.round(accs.reduce((s, a) => s + (a.score || 0), 0) / accs.length)
      : 0;
    return { bm, total: accs.length, blocked, avg };
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-display font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Business Managers
        </h3>
        {activeBmId !== "all" && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onPick("all")}>
            Limpar seleção
          </Button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {stats.map(({ bm, total, blocked, avg }) => {
          const active = activeBmId === bm.id;
          const scoreTone =
            avg >= 70 ? "text-primary" : avg >= 50 ? "text-yellow-400" : "text-destructive";
          return (
            <Card
              key={bm.id}
              onClick={() => onPick(active ? "all" : bm.id)}
              className={cn(
                "min-w-[240px] p-3 cursor-pointer transition-all hover:border-primary/60",
                active && "border-primary shadow-[0_0_20px_-10px_hsl(var(--primary)/0.7)]"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">{bm.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {bm.last_synced_at
                      ? `Sync há ${formatDistanceToNowStrict(new Date(bm.last_synced_at), { locale: ptBR })}`
                      : "Sem sync"}
                  </div>
                </div>
                <ChevronRight className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div className="flex gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Contas</div>
                    <div className="text-base font-display font-bold text-foreground">{total}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Bloq.</div>
                    <div className={cn("text-base font-display font-bold", blocked > 0 ? "text-destructive" : "text-foreground")}>
                      {blocked}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Score</div>
                    <div className={cn("text-base font-display font-bold", scoreTone)}>{avg}</div>
                  </div>
                </div>
                {bm.verification_status === "verified" && (
                  <Badge variant="outline" className="gap-1 text-[10px] border-primary/40 text-primary">
                    <ShieldCheck className="h-3 w-3" /> Verificada
                  </Badge>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
