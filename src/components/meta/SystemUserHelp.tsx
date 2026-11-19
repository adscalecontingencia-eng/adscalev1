import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { tr } from '@/i18n';
import { Shield, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function SystemUserHelp() {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs flex items-center gap-2 hover:bg-primary/10 transition-colors">
        <Shield className="h-3.5 w-3.5 text-primary" />
        <span className="text-primary font-medium">{tr('meta.help.title')}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 ml-auto text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-b-lg border-x border-b border-primary/30 bg-primary/5 px-4 py-3 text-xs text-muted-foreground leading-relaxed -mt-px" dangerouslySetInnerHTML={{ __html: tr('meta.help.h1') }} />
      </CollapsibleContent>
    </Collapsible>
  );
}
