import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, UserPlus, RefreshCw, Building2, Mail, Phone, Target, DollarSign, Compass } from 'lucide-react';

type PendingClient = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  cnpj: string | null;
  niche: string | null;
  monthly_investment: string | null;
  how_found_us: string | null;
  created_at: string;
};

const nicheLabel = (v: string | null) =>
  v === 'infoproduto' ? 'Infoproduto' : v === 'produto_fisico' ? 'Produto físico' : v === 'outro' ? 'Outro' : '—';

const investLabel = (v: string | null) => {
  const map: Record<string, string> = {
    ate_5k: 'US$ 0 – 5.000',
    '5k_20k': 'US$ 5.000 – 20.000',
    '20k_50k': 'US$ 20.000 – 50.000',
    '50k_100k': 'US$ 50.000 – 100.000',
    acima_100k: 'US$ 100.000+',
  };
  return (v && map[v]) || v || '—';
};

const formatCnpj = (v: string | null) => {
  const d = (v || '').replace(/\D+/g, '');
  if (d.length !== 14) return v || '—';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

const PendingApprovalsPanel: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const [rows, setRows] = useState<PendingClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('clients')
      .select('id, name, email, phone, company_name, cnpj, niche, monthly_investment, how_found_us, created_at')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });
    setRows((data as PendingClient[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = async (id: string, approve: boolean) => {
    let reason: string | null = null;
    if (!approve) {
      reason = window.prompt('Motivo da recusa (visível para o cliente):', '') || '';
      if (!reason.trim()) return;
    }
    setBusyId(id);
    const { data: auth } = await supabase.auth.getUser();
    await supabase
      .from('clients')
      .update({
        approval_status: approve ? 'approved' : 'rejected',
        approved_at: approve ? new Date().toISOString() : null,
        approved_by: auth?.user?.id ?? null,
        rejection_reason: approve ? null : reason,
      })
      .eq('id', id);
    setBusyId(null);
    setRows(prev => prev.filter(r => r.id !== id));
    onChanged?.();
  };

  if (!loading && rows.length === 0) return null;

  return (
    <div className="bg-card/70 border border-border/60 rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/40 flex items-center justify-center">
            <UserPlus size={16} className="text-primary" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground">Cadastros aguardando aprovação</h3>
            <p className="text-xs text-muted-foreground">{rows.length} pendente(s)</p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-secondary/60" title="Atualizar">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map(r => (
          <div key={r.id} className="border border-border/60 rounded-xl p-4 bg-background/40 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{r.name || '—'}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/30">
                Pendente
              </span>
            </div>

            <div className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Mail size={12} /> {r.email || '—'}</span>
              <span className="flex items-center gap-1.5"><Phone size={12} /> {r.phone || '—'}</span>
              <span className="flex items-center gap-1.5"><Building2 size={12} /> {r.company_name || '—'} · {formatCnpj(r.cnpj)}</span>
              <span className="flex items-center gap-1.5"><Target size={12} /> {nicheLabel(r.niche)}</span>
              <span className="flex items-center gap-1.5"><DollarSign size={12} /> {investLabel(r.monthly_investment)}</span>
              <span className="flex items-center gap-1.5"><Compass size={12} /> {r.how_found_us || '—'}</span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                disabled={busyId === r.id}
                onClick={() => decide(r.id, true)}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-50"
              >
                <CheckCircle2 size={14} /> Aprovar
              </button>
              <button
                disabled={busyId === r.id}
                onClick={() => decide(r.id, false)}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <XCircle size={14} /> Recusar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingApprovalsPanel;
