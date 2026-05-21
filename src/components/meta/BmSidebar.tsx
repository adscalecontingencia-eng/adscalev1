import { Card } from "@/components/ui/card";
import { Building2, ShieldAlert, Layers, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface BM {
  id: string; name: string; status: string | null;
  last_synced_at: string | null;
}
interface Account { id: string; bm_id: string | null; status: string | null; }

interface Props {
  bms: BM[];
  accounts: Account[];
  selected: string; // bmId | "all" | "none"
  onSelect: (v: string) => void;
}

export default function BmSidebar({ bms, accounts, selected, onSelect }: Props) {
  const totalAccounts = accounts.length;
  const totalBlocked = accounts.filter((a) => a.status !== "active").length;
  const orphanCount = accounts.filter((a) => !a.bm_id).length;

  const Item = ({
    active, onClick, icon: Icon, title, count, blocked, tone = "default",
  }: {
    active: boolean; onClick: () => void; icon: any; title: string;
    count: number; blocked?: number; tone?: "default" | "muted";
  }) => (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border px-3 py-2.5 transition-all flex items-start gap-2.5 group",
        active
          ? "border-primary bg-primary/10 shadow-[0_0_18px_-10px_hsl(var(--primary)/0.8)]"
          : "border-border bg-card/40 hover:border-primary/50 hover:bg-card",
      )}
    >
      <Icon className={cn(
        "h-4 w-4 mt-0.5 shrink-0",
        active ? "text-primary" : tone === "muted" ? "text-muted-foreground" : "text-foreground/70"
      )} />
      <div className="min-w-0 flex-1">
        <div className={cn(
          "text-sm font-medium truncate",
          active ? "text-primary" : "text-foreground"
        )}>
          {title}
        </div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
          <span>{count} {count === 1 ? "conta" : "contas"}</span>
          {blocked !== undefined && blocked > 0 && (
            <span className="inline-flex items-center gap-0.5 text-destructive">
              <ShieldAlert className="h-3 w-3" /> {blocked}
            </span>
          )}
        </div>
      </div>
    </button>
  );

  return (
    <Card className="p-2.5 space-y-1.5 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <div className="px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
        Business Managers
      </div>
      <Item
        active={selected === "all"}
        onClick={() => onSelect("all")}
        icon={Layers}
        title="Todas as BMs"
        count={totalAccounts}
        blocked={totalBlocked}
      />
      {bms.map((bm) => {
        const bmAccs = accounts.filter((a) => a.bm_id === bm.id);
        const bmBlocked = bmAccs.filter((a) => a.status !== "active").length;
        return (
          <Item
            key={bm.id}
            active={selected === bm.id}
            onClick={() => onSelect(bm.id)}
            icon={Building2}
            title={bm.name}
            count={bmAccs.length}
            blocked={bmBlocked}
          />
        );
      })}
      {orphanCount > 0 && (
        <Item
          active={selected === "none"}
          onClick={() => onSelect("none")}
          icon={AlertCircle}
          title="Sem BM"
          count={orphanCount}
          tone="muted"
        />
      )}
    </Card>
  );
}
