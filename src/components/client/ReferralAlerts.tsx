import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useReferralStatement } from './ReferralStatement';
import { Bell, Target, PartyPopper, X, ArrowRight } from 'lucide-react';

const T = {
  pt: {
    heading: 'Alertas do programa de indicação',
    approaching: 'Falta pouco para o próximo bônus!',
    approachingBody: '{{name}} já pagou US$ {{paid}} à agência. Faltam US$ {{remaining}} para você receber mais US$ {{bonus}} em crédito.',
    awarded: 'Bônus liberado!',
    awardedBody: 'Você ganhou US$ {{bonus}} em crédito pela meta de US$ {{target}} paga por {{name}}.',
    statement: 'Ver extrato',
    dismiss: 'Dispensar',
  },
  en: {
    heading: 'Referral program alerts',
    approaching: 'Almost there for the next bonus!',
    approachingBody: '{{name}} has paid US$ {{paid}} to the agency. US$ {{remaining}} to go until you earn another US$ {{bonus}} in credit.',
    awarded: 'Bonus released!',
    awardedBody: 'You earned US$ {{bonus}} in credit for the US$ {{target}} milestone paid by {{name}}.',
    statement: 'View statement',
    dismiss: 'Dismiss',
  },
  es: {
    heading: 'Alertas del programa de referidos',
    approaching: '¡Falta poco para el próximo bono!',
    approachingBody: '{{name}} ya pagó US$ {{paid}} a la agencia. Faltan US$ {{remaining}} para que recibas US$ {{bonus}} más en crédito.',
    awarded: '¡Bono liberado!',
    awardedBody: 'Ganaste US$ {{bonus}} en crédito por la meta de US$ {{target}} pagada por {{name}}.',
    statement: 'Ver extracto',
    dismiss: 'Descartar',
  },
} as const;

const num = (v: number, locale: string) =>
  Number(v || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = { clientId?: string | null; onOpenStatement?: () => void };

const ReferralAlerts: React.FC<Props> = ({ clientId, onOpenStatement }) => {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('en') ? 'en' : i18n.language?.startsWith('es') ? 'es' : 'pt';
  const d = T[lang];
  const locale = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'pt-BR';
  const { data } = useReferralStatement(clientId);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const alerts = useMemo(() => {
    const list = (data?.alerts || []) as any[];
    const progressByReferred = new Map(
      (data?.progress || []).map((p: any) => [p.referred_id, p])
    );
    return list
      .filter((a) => !a.read_at && !dismissed.includes(a.id))
      .map((a) => ({ ...a, progress: progressByReferred.get(a.referred_id) }))
      .slice(0, 3);
  }, [data, dismissed]);

  const dismiss = async (id: string) => {
    setDismissed((prev) => [...prev, id]);
    try {
      await supabase.from('referral_alerts' as any).update({ read_at: new Date().toISOString() } as any).eq('id', id);
    } catch { /* silent */ }
  };

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Bell size={13} className="text-primary" /> {d.heading}
      </div>
      <AnimatePresence>
        {alerts.map((a) => {
          const isAwarded = a.kind === 'awarded';
          const paid = a.progress?.total_paid ?? 0;
          const remaining = a.remaining_amount ?? a.progress?.remaining ?? 0;
          const body = isAwarded
            ? d.awardedBody
                .replace('{{bonus}}', num(a.estimated_amount, locale))
                .replace('{{target}}', num((a.milestone_index || 1) * 1000, locale))
                .replace('{{name}}', a.referred_name || '—')
            : d.approachingBody
                .replace('{{name}}', a.referred_name || '—')
                .replace('{{paid}}', num(paid, locale))
                .replace('{{remaining}}', num(remaining, locale))
                .replace('{{bonus}}', num(a.estimated_amount, locale));

          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
              className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/12 via-card/70 to-card/60 p-4"
            >
              <div className="pointer-events-none absolute -top-16 -right-10 w-48 h-48 rounded-full bg-primary/15 blur-3xl" />
              <div className="relative flex flex-wrap items-start gap-3">
                <span className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                  {isAwarded ? <PartyPopper size={16} /> : <Target size={16} />}
                </span>
                <div className="flex-1 min-w-[200px]">
                  <div className="text-sm font-semibold text-foreground">{isAwarded ? d.awarded : d.approaching}</div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{body}</p>
                  {!isAwarded && a.progress && (
                    <div className="mt-2 h-1.5 rounded-full bg-border/60 overflow-hidden max-w-md">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, Number(a.progress.progress_pct) || 0)}%` }} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {onOpenStatement && (
                    <button onClick={onOpenStatement}
                      className="flex items-center gap-1.5 bg-primary text-primary-foreground text-[11px] font-semibold rounded-xl px-3 py-2 hover:brightness-110">
                      {d.statement} <ArrowRight size={12} />
                    </button>
                  )}
                  <button onClick={() => dismiss(a.id)} title={d.dismiss}
                    className="w-8 h-8 rounded-xl border border-border bg-secondary/60 flex items-center justify-center text-muted-foreground hover:text-foreground">
                    <X size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default ReferralAlerts;
