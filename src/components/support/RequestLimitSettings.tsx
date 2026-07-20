import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Settings, Save } from 'lucide-react';

const RequestLimitSettings: React.FC = () => {
  const [limit, setLimit] = useState<number>(5);
  const [notice, setNotice] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('support_settings')
        .select('key, value')
        .in('key', ['ad_account_request_limit', 'ad_account_request_notice']);
      if (data) {
        for (const row of data) {
          if (row.key === 'ad_account_request_limit') {
            const n = typeof row.value === 'number' ? row.value : Number(row.value);
            if (Number.isFinite(n) && n > 0) setLimit(Math.floor(n));
          } else if (row.key === 'ad_account_request_notice') {
            setNotice(typeof row.value === 'string' ? row.value : String(row.value ?? ''));
          }
        }
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!Number.isFinite(limit) || limit < 1) {
      toast.error('Informe um limite válido (mínimo 1).');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('support_settings').upsert([
      { key: 'ad_account_request_limit', value: limit as any },
      { key: 'ad_account_request_notice', value: notice as any },
    ]);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Configurações salvas. Novos pedidos já respeitam o limite.');
  };

  if (loading) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 border-glow">
      <h3 className="font-display text-sm font-semibold mb-1 flex items-center gap-2">
        <Settings size={16} className="text-primary" /> Limite de pedidos de conta
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Define o máximo de contas que cada cliente pode solicitar por pedido e a mensagem exibida no painel de suporte.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-3 items-end">
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Máx. por pedido</label>
          <input
            type="number" min={1} max={100}
            value={limit}
            onChange={e => setLimit(Math.max(1, Number(e.target.value) || 1))}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Mensagem para o cliente</label>
          <textarea
            value={notice}
            onChange={e => setNotice(e.target.value)}
            placeholder="Ex: AVISO, estamos passando por uma instabilidade no Meta..."
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary h-20 resize-none"
          />
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
        >
          <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
};

export default RequestLimitSettings;
