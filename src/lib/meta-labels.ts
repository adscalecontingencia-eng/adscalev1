import { tr } from '@/i18n';

const SCORE: Record<string, string> = { Excelente: 'excellent', Bom: 'good', 'Atenção': 'attention', 'Crítico': 'critical', 'Saudável': 'healthy' };

/** Translates the Portuguese score label saved by meta-sync (Excelente/Bom/Atenção/Crítico). */
export function scoreLabel(label: string | null | undefined): string {
  if (!label) return '—';
  const k = SCORE[label];
  return k ? tr(`metaLabels.score.${k}`) : label;
}

/** Translates the disable reason saved by meta-sync ("Nenhum", "Código 19", Meta enum names). */
export function disableReasonLabel(label: string | null | undefined): string {
  if (!label) return '';
  if (label === 'Nenhum') return tr('metaLabels.none');
  const m = /^Código (\d+)$/.exec(label);
  if (m) return tr('metaLabels.code', { code: m[1] });
  return label;
}
