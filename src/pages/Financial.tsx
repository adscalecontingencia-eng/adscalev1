import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  date: string;
  type: 'receita' | 'gasto';
  category: string;
  subcategory: string;
  clientId?: string;
  amount: number;
  description: string;
}

interface ClientOption {
  id: string;
  name: string;
}

const CATEGORIES = ['BMs', 'Perfis', 'Proxy', 'Multilogin', 'Comissão Fixa', 'Comissão Semanal', 'Outros'];

const Financial: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], type: 'gasto' as 'receita' | 'gasto', category: 'BMs', subcategory: '', clientId: '', amount: '', description: '' });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [txRes, clientRes] = await Promise.all([
      supabase.from('transactions').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name'),
    ]);
    if (txRes.data) {
      setTransactions(txRes.data.map(t => ({
        id: t.id, date: t.date, type: t.type as 'receita' | 'gasto', category: t.category,
        subcategory: t.subcategory || '', clientId: t.client_id || undefined, amount: Number(t.amount), description: t.description,
      })));
    }
    if (clientRes.data) setClients(clientRes.data.map(c => ({ id: c.id, name: c.name })));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) errs.amount = 'O valor deve ser um número positivo';
    if (!form.date) errs.date = 'Data é obrigatória';
    if (!form.description.trim()) errs.description = 'Descrição é obrigatória';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const { error } = await supabase.from('transactions').insert({
      date: form.date, type: form.type, category: form.category,
      subcategory: form.subcategory || null, client_id: form.clientId || null,
      amount: parseFloat(form.amount), description: form.description,
    });
    if (error) { toast.error('Erro ao salvar transação'); return; }
    toast.success('Transação salva!');
    setForm({ date: new Date().toISOString().split('T')[0], type: 'gasto', category: 'BMs', subcategory: '', clientId: '', amount: '', description: '' });
    setShowForm(false);
    setErrors({});
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover'); return; }
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const fmt = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const inputClass = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors";
  const errorInputClass = "w-full bg-secondary border border-destructive rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-destructive transition-colors";

  const totalRevenue = transactions.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + t.amount, 0);

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground text-sm">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 border-glow">
          <p className="text-xs text-muted-foreground">Receitas totais</p>
          <p className="text-xl font-bold text-primary">{fmt(totalRevenue)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 border-glow">
          <p className="text-xs text-muted-foreground">Gastos totais</p>
          <p className="text-xl font-bold text-destructive">{fmt(totalExpenses)}</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="font-display text-sm font-semibold">Transações</h3>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 glow-box">
          <Plus size={16} /> Adicionar
        </button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-semibold">Nova Transação</h3>
              <button onClick={() => { setShowForm(false); setErrors({}); }} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Data</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className={errors.date ? errorInputClass : inputClass} />
                {errors.date && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.date}</p>}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Tipo</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))} className={inputClass}>
                  <option value="gasto">Gasto de Estrutura</option>
                  <option value="receita">Receita / Comissão</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Categoria</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={inputClass}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Cliente (opcional)</label>
                <select value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))} className={inputClass}>
                  <option value="">Sem cliente</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Valor ($)</label>
                <input type="number" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" className={errors.amount ? errorInputClass : inputClass} />
                {errors.amount && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.amount}</p>}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Descrição</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={errors.description ? errorInputClass : inputClass} />
                {errors.description && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.description}</p>}
              </div>
              <button onClick={handleSave} className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 glow-box">Salvar</button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <div className="space-y-2">
        {transactions.map(t => (
          <div key={t.id} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded ${t.type === 'receita' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                  {t.type === 'receita' ? 'Receita' : 'Gasto'}
                </span>
                <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded">{t.category}</span>
              </div>
              <p className="text-sm mt-1">{t.description}</p>
              <p className="text-xs text-muted-foreground">{new Date(t.date).toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-semibold ${t.type === 'receita' ? 'text-primary' : 'text-destructive'}`}>{fmt(t.amount)}</span>
              <button onClick={() => handleDelete(t.id)} className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
            </div>
          </div>
        ))}
        {transactions.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Nenhuma transação registrada.</p>}
      </div>
    </div>
  );
};

export default Financial;
