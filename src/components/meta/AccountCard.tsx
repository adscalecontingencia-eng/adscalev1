import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CheckCircle2, AlertOctagon, Clock, Wallet, CreditCard, Globe, Eye, Building2, ExternalLink, BadgeCheck, Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { scoreColor, scoreBadgeVariant } from "@/lib/meta-score";
import ClientPicker from "./ClientPicker";

export interface AccountCardData {
  id: string;
  meta_account_id: string;
  name: string;
  bm_id: string | null;
  status: string | null;
  disable_reason_label: string | null;
  disable_reason: number | null;
  score: number | null;
  score_label: string | null;
  currency: string | null;
  amount_spent: number | null;
  balance: number | null;
  age: number | null;
  funding_source: string | null;
  business_country_code: string | null;
  owner_business_id?: string | null;
  owner_business_name?: string | null;
  shared_with_businesses?: { id: string; name: string; verification_status?: string | null }[] | null;
}

interface Client { id: string; name: string; email: string }

interface Props {
  account: AccountCardData;
  bmName: string;
  bmVerified?: boolean;
  clients: Client[];
  currentClientId: string | null;
  onAssign: (clientId: string | null) => Promise<void> | void;
  onOpenDetail: () => void;
}

export default function AccountCard({ account, bmName, bmVerified, clients, currentClientId, onAssign, onOpenDetail }: Props) {
  const isActive = account.status === "active";
  const score = account.score ?? 0;
  const noFunding = !account.funding_source;
  const balance = Number(account.balance || 0);
  const spend = Number(account.amount_spent || 0);
  const age = Number(account.age || 0);

  const ageTone =
    age >= 180 ? "text-primary" : age >= 30 ? "text-yellow-400" : "text-destructive";

  const borderTone = !isActive
    ? "border-l-destructive"
    : !currentClientId
      ? "border-l-yellow-500"
      : "border-l-primary";

  return (
    <Card className={cn("p-4 border-l-4 transition-colors hover:border-primary/40", borderTone)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-display font-bold text-foreground truncate">{account.name}</h3>
            <Badge variant="outline" className="text-[10px] font-mono">{account.meta_account_id}</Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <Building2 className="h-3 w-3" />
            <span>{bmName}</span>
            {bmVerified && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                  </TooltipTrigger>
                  <TooltipContent>BM verificada</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {Array.isArray(account.shared_with_businesses) && account.shared_with_businesses.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {account.shared_with_businesses.map((b) => (
                <Badge key={b.id} variant="outline" className="gap-1 text-[10px] border-primary/40 text-primary bg-primary/5">
                  <Share2 className="h-3 w-3" />
                  Compartilhada com: {b.name}
                  <span className="font-mono opacity-70">({b.id})</span>
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {isActive ? (
            <Badge className="gap-1 bg-primary/15 text-primary border-primary/40 hover:bg-primary/20">
              <CheckCircle2 className="h-3 w-3" /> Ativa
            </Badge>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="destructive" className="gap-1 cursor-help">
                    <AlertOctagon className="h-3 w-3" />
                    {account.disable_reason_label || "Bloqueada"}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Motivo: {account.disable_reason_label || "Não informado"}
                  {account.disable_reason ? ` (cód. ${account.disable_reason})` : ""}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Score</span>
            <span className={cn("font-display font-bold text-sm", scoreColor(score))}>{score}</span>
            <Badge variant={scoreBadgeVariant(account.score_label)} className="text-[9px] h-4 px-1.5">
              {account.score_label || "—"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs">
        <Meta icon={Wallet} label="Gasto" value={`${account.currency || "USD"} ${spend.toFixed(2)}`} />
        <Meta
          icon={CreditCard}
          label="Saldo"
          value={`${account.currency || "USD"} ${balance.toFixed(2)}`}
          tone={balance === 0 && noFunding ? "danger" : undefined}
        />
        <Meta
          icon={CreditCard}
          label="Pagamento"
          value={account.funding_source ? "Vinculado" : "Sem pagamento"}
          tone={noFunding ? "warn" : "ok"}
        />
        <Meta icon={Clock} label="Idade" value={age ? `${age}d` : "Nova"} tone={ageTone === "text-primary" ? "ok" : ageTone === "text-yellow-400" ? "warn" : "danger"} />
        {account.business_country_code && (
          <Meta icon={Globe} label="País" value={account.business_country_code} />
        )}
      </div>

      {/* Assignment + actions */}
      <div className="grid sm:grid-cols-[1fr_auto] gap-2 mt-3 items-center">
        <ClientPicker
          clients={clients}
          currentClientId={currentClientId}
          onAssign={onAssign}
        />
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={onOpenDetail}>
            <Eye className="h-3.5 w-3.5" /> Detalhes
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9 w-9 p-0"
            asChild
            title="Abrir no Meta Business Manager"
          >
            <a
              href={`https://business.facebook.com/adsmanager/manage/accounts?act=${account.meta_account_id}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir no Meta"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Meta({ icon: Icon, label, value, tone }: {
  icon: any; label: string; value: string; tone?: "ok" | "warn" | "danger";
}) {
  const color = tone === "danger" ? "text-destructive"
    : tone === "warn" ? "text-yellow-400"
    : tone === "ok" ? "text-primary"
    : "text-foreground";
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn("font-medium", color)}>{value}</span>
    </span>
  );
}
