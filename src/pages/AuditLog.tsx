import React, { useEffect, useMemo, useState } from 'react';
import { PageHero } from '@/components/ui-kit';
import { supabase } from '@/integrations/supabase/client';
import { Shield, RefreshCw, AlertTriangle, AlertCircle, Info, CheckCircle2, X, Copy, Search, Calendar as CalIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Severity = 'critical' | 'error' | 'warning' | 'info';
type Category = 'error' | 'auth' | 'task' | 'financial' | 'meta' | 'other';

interface Row {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  before: any;
  after: any;
  metadata: any;
  created_at: string;
}

// Heurísticas para classificar
function classify(action: string, metadata: any): { sev: Severity; cat: Category } {
  const a = action.toLowerCase();
  let sev: Severity = 'info';
  if (/fatal|crash|critical/.test(a)) sev = 'critical';
  else if (/error|failure|failed|rejection|exception/.test(a)) sev = 'error';
  else if (/warn|partial|retry|blocked/.test(a)) sev = 'warning';
  else sev = 'info';

  let cat: Category = 'other';
  if (/error|failure|rejection|exception|window|unhandled/.test(a)) cat = 'error';
  else if (/login|password|auth|signup|session/.test(a)) cat = 'auth';
  else if (/task|support_request/.test(a)) cat = 'task';
  else if (/commission|payment|transaction|financial/.test(a)) cat = 'financial';
  else if (/scan|meta|bm|backup/.test(a)) cat = 'meta';
  return { sev, cat };
}

const sevStyle: Record<Severity, { cls: string; Icon: any; label: string }> = {
  critical: { cls: 'text-red-400 border-red-500/40 bg-red-500/10', Icon: AlertTriangle, label: 'Crítico' },
  error:    { cls: 'text-destructive border-destructive/40 bg-destructive/10', Icon: AlertCircle, label: 'Erro' },
  warning:  { cls: 'text-amber-300 border-amber-500/40 bg-amber-500/10', Icon: AlertTriangle, label: 'Aviso' },
  info:     { cls: 'text-primary border-primary/30 bg-primary/10', Icon: CheckCircle2, label: 'Info' },
};

const catLabel: Record<Category, string> = {
  error: 'Erros do sistema',
  auth: 'Autenticação',
  task: 'Tarefas/Suporte',
  financial: 'Financeiro',
  meta: 'Meta/BMs',
  other: 'Outros',
};

const AuditLog: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sev, setSev] = useState<Severity | 'all'>('all');
  const [cat, setCat] = useState<Category | 'all'>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [detail, setDetail] = useState<Row | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(500);
    if (from) q = q.gte('created_at', new Date(from).toISOString());
    if (to)   q = q.lte('created_at', new Date(to + 'T23:59:59').toISOString());
    const { data } = await q;
    setRows((data as Row[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [from, to]);

  const enriched = useMemo(() => rows.map(r => ({ ...r, _meta: classify(r.action, r.metadata) })), [rows]);

  const actions = useMemo(() => Array.from(new Set(rows.map(r => r.action))).sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return enriched.filter(r => {
      if (sev !== 'all' && r._meta.sev !== sev) return false;
      if (cat !== 'all' && r._meta.cat !== cat) return false;
      if (actionFilter !== 'all' && r.action !== actionFilter) return false;
      if (q) {
        const blob = `${r.action} ${r.entity} ${r.actor_email || ''} ${JSON.stringify(r.metadata || {})}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, sev, cat, actionFilter, search]);

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, error: 0, warning: 0, info: 0 };
    for (const r of enriched) c[r._meta.sev]++;
    return c;
  }, [enriched]);

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Segurança"
        title={<>Auditoria de <span className="text-primary glow-text">ações & erros</span></>}
        description="Histórico de ações sensíveis e erros do sistema. Filtre por tipo, severidade e data — clique em qualquer linha para ver payload, stack e solução sugerida."
        actions={
          <button onClick={load} disabled={loading} className="flex items-center gap-2 bg-card border border-border text-foreground px-3 py-2 rounded-lg text-xs font-medium hover:border-primary">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        }
      />

      {/* KPIs por severidade */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(['critical','error','warning','info'] as Severity[]).map(s => {
          const { cls, Icon, label } = sevStyle[s];
          const active = sev === s;
          return (
            <button
              key={s}
              onClick={() => setSev(active ? 'all' : s)}
              className={cn(
                "border rounded-xl p-3 text-left transition-all",
                cls,
                active ? "ring-2 ring-primary/60" : "hover:scale-[1.01]"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider opacity-80">{label}</span>
                <Icon size={14} />
              </div>
              <div className="text-2xl font-bold mt-1">{counts[s]}</div>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar ação, email, metadata..."
            className="w-full pl-9 bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <select value={cat} onChange={e => setCat(e.target.value as any)} className="bg-secondary border border-border rounded-lg px-3 py-2 text-xs">
          <option value="all">Todas categorias</option>
          {(Object.keys(catLabel) as Category[]).map(c => <option key={c} value={c}>{catLabel[c]}</option>)}
        </select>

        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="bg-secondary border border-border rounded-lg px-3 py-2 text-xs max-w-[220px]">
          <option value="all">Todas ações</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <div className="flex items-center gap-1 bg-secondary border border-border rounded-lg px-2 py-1">
          <CalIcon size={12} className="text-muted-foreground" />
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="bg-transparent text-xs focus:outline-none" />
          <span className="text-muted-foreground text-xs">→</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="bg-transparent text-xs focus:outline-none" />
        </div>

        {(search || sev !== 'all' || cat !== 'all' || actionFilter !== 'all' || from || to) && (
          <button
            onClick={() => { setSearch(''); setSev('all'); setCat('all'); setActionFilter('all'); setFrom(''); setTo(''); }}
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <X size={11} /> Limpar
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-12">
            {loading ? 'Carregando...' : 'Nenhuma entrada com os filtros atuais.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary/60 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2">Severidade</th>
                  <th className="px-3 py-2">Ação</th>
                  <th className="px-3 py-2">Entidade</th>
                  <th className="px-3 py-2">Ator</th>
                  <th className="px-3 py-2">Resumo</th>
                  <th className="px-3 py-2 text-right">Quando</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const { Icon, cls, label } = sevStyle[r._meta.sev];
                  const summary = r.metadata?.erro || r.metadata?.message || r.metadata?.solucao_sugerida || r.metadata?.source || '—';
                  return (
                    <tr key={r.id}
                        onClick={() => setDetail(r)}
                        className="border-t border-border hover:bg-secondary/40 cursor-pointer">
                      <td className="px-3 py-2">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold", cls)}>
                          <Icon size={10} /> {label}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">{r.action}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.entity}</td>
                      <td className="px-3 py-2">
                        <div className="text-foreground">{r.actor_email || '—'}</div>
                        {r.actor_role && <div className="text-[9px] uppercase text-primary">{r.actor_role}</div>}
                      </td>
                      <td className="px-3 py-2 max-w-[300px] truncate text-muted-foreground" title={typeof summary === 'string' ? summary : ''}>
                        {typeof summary === 'string' ? summary : JSON.stringify(summary).slice(0, 80)}
                      </td>
                      <td className="px-3 py-2 text-right text-[10px] text-muted-foreground whitespace-nowrap">
                        {format(new Date(r.created_at), 'dd/MM HH:mm:ss', { locale: ptBR })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Mostrando {filtered.length} de {rows.length} registros (limite 500 por consulta).
      </p>

      {detail && <DetailDrawer row={detail} onClose={() => setDetail(null)} />}
    </div>
  );
};

const DetailDrawer: React.FC<{ row: Row; onClose: () => void }> = ({ row, onClose }) => {
  const { sev, cat } = classify(row.action, row.metadata);
  const { Icon, cls, label } = sevStyle[sev];
  const meta = row.metadata || {};
  const solucao = meta.solucao_sugerida;
  const stack = meta.stack;
  const payload = meta.payload;

  const copy = (txt: string) => { navigator.clipboard.writeText(txt); toast.success('Copiado'); };

  return (
    <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between p-4 border-b border-border">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold", cls)}>
                <Icon size={10} /> {label}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase">{catLabel[cat]}</span>
            </div>
            <h3 className="font-display text-base font-semibold font-mono break-all">{row.action}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {row.entity}{row.entity_id ? ` · ${row.entity_id}` : ''} · {format(new Date(row.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
            </p>
            {row.actor_email && <p className="text-[11px] text-muted-foreground">por {row.actor_email} {row.actor_role && <span className="text-primary">({row.actor_role})</span>}</p>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="overflow-auto p-4 space-y-3">
          {solucao && (
            <div className="border border-primary/40 bg-primary/10 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1 flex items-center gap-1">
                <Info size={11} /> Solução sugerida
              </div>
              <p className="text-sm">{String(solucao)}</p>
            </div>
          )}

          {(meta.erro || meta.message) && (
            <Section title="Mensagem de erro">
              <pre className="text-xs whitespace-pre-wrap text-destructive">{String(meta.erro || meta.message)}</pre>
            </Section>
          )}

          {stack && (
            <Section title="Stack trace" onCopy={() => copy(String(stack))}>
              <pre className="text-[10px] whitespace-pre-wrap text-muted-foreground max-h-72 overflow-auto">{String(stack)}</pre>
            </Section>
          )}

          {payload != null && (
            <Section title="Payload da requisição" onCopy={() => copy(JSON.stringify(payload, null, 2))}>
              <pre className="text-[10px] whitespace-pre-wrap max-h-72 overflow-auto">{JSON.stringify(payload, null, 2)}</pre>
            </Section>
          )}

          <Section title="Metadata completa" onCopy={() => copy(JSON.stringify(meta, null, 2))}>
            <pre className="text-[10px] whitespace-pre-wrap max-h-72 overflow-auto text-muted-foreground">{JSON.stringify(meta, null, 2)}</pre>
          </Section>

          {(row.before || row.after) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {row.before && (
                <Section title="Antes">
                  <pre className="text-[10px] whitespace-pre-wrap max-h-60 overflow-auto text-muted-foreground">{JSON.stringify(row.before, null, 2)}</pre>
                </Section>
              )}
              {row.after && (
                <Section title="Depois">
                  <pre className="text-[10px] whitespace-pre-wrap max-h-60 overflow-auto text-muted-foreground">{JSON.stringify(row.after, null, 2)}</pre>
                </Section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; onCopy?: () => void; children: React.ReactNode }> = ({ title, onCopy, children }) => (
  <div className="bg-secondary/40 border border-border rounded-lg">
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{title}</span>
      {onCopy && (
        <button onClick={onCopy} className="text-[10px] text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <Copy size={10} /> Copiar
        </button>
      )}
    </div>
    <div className="p-3">{children}</div>
  </div>
);

export default AuditLog;
