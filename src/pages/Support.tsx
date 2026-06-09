import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PageHero } from '@/components/ui-kit';
import { Plus, X, CheckCircle2, Clock, AlertTriangle, LifeBuoy, CreditCard, ImageIcon, ListTodo, Building2, Briefcase, LayoutGrid } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { logAudit } from '@/lib/audit';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import BMActivityTab from '@/components/support/BMActivityTab';
import AgencyTasksTab from '@/components/support/AgencyTasksTab';
import BMPanelTab from '@/components/support/BMPanelTab';

interface Task {
  id: string;
  title: string;
  description: string | null;
  category: string;
  structure_type: string;
  assigned_to?: string | null;
  client_id?: string | null;
  status: string;
  created_at: string;
}

const Support: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Task>>({ category: 'manutencao', structure_type: 'BM Comum', status: 'pendente' });
  const [supportUsers, setSupportUsers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [clientRequests, setClientRequests] = useState<any[]>([]);

  const loadClientRequests = async () => {
    const { data } = await supabase
      .from('support_requests')
      .select('*, client:clients(name, email)')
      .order('created_at', { ascending: false });
    if (data) setClientRequests(data);
  };

  const loadTasks = async () => {
    const { data } = await supabase
      .from('internal_tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setTasks(data as Task[]);
  };

  useEffect(() => {
    const fetchData = async () => {
      const [supRes, cliRes] = await Promise.all([
        supabase.from('support_users').select('id, name'),
        supabase.from('clients').select('id, name'),
      ]);
      if (supRes.data) setSupportUsers(supRes.data);
      if (cliRes.data) setClients(cliRes.data);
      await Promise.all([loadClientRequests(), loadTasks()]);
    };
    fetchData();

    // Migração one-shot do localStorage → DB
    try {
      const legacy = localStorage.getItem('adscale_tasks');
      if (legacy) {
        const arr = JSON.parse(legacy);
        if (Array.isArray(arr) && arr.length > 0) {
          supabase.from('internal_tasks').insert(arr.map((t: any) => ({
            title: t.title,
            description: t.description || null,
            category: t.category || 'manutencao',
            structure_type: t.structureType || t.structure_type || 'BM Comum',
            assigned_to: t.assignedTo || t.assigned_to || null,
            client_id: t.clientId || t.client_id || null,
            status: t.status || 'pendente',
          }))).then(() => {
            localStorage.removeItem('adscale_tasks');
            loadTasks();
          });
        } else {
          localStorage.removeItem('adscale_tasks');
        }
      }
    } catch { /* silent */ }

    // Realtime: solicitações de cliente + tarefas
    const ch = supabase
      .channel('support-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_requests' }, () => loadClientRequests())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_tasks' }, () => loadTasks())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const updateRequestStatus = async (id: string, status: string) => {
    const prev = clientRequests.find(r => r.id === id);
    const patch: any = { status };
    if (status === 'concluida' || status === 'cancelada') patch.resolved_at = new Date().toISOString();
    await supabase.from('support_requests').update(patch).eq('id', id);
    setClientRequests(prevList => prevList.map(r => r.id === id ? { ...r, ...patch } : r));
    logAudit({ action: 'support_request_status_changed', entity: 'support_request', entity_id: id, before: { status: prev?.status }, after: { status } });
  };

  const handleSave = async () => {
    if (!form.title) return;
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      title: form.title,
      description: form.description || null,
      category: form.category || 'manutencao',
      structure_type: form.structure_type || 'BM Comum',
      assigned_to: form.assigned_to || null,
      client_id: form.client_id || null,
      status: 'pendente',
      created_by: user?.id ?? null,
    };
    const { data, error } = await supabase.from('internal_tasks').insert(payload).select().single();
    if (error) { toast.error('Erro ao criar tarefa'); return; }
    setForm({ category: 'manutencao', structure_type: 'BM Comum', status: 'pendente' });
    setShowForm(false);
    logAudit({ action: 'internal_task_created', entity: 'internal_task', entity_id: data?.id, after: payload });
  };

  const updateStatus = async (id: string, status: string) => {
    const prev = tasks.find(t => t.id === id);
    await supabase.from('internal_tasks').update({ status }).eq('id', id);
    logAudit({ action: 'internal_task_status_changed', entity: 'internal_task', entity_id: id, before: { status: prev?.status }, after: { status } });
  };

  const deleteTask = async (id: string) => {
    const prev = tasks.find(t => t.id === id);
    await supabase.from('internal_tasks').delete().eq('id', id);
    logAudit({ action: 'internal_task_deleted', entity: 'internal_task', entity_id: id, before: prev as any });
  };

  const statusIcon = (s: string) => {
    if (s === 'concluida') return <CheckCircle2 size={14} className="text-primary" />;
    if (s === 'em_andamento') return <Clock size={14} className="text-warning" />;
    return <AlertTriangle size={14} className="text-muted-foreground" />;
  };

  const inputClass = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors";

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Suporte"
        title={<>Operação & <span className="text-primary glow-text">tarefas</span></>}
        description="Tarefas internas, solicitações de clientes, e registro diário de BMs e atividades do time."
        actions={
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 shadow-[0_0_20px_hsl(var(--primary)/0.4)]">
            <Plus size={16} /> Nova Tarefa
          </button>
        }
      />

      <Tabs defaultValue="tarefas" className="space-y-5">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto sm:inline-grid h-auto p-1 bg-secondary/60 border border-border">
          <TabsTrigger value="tarefas" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 gap-2 text-xs sm:text-sm">
            <ListTodo size={14} /> Tarefas & Solicitações
          </TabsTrigger>
          <TabsTrigger value="agencia" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 gap-2 text-xs sm:text-sm">
            <Briefcase size={14} /> Agência
          </TabsTrigger>
          <TabsTrigger value="painel-bms" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 gap-2 text-xs sm:text-sm">
            <LayoutGrid size={14} /> Painel BMs
          </TabsTrigger>
          <TabsTrigger value="bms" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 gap-2 text-xs sm:text-sm">
            <Building2 size={14} /> Atividades & BMs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tarefas" className="space-y-6 mt-0">
          {(() => {

        const allItems = [
          ...tasks.map(t => ({ status: t.status })),
          ...clientRequests.map((r: any) => ({ status: r.status || 'pendente' })),
        ];
        const count = (s: string) => allItems.filter(i => i.status === s).length;
        return (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-muted/60 backdrop-blur border border-border/60 text-muted-foreground px-3 py-1.5 rounded-full">Pendentes · {count('pendente')}</span>
            <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-full">Em andamento · {count('em_andamento')}</span>
            <span className="bg-primary/10 border border-primary/30 text-primary px-3 py-1.5 rounded-full">Concluídas · {count('concluida')}</span>
          </div>
        );
      })()}

      {/* Client service requests */}
      <div className="bg-card border border-border rounded-xl p-5 border-glow">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-display text-sm font-semibold flex items-center gap-2">
            <LifeBuoy size={16} className="text-primary" /> Solicitações de clientes
            {clientRequests.filter(r => r.status === 'pendente').length > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-2 py-0.5">
                {clientRequests.filter(r => r.status === 'pendente').length} novas
              </span>
            )}
          </h3>
          <button onClick={loadClientRequests} className="text-xs text-muted-foreground hover:text-primary">Atualizar</button>
        </div>
        {(() => {
          const merged: any[] = [
            ...clientRequests.map((r: any) => ({ ...r, _kind: 'request' })),
            ...tasks.map((t: any) => ({ ...t, _kind: 'task' })),
          ];
          if (merged.length === 0) {
            return <p className="text-center text-muted-foreground text-xs py-6">Nenhuma solicitação ou tarefa.</p>;
          }
          const columns = [
            { key: 'pendente', label: 'Pendente', accent: 'border-amber-500/40 bg-amber-500/5', badge: 'bg-amber-500/20 text-amber-300', icon: <AlertTriangle size={14} /> },
            { key: 'em_andamento', label: 'Em andamento', accent: 'border-blue-500/40 bg-blue-500/5', badge: 'bg-blue-500/20 text-blue-300', icon: <Clock size={14} /> },
            { key: 'concluida', label: 'Concluída', accent: 'border-primary/40 bg-primary/5', badge: 'bg-primary/20 text-primary', icon: <CheckCircle2 size={14} /> },
          ] as const;
          return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {columns.map(col => {
              const items = merged
                .filter((r: any) => (r.status || 'pendente') === col.key)
                .sort((a: any, b: any) => {
                  // Para Pendente e Em andamento: mais antigos (maior tempo) no topo.
                  // Para Concluída: mantém recente no topo.
                  if (col.key === 'concluida') {
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                  }
                  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                });
              return (
                <div key={col.key} className={cn("rounded-lg border p-3 min-h-[120px]", col.accent)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      {col.icon} {col.label}
                    </div>
                    <span className={cn("text-[10px] font-bold rounded-full px-2 py-0.5", col.badge)}>{items.length}</span>
                  </div>
                  {items.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/60 text-center py-4">Nenhuma</p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((r: any) => {
                        const ageMs = Date.now() - new Date(r.created_at).getTime();
                        const overdue = col.key !== 'concluida' && ageMs > 24 * 60 * 60 * 1000;
                        const hoursLate = Math.floor(ageMs / (60 * 60 * 1000));
                        const overdueCard = overdue
                          ? 'bg-red-500/10 border-red-500/60 ring-1 ring-red-500/40 shadow-[0_0_14px_-2px_rgba(239,68,68,0.45)]'
                          : 'bg-secondary/40 border-border';
                        const overdueBadge = overdue && (
                          <span className="text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/50 px-1.5 py-0.5 rounded inline-flex items-center gap-1 animate-pulse">
                            <AlertTriangle size={10} /> Atrasado {hoursLate}h
                          </span>
                        );
                        if (r._kind === 'task') {
                          const assignedName = supportUsers.find((u: any) => u.id === r.assigned_to)?.name;
                          const clientName = clients.find((c: any) => c.id === r.client_id)?.name;
                          return (
                            <div key={`t-${r.id}`} className={cn("border rounded-lg p-3 flex flex-col gap-2", overdueCard)}>
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", overdue ? "bg-red-500/20 text-red-300" : "bg-primary/10 text-primary")}>
                                  <LifeBuoy size={16} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-semibold">{r.title}</p>
                                    {overdueBadge}
                                    <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{r.category === 'manutencao' ? 'Manutenção' : 'Atendimento'}</span>
                                    <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{r.structure_type}</span>
                                    {clientName && <span className="text-[11px] text-primary">{clientName}</span>}
                                  </div>
                                  {r.description && <p className="text-[11px] text-muted-foreground mt-0.5 whitespace-pre-wrap">{r.description}</p>}
                                  {assignedName && <p className="text-[10px] text-primary mt-1">Atribuído: {assignedName}</p>}
                                  <p className={cn("text-[10px] mt-1", overdue ? "text-red-400/80 font-semibold" : "text-muted-foreground/70")}>
                                    {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <select
                                  value={r.status}
                                  onChange={e => updateStatus(r.id, e.target.value)}
                                  className="bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground flex-1"
                                >
                                  <option value="pendente">Pendente</option>
                                  <option value="em_andamento">Em andamento</option>
                                  <option value="concluida">Concluída</option>
                                </select>
                                <button onClick={() => deleteTask(r.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><X size={14} /></button>
                              </div>
                            </div>
                          );
                        }
                        const TypeIcon = r.request_type === 'add_ad_account' ? CreditCard : r.request_type === 'add_page' ? ImageIcon : LifeBuoy;
                        const typeLabel = r.request_type === 'add_ad_account' ? 'Adicionar conta' : r.request_type === 'add_page' ? 'Adicionar página' : 'Outro';
                        return (
                <div key={r.id} className={cn("border rounded-lg p-3 flex flex-col gap-2", overdueCard)}>
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", overdue ? "bg-red-500/20 text-red-300" : "bg-primary/10 text-primary")}>
                      <TypeIcon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{typeLabel}</p>
                        {overdueBadge}
                        {r.request_type !== 'other' && (
                          <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">x{r.quantity}</span>
                        )}
                        <span className="text-[11px] text-primary">{r.client?.name || '—'}</span>
                      </div>
                      {r.description && <p className="text-[11px] text-muted-foreground mt-0.5 whitespace-pre-wrap">{r.description}</p>}
                      {r.bm_meta_id && (
                        <p className="text-[11px] text-primary flex items-center gap-1 mt-1">
                          <CreditCard size={11} /> BM destino: <span className="font-mono">{r.bm_meta_id}</span>
                        </p>
                      )}
                      {Array.isArray(r.page_names) && r.page_names.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.page_names.map((n: string, i: number) => (
                            <span key={i} className="text-[10px] bg-primary/10 text-primary border border-primary/30 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                              <ImageIcon size={9} /> {n}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className={cn("text-[10px] mt-1", overdue ? "text-red-400/80 font-semibold" : "text-muted-foreground/70")}>
                        {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <select
                    value={r.status}
                    onChange={e => updateRequestStatus(r.id, e.target.value)}
                    className={cn(
                      "bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground",
                      r.status === 'concluida' && 'text-emerald-400',
                      r.status === 'em_andamento' && 'text-warning',
                    )}
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
          );
        })()}
      </div>


      {showForm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-semibold">Nova Tarefa</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Título</label>
                <input value={form.title || ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className={inputClass} required />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Descrição</label>
                <textarea value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={`${inputClass} h-20 resize-none`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Categoria</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as any }))} className={inputClass}>
                    <option value="manutencao">Manutenção</option>
                    <option value="atendimento">Atendimento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Estrutura</label>
                  <select value={form.structure_type} onChange={e => setForm(p => ({ ...p, structure_type: e.target.value as any }))} className={inputClass}>
                    {['Perfil', 'BM Comum', 'BM Verificada', 'BM API', 'BM Disparo', 'Pagina', 'Outro'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Atribuir a</label>
                <select value={form.assigned_to || ''} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} className={inputClass}>
                  <option value="">Sem atribuição</option>
                  {supportUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Cliente</label>
                <select value={form.client_id || ''} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))} className={inputClass}>
                  <option value="">Nenhum</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button onClick={handleSave} className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 glow-box">Criar Tarefa</button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <div className="space-y-2">
        {tasks.map(t => (
          <div key={t.id} className="bg-card border border-border rounded-lg px-4 py-3 border-glow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {statusIcon(t.status)}
                  <h4 className="text-sm font-medium">{t.title}</h4>
                </div>
                {t.description && <p className="text-xs text-muted-foreground mb-2">{t.description}</p>}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-secondary text-muted-foreground px-2 py-0.5 rounded">{t.category === 'manutencao' ? 'Manutenção' : 'Atendimento'}</span>
                  <span className="bg-secondary text-muted-foreground px-2 py-0.5 rounded">{t.structure_type}</span>
                  {t.assigned_to && <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">{supportUsers.find((u: any) => u.id === t.assigned_to)?.name || 'Atribuído'}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <select
                  value={t.status}
                  onChange={e => updateStatus(t.id, e.target.value as Task['status'])}
                  className="bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground"
                >
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="concluida">Concluída</option>
                </select>
                <button onClick={() => deleteTask(t.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><X size={14} /></button>
              </div>
            </div>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Nenhuma tarefa registrada.</p>}
      </div>
        </TabsContent>

        <TabsContent value="agencia" className="mt-0">
          <AgencyTasksTab />
        </TabsContent>

        <TabsContent value="painel-bms" className="mt-0">
          <BMPanelTab />
        </TabsContent>

        <TabsContent value="bms" className="mt-0">
          <BMActivityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Support;
