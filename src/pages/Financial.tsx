import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, AlertCircle, CalendarIcon, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDateLocal, formatDateBR } from '@/lib/date-utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

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

type DateFilter = 'all' | 'today' | '7days' | 'month' | 'custom' | 'range';

const CATEGORIES = ['BMs', 'Perfis', 'Proxy', 'Multilogin', 'Comissão Fixa', 'Comissão Semanal', 'Outros'];

const Financial: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], type: 'gasto' as 'receita' | 'gasto', category: 'BMs', subcategory: '', clientId: '', amount: '', description: '' });
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customDate, setCustomDate] = useState<Date | undefined>(new Date());
  const [rangeFrom, setRangeFrom] = useState<Date | undefined>(undefined);
  const [rangeTo, setRangeTo] = useState<Date | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

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

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter(t => {
      const d = new Date(t.date);

      // Date filter
      if (dateFilter === 'today' && d.toDateString() !== now.toDateString()) return false;
      if (dateFilter === '7days' && d < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) return false;
      if (dateFilter === 'month' && (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())) return false;
      if (dateFilter === 'custom' && customDate) {
        if (d.toDateString() !== customDate.toDateString()) return false;
      }
      if (dateFilter === 'range') {
        if (rangeFrom) { const from = new Date(rangeFrom); from.setHours(0,0,0,0); if (d < from) return false; }
        if (rangeTo) { const to = new Date(rangeTo); to.setHours(23,59,59,999); if (d > to) return false; }
      }

      // Category filter
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;

      // Type filter
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;

      return true;
    });
  }, [transactions, dateFilter, customDate, rangeFrom, rangeTo, categoryFilter, typeFilter]);

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

  const totalRevenue = filteredTransactions.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filteredTransactions.filter(t => t.type === 'gasto').reduce((s, t) => s + t.amount, 0);

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground text-sm">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Filter size={16} className="text-muted-foreground" />
          {(['all', 'today', '7days', 'month', 'custom', 'range'] as DateFilter[]).map(f => (
            <button key={f} onClick={() => setDateFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${dateFilter === f ? 'bg-primary text-primary-foreground glow-box' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {f === 'all' ? 'Todos' : f === 'today' ? 'Hoje' : f === '7days' ? '7 dias' : f === 'month' ? 'Este mês' : f === 'custom' ? 'Data' : 'Período'}
            </button>
          ))}
          {dateFilter === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-secondary border border-border text-foreground hover:border-primary transition-colors")}>
                  <CalendarIcon size={12} />
                  {customDate ? format(customDate, "dd/MM/yyyy", { locale: ptBR }) : 'Selecionar'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customDate} onSelect={setCustomDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          )}
          {dateFilter === 'range' && (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-secondary border border-border text-foreground hover:border-primary transition-colors")}>
                    <CalendarIcon size={12} />
                    {rangeFrom ? format(rangeFrom, "dd/MM/yyyy") : 'De'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={rangeFrom} onSelect={setRangeFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">até</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-secondary border border-border text-foreground hover:border-primary transition-colors")}>
                    <CalendarIcon size={12} />
                    {rangeTo ? format(rangeTo, "dd/MM/yyyy") : 'Até'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={rangeTo} onSelect={setRangeTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors">
            <option value="all">Todas categorias</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors">
            <option value="all">Todos tipos</option>
            <option value="receita">Receita</option>
            <option value="gasto">Gasto</option>
          </select>
        </div>
      </div>

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
        <h3 className="font-display text-sm font-semibold">Transações ({filteredTransactions.length})</h3>
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
        {filteredTransactions.map(t => (
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
        {filteredTransactions.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Nenhuma transação encontrada.</p>}
      </div>
    </div>
  );
};

export default Financial;
