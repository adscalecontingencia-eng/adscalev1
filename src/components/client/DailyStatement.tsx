import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Download, Lock, LockOpen, Clock, Info } from 'lucide-react';
import { format, subWeeks, addWeeks, formatDistanceToNow } from 'date-fns';
import { ptBR, enUS, es as esLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  buildWeekStatement,
  statementItems,
  statementToCSV,
  downloadCSV,
  StatementAccount,
  StatementInsight,
} from '@/lib/billing-statement';

interface Props {
  clientId: string;
  clientName: string;
  accounts: StatementAccount[];
  insights: StatementInsight[];
  basePct: number;
  getTierPct?: (weekSpend: number, basePct: number) => number;
  isAdmin?: boolean;
}

const fmtUSD = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const DailyStatement: React.FC<Props> = ({
  clientId,
  clientName,
  accounts,
  insights,
  basePct,
  getTierPct,
  isAdmin,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('en') ? enUS : i18n.language.startsWith('es') ? esLocale : ptBR;

  // Semana de referência: por padrão a última semana FECHADA (sexta → quinta).
  const [reference, setReference] = useState<Date>(() => subWeeks(new Date(), 1));
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const st = useMemo(
    () => buildWeekStatement({ reference, accounts, insights, basePct, getTierPct }),
    [reference, accounts, insights, basePct, getTierPct]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from('billing_week_snapshots')
        .select('*')
        .eq('client_id', clientId)
        .eq('week_start', st.weekStartISO)
        .maybeSingle();
      if (!cancelled) setSnapshot(data || null);
    })();
    return () => { cancelled = true; };
  }, [clientId, st.weekStartISO]);

  const isCurrentWeek = st.weekStartISO === buildWeekStatement({
    reference: new Date(), accounts: [], insights: [], basePct,
  }).weekStartISO;

  const frozenSpend = snapshot ? Number(snapshot.total_spend || 0) : null;
  const frozenCommission = snapshot ? Number(snapshot.commission_amount || 0) : null;
  const drift = frozenSpend !== null ? st.totalSpend - frozenSpend : 0;

  const closeWeek = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        client_id: clientId,
        week_start: st.weekStartISO,
        week_end: st.weekEndISO,
        total_spend: Number(st.totalSpend.toFixed(2)),
        commission_pct: st.commissionPct,
        commission_amount: Number(st.commissionAmount.toFixed(2)),
        currency: 'USD',
        timezone_note: st.timezones.join(' | ') || null,
        items: statementItems(st),
        closed_by: user?.id ?? null,
        closed_by_email: user?.email ?? null,
      };
      const { data, error } = await (supabase as any)
        .from('billing_week_snapshots')
        .upsert(payload, { onConflict: 'client_id,week_start' })
        .select()
        .maybeSingle();
      if (error) throw error;
      setSnapshot(data);
      toast.success(t('clientDash.statement.closed', 'Semana fechada e congelada'));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const lastSync = accounts
    .map((a) => a.last_synced_at)
    .filter(Boolean)
    .sort()
    .pop();

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
      {/* Header + navegação de semana */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
            {t('clientDash.statement.eyebrow', 'Transparência')}
          </p>
          <h3 className="font-display text-lg font-bold">
            {t('clientDash.statement.title', 'Extrato diário por conta')}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(st.weekStart, 'dd/MM/yyyy', { locale })} — {format(st.weekEnd, 'dd/MM/yyyy', { locale })}
            {' · '}
            {t('clientDash.statement.weekLabel', 'semana de cobrança (sexta → quinta)')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReference(subWeeks(reference, 1))}
            className="p-2 rounded-lg border border-border hover:bg-secondary"
            aria-label={t('clientDash.statement.prevWeek', 'Semana anterior')}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setReference(addWeeks(reference, 1))}
            disabled={isCurrentWeek}
            className="p-2 rounded-lg border border-border hover:bg-secondary disabled:opacity-40"
            aria-label={t('clientDash.statement.nextWeek', 'Próxima semana')}
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => downloadCSV(
              `extrato-${clientName.replace(/\s+/g, '-').toLowerCase()}-${st.weekStartISO}.csv`,
              statementToCSV(st, clientName)
            )}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/40 bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20"
          >
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-secondary/40 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clientDash.statement.spend', 'Gasto da semana')}</p>
          <p className="font-display text-xl font-bold">{fmtUSD(snapshot ? frozenSpend! : st.totalSpend)}</p>
        </div>
        <div className="rounded-xl border border-border bg-secondary/40 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clientDash.statement.pct', 'Percentual aplicado')}</p>
          <p className="font-display text-xl font-bold text-primary">
            {snapshot ? Number(snapshot.commission_pct) : st.commissionPct}%
          </p>
        </div>
        <div className="rounded-xl border border-border bg-secondary/40 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clientDash.statement.commission', 'Comissão')}</p>
          <p className="font-display text-xl font-bold">{fmtUSD(snapshot ? frozenCommission! : st.commissionAmount)}</p>
        </div>
        <div className="rounded-xl border border-border bg-secondary/40 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clientDash.statement.accounts', 'Contas com gasto')}</p>
          <p className="font-display text-xl font-bold">{st.groups.length}</p>
        </div>
      </div>

      {/* Selo de fuso + sincronização + fechamento */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-secondary/50 text-muted-foreground">
          <Info size={12} />
          {t('clientDash.statement.tzNote', 'Valores no fuso da conta de anúncios, iguais ao Gerenciador da Meta')}
          {st.timezones.length > 0 && ` · ${st.timezones.join(', ')}`}
        </span>
        {lastSync && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-secondary/50 text-muted-foreground">
            <Clock size={12} />
            {t('clientDash.statement.syncedAgo', 'Sincronizado')}{' '}
            {formatDistanceToNow(new Date(lastSync), { addSuffix: true, locale })}
          </span>
        )}
        {snapshot ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-success/40 bg-success/10 text-success">
            <Lock size={12} />
            {t('clientDash.statement.frozen', 'Fechamento congelado')} ·{' '}
            {format(new Date(snapshot.created_at), 'dd/MM/yyyy HH:mm')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-warning/40 bg-warning/10 text-warning">
            <LockOpen size={12} />
            {t('clientDash.statement.open', 'Semana em aberto — valores podem mudar com novas sincronizações')}
          </span>
        )}
        {isAdmin && !isCurrentWeek && (
          <button
            onClick={closeWeek}
            disabled={saving || st.groups.length === 0}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
          >
            <Lock size={12} />
            {snapshot
              ? t('clientDash.statement.refreeze', 'Refazer fechamento')
              : t('clientDash.statement.close', 'Fechar semana')}
          </button>
        )}
      </div>

      {snapshot && Math.abs(drift) >= 0.01 && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          {t('clientDash.statement.drift', 'A Meta reportou {{amount}} de diferença após o fechamento. O valor cobrado permanece o congelado; a diferença entra como ajuste na próxima semana.', {
            amount: fmtUSD(drift),
          })}
        </div>
      )}

      {/* Tabela por conta */}
      {st.groups.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {t('clientDash.statement.empty', 'Nenhum gasto registrado nesta semana.')}
        </p>
      ) : (
        <div className="space-y-3">
          {st.groups.map((g) => (
            <div key={g.account.id} className="rounded-xl border border-border overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-secondary/50">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{g.account.name || g.account.meta_account_id}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {g.account.meta_account_id}
                    {g.account.timezone_name && ` · ${g.account.timezone_name}`}
                  </p>
                </div>
                <p className="font-display text-sm font-bold">{fmtUSD(g.total)}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left font-medium px-3 py-1.5">{t('clientDash.statement.date', 'Data')}</th>
                      <th className="text-right font-medium px-3 py-1.5">{t('clientDash.statement.spendCol', 'Gasto')}</th>
                      <th className="text-right font-medium px-3 py-1.5 hidden sm:table-cell">{t('clientDash.statement.impressions', 'Impressões')}</th>
                      <th className="text-right font-medium px-3 py-1.5 hidden sm:table-cell">{t('clientDash.statement.clicks', 'Cliques')}</th>
                      <th className="text-right font-medium px-3 py-1.5">{t('clientDash.statement.dayCommission', 'Comissão')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.days.map((d) => (
                      <tr key={d.date} className={cn('border-b border-border/50 last:border-0', d.spend === 0 && 'text-muted-foreground')}>
                        <td className="px-3 py-1.5">{format(new Date(`${d.date}T12:00:00`), 'dd/MM (EEE)', { locale })}</td>
                        <td className="px-3 py-1.5 text-right font-medium">{fmtUSD(d.spend)}</td>
                        <td className="px-3 py-1.5 text-right hidden sm:table-cell">{d.impressions.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right hidden sm:table-cell">{d.clicks.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right text-primary">
                          {fmtUSD(d.spend * (st.commissionPct / 100))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DailyStatement;
