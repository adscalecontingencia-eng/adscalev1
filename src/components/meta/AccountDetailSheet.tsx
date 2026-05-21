import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { scoreColor, scoreBadgeVariant } from "@/lib/meta-score";
import { cn } from "@/lib/utils";
import type { AccountCardData } from "./AccountCard";

interface ExtendedAccount extends AccountCardData {
  account_created_time: string | null;
  timezone_name: string | null;
  spend_cap: number | null;
  billing_cycle: string | null;
  owner_business_name: string | null;
  account_status: number | null;
}

interface Props {
  account: ExtendedAccount | null;
  bmName: string;
  clientName: string | null;
  onClose: () => void;
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-3 py-2 border-b border-border/50 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground font-medium text-right">{value ?? "—"}</span>
  </div>
);

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const fmtMoney = (cur: string | null, v: number | null) =>
  v === null || v === undefined ? "—" : `${cur || "USD"} ${Number(v).toFixed(2)}`;

export default function AccountDetailSheet({ account, bmName, clientName, onClose }: Props) {
  if (!account) return null;
  const score = account.score ?? 0;

  return (
    <Sheet open={!!account} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="space-y-2">
          <SheetTitle className="flex items-center gap-2 flex-wrap pr-6">
            {account.name}
          </SheetTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {account.status === "active" ? (
              <Badge className="bg-primary/15 text-primary border-primary/40">Ativa</Badge>
            ) : (
              <Badge variant="destructive">{account.disable_reason_label || "Bloqueada"}</Badge>
            )}
            <Badge variant={scoreBadgeVariant(account.score_label)}>
              <span className={cn("font-display font-bold", scoreColor(score))}>{score}</span>
              <span className="ml-1">· {account.score_label || "—"}</span>
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">{account.meta_account_id}</p>
        </SheetHeader>

        <div className="mt-4 space-y-0.5">
          <Row label="Business Manager" value={bmName} />
          <Row label="Cliente atribuído" value={clientName || <span className="text-yellow-400">— Sem cliente —</span>} />
          <Row label="Status (código)" value={account.account_status} />
          <Row label="País" value={account.business_country_code} />
          <Row label="Moeda" value={account.currency} />
          <Row label="Fuso horário" value={account.timezone_name} />
          <Row label="Criada em" value={fmtDate(account.account_created_time)} />
          <Row label="Idade" value={account.age ? `${account.age} dias` : "—"} />
          <Row label="Owner" value={account.owner_business_name} />
          <Row label="Pagamento" value={account.funding_source || <span className="text-yellow-400">Sem método</span>} />
          <Row label="Ciclo de cobrança" value={account.billing_cycle} />
          <Row label="Saldo" value={fmtMoney(account.currency, account.balance)} />
          <Row label="Spend cap" value={fmtMoney(account.currency, account.spend_cap)} />
          <Row label="Total gasto" value={fmtMoney(account.currency, account.amount_spent)} />
        </div>

        <Button asChild className="w-full mt-5 gap-2">
          <a
            href={`https://business.facebook.com/adsmanager/manage/accounts?act=${account.meta_account_id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4" /> Abrir no Meta Business Manager
          </a>
        </Button>
      </SheetContent>
    </Sheet>
  );
}
