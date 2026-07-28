// Metas de fidelidade por comissão paga acumulada (clientes de aluguel)
// Ao cruzar cada meta, o percentual base do cliente cai automaticamente.

export type LoyaltyTierId = 'standard' | 'premium' | 'elite';

export interface LoyaltyTier {
  id: LoyaltyTierId;
  label: string;
  threshold: number; // total pago acumulado (USD) necessário
  basePct: number;   // percentual base aplicado quando atingido
  accent: string;    // cor destaque
  gradient: string;  // gradiente para banners
  ring: string;
  glow: string;
  icon: string;      // nome do ícone lucide (renderizado no componente)
  tagline: string;
}

export const LOYALTY_TIERS: LoyaltyTier[] = [
  {
    id: 'standard',
    label: 'Standard',
    threshold: 0,
    basePct: 5,
    accent: 'text-primary',
    gradient: 'from-primary/15 via-card to-card',
    ring: 'ring-primary/30',
    glow: 'bg-primary/20',
    icon: 'Sparkles',
    tagline: 'Todo cliente começa aqui — evolua pagando sua comissão em dia.',
  },
  {
    id: 'premium',
    label: 'Premium',
    threshold: 5000,
    basePct: 4,
    accent: 'text-violet-300',
    gradient: 'from-violet-600/25 via-fuchsia-600/10 to-card',
    ring: 'ring-violet-400/40',
    glow: 'bg-violet-500/30',
    icon: 'Gem',
    tagline: 'Você desbloqueou o benefício Premium — comissão base reduzida.',
  },
  {
    id: 'elite',
    label: 'Elite',
    threshold: 10000,
    basePct: 3,
    accent: 'text-amber-300',
    gradient: 'from-amber-500/30 via-yellow-500/10 to-card',
    ring: 'ring-amber-400/50',
    glow: 'bg-amber-400/30',
    icon: 'Crown',
    tagline: 'Nível Elite — o menor percentual da agência. Bem-vindo ao topo.',
  },
];

export interface LoyaltyProgress {
  current: LoyaltyTier;
  next: LoyaltyTier | null;
  totalPaid: number;
  progressPct: number;    // 0-100 dentro da faixa atual
  remainingToNext: number;
  achievedTop: boolean;
  nearNext: boolean;      // true quando >= 70% do próximo tier
}

/** Retorna o tier cujo basePct casa com a porcentagem informada (menor pct = tier melhor). */
export function tierFromBasePct(basePct: number): LoyaltyTier {
  const byPct = [...LOYALTY_TIERS].sort((a, b) => a.basePct - b.basePct); // 3, 4, 5
  for (const t of byPct) if (basePct <= t.basePct + 0.0001) return t;
  return byPct[byPct.length - 1];
}

export function computeLoyaltyProgress(totalPaid: number, basePctOverride?: number | null): LoyaltyProgress {
  const paid = Math.max(0, Number(totalPaid) || 0);
  const sorted = [...LOYALTY_TIERS].sort((a, b) => a.threshold - b.threshold);
  let current = sorted[0];
  for (const t of sorted) if (paid >= t.threshold) current = t;

  // Override manual: se o admin ajustou a comissão para um valor melhor (menor)
  // que o tier natural, força o tier correspondente àquela porcentagem.
  if (basePctOverride !== undefined && basePctOverride !== null && !Number.isNaN(Number(basePctOverride))) {
    const manual = tierFromBasePct(Number(basePctOverride));
    if (manual.basePct < current.basePct) current = manual;
  }

  const idx = sorted.findIndex(t => t.id === current.id);
  const next = idx < sorted.length - 1 ? sorted[idx + 1] : null;

  let progressPct = 100;
  let remainingToNext = 0;
  let nearNext = false;
  if (next) {
    const span = next.threshold - current.threshold;
    const inTier = Math.max(0, paid - current.threshold);
    progressPct = span > 0 ? Math.min(100, (inTier / span) * 100) : 0;
    remainingToNext = Math.max(0, next.threshold - paid);
    nearNext = progressPct >= 70;
  }

  return {
    current,
    next,
    totalPaid: paid,
    progressPct,
    remainingToNext,
    achievedTop: !next,
    nearNext,
  };
}
