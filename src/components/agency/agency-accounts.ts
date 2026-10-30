// Shared helpers for agency ad-account display (status, health) and demo data.

export type AgencyAccount = {
  id: string;
  name: string;
  meta_account_id: string;
  account_status: number | null;
  amount_spent: number | string | null;
  balance: number | string | null;
  spend_cap: number | string | null;
  currency: string | null;
  score: number | null;
  score_label: string | null;
  disable_reason_label: string | null;
  last_synced_at: string | null;
  week_spend?: number;
};

export const ACCOUNT_FIELDS =
  'id, name, meta_account_id, account_status, amount_spent, balance, spend_cap, currency, score, score_label, disable_reason_label, last_synced_at';

export function accountState(status: number | null | undefined): { label: string; tone: 'ok' | 'warn' | 'bad' } {
  switch (status) {
    case 1: return { label: 'Ativa', tone: 'ok' };
    case 2: return { label: 'Banida', tone: 'bad' };
    case 3: return { label: 'Pendência de pagamento', tone: 'warn' };
    case 7: return { label: 'Em análise', tone: 'warn' };
    case 9: return { label: 'Período de carência', tone: 'warn' };
    case 101: return { label: 'Encerrada', tone: 'bad' };
    default: return { label: 'Desconhecida', tone: 'warn' };
  }
}

export function healthOf(a: AgencyAccount): { score: number; label: string; tone: 'ok' | 'warn' | 'bad' } {
  const s = a.account_status === 2 || a.account_status === 101 ? 0 : Number(a.score ?? (a.account_status === 1 ? 80 : 40));
  const tone = s >= 70 ? 'ok' : s >= 40 ? 'warn' : 'bad';
  const label = a.score_label || (tone === 'ok' ? 'Saudável' : tone === 'warn' ? 'Atenção' : 'Crítico');
  return { score: s, label, tone };
}

export const toneClass = {
  ok: 'bg-primary/15 text-primary border-primary/30',
  warn: 'bg-accent/20 text-accent-foreground border-accent/40',
  bad: 'bg-destructive/15 text-destructive border-destructive/30',
} as const;

export const DEMO_AGENCY_EMAIL = 'demo.agencia@adscalehub.com';

const now = new Date().toISOString();
export const DEMO_ACCOUNTS: AgencyAccount[] = [
  { id: 'demo-1', name: 'Loja Exemplo · 01', meta_account_id: '1203948577610', account_status: 1, amount_spent: 48210.4, balance: 1240.5, spend_cap: 0, currency: 'USD', score: 92, score_label: 'Excelente', disable_reason_label: null, last_synced_at: now, week_spend: 14600 },
  { id: 'demo-2', name: 'Loja Exemplo · 02', meta_account_id: '1203948577622', account_status: 1, amount_spent: 21890.0, balance: 610.2, spend_cap: 30000, currency: 'USD', score: 78, score_label: 'Saudável', disable_reason_label: null, last_synced_at: now, week_spend: 7800 },
  { id: 'demo-3', name: 'Infoprodutor · Escala', meta_account_id: '1203948577655', account_status: 1, amount_spent: 63500.75, balance: 2100.0, spend_cap: 0, currency: 'USD', score: 85, score_label: 'Saudável', disable_reason_label: null, last_synced_at: now, week_spend: 12300 },
  { id: 'demo-4', name: 'Infoprodutor · Teste', meta_account_id: '1203948577690', account_status: 3, amount_spent: 3820.1, balance: 145.3, spend_cap: 5000, currency: 'USD', score: 45, score_label: 'Atenção', disable_reason_label: null, last_synced_at: now, week_spend: 3800 },
  { id: 'demo-5', name: 'Reserva · Contingência', meta_account_id: '1203948577701', account_status: 2, amount_spent: 1290.0, balance: 0, spend_cap: 0, currency: 'USD', score: 0, score_label: 'Crítico', disable_reason_label: 'ADS_INTEGRITY_POLICY', last_synced_at: now, week_spend: 0 },
];

// demo account -> index of sub-client it belongs to (by name order)
export const DEMO_LINKS: Record<string, number | null> = { 'demo-1': 1, 'demo-2': 1, 'demo-3': 0, 'demo-4': 0, 'demo-5': null };
