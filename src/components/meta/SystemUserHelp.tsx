import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Shield, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function SystemUserHelp() {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs flex items-center gap-2 hover:bg-primary/10 transition-colors">
        <Shield className="h-3.5 w-3.5 text-primary" />
        <span className="text-primary font-medium">Conta de outra BM não aparece na sync?</span>
        <ChevronDown className={cn("h-3.5 w-3.5 ml-auto text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-b-lg border-x border-b border-primary/30 bg-primary/5 px-4 py-3 text-xs text-muted-foreground leading-relaxed -mt-px">
          Para uma conta de anúncio aparecer aqui, o <span className="text-foreground font-medium">System User</span> da BM dona do app precisa estar atribuído a ela.
          Na BM externa: <span className="text-foreground">Business Settings → Ad Accounts → Add → Request Access</span> (ou a BM dona compartilha via <span className="text-foreground">Assign Partner</span> com o ID da sua BM).
          Depois, na sua BM: <span className="text-foreground">Users → System Users → [seu user] → Add Assets → Ad Accounts</span>, selecione as contas e marque a permissão (mínimo <span className="text-foreground">View Performance</span>, ideal <span className="text-foreground">Manage Campaigns</span>). Sem isso o token ignora a conta.
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
