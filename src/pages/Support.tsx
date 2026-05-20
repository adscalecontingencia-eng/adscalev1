import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PageHero } from '@/components/ui-kit';
import { Plus, X, CheckCircle2, Clock, AlertTriangle, LifeBuoy, CreditCard, ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  description: string;
  category: 'manutencao' | 'atendimento';
  structureType: 'Perfil' | 'BM Comum' | 'BM Verificada' | 'BM API' | 'BM Disparo' | 'Pagina' | 'Outro';
  assignedTo?: string;
  clientId?: string;
  status: 'pendente' | 'em_andamento' | 'concluida';
  createdAt: string;
}

const Support: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(() => JSON.parse(localStorage.getItem('adscale_tasks') || '[]'));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Task>>({ category: 'manutencao', structureType: 'BM Comum', status: 'pendente' });
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

  useEffect(() => {
    const fetchData = async () => {
      const [supRes, cliRes] = await Promise.all([
        supabase.from('support_users').select('id, name'),
        supabase.from('clients').select('id, name'),
      ]);
      if (supRes.data) setSupportUsers(supRes.data);
      if (cliRes.data) setClients(cliRes.data);
      await loadClientRequests();
    };
    fetchData();
  }, []);

  const updateRequestStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === 'concluida' || status === 'cancelada') patch.resolved_at = new Date().toISOString();
    await supabase.from('support_requests').update(patch).eq('id', id);
    setClientRequests(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  useEffect(() => { localStorage.setItem('adscale_tasks', JSON.stringify(tasks)); }, [tasks]);

  const handleSave = () => {
    if (!form.title) return;
    const t: Task = {
      id: `task-${Date.now()}`, title: form.title || '', description: form.description || '',
      category: form.category || 'manutencao', structureType: form.structureType || 'BM Comum',
      assignedTo: form.assignedTo, clientId: form.clientId, status: 'pendente',
      createdAt: new Date().toISOString(),
    };
    setTasks(prev => [t, ...prev]);
    setForm({ category: 'manutencao', structureType: 'BM Comum', status: 'pendente' });
    setShowForm(false);
  };

  const updateStatus = (id: string, status: Task['status']) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  };

  const deleteTask = (id: string) => setTasks(prev => prev.filter(t => t.id !== id));

  const statusIcon = (s: Task['status']) => {
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
        description="Tarefas internas de manutenção, atendimento e estrutura — distribuídas para o time de suporte."
        actions={
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 shadow-[0_0_20px_hsl(var(--primary)/0.4)]">
            <Plus size={16} /> Nova Tarefa
          </button>
        }
      />

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="bg-muted/60 backdrop-blur border border-border/60 text-muted-foreground px-3 py-1.5 rounded-full">Pendentes · {tasks.filter(t => t.status === 'pendente').length}</span>
        <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-full">Em andamento · {tasks.filter(t => t.status === 'em_andamento').length}</span>
        <span className="bg-primary/10 border border-primary/30 text-primary px-3 py-1.5 rounded-full">Concluídas · {tasks.filter(t => t.status === 'concluida').length}</span>
      </div>

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
        {clientRequests.length === 0 ? (
          <p className="text-center text-muted-foreground text-xs py-6">Nenhuma solicitação de cliente.</p>
        ) : (
          <div className="space-y-2">
            {clientRequests.map((r: any) => {
              const TypeIcon = r.request_type === 'add_ad_account' ? CreditCard : r.request_type === 'add_page' ? ImageIcon : LifeBuoy;
              const typeLabel = r.request_type === 'add_ad_account' ? 'Adicionar conta' : r.request_type === 'add_page' ? 'Adicionar página' : 'Outro';
              return (
                <div key={r.id} className="bg-secondary/40 border border-border rounded-lg p-3 flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <TypeIcon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{typeLabel}</p>
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
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
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
                  <select value={form.structureType} onChange={e => setForm(p => ({ ...p, structureType: e.target.value as any }))} className={inputClass}>
                    {['Perfil', 'BM Comum', 'BM Verificada', 'BM API', 'BM Disparo', 'Pagina', 'Outro'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Atribuir a</label>
                <select value={form.assignedTo || ''} onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))} className={inputClass}>
                  <option value="">Sem atribuição</option>
                  {supportUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Cliente</label>
                <select value={form.clientId || ''} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))} className={inputClass}>
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
                  <span className="bg-secondary text-muted-foreground px-2 py-0.5 rounded">{t.structureType}</span>
                  {t.assignedTo && <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">{supportUsers.find((u: any) => u.id === t.assignedTo)?.name || 'Atribuído'}</span>}
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
    </div>
  );
};

export default Support;
