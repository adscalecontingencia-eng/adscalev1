import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, User, UserPlus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Client { id: string; name: string; email: string; company_name?: string | null }

interface Props {
  clients: Client[];
  currentClientId: string | null;
  onAssign: (clientId: string | null) => Promise<void> | void;
}

export default function ClientPicker({ clients, currentClientId, onAssign }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const current = clients.find((c) => c.id === currentClientId) || null;

  const handle = async (id: string | null) => {
    setBusy(true);
    try { await onAssign(id); } finally { setBusy(false); setOpen(false); }
  };

  return (
    <div className={cn(
      "flex items-center gap-2 rounded-lg border p-2 transition-colors",
      current ? "border-primary/30 bg-primary/5" : "border-yellow-500/30 bg-yellow-500/5"
    )}>
      <div className={cn(
        "h-7 w-7 rounded-full flex items-center justify-center shrink-0",
        current ? "bg-primary/15 text-primary" : "bg-yellow-500/15 text-yellow-400"
      )}>
        {current ? <User className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">
          {current?.company_name ? "Empresa · Cliente" : "Cliente"}
        </div>
        <div className={cn(
          "text-sm font-medium truncate leading-tight mt-0.5",
          current ? "text-foreground" : "text-yellow-400"
        )}>
          {current
            ? (current.company_name ? `${current.company_name} · ${current.name}` : current.name)
            : "Não atribuída"}
        </div>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant={current ? "outline" : "default"} className="h-8 gap-1" disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
            {current ? "Trocar" : "Atribuir"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="end">
          <Command>
            <CommandInput placeholder="Buscar cliente..." />
            <CommandList>
              <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
              <CommandGroup>
                {clients.map((c) => (
                  <CommandItem key={c.id} value={`${c.name} ${c.email} ${c.company_name || ''}`} onSelect={() => handle(c.id)}>
                    <Check className={cn("mr-2 h-3.5 w-3.5", currentClientId === c.id ? "opacity-100 text-primary" : "opacity-0")} />
                    <div className="min-w-0">
                      {c.company_name && (
                        <div className="text-[10px] uppercase tracking-wider text-primary/80 truncate">{c.company_name}</div>
                      )}
                      <div className="text-sm truncate">{c.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{c.email}</div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              {current && (
                <CommandGroup>
                  <CommandItem onSelect={() => handle(null)} className="text-destructive">
                    <X className="mr-2 h-3.5 w-3.5" /> Remover atribuição
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
