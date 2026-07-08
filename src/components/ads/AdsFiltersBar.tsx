import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  RefreshCw, BarChart3, Users, X, Search, CalendarIcon, Building2, ShieldCheck,
} from "lucide-react";
import MetaApiHealthDialog from "./MetaApiHealthDialog";

export type AdsRange = "today" | "yesterday" | "billing_week" | "7d" | "30d" | "90d" | "custom";
export type AccountStatus = "all" | "active" | "blocked";

interface BM { id: string; name: string }
interface Account { id: string; name: string; bm_id: string | null; status?: string | null }
interface Client { id: string; name: string }

interface Props {
  range: AdsRange;
  onRangeChange: (r: AdsRange) => void;
  customStart?: Date;
  customEnd?: Date;
  onCustomChange: (start?: Date, end?: Date) => void;

  bms: BM[];
  accounts: Account[];
  clients: Client[];

  filterBm: string;
  onFilterBmChange: (v: string) => void;
  filterClients: string[];
  onFilterClientsChange: (v: string[]) => void;
  filterAccounts: string[];
  onFilterAccountsChange: (v: string[]) => void;
  statusFilter: AccountStatus;
  onStatusFilterChange: (v: AccountStatus) => void;

  lastSyncAt?: Date | null;
  syncing: boolean;
  onSync: () => void;
  syncScope: SyncScope;
  onSyncScopeChange: (v: SyncScope) => void;
  activeAccountsCount: number;
}

export type SyncScope = "active" | "recent_spenders";

const RANGES: { key: AdsRange; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "billing_week", label: "Última semana fechada" },
  { key: "7d", label: "7 dias corridos" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "custom", label: "Custom" },
];

