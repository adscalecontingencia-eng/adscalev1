import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  category: 'manutencao' | 'atendimento';
  structureType: 'BMs' | 'Perfis' | 'Proxy' | 'Multilogin' | 'Outro';
  assignedTo?: string;
  clientId?: string;
  status: 'pendente' | 'em_andamento' | 'concluida';
  createdAt: string;
}

const Support: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(() => JSON.parse(localStorage.getItem('adscale_tasks') || '[]'));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Task>>({ category: 'manutencao', structureType: 'BMs', status: 'pendente' });
  const supportUsers = JSON.parse(localStorage.getItem('adscale_support_users') || '[]');
  const clients = JSON.parse(localStorage.getItem('adscale_clients') || '[]');

  useEffect(() => { localStorage.setItem('adscale_tasks', JSON.stringify(tasks)); }, [tasks]);

  const handleSave = () => {
    if (!form.title) return;
    const t: Task = {
      id: `task-${Date.now()}`, title: form.title || '', description: form.description || '',
      category: form.category || 'manutencao', structureType: form.structureType || 'BMs',
      assignedTo: form.assignedTo, clientId: form.clientId, status: 'pendente',
      createdAt: new Date().toISOString(),
    };
    setTasks(prev => [t, ...prev]);
    setForm({ category: 'manutencao', structureType: 'BMs', status: 'pendente' });
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
      <div className="flex justify-between items-center">
        <div className="flex gap-2 text-xs">
          <span className="bg-muted text-muted-foreground px-2 py-1 rounded">Pendentes: {tasks.filter(t => t.status === 'pendente').length}</span>
          <span className="bg-warning/10 text-warning px-2 py-1 rounded">Em andamento: {tasks.filter(t => t.status === 'em_andamento').length}</span>
          <span className="bg-primary/10 text-primary px-2 py-1 rounded">Concluídas: {tasks.filter(t => t.status === 'concluida').length}</span>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 glow-box">
          <Plus size={16} /> Nova Tarefa
        </button>
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
                    {['BMs', 'Perfis', 'Proxy', 'Multilogin', 'Outro'].map(s => <option key={s} value={s}>{s}</option>)}
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
