import React from 'react';
import { Crown, Gem, Sparkles, TrendingUp, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoyaltyProgress, LOYALTY_TIERS } from '@/lib/loyalty-tiers';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

const iconMap: Record<string, React.ComponentType<any>> = {
  Sparkles,
  Gem,
  Crown,
};

interface Props {
  progress: LoyaltyProgress;
  compact?: boolean;
  className?: string;
}

export const LoyaltyTierCard: React.FC<Props> = ({ progress, compact, className }) => {
  const { current, next, totalPaid, progressPct, remainingToNext, achievedTop, nearNext } = progress;
  const Icon = iconMap[current.icon] ?? Sparkles;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-5 bg-gradient-to-br',
        current.gradient,
        current.id === 'elite' && 'border-amber-400/40 shadow-[0_0_40px_-10px_rgba(251,191,36,0.35)]',
        current.id === 'premium' && 'border-violet-400/40 shadow-[0_0_40px_-10px_rgba(167,139,250,0.4)]',
        current.id === 'standard' && 'border-primary/30',
        className,
      )}
    >
      <div className={cn('absolute -top-16 -right-16 w-52 h-52 rounded-full blur-[70px] pointer-events-none', current.glow)} />
      {current.id === 'elite' && (
        <div className="absolute inset-0 pointer-events-none opacity-30" style={{
          background: 'radial-gradient(circle at 20% 20%, rgba(251,191,36,0.4), transparent 40%), radial-gradient(circle at 80% 60%, rgba(245,158,11,0.3), transparent 40%)',
        }} />
      )}

      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center ring-2',
            current.ring,
            current.id === 'elite' ? 'bg-amber-400/15' : current.id === 'premium' ? 'bg-violet-500/15' : 'bg-primary/15',
          )}>
            <Icon size={20} className={current.accent} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Nível de fidelidade</span>
              {nearNext && next && (
                <span className="text-[9px] uppercase tracking-wider bg-warning/20 text-warning px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                  Perto do próximo!
                </span>
              )}
            </div>
            <h3 className={cn('font-display text-xl sm:text-2xl font-bold leading-tight', current.accent)}>
              {current.label} · {current.basePct}% base
            </h3>
            {!compact && (
              <p className="text-[11px] text-muted-foreground mt-0.5 max-w-md">{current.tagline}</p>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Comissão paga acumulada</div>
          <div className={cn('font-display font-bold text-lg', current.accent)}>{fmt(totalPaid)}</div>
        </div>
      </div>

      {/* Progress */}
      <div className="relative mt-4">
        {achievedTop ? (
          <div className="flex items-center gap-2 text-[11px] text-amber-300">
            <Trophy size={13} /> Você está no topo — nível máximo desbloqueado.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
              <span className="flex items-center gap-1">
                <TrendingUp size={11} /> Próximo: <strong className="text-foreground">{next?.label}</strong> · {next?.basePct}% base
              </span>
              <span>Faltam <strong className="text-foreground">{fmt(remainingToNext)}</strong></span>
            </div>
            <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  current.id === 'premium'
                    ? 'bg-gradient-to-r from-violet-400 to-amber-300'
                    : 'bg-gradient-to-r from-primary via-violet-400 to-violet-500',
                )}
                style={{ width: `${Math.max(4, progressPct)}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground/70 mt-1">
              <span>{fmt(current.threshold)}</span>
              <span>{Math.round(progressPct)}%</span>
              <span>{fmt(next?.threshold || 0)}</span>
            </div>
          </>
        )}
      </div>

      {/* Roadmap chips (não-compact) */}
      {!compact && (
        <div className="relative mt-5">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">Jornada de níveis</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {LOYALTY_TIERS.map(t => {
              const reached = totalPaid >= t.threshold;
              const isCurrent = t.id === current.id;
              const TIcon = iconMap[t.icon] ?? Sparkles;
              return (
                <div
                  key={t.id}
                  className={cn(
                    'relative rounded-xl border-2 px-3 py-2.5 transition-all overflow-hidden',
                    isCurrent
                      ? cn(
                          'shadow-lg scale-[1.02]',
                          t.id === 'elite' && 'border-amber-400 bg-amber-500/15 shadow-amber-500/30',
                          t.id === 'premium' && 'border-violet-400 bg-violet-500/15 shadow-violet-500/30',
                          t.id === 'standard' && 'border-primary bg-primary/15 shadow-primary/30',
                        )
                      : reached
                        ? 'border-border/70 bg-background/50'
                        : 'border-dashed border-border/40 bg-background/20 opacity-70',
                  )}
                >
                  {isCurrent && (
                    <span className={cn('absolute top-1 right-1 text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full bg-background/80 border', t.accent, 'border-current')}>
                      Atual
                    </span>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center',
                      reached ? cn('bg-background/60 ring-1', t.ring) : 'bg-background/30',
                    )}>
                      <TIcon size={14} className={reached ? t.accent : 'text-muted-foreground'} />
                    </div>
                    <div className={cn('font-display font-bold text-sm', reached ? t.accent : 'text-muted-foreground')}>
                      {t.label}
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn('font-display text-lg font-bold', reached ? t.accent : 'text-foreground/60')}>
                      {t.basePct}%
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {fmt(t.threshold)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoyaltyTierCard;