export default function AdsFiltersBar(props: Props) {
  const {
    range, onRangeChange, customStart, customEnd, onCustomChange,
    bms, accounts, clients,
    filterBm, onFilterBmChange,
    filterClients, onFilterClientsChange,
    filterAccounts, onFilterAccountsChange,
    statusFilter, onStatusFilterChange,
    lastSyncAt, syncing, onSync, activeAccountsCount,
  } = props;

  const [clientSearch, setClientSearch] = useState("");
  const [accountSearch, setAccountSearch] = useState("");

  const accountOptions = accounts.filter((a) => filterBm === "all" || a.bm_id === filterBm);

  const syncChip = (
    <button
      onClick={onSync}
      disabled={syncing}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
        "bg-secondary/60 border-border hover:border-primary/60 hover:text-primary disabled:opacity-60",
      )}
    >
      <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin text-primary")} />
      {syncing ? "Sincronizando..." : lastSyncAt
        ? `Sync · há ${formatDistanceToNowStrict(lastSyncAt, { locale: ptBR })}`
        : "Sincronizar"}
    </button>
  );

  return (
    <Card className="p-4 space-y-3">
      {/* Row 1: período + sync */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <Button
              key={r.key}
              size="sm"
              variant={range === r.key ? "default" : "outline"}
              onClick={() => onRangeChange(r.key)}
              className="h-8"
            >
              {r.label}
            </Button>
          ))}
          {range === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2 font-normal">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {customStart && customEnd
                    ? `${format(customStart, "dd/MM")} → ${format(customEnd, "dd/MM")}`
                    : "Selecionar datas"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: customStart, to: customEnd }}
                  onSelect={(r: any) => onCustomChange(r?.from, r?.to)}
                  numberOfMonths={2}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden md:inline">
            {activeAccountsCount} conta(s) ativa(s)
          </span>
          <MetaApiHealthDialog />
          {syncChip}
        </div>
      </div>

      {/* Row 2: filtros */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterBm} onValueChange={(v) => { onFilterBmChange(v); onFilterAccountsChange([]); }}>
          <SelectTrigger className="w-[200px] h-9">
            <Building2 className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Todas as BMs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as BMs</SelectItem>
            {bms.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Clientes */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-9 w-[220px] justify-between font-normal">
              <span className="flex items-center gap-2 truncate">
                <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {filterClients.length === 0
                  ? "Todos clientes"
                  : filterClients.length === 1
                    ? (filterClients[0] === "__unassigned__"
                        ? "Sem cliente"
                        : clients.find((c) => c.id === filterClients[0])?.name || "1 cliente")
                    : `${filterClients.length} clientes`}
              </span>
              {filterClients.length > 0 && (
                <X
                  className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); onFilterClientsChange([]); }}
                />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-7 h-8 text-xs"
                  placeholder="Buscar cliente..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between px-3 py-2 border-b border-border text-xs">
              <button className="text-primary hover:underline" onClick={() => onFilterClientsChange(clients.map((c) => c.id))}>Selecionar todos</button>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => onFilterClientsChange([])}>Limpar</button>
            </div>
            <div className="max-h-[260px] overflow-y-auto p-1">
              <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary cursor-pointer text-sm">
                <Checkbox
                  checked={filterClients.includes("__unassigned__")}
                  onCheckedChange={(v) => onFilterClientsChange(
                    v ? [...filterClients, "__unassigned__"] : filterClients.filter((x) => x !== "__unassigned__")
                  )}
                />
                <span className="italic text-muted-foreground">— Sem cliente —</span>
              </label>
              {clients
                .filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                .map((c) => (
                  <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary cursor-pointer text-sm">
                    <Checkbox
                      checked={filterClients.includes(c.id)}
                      onCheckedChange={(v) => onFilterClientsChange(
                        v ? [...filterClients, c.id] : filterClients.filter((x) => x !== c.id)
                      )}
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Contas */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-9 w-[220px] justify-between font-normal">
              <span className="flex items-center gap-2 truncate">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {filterAccounts.length === 0
                  ? "Todas as contas"
                  : filterAccounts.length === 1
                    ? (accounts.find((a) => a.id === filterAccounts[0])?.name || "1 conta")
                    : `${filterAccounts.length} contas`}
              </span>
              {filterAccounts.length > 0 && (
                <X
                  className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); onFilterAccountsChange([]); }}
                />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-7 h-8 text-xs"
                  placeholder="Buscar conta..."
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between px-3 py-2 border-b border-border text-xs">
              <button className="text-primary hover:underline" onClick={() => onFilterAccountsChange(accountOptions.map((a) => a.id))}>Selecionar todos</button>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => onFilterAccountsChange([])}>Limpar</button>
            </div>
            <div className="max-h-[260px] overflow-y-auto p-1">
              {accountOptions
                .filter((a) => a.name.toLowerCase().includes(accountSearch.toLowerCase()))
                .map((a) => (
                  <label key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary cursor-pointer text-sm">
                    <Checkbox
                      checked={filterAccounts.includes(a.id)}
                      onCheckedChange={(v) => onFilterAccountsChange(
                        v ? [...filterAccounts, a.id] : filterAccounts.filter((x) => x !== a.id)
                      )}
                    />
                    <span className="truncate">{a.name}</span>
                  </label>
                ))}
            </div>
          </PopoverContent>
        </Popover>

        <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as AccountStatus)}>
          <SelectTrigger className="w-[160px] h-9">
            <ShieldCheck className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="blocked">Bloqueadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Chips ativos */}
      {(filterClients.length > 0 || filterAccounts.length > 0) && (
        <div className="flex flex-wrap gap-1 items-center pt-1">
          {filterClients.slice(0, 4).map((cid) => (
            <Badge key={cid} variant="secondary" className="gap-1">
              {cid === "__unassigned__" ? "Sem cliente" : clients.find((c) => c.id === cid)?.name || cid}
              <X className="h-3 w-3 cursor-pointer" onClick={() => onFilterClientsChange(filterClients.filter((x) => x !== cid))} />
            </Badge>
          ))}
          {filterClients.length > 4 && <Badge variant="outline">+{filterClients.length - 4}</Badge>}
          {filterAccounts.slice(0, 3).map((aid) => (
            <Badge key={aid} variant="secondary" className="gap-1">
              {accounts.find((a) => a.id === aid)?.name || aid}
              <X className="h-3 w-3 cursor-pointer" onClick={() => onFilterAccountsChange(filterAccounts.filter((x) => x !== aid))} />
            </Badge>
          ))}
          {filterAccounts.length > 3 && <Badge variant="outline">+{filterAccounts.length - 3}</Badge>}
        </div>
      )}
    </Card>
  );
}
