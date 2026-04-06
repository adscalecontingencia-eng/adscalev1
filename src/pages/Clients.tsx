import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, X, DollarSign, CheckCircle, ChevronDown, ChevronUp, CalendarIcon, Receipt, Pencil } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, startOfWeek, endOfWeek, isWithinInterval, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDateLocal, formatDateBR } from '@/lib/date-utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Client {
  id: string;
  number: string;
  name: string;
  companyName: string;
  email: string;
  password: string;
  observations: string;
  paymentType: 'fixed' | 'percentage' | 'both';
  fixedValue?: number;
  percentageValue?: number;
  adAccounts: number;
  usedAccounts: number;
  blockedAccounts: number;
}

interface Commission {
  id: string;
  clientId: string;
  date: string;
  amount: number;
  adSpend: number;
  type: 'daily' | 'paid' | 'weekly_billing';
  note?: string;
  billingWeekStart?: string;
  billingWeekEnd?: string;
  isWeeklyBilling?: boolean;
  percentualAplicado?: number;
  valorPago?: number;
  valorPendente?: number;
  status?: string;
}

const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showCommissionForm, setShowCommissionForm] = useState<string | null>(null);
  const [showPaidForm, setShowPaidForm] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Client | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Client>>({ paymentType: 'fixed', adAccounts: 0, usedAccounts: 0, blockedAccounts: 0 });
  const [adSpendAmount, setAdSpendAmount] = useState('');
  const [commissionNote, setCommissionNote] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [commissionDate, setCommissionDate] = useState<Date>(new Date());
  const [paidDate, setPaidDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('month');
  const [customStart, setCustomStart] = useState<Date | undefined>(undefined);
  const [customEnd, setCustomEnd] = useState<Date | undefined>(undefined);

  // Edit commission state
  const [editingCommission, setEditingCommission] = useState<Commission | null>(null);
  const [editCommAmount, setEditCommAmount] = useState('');
  const [editCommAdSpend, setEditCommAdSpend] = useState('');
  const [editCommNote, setEditCommNote] = useState('');
  const [editCommDate, setEditCommDate] = useState<Date>(new Date());

  const fetchClients = async () => {
    const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
    if (error) { toast.error('Erro ao carregar clientes'); return; }
    setClients((data || []).map(c => ({
      id: c.id, number: c.number || '', name: c.name, companyName: c.company_name || '',
      email: c.email, password: c.password, observations: c.observations || '',
      paymentType: (c.payment_type as 'fixed' | 'percentage' | 'both') || 'fixed',
      fixedValue: Number(c.fixed_value) || 0, percentageValue: Number(c.percentage_value) || 0,
      adAccounts: c.ad_accounts || 0, usedAccounts: c.used_accounts || 0, blockedAccounts: c.blocked_accounts || 0,
    })));
    setLoading(false);
  };

  const fetchCommissions = async () => {
    const { data, error } = await supabase.from('commissions').select('*').order('date', { ascending: false });
    if (error) return;
    setCommissions((data || []).map(c => ({
      id: c.id, clientId: c.client_id, date: c.date, amount: Number(c.amount),
      adSpend: Number(c.ad_spend) || 0,
      type: c.type as 'daily' | 'paid' | 'weekly_billing', note: c.note || undefined,
      billingWeekStart: c.billing_week_start || undefined,
      billingWeekEnd: c.billing_week_end || undefined,
      isWeeklyBilling: c.is_weekly_billing || false,
      percentualAplicado: Number((c as any).percentual_aplicado) || 0,
      valorPago: Number((c as any).valor_pago) || 0,
      valorPendente: Number((c as any).valor_pendente) || 0,
      status: (c as any).status || 'pendente',
    })));
  };

  useEffect(() => { fetchClients(); fetchCommissions(); }, []);

  const calculateCommission = (client: Client, adSpend: number): number => {
    let commission = 0;
    if (client.paymentType === 'fixed' || client.paymentType === 'both') {
      commission += client.fixedValue || 0;
    }
    if (client.paymentType === 'percentage' || client.paymentType === 'both') {
      commission += adSpend * ((client.percentageValue || 0) / 100);
    }
    return commission;
  };

  const handleSave = async () => {
    if (!form.name || !form.email || !form.number) {
      toast.error('Preencha os campos obrigatórios: Número, Nome e E-mail');
      return;
    }
    setSaving(true);

    if (editing) {
      const payload = {
        number: form.number || '', name: form.name || '', company_name: form.companyName || '',
        email: form.email || '', observations: form.observations || '',
        payment_type: form.paymentType || 'fixed', fixed_value: form.fixedValue || 0, percentage_value: form.percentageValue || 0,
        ad_accounts: form.adAccounts || 0, used_accounts: form.usedAccounts || 0, blocked_accounts: form.blockedAccounts || 0,
      };
      const { error } = await supabase.from('clients').update(payload).eq('id', editing.id);
      if (error) { toast.error('Erro ao atualizar cliente'); setSaving(false); return; }
      toast.success('Cliente atualizado!');
    } else {
      const password = form.password || '123456';
      const res = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create_user', email: form.email, password, name: form.name, role: 'client',
          client_data: {
            number: form.number, companyName: form.companyName, observations: form.observations,
            paymentType: form.paymentType || 'fixed', fixedValue: form.fixedValue || 0,
            percentageValue: form.percentageValue || 0, adAccounts: form.adAccounts || 0,
            usedAccounts: form.usedAccounts || 0, blockedAccounts: form.blockedAccounts || 0,
          },
        },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || res.error?.message || 'Erro ao cadastrar cliente');
        setSaving(false); return;
      }
      toast.success('Cliente cadastrado!');
    }
    setSaving(false);
    resetForm();
    fetchClients();
  };

  const resetForm = () => {
    setForm({ paymentType: 'fixed', adAccounts: 0, usedAccounts: 0, blockedAccounts: 0 });
    setEditing(null);
    setShowForm(false);
  };

  const handleEdit = (c: Client) => { setForm(c); setEditing(c); setShowForm(true); };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover cliente'); return; }
    setClients(prev => prev.filter(c => c.id !== id));
  };

  // "Lançar Gastos em Ads" — inserts ad spend, auto-calculates commission as PENDING
  const handleAddAdSpend = async (clientId: string) => {
    const adSpend = parseFloat(adSpendAmount);
    if (isNaN(adSpend) || adSpend <= 0) { toast.error('Informe um valor de gasto válido'); return; }
    
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    const commission = calculateCommission(client, adSpend);
    const percentApplied = client.paymentType === 'percentage' || client.paymentType === 'both' 
      ? client.percentageValue || 0 : 0;
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const { error: commError } = await supabase.from('commissions').insert({
      client_id: clientId, 
      date: commissionDate.toISOString(), 
      amount: commission,
      ad_spend: adSpend, 
      type: 'daily', 
      note: commissionNote || null,
      billing_week_start: format(weekStart, 'yyyy-MM-dd'),
      billing_week_end: format(weekEnd, 'yyyy-MM-dd'),
      percentual_aplicado: percentApplied,
      valor_pago: 0,
      valor_pendente: commission,
      status: 'pendente',
    } as any);
    if (commError) { toast.error('Erro ao lançar gasto em ads'); return; }

    const categoryType = client.paymentType === 'fixed' ? 'Comissão Fixa' : 'Comissão Semanal';
    const periodoStr = `${format(weekStart, 'dd/MM')} a ${format(weekEnd, 'dd/MM')}`;
    await supabase.from('transactions').insert({
      date: format(commissionDate, 'yyyy-MM-dd'),
      type: 'receita',
      category: categoryType,
      client_id: clientId,
      amount: commission,
      description: `Comissão do cliente ${client.name} - período ${periodoStr}`,
    });

    toast.success(`Gasto em Ads: ${fmt(adSpend)} → Comissão pendente: ${fmt(commission)}`);
    setAdSpendAmount(''); setCommissionNote(''); setCommissionDate(new Date()); setShowCommissionForm(null);
    fetchCommissions();
  };

  // "Comissão Paga" — subtracts from pending commissions
  const handleAddPaid = async (clientId: string) => {
    const amount = parseFloat(paidAmount);
    if (isNaN(amount) || amount <= 0) return;

    const { error } = await supabase.from('commissions').insert({
      client_id: clientId, date: paidDate.toISOString(), amount, type: 'paid',
    });
    if (error) { toast.error('Erro ao registrar pagamento'); return; }

    const clientDailyComms = commissions
      .filter(c => c.clientId === clientId && (c.type === 'daily' || c.type === 'weekly_billing') && (c.status === 'pendente' || c.status === 'parcial'))
      .sort((a, b) => parseDateLocal(a.date).getTime() - parseDateLocal(b.date).getTime());

    let remaining = amount;
    for (const comm of clientDailyComms) {
      if (remaining <= 0) break;
      const pendente = comm.valorPendente || (comm.amount - (comm.valorPago || 0));
      const payThis = Math.min(remaining, pendente);
      const newPago = (comm.valorPago || 0) + payThis;
      const newPendente = comm.amount - newPago;
      const newStatus = newPendente <= 0 ? 'pago' : newPago > 0 ? 'parcial' : 'pendente';
      
      await supabase.from('commissions').update({
        valor_pago: newPago,
        valor_pendente: Math.max(0, newPendente),
        status: newStatus,
      } as any).eq('id', comm.id);
      
      remaining -= payThis;
    }

    toast.success('Pagamento registrado! Comissões pendentes atualizadas.');
    setPaidAmount(''); setPaidDate(new Date()); setShowPaidForm(null);
    fetchCommissions();
  };

  const handleGenerateWeeklyBilling = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const existing = commissions.find(c =>
      c.clientId === clientId && c.type === 'weekly_billing' &&
      c.billingWeekStart === format(weekStart, 'yyyy-MM-dd') 
    );
    if (existing) {
      toast.error('Cobrança semanal já gerada para esta semana!');
      return;
    }

    const weeklyCommissions = commissions.filter(c =>
      c.clientId === clientId && c.type === 'daily' &&
      isWithinInterval(parseDateLocal(c.date), { start: weekStart, end: weekEnd })
    );
    const totalAdSpend = weeklyCommissions.reduce((s, c) => s + c.adSpend, 0);
    const totalCommission = weeklyCommissions.reduce((s, c) => s + c.amount, 0);

    if (totalCommission <= 0) {
      toast.error('Nenhum gasto em ads lançado nesta semana para gerar cobrança');
      return;
    }

    const { error } = await supabase.from('commissions').insert({
      client_id: clientId, date: now.toISOString(), amount: totalCommission,
      ad_spend: totalAdSpend, type: 'weekly_billing',
      billing_week_start: format(weekStart, 'yyyy-MM-dd'),
      billing_week_end: format(weekEnd, 'yyyy-MM-dd'),
      is_weekly_billing: true,
      note: `Cobrança semanal ${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM')}`,
      valor_pago: 0,
      valor_pendente: totalCommission,
      status: 'pendente',
    } as any);
    if (error) { toast.error('Erro ao gerar cobrança'); return; }
    toast.success(`Cobrança semanal de ${fmt(totalCommission)} gerada!`);
    fetchCommissions();
  };

  // Edit commission
  const startEditCommission = (comm: Commission) => {
    setEditingCommission(comm);
    setEditCommAmount(comm.amount.toString());
    setEditCommAdSpend(comm.adSpend.toString());
    setEditCommNote(comm.note || '');
    setEditCommDate(parseDateLocal(comm.date));
  };

  const handleSaveEditCommission = async () => {
    if (!editingCommission) return;
    const newAmount = parseFloat(editCommAmount);
    const newAdSpend = parseFloat(editCommAdSpend) || 0;
    if (isNaN(newAmount) || newAmount < 0) { toast.error('Valor inválido'); return; }

    // If it's a daily/weekly type and we're editing ad_spend, recalculate commission
    let finalAmount = newAmount;
    if ((editingCommission.type === 'daily' || editingCommission.type === 'weekly_billing') && newAdSpend > 0) {
      const client = clients.find(c => c.id === editingCommission.clientId);
      if (client) {
        finalAmount = calculateCommission(client, newAdSpend);
      }
    }

    const updatePayload: any = {
      amount: finalAmount,
      ad_spend: newAdSpend,
      note: editCommNote || null,
      date: editCommDate.toISOString(),
    };

    if (editingCommission.type === 'daily' || editingCommission.type === 'weekly_billing') {
      const pago = editingCommission.valorPago || 0;
      updatePayload.valor_pendente = Math.max(0, finalAmount - pago);
      updatePayload.status = finalAmount - pago <= 0 ? 'pago' : pago > 0 ? 'parcial' : 'pendente';
    }

    const { error } = await supabase.from('commissions').update(updatePayload).eq('id', editingCommission.id);
    if (error) { toast.error('Erro ao editar lançamento'); return; }
    toast.success('Lançamento atualizado!');
    setEditingCommission(null);
    fetchCommissions();
  };

  const handleDeleteCommission = async (commId: string) => {
    const { error } = await supabase.from('commissions').delete().eq('id', commId);
    if (error) { toast.error('Erro ao remover lançamento'); return; }
    toast.success('Lançamento removido!');
    fetchCommissions();
  };

  const getFilterRange = (): { start: Date; end: Date } | null => {
    const now = new Date();
    switch (periodFilter) {
      case 'today': return { start: startOfDay(now), end: endOfDay(now) };
      case 'yesterday': { const y = subDays(now, 1); return { start: startOfDay(y), end: endOfDay(y) }; }
      case 'week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'custom': return customStart && customEnd ? { start: startOfDay(customStart), end: endOfDay(customEnd) } : null;
    }
  };

  const getClientCommissions = (clientId: string) => commissions.filter(c => c.clientId === clientId);
  
  const getAccumulated = (clientId: string) => {
    const cc = getClientCommissions(clientId);
    const range = getFilterRange();
    
    const filtered = range 
      ? cc.filter(c => isWithinInterval(parseDateLocal(c.date), { start: range.start, end: range.end }))
      : cc;
    
    const comissionTypes = filtered.filter(c => c.type === 'daily' || c.type === 'weekly_billing');
    const daily = comissionTypes.reduce((s, c) => s + c.amount, 0);
    const paid = filtered.filter(c => c.type === 'paid').reduce((s, c) => s + c.amount, 0);
    const totalAdSpend = comissionTypes.reduce((s, c) => s + c.adSpend, 0);
    return { daily, paid, pending: daily - paid, totalAdSpend };
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.companyName.toLowerCase().includes(search.toLowerCase()) ||
    c.number.includes(search)
  );

  const fmt = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const inputClass = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors";

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground text-sm">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..." className={`${inputClass} pl-10`} />
        </div>
        <div className="flex gap-1 flex-wrap items-center">
          {([
            { key: 'today', label: 'Hoje' },
            { key: 'yesterday', label: 'Ontem' },
            { key: 'week', label: 'Semana' },
            { key: 'month', label: 'Mês' },
            { key: 'custom', label: 'Personalizado' },
          ] as const).map(p => (
            <button key={p.key} onClick={() => setPeriodFilter(p.key)}
              className={cn("px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                periodFilter === p.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              )}>
              {p.label}
            </button>
          ))}
          {periodFilter === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground flex items-center gap-1">
                    <CalendarIcon size={12} />
                    {customStart ? format(customStart, 'dd/MM/yyyy') : 'Início'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customStart} onSelect={setCustomStart} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground text-xs">até</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground flex items-center gap-1">
                    <CalendarIcon size={12} />
                    {customEnd ? format(customEnd, 'dd/MM/yyyy') : 'Fim'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 glow-box whitespace-nowrap">
          <Plus size={16} /> Novo Cliente
        </button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-semibold">{editing ? 'Editar Cliente' : 'Novo Cliente'}</h3>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Número</label>
                  <input value={form.number || ''} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} className={inputClass} required />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Nome</label>
                  <input value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputClass} required />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Empresa</label>
                <input value={form.companyName || ''} onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">E-mail (login)</label>
                  <input type="email" value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={inputClass} required />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Senha</label>
                  <input value={form.password || ''} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Observações (contrato)</label>
                <textarea value={form.observations || ''} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))} className={`${inputClass} h-24 resize-none`} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Tipo de Pagamento</label>
                <select value={form.paymentType} onChange={e => setForm(p => ({ ...p, paymentType: e.target.value as any }))} className={inputClass}>
                  <option value="fixed">Valor Fixo</option>
                  <option value="percentage">% sobre Gasto</option>
                  <option value="both">Fixo + %</option>
                </select>
              </div>
              {(form.paymentType === 'fixed' || form.paymentType === 'both') && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Valor Fixo ($)</label>
                  <input type="number" value={form.fixedValue || ''} onChange={e => setForm(p => ({ ...p, fixedValue: +e.target.value }))} className={inputClass} />
                </div>
              )}
              {(form.paymentType === 'percentage' || form.paymentType === 'both') && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Percentual (%)</label>
                  <input type="number" value={form.percentageValue || ''} onChange={e => setForm(p => ({ ...p, percentageValue: +e.target.value }))} className={inputClass} />
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Contas disponíveis</label>
                  <input type="number" value={form.adAccounts || 0} onChange={e => setForm(p => ({ ...p, adAccounts: +e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Contas usadas</label>
                  <input type="number" value={form.usedAccounts || 0} onChange={e => setForm(p => ({ ...p, usedAccounts: +e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Contas bloqueadas</label>
                  <input type="number" value={form.blockedAccounts || 0} onChange={e => setForm(p => ({ ...p, blockedAccounts: +e.target.value }))} className={inputClass} />
                </div>
              </div>
              <button onClick={handleSave} disabled={saving} className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 glow-box disabled:opacity-50">
                {saving ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Cadastrar Cliente'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Edit Commission Modal */}
      {editingCommission && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-semibold">
                Editar {editingCommission.type === 'paid' ? 'Pagamento' : 'Lançamento'}
              </h3>
              <button onClick={() => setEditingCommission(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Data</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={cn("flex items-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm bg-secondary border border-border text-foreground hover:border-primary transition-colors")}>
                      <CalendarIcon size={14} />
                      {format(editCommDate, "dd/MM/yyyy", { locale: ptBR })}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={editCommDate} onSelect={(d) => d && setEditCommDate(d)} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              {editingCommission.type !== 'paid' && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Gasto em Ads ($)</label>
                  <input type="number" value={editCommAdSpend} onChange={e => {
                    setEditCommAdSpend(e.target.value);
                    const client = clients.find(c => c.id === editingCommission.clientId);
                    if (client) {
                      const newComm = calculateCommission(client, parseFloat(e.target.value) || 0);
                      setEditCommAmount(newComm.toString());
                    }
                  }} className={inputClass} />
                </div>
              )}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  {editingCommission.type === 'paid' ? 'Valor Pago ($)' : 'Comissão ($)'}
                </label>
                <input type="number" value={editCommAmount} onChange={e => setEditCommAmount(e.target.value)} className={inputClass} readOnly={editingCommission.type !== 'paid'} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Nota</label>
                <input value={editCommNote} onChange={e => setEditCommNote(e.target.value)} className={inputClass} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveEditCommission} className="flex-1 bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90">
                  Salvar
                </button>
                <button onClick={() => setEditingCommission(null)} className="px-4 py-2.5 rounded-lg border border-border text-muted-foreground hover:text-foreground">
                  Cancelar
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      <div className="space-y-3">
        {filtered.map(c => {
          const acc = getAccumulated(c.id);
          const isExpanded = expandedClient === c.id;
          const clientComms = getClientCommissions(c.id);
          const previewCommission = adSpendAmount && showCommissionForm === c.id
            ? calculateCommission(c, parseFloat(adSpendAmount) || 0) : 0;

          return (
            <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-border rounded-xl overflow-hidden border-glow">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">#{c.number}</span>
                      <h4 className="font-semibold text-sm">{c.name}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.companyName}</p>
                    <p className="text-xs text-muted-foreground mt-1">{c.email}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs">
                      <span className="text-primary">
                        {c.paymentType === 'fixed' ? `Fixo: $${c.fixedValue}` : c.paymentType === 'percentage' ? `${c.percentageValue}% sobre gasto` : `Fixo $${c.fixedValue} + ${c.percentageValue}%`}
                      </span>
                      <span className="text-muted-foreground">Contas: {c.adAccounts - c.usedAccounts - c.blockedAccounts} disponíveis</span>
                    </div>
                  </div>
                  <div className="flex gap-1 sm:gap-2 shrink-0 ml-2">
                    <button onClick={() => handleEdit(c)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(c.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-3">
                    <div className="bg-secondary rounded-lg p-2 sm:p-3 text-center">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Gasto em Ads</p>
                      <p className="text-xs sm:text-sm font-bold text-foreground">{fmt(acc.totalAdSpend)}</p>
                    </div>
                    <div className="bg-secondary rounded-lg p-2 sm:p-3 text-center">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Comissão</p>
                      <p className="text-xs sm:text-sm font-bold text-primary">{fmt(acc.daily)}</p>
                    </div>
                    <div className="bg-secondary rounded-lg p-2 sm:p-3 text-center">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Pago</p>
                      <p className="text-xs sm:text-sm font-bold text-success">{fmt(acc.paid)}</p>
                    </div>
                    <div className="bg-secondary rounded-lg p-2 sm:p-3 text-center">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Pendente</p>
                      <p className={`text-xs sm:text-sm font-bold ${acc.pending > 0 ? 'text-warning' : 'text-muted-foreground'}`}>{fmt(acc.pending)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setShowCommissionForm(showCommissionForm === c.id ? null : c.id)} className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">
                      <DollarSign size={12} /> Lançar Gastos em Ads
                    </button>
                    <button onClick={() => setShowPaidForm(showPaidForm === c.id ? null : c.id)} className="flex items-center gap-1.5 text-xs bg-success/10 text-success px-3 py-1.5 rounded-lg hover:bg-success/20 transition-colors">
                      <CheckCircle size={12} /> Comissão Paga
                    </button>
                    <button onClick={() => handleGenerateWeeklyBilling(c.id)} className="flex items-center gap-1.5 text-xs bg-warning/10 text-warning px-3 py-1.5 rounded-lg hover:bg-warning/20 transition-colors">
                      <Receipt size={12} /> Gerar Cobrança Semanal
                    </button>
                    <button onClick={() => setExpandedClient(isExpanded ? null : c.id)} className="flex items-center gap-1.5 text-xs bg-secondary text-muted-foreground px-3 py-1.5 rounded-lg hover:text-foreground transition-colors ml-auto">
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Histórico
                    </button>
                  </div>

                  {showCommissionForm === c.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-3 space-y-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className={cn("flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm bg-secondary border border-border text-foreground hover:border-primary transition-colors whitespace-nowrap")}>
                              <CalendarIcon size={14} />
                              {format(commissionDate, "dd/MM/yyyy", { locale: ptBR })}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={commissionDate} onSelect={(d) => d && setCommissionDate(d)} initialFocus className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                        <input type="number" placeholder="Gasto em Ads ($)" value={adSpendAmount} onChange={e => setAdSpendAmount(e.target.value)} className={`${inputClass} flex-1`} />
                        <input placeholder="Nota (opcional)" value={commissionNote} onChange={e => setCommissionNote(e.target.value)} className={`${inputClass} flex-1`} />
                        <button onClick={() => handleAddAdSpend(c.id)} className="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 whitespace-nowrap">Adicionar</button>
                      </div>
                      {previewCommission > 0 && (
                        <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                          <DollarSign size={12} className="text-primary" />
                          <span className="text-muted-foreground">
                            Gasto: <strong className="text-foreground">{fmt(parseFloat(adSpendAmount) || 0)}</strong>
                            {' → '}Comissão pendente ({c.paymentType === 'fixed' ? 'Fixo' : c.paymentType === 'percentage' ? `${c.percentageValue}%` : `Fixo + ${c.percentageValue}%`}): 
                            <strong className="text-primary ml-1">{fmt(previewCommission)}</strong>
                          </span>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {showPaidForm === c.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-3 flex flex-col sm:flex-row gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className={cn("flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm bg-secondary border border-border text-foreground hover:border-primary transition-colors whitespace-nowrap")}>
                            <CalendarIcon size={14} />
                            {format(paidDate, "dd/MM/yyyy", { locale: ptBR })}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={paidDate} onSelect={(d) => d && setPaidDate(d)} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                      <input type="number" placeholder="Valor pago $" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} className={`${inputClass} flex-1`} />
                      <button onClick={() => handleAddPaid(c.id)} className="bg-success text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 whitespace-nowrap">Registrar Pagamento</button>
                    </motion.div>
                  )}
                </div>
              </div>

              {isExpanded && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="border-t border-border bg-secondary/50 p-4">
                  <h5 className="text-xs font-semibold text-muted-foreground mb-2">Histórico de Lançamentos</h5>
                  {clientComms.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum lançamento encontrado.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {clientComms.sort((a, b) => parseDateLocal(b.date).getTime() - parseDateLocal(a.date).getTime()).map(comm => (
                        <div key={comm.id} className={cn(
                          "flex items-center justify-between rounded-lg px-3 py-2 text-xs",
                          comm.type === 'weekly_billing' ? 'bg-warning/10 border border-warning/20' : 'bg-card'
                        )}>
                          <div className="flex items-center gap-2 flex-wrap flex-1">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${comm.type === 'daily' ? 'bg-primary' : comm.type === 'paid' ? 'bg-success' : 'bg-warning'}`} />
                            <span className="text-muted-foreground">{format(new Date(comm.date), "dd/MM/yyyy", { locale: ptBR })}</span>
                            <span className="text-muted-foreground">
                              {comm.type === 'daily' ? 'Gasto em Ads' : comm.type === 'paid' ? 'Pagamento' : '📋 Cobrança Semanal'}
                            </span>
                            {comm.type === 'daily' && comm.adSpend > 0 && (
                              <span className="text-muted-foreground">(Ads: {fmt(comm.adSpend)})</span>
                            )}
                            {(comm.type === 'daily' || comm.type === 'weekly_billing') && comm.status && (
                              <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium",
                                comm.status === 'pago' ? 'bg-success/10 text-success' : 
                                comm.status === 'parcial' ? 'bg-warning/10 text-warning' : 
                                'bg-muted text-muted-foreground'
                              )}>
                                {comm.status === 'pago' ? 'Pago' : comm.status === 'parcial' ? 'Parcial' : 'Pendente'}
                              </span>
                            )}
                            {comm.note && <span className="text-muted-foreground italic">- {comm.note}</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`font-semibold ${comm.type === 'daily' ? 'text-primary' : comm.type === 'paid' ? 'text-success' : 'text-warning'}`}>
                              {comm.type === 'paid' ? '-' : '+'}{fmt(comm.amount)}
                            </span>
                            <button onClick={() => startEditCommission(comm)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Editar">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => handleDeleteCommission(comm.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Remover">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Nenhum cliente encontrado.</p>}
      </div>
    </div>
  );
};

export default Clients;
