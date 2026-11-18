import React from 'react';
import { tr } from '@/i18n';
import { Search, Plus, SlidersHorizontal, CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'custom';
export type TypeFilter = 'all' | 'aluguel' | 'venda';
export type StatusFilter = 'all' | 'em_dia' | 'pendente' | 'atrasado' | 'sem_gasto';
export type SortKey = 'saldo_desc' | 'recent' | 'az';

interface Props {
  search: string;
  setSearch: (s: string) => void;
  periodFilter: PeriodKey;
  setPeriodFilter: (k: PeriodKey) => void;
  customStart?: Date;
  setCustomStart: (d: Date | undefined) => void;
  customEnd?: Date;
  setCustomEnd: (d: Date | undefined) => void;
  typeFilter: TypeFilter;
  setTypeFilter: (t: TypeFilter) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  sort: SortKey;
  setSort: (s: SortKey) => void;
  shownCount: number;
  totalCount: number;
  onNewClient: () => void;
  onOpenTiers: () => void;
}

const inputClass =
  'w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors';

const Chip: React.FC<{
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}> = ({ active, onClick, children, title }) => (
  <button
    title={title}
    onClick={onClick}
    className={cn(
      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
      active
        ? 'bg-primary text-primary-foreground'
        : 'bg-secondary text-muted-foreground hover:text-foreground border border-border'
    )}
  >
    {children}
  </button>
);

const Group: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-1.5">
    <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground hidden md:inline">{label}</span>
    <div className="flex gap-1 flex-wrap">{children}</div>
  </div>
);

export const ClientFiltersBar: React.FC<Props> = (p) => {
  return (
    <div className="space-y-3">
      {/* Linha 1: busca + ações */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={p.search}
            onChange={(e) => p.setSearch(e.target.value)}
            placeholder={tr('admin.filters.search')}
            className={`${inputClass} pl-10`}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-[11px] text-muted-foreground whitespace-nowrap px-2">
            {p.shownCount} de {p.totalCount}
          </span>
          <button
            onClick={p.onOpenTiers}
            className="flex items-center gap-1.5 text-xs px-3 py-2.5 rounded-lg border border-border bg-secondary text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors whitespace-nowrap"
            title={tr('admin.filters.tiersTitle')}
          >
            <SlidersHorizontal size={13} /> {tr('admin.filters.tiers')}
          </button>
          <button
            onClick={p.onNewClient}
            className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 glow-box whitespace-nowrap"
          >
            <Plus size={16} /> {tr('admin.clients.newClient')}
          </button>
        </div>
      </div>

      {/* Linha 2: filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <Group label={tr('admin.filters.period')}>
          {([
            { key: 'today', label: tr('admin.filters.today') },
            { key: 'yesterday', label: tr('admin.filters.yesterday') },
            { key: 'week', label: tr('admin.filters.week') },
            { key: 'month', label: tr('admin.filters.month') },
            { key: 'custom', label: tr('admin.filters.custom') },
          ] as const).map((opt) => (
            <Chip key={opt.key} active={p.periodFilter === opt.key} onClick={() => p.setPeriodFilter(opt.key)}>
              {opt.label}
            </Chip>
          ))}
          {p.periodFilter === 'custom' && (
            <div className="flex items-center gap-1 ml-1">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-[11px] text-foreground flex items-center gap-1">
                    <CalendarIcon size={11} />
                    {p.customStart ? format(p.customStart, 'dd/MM/yyyy') : tr('admin.filters.start')}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={p.customStart}
                    onSelect={p.setCustomStart}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground text-[10px]">{tr('admin.filters.until')}</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-[11px] text-foreground flex items-center gap-1">
                    <CalendarIcon size={11} />
                    {p.customEnd ? format(p.customEnd, 'dd/MM/yyyy') : tr('admin.filters.end')}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={p.customEnd}
                    onSelect={p.setCustomEnd}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </Group>

        <div className="h-5 w-px bg-border hidden md:block" />

        <Group label={tr('admin.filters.type')}>
          <Chip active={p.typeFilter === 'all'} onClick={() => p.setTypeFilter('all')}>{tr('admin.filters.all')}</Chip>
          <Chip active={p.typeFilter === 'aluguel'} onClick={() => p.setTypeFilter('aluguel')}>{tr('admin.card.rental')}</Chip>
          <Chip active={p.typeFilter === 'venda'} onClick={() => p.setTypeFilter('venda')}>{tr('admin.card.sale')}</Chip>
        </Group>

        <div className="h-5 w-px bg-border hidden md:block" />

        <Group label={tr('admin.filters.status')}>
          <Chip active={p.statusFilter === 'all'} onClick={() => p.setStatusFilter('all')}>{tr('admin.filters.all')}</Chip>
          <Chip active={p.statusFilter === 'em_dia'} onClick={() => p.setStatusFilter('em_dia')}>{tr('admin.card.st.ok')}</Chip>
          <Chip active={p.statusFilter === 'pendente'} onClick={() => p.setStatusFilter('pendente')}>{tr('admin.card.st.pending')}</Chip>
          <Chip active={p.statusFilter === 'atrasado'} onClick={() => p.setStatusFilter('atrasado')}>{tr('admin.card.st.late')}</Chip>
          <Chip active={p.statusFilter === 'sem_gasto'} onClick={() => p.setStatusFilter('sem_gasto')}>{tr('admin.card.st.noSpend')}</Chip>
        </Group>

        <div className="h-5 w-px bg-border hidden md:block" />

        <Group label={tr('admin.filters.sort')}>
          <Chip active={p.sort === 'saldo_desc'} onClick={() => p.setSort('saldo_desc')}>{tr('admin.filters.highest')}</Chip>
          <Chip active={p.sort === 'recent'} onClick={() => p.setSort('recent')}>{tr('admin.filters.recent')}</Chip>
          <Chip active={p.sort === 'az'} onClick={() => p.setSort('az')}>A–Z</Chip>
        </Group>
      </div>
    </div>
  );
};

export default ClientFiltersBar;
