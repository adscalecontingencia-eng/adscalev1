import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Ban, ShieldCheck, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgencyAccount, accountState, healthOf, toneClass } from './agency-accounts';

const usd = (n: any) => `US$ ${Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  accounts: AgencyAccount[];
  ownerOf?: (id: string) => string | null;
  renderAction?: (a: AgencyAccount) => React.ReactNode;
}

export const AgencyAccountsTable: React.FC<Props> = ({ accounts, ownerOf, renderAction }) => {
  if (!accounts.length) return <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma conta de anúncio por aqui ainda.</p>;
  return (
    <div className="grid gap-3">
      {accounts.map(a => {
        const st = accountState(a.account_status);
        const h = healthOf(a);
        const Icon = st.tone === 'ok' ? ShieldCheck : st.tone === 'bad' ? Ban : AlertTriangle;
        const owner = ownerOf?.(a.id);
        return (
          <div key={a.id} className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center border', toneClass[st.tone])}><Icon size={18} /></div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{a.name}</p>
                <p className="text-[11px] font-mono text-muted-foreground">ID: {a.meta_account_id}{owner !== undefined && <> · <span className="font-sans">{owner ?? 'Sem cliente'}</span></>}</p>
              </div>
              <span className={cn('text-[11px] px-2 py-1 rounded-md border font-medium', toneClass[st.tone])}>{st.label}</span>
              {renderAction?.(a)}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              <Stat label="Gasto na semana" value={usd(a.week_spend)} />
              <Stat label="Gasto total" value={usd(a.amount_spent)} />
              <Stat label="Saldo" value={usd(a.balance)} />
              <Stat label="Limite de gasto" value={Number(a.spend_cap) > 0 ? usd(a.spend_cap) : 'Sem limite'} />
              <div className="rounded-lg bg-background/40 border border-border/60 p-2">
                <p className="text-muted-foreground">Saúde</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden"><div className={cn('h-full', h.tone === 'ok' ? 'bg-primary' : h.tone === 'warn' ? 'bg-accent' : 'bg-destructive')} style={{ width: `${h.score}%` }} /></div>
                  <span className="font-semibold">{h.score}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{h.label}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 text-[10px] text-muted-foreground">
              {a.currency && <span>Moeda: {a.currency}</span>}
              {a.disable_reason_label && a.disable_reason_label !== 'Nenhum' && <span className="text-destructive">Motivo do bloqueio: {a.disable_reason_label}</span>}
              {a.last_synced_at && <span>Atualizada {formatDistanceToNow(new Date(a.last_synced_at), { addSuffix: true, locale: ptBR })}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg bg-background/40 border border-border/60 p-2"><p className="text-muted-foreground">{label}</p><p className="font-semibold mt-1">{value}</p></div>
);
