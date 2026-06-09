import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, isBefore, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, X, CheckCircle2, Clock, AlertTriangle, Briefcase, Trash2, Calendar, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { logAudit } from '@/lib/audit';

interface Task {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
}

const CATEGORIES = [
  'Financeiro', 'Infra/Proxy', 'Multilogin', 'Fornecedores',
  'Jurídico', 'Marketing', 'Administrativo', 'Outros',
] as const;

const PRIORITIES = [
  { v: 'baixa', label: 'Baixa', cls: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40' },
  { v: 'media', label: 'Média', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/40' },
  { v: 'alta', label: 'Alta', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
  { v: 'urgente', label: 'Urgente', cls: 'bg-destructive/15 text-destructive border-destructive/40 animate-pulse' },
];

const STATUS_COLS = [
  { key: 'pendente', label: 'Pendente', cls: 'border-amber-500/40 bg-amber-500/5', badge: 'bg-amber-500/20 text-amber-300', icon: AlertTriangle },
  { key: 'em_andamento', label: 'Em andamento', cls: 'border-blue-500/40 bg-blue-500/5', badge: 'bg-blue-500/20 text-blue-300', icon: Clock },
  { key: 'concluida', label: 'Concluída', cls: 'border-primary/40 bg-primary/5', badge: 'bg-primary/20 text-primary', icon: CheckCircle2 },
];

const inputCls = "w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary";

const AgencyTasksTab: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [supportUsers, setSupportUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<Partial<Task>>({ category: 'Administrativo', priority: 'media', status: 'pendente' });
  const [filterCat, setFilterCat] = useState('');
  const [filterPrio, setFilterPrio] = useState('');
  const [filterUser, setFilterUser] = useState('');

  const load = async () => {
    const { data } = await supabase
      .from('internal_tasks')
      .select('*')
      .eq('scope', 'agencia')
      .order('created_at', { ascending: false });
    if (data) setTasks(data as any);
  };

  useEffect(() => {
    load();
    supabase.from('support_users').select('id, name').then(({ data }) => data && setSupportUsers(data));
    const ch = supabase
      .channel('agency-tasks-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_tasks' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => tasks.filter(t => {
    if (filterCat && t.category !== filterCat) return false;
    if (filterPrio && t.priority !== filterPrio) return false;
    if (filterUser && t.assigned_to !== filterUser) return false;
    return true;
  }), [tasks, filterCat, filterPrio, filterUser]);

  const kpis = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      abertas: tasks.filter(t => t.status !== 'concluida' && t.status !== 'cancelada').length,
      urgentes: tasks.filter(t => t.priority === 'urgente' && t.status !== 'concluida').length,
      vencidas: tasks.filter(t => t.due_date && t.status !== 'concluida' && isBefore(parseISO(t.due_date), now)).length,
      concluidasMes: tasks.filter(t => t.status === 'concluida' && new Date(t.created_at) >= monthStart).length,
    };
  }, [tasks]);

  const openCreate = () => {
    setEditing(null);
    setForm({ category: 'Administrativo', priority: 'media', status: 'pendente' });
    setShowForm(true);
  };
  const openEdit = (t: Task) => {
    setEditing(t);
    setForm({ ...t });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title?.trim()) { toast.error('Título é obrigatório'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      title: form.title.trim(),
      description: form.description || null,
      category: form.category || 'Administrativo',
      structure_type: 'Agência',
      scope: 'agencia',
      priority: form.priority || 'media',
      due_date: form.due_date || null,
      assigned_to: form.assigned_to || null,
      status: form.status || 'pendente',
      client_id: null,
    };
    if (editing) {
      const { error } = await supabase.from('internal_tasks').update(payload).eq('id', editing.id);
      if (error) { toast.error('Erro ao atualizar'); return; }
      logAudit({ action: 'agency_task_updated', entity: 'internal_task', entity_id: editing.id, after: payload });
      toast.success('Atualizado');
    } else {
      const { data, error } = await supabase.from('internal_tasks').insert({ ...payload, created_by: user?.id }).select().single();
      if (error) { toast.error('Erro ao criar'); return; }
      logAudit({ action: 'agency_task_created', entity: 'internal_task', entity_id: data?.id, after: payload });
      toast.success('Criado');
    }
    setShowForm(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('internal_tasks').update({ status }).eq('id', id);
  };
  const deleteTask = async (id: string) => {
    if (!confirm('Excluir esta pendência?')) return;
    await supabase.from('internal_tasks').delete().eq('id', id);
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Abertas" value={kpis.abertas} cls="text-amber-400" />
        <KPI label="Urgentes" value={kpis.urgentes} cls="text-destructive" />
        <KPI label="Vencidas" value={kpis.vencidas} cls="text-red-400" />
        <KPI label="Concluídas no mês" value={kpis.concluidasMes} cls="text-primary" />
      </div>

      {/* Filtros + Criar */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center gap-2">
        <Filter size={14} className="text-muted-foreground" />
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className={cn(inputCls, "w-auto")}>
          <option value="">Todas categorias</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterPrio} onChange={e => setFilterPrio(e.target.value)} className={cn(inputCls, "w-auto")}>
          <option value="">Toda prioridade</option>
          {PRIORITIES.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}
        </select>
        <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className={cn(inputCls, "w-auto")}>
          <option value="">Todos responsáveis</option>
          {supportUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <button onClick={openCreate} className="ml-auto bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 hover:opacity-90">
          <Plus size={14} /> Nova pendência
        </button>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {STATUS_COLS.map(col => {
          const items = filtered.filter(t => t.status === col.key);
          const Icon = col.icon;
          return (
            <div key={col.key} className={cn("rounded-lg border p-3 min-h-[160px]", col.cls)}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-semibold"><Icon size={14} /> {col.label}</div>
                <span className={cn("text-[10px] font-bold rounded-full px-2 py-0.5", col.badge)}>{items.length}</span>
              </div>
              {items.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/60 text-center py-4">Nenhuma</p>
              ) : (
                <div className="space-y-2">
                  {items.map(t => {
                    const prio = PRIORITIES.find(p => p.v === t.priority)!;
                    const overdue = t.due_date && t.status !== 'concluida' && isBefore(parseISO(t.due_date), new Date());
                    return (
                      <div key={t.id} className={cn("border rounded-lg p-3 bg-secondary/40", overdue && "border-red-500/60 ring-1 ring-red-500/30")}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <button onClick={() => openEdit(t)} className="text-sm font-semibold text-left hover:text-primary">{t.title}</button>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{t.category}</span>
                              <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", prio.cls)}>{prio.label}</span>
                              {t.due_date && (
                                <span className={cn("text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1", overdue ? "bg-red-500/15 text-red-300 border border-red-500/40" : "bg-secondary text-muted-foreground")}>
                                  <Calendar size={9} />{format(parseISO(t.due_date), 'dd/MM', { locale: ptBR })}
                                </span>
                              )}
                              {t.assigned_to && (
                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                  {supportUsers.find(u => u.id === t.assigned_to)?.name || '—'}
                                </span>
                              )}
                            </div>
                            {t.description && <p className="text-[11px] text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">{t.description}</p>}
                          </div>
                          <button onClick={() => deleteTask(t.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                        </div>
                        <select
                          value={t.status}
                          onChange={e => updateStatus(t.id, e.target.value)}
                          className="mt-2 w-full bg-secondary border border-border rounded px-2 py-1 text-xs"
                        >
                          <option value="pendente">Pendente</option>
                          <option value="em_andamento">Em andamento</option>
                          <option value="concluida">Concluída</option>
                          <option value="cancelada">Cancelada</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && tasks.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Briefcase size={40} className="mx-auto mb-3 opacity-40" />
          Nenhuma pendência da agência ainda. Clique em "Nova pendência" para criar.
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-semibold">{editing ? 'Editar pendência' : 'Nova pendência da agência'}</h3>
              <button onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Título *</label>
                <input value={form.title || ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Descrição</label>
                <textarea value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={cn(inputCls, "h-20 resize-none")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Categoria</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={inputCls}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Prioridade</label>
                  <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className={inputCls}>
                    {PRIORITIES.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Prazo</label>
                  <input type="date" value={form.due_date || ''} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Responsável</label>
                  <select value={form.assigned_to || ''} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} className={inputCls}>
                    <option value="">Sem atribuição</option>
                    {supportUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              {editing && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className={inputCls}>
                    <option value="pendente">Pendente</option>
                    <option value="em_andamento">Em andamento</option>
                    <option value="concluida">Concluída</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
              )}
              <button onClick={handleSave} className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90">
                {editing ? 'Salvar alterações' : 'Criar pendência'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const KPI: React.FC<{ label: string; value: number; cls: string }> = ({ label, value, cls }) => (
  <div className="bg-card border border-border rounded-xl p-4">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={cn("text-2xl font-bold mt-1", cls)}>{value}</div>
  </div>
);

export default AgencyTasksTab;
