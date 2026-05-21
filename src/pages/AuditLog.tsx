import React, { useEffect, useState } from 'react';
import { PageHero } from '@/components/ui-kit';
import { supabase } from '@/integrations/supabase/client';
import { Shield, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AuditLog: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterAction, setFilterAction] = useState('');

  const load = async () => {
    setLoading(true);
    let q = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200);
    if (filterAction) q = q.ilike('action', `%${filterAction}%`);
    const { data } = await q;
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Segurança"
        title={<>Auditoria de <span className="text-primary glow-text">ações</span></>}
        description="Histórico completo de ações sensíveis: pagamentos validados, contas atribuídas, edições críticas e erros do frontend."
        actions={
          <button onClick={load} disabled={loading} className="flex items-center gap-2 bg-card border border-border text-foreground px-3 py-2 rounded-lg text-xs font-medium hover:border-primary">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        }
      />

      <div className="flex gap-2">
        <input
          placeholder="Filtrar por ação (ex: payment_validated)"
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
          className="w-full bg-secondary border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary"
        />
        <button onClick={load} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold">Filtrar</button>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 border-glow">
        {rows.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">Nenhuma entrada registrada.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r: any) => (
              <div key={r.id} className="bg-secondary/40 border border-border rounded-lg p-3 text-xs">
                <div className="flex items-start justify-between flex-wrap gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <Shield size={12} className="text-primary" />
                    <span className="font-semibold text-foreground">{r.action}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{r.entity}{r.entity_id ? ` #${r.entity_id.slice(0, 8)}` : ''}</span>
                    {r.actor_role && (
                      <span className="text-[10px] uppercase bg-primary/10 text-primary border border-primary/30 px-1.5 py-0.5 rounded">{r.actor_role}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground/70">{format(new Date(r.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}</span>
                </div>
                {r.actor_email && (
                  <p className="text-[11px] text-muted-foreground">por {r.actor_email}</p>
                )}
                {(r.before || r.after || (r.metadata && Object.keys(r.metadata).length > 0)) && (
                  <details className="mt-2">
                    <summary className="text-[10px] text-muted-foreground/70 cursor-pointer hover:text-foreground">Detalhes</summary>
                    <pre className="text-[10px] bg-background/40 p-2 rounded mt-1 overflow-x-auto text-muted-foreground">
                      {JSON.stringify({ before: r.before, after: r.after, metadata: r.metadata }, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLog;
