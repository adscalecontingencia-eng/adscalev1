import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { PageHero } from '@/components/ui-kit';
import { Plus, X, AlertCircle, CalendarIcon, Filter, Pencil, History, Wallet, CheckCircle2 } from 'lucide-react';
import { STATUS_LABEL, TYPE_LABEL, PAYMENT_METHODS, effectiveStatus, reportRows, accountBalances, openItems, type TxStatus } from '@/lib/finance-ledger';
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
  type: 'receita' | 'gasto' | 'transferencia' | 'estorno' | 'reembolso';
  category: string;
  status: string;
  dueDate?: string;
  paidAt?: string;
  paymentMethod?: string;
  accountId?: string;
  destAccountId?: string;
  relatedId?: string;
  notes?: string;
  supplierId?: string;
  subcategory: string;
  clientId?: string;
  amount: number;
  description: string;
  custoProduto: number;
  valorVenda: number;
  quantidade: number;
}

interface FinAccount { id: string; name: string; account_type: string; currency: string; initial_balance: number; active: boolean; }

type FormType = 'receita' | 'gasto' | 'outros' | 'fornecedores' | 'marketing' | 'custo_op' | 'transferencia' | 'estorno' | 'reembolso';
const today = () => new Date().toISOString().split('T')[0];
const emptyForm = () => ({ date: today(), type: 'gasto' as FormType, category: 'BM Comum', subcategory: '', clientId: '', supplierId: '', amount: '', description: '', custoProduto: '', valorVenda: '', quantidade: '', status: 'confirmado' as TxStatus, dueDate: '', paidAt: today(), paymentMethod: '', accountId: '', destAccountId: '', relatedId: '', notes: '' });
const STATUS_STYLE: Record<TxStatus, string> = {
  pendente: 'bg-amber-500/10 text-amber-400',
  confirmado: 'bg-primary/10 text-primary',
  atrasado: 'bg-destructive/15 text-destructive',
  cancelado: 'bg-muted text-muted-foreground line-through',
};
const ACCOUNT_TYPES: Record<string, string> = { banco: 'Banco', carteira: 'Carteira digital', caixa: 'Caixa', cartao: 'Cartão', cripto: 'Cripto', outro: 'Outro' };
const FIELD_LABEL: Record<string, string> = { date: 'Data', type: 'Tipo', category: 'Categoria', subcategory: 'Subcategoria', client_id: 'Cliente', amount: 'Valor', description: 'Descrição', custo_produto: 'Custo do produto', valor_venda: 'Valor de venda', quantidade: 'Quantidade', supplier_id: 'Fornecedor', status: 'Status', due_date: 'Vencimento', paid_at: 'Data de pagamento', payment_method: 'Forma de pagamento', account_id: 'Conta', destination_account_id: 'Conta de destino', related_transaction_id: 'Lançamento original', notes: 'Observação' };

interface ClientOption {
  id: string;
  name: string;
}

type DateFilter = 'all' | 'today' | '7days' | 'month' | 'custom' | 'range';

import { ASSET_CATEGORIES, CATEGORIES, withLegacy } from '@/lib/finance-categories';

const Financial: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [showSuppliersManager, setShowSuppliersManager] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<FinAccount[]>([]);
  const [rawTx, setRawTx] = useState<any[]>([]);
  const [view, setView] = useState<'todos' | 'pagar' | 'receber'>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAccounts, setShowAccounts] = useState(false);
  const [accForm, setAccForm] = useState({ name: '', account_type: 'banco', currency: 'USD', initial_balance: '' });
  const [historyFor, setHistoryFor] = useState<Transaction | null>(null);
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [inputCurrency, setInputCurrency] = useState<'USD' | 'BRL'>('USD');
  const [usdToBrl, setUsdToBrl] = useState<number>(5.0);
  const [loading, setLoading] = useState(true);

  // Cotação USD → BRL para conversão dos lançamentos em BRL
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
        const json = await res.json();
        const bid = parseFloat(json?.USDBRL?.bid);
        if (!isNaN(bid) && bid > 0) setUsdToBrl(bid);
      } catch { /* mantém fallback */ }
    })();
  }, []);

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customDate, setCustomDate] = useState<Date | undefined>(new Date());
  const [rangeFrom, setRangeFrom] = useState<Date | undefined>(undefined);
  const [rangeTo, setRangeTo] = useState<Date | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const fetchData = async () => {
    const [txRes, clientRes, supRes, accRes] = await Promise.all([
      supabase.from('transactions').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name'),
      supabase.from('suppliers' as any).select('id, name').order('name'),
      supabase.from('financial_accounts').select('*').order('name'),
    ]);
    if (accRes.data) setAccounts((accRes.data as any[]).map(a => ({ ...a, initial_balance: Number(a.initial_balance) })));
    if (txRes.data) {
      setRawTx(txRes.data as any[]);
      setTransactions(txRes.data.map((t: any) => ({
        id: t.id, date: t.date, type: t.type, category: t.category,
        status: t.status || 'confirmado', dueDate: t.due_date || undefined, paidAt: t.paid_at || undefined,
        paymentMethod: t.payment_method || undefined, accountId: t.account_id || undefined,
        destAccountId: t.destination_account_id || undefined, relatedId: t.related_transaction_id || undefined,
        notes: t.notes || undefined, supplierId: t.supplier_id || undefined,
        subcategory: t.subcategory || '', clientId: t.client_id || undefined, amount: Number(t.amount), description: t.description,
        custoProduto: Number(t.custo_produto || 0), valorVenda: Number(t.valor_venda || 0), quantidade: Number(t.quantidade || 0),
      })));
    }
    if (clientRes.data) setClients(clientRes.data.map(c => ({ id: c.id, name: c.name })));
    if (supRes.data) setSuppliers((supRes.data as any[]).map((s: any) => ({ id: s.id, name: s.name })));
    setLoading(false);
  };

  const createSupplier = async (): Promise<string | null> => {
    const name = newSupplierName.trim();
    if (!name) { toast.error('Informe o nome do fornecedor'); return null; }
    const { data, error } = await supabase.from('suppliers' as any).insert({ name } as any).select('id, name').single();
    if (error || !data) { toast.error('Erro ao criar fornecedor'); return null; }
    const created = data as any;
    setSuppliers(prev => [...prev, { id: created.id, name: created.name }].sort((a, b) => a.name.localeCompare(b.name)));
    setNewSupplierName('');
    setShowNewSupplier(false);
    toast.success('Fornecedor cadastrado');
    return created.id;
  };

  const deleteSupplier = async (id: string) => {
    if (!confirm('Remover este fornecedor? Os lançamentos antigos continuarão, mas sem vínculo.')) return;
    const { error } = await supabase.from('suppliers' as any).delete().eq('id', id);
    if (error) { toast.error('Erro ao remover'); return; }
    setSuppliers(prev => prev.filter(s => s.id !== id));
  };

  useEffect(() => { fetchData(); }, []);

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter(t => {
      const d = parseDateLocal(t.date);

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

      // Status filter
      const st = effectiveStatus({ status: t.status, due_date: t.dueDate });
      if (statusFilter !== 'all' && st !== statusFilter) return false;

      return true;
    });
  }, [transactions, dateFilter, customDate, rangeFrom, rangeTo, categoryFilter, typeFilter, statusFilter]);

  const filterCategories = useMemo(() => withLegacy(CATEGORIES, transactions.map(t => t.category)), [transactions]);
  // Ao editar um lançamento com categoria antiga, mantém essa categoria disponível no formulário.
  const keepCat = (list: string[]) => form.category && !list.includes(form.category) ? [...list, form.category] : list;
  const rawById = useMemo(() => new Map(rawTx.map(r => [r.id, r])), [rawTx]);
  const balances = useMemo(() => accountBalances(accounts, rawTx), [accounts, rawTx]);
  const payables = useMemo(() => openItems(rawTx, 'pagar'), [rawTx]);
  const receivables = useMemo(() => openItems(rawTx, 'receber'), [rawTx]);
  const accName = (id?: string) => accounts.find(a => a.id === id)?.name;
  const txById = useMemo(() => new Map(transactions.map(t => [t.id, t])), [transactions]);
  const visibleTransactions = useMemo(() => {
    if (view === 'todos') return filteredTransactions;
    const ids = new Set((view === 'pagar' ? payables : receivables).items.map(i => i.id));
    return filteredTransactions.filter(t => ids.has(t.id))
      .sort((a, b) => (a.dueDate || a.date).localeCompare(b.dueDate || b.date));
  }, [view, filteredTransactions, payables, receivables]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const valueField = form.type === 'gasto' ? form.custoProduto : form.type === 'receita' ? form.valorVenda : form.amount;
    const amount = parseFloat(valueField);
    if (isNaN(amount) || amount <= 0) errs.amount = 'O valor deve ser um número positivo';
    if (!form.date) errs.date = 'Data é obrigatória';
    if (!form.description.trim()) errs.description = 'Descrição é obrigatória';
    if (form.type === 'transferencia' && (!form.accountId || !form.destAccountId || form.accountId === form.destAccountId)) errs.accounts = 'Escolha conta de origem e destino diferentes';
    if ((form.type === 'estorno' || form.type === 'reembolso') && !form.relatedId) errs.related = 'Escolha o lançamento original';
    if (form.status === 'pendente' && !form.dueDate) errs.dueDate = 'Informe o vencimento';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const isGasto = form.type === 'gasto';
    const isVenda = form.type === 'receita';
    const isOutros = form.type === 'outros';
    const isFornecedores = form.type === 'fornecedores';
    const isMarketing = form.type === 'marketing';
    const isCustoOp = form.type === 'custo_op';
    // Se o usuário lançou em BRL, convertemos para USD (moeda base do sistema)
    const toUsd = (n: number) => inputCurrency === 'BRL' && usdToBrl > 0 ? n / usdToBrl : n;
    const custo = toUsd(parseFloat(form.custoProduto) || 0);
    const venda = toUsd(parseFloat(form.valorVenda) || 0);
    const outros = toUsd(parseFloat(form.amount) || 0);
    const amount = isGasto ? custo : isVenda ? venda : outros;
    const isSpecial = form.type === 'transferencia' || form.type === 'estorno' || form.type === 'reembolso';
    const dbType = isSpecial ? form.type : isVenda ? 'receita' : 'gasto';
    const subcategory = isOutros ? 'outros_gastos' : (form.subcategory || null);
    const related = form.relatedId ? txById.get(form.relatedId) : undefined;
    const dbCategory = form.type === 'transferencia' ? 'Transferência'
      : (form.type === 'estorno' || form.type === 'reembolso') ? (related?.category || 'Outros')
      : isOutros ? 'Outros'
      : isFornecedores ? 'Fornecedores'
      : isMarketing ? 'Marketing'
      : isCustoOp ? 'Custo Operacional'
      : form.category;
    const payload: any = {
      date: form.date, type: dbType, category: dbCategory,
      subcategory: isSpecial ? null : subcategory,
      client_id: form.type === 'transferencia' ? null : (form.clientId || related?.clientId || null),
      supplier_id: dbCategory === 'Fornecedores' && !isSpecial ? (form.supplierId || null) : null,
      amount, description: form.description,
      custo_produto: isGasto || isVenda ? custo : 0,
      valor_venda: isVenda ? venda : 0,
      quantidade: isVenda ? (parseInt(form.quantidade) || 0) : 0,
      status: form.status,
      due_date: form.dueDate || null,
      paid_at: form.status === 'confirmado' ? (form.paidAt || form.date) : null,
      payment_method: form.paymentMethod || null,
      account_id: form.accountId || null,
      destination_account_id: form.type === 'transferencia' ? (form.destAccountId || null) : null,
      related_transaction_id: (form.type === 'estorno' || form.type === 'reembolso') ? form.relatedId : null,
      notes: form.notes.trim() || null,
    };
    const { error } = editingId
      ? await supabase.from('transactions').update(payload).eq('id', editingId)
      : await supabase.from('transactions').insert(payload);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success(editingId ? 'Lançamento atualizado!' : inputCurrency === 'BRL' ? `Salva em USD (convertida de R$ @ ${usdToBrl.toFixed(2)})` : 'Transação salva!');
    closeForm();
    fetchData();
  };

  const closeForm = () => {
    setForm(emptyForm());
    setInputCurrency('USD');
    setShowForm(false);
    setEditingId(null);
    setErrors({});
  };

  const openEdit = (t: Transaction) => {
    const r = rawById.get(t.id) || {};
    let type: FormType = t.type === 'receita' ? 'receita' : (t.type as FormType);
    if (t.type === 'gasto') {
      type = t.subcategory === 'outros_gastos' ? 'outros' : t.category === 'Fornecedores' ? 'fornecedores' : t.category === 'Marketing' ? 'marketing' : t.category === 'Custo Operacional' ? 'custo_op' : 'gasto';
    }
    setForm({
      date: t.date, type, category: t.category, subcategory: t.subcategory === 'outros_gastos' ? '' : t.subcategory,
      clientId: t.clientId || '', supplierId: t.supplierId || '',
      amount: String(t.amount), description: t.description,
      custoProduto: String(type === 'gasto' ? t.amount : (r.custo_produto ?? '')),
      valorVenda: String(type === 'receita' ? t.amount : ''), quantidade: String(t.quantidade || ''),
      status: (t.status as TxStatus) === 'atrasado' ? 'pendente' : (t.status as TxStatus),
      dueDate: t.dueDate || '', paidAt: t.paidAt || (t.status === 'confirmado' ? t.date : today()),
      paymentMethod: t.paymentMethod || '', accountId: t.accountId || '', destAccountId: t.destAccountId || '',
      relatedId: t.relatedId || '', notes: t.notes || '',
    });
    setInputCurrency('USD');
    setEditingId(t.id);
    setShowForm(true);
  };

  const markPaid = async (t: Transaction) => {
    const { error } = await supabase.from('transactions').update({ status: 'confirmado', paid_at: today() }).eq('id', t.id);
    if (error) { toast.error('Erro ao marcar como pago'); return; }
    toast.success(t.type === 'receita' ? 'Marcado como recebido' : 'Marcado como pago');
    fetchData();
  };

  const openHistory = async (t: Transaction) => {
    setHistoryFor(t);
    setHistoryRows([]);
    const { data } = await supabase.from('transaction_history').select('*').eq('transaction_id', t.id).order('created_at', { ascending: false });
    setHistoryRows(data || []);
  };

  const saveAccount = async () => {
    if (!accForm.name.trim()) { toast.error('Informe o nome da conta'); return; }
    const { error } = await supabase.from('financial_accounts').insert({
      name: accForm.name.trim(), account_type: accForm.account_type, currency: accForm.currency,
      initial_balance: parseFloat(accForm.initial_balance) || 0,
    });
    if (error) { toast.error('Erro ao criar conta'); return; }
    setAccForm({ name: '', account_type: 'banco', currency: 'USD', initial_balance: '' });
    toast.success('Conta cadastrada');
    fetchData();
  };

  const toggleAccount = async (a: FinAccount) => {
    const { error } = await supabase.from('financial_accounts').update({ active: !a.active }).eq('id', a.id);
    if (error) { toast.error('Erro ao atualizar conta'); return; }
    fetchData();
  };

  const fmtHistValue = (k: string, v: any) => {
    if (v === null || v === undefined || v === '') return '—';
    if (k === 'status') return STATUS_LABEL[v as TxStatus] || v;
    if (k === 'type') return TYPE_LABEL[v as keyof typeof TYPE_LABEL] || v;
    if (k === 'payment_method') return PAYMENT_METHODS[v] || v;
    if (k === 'account_id' || k === 'destination_account_id') return accName(v) || v;
    if (k === 'client_id') return clients.find(c => c.id === v)?.name || v;
    if (k === 'amount' || k === 'custo_produto' || k === 'valor_venda') return fmt(Number(v));
    return String(v);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apagar este lançamento? A exclusão fica registrada no histórico.')) return;
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover'); return; }
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const fmt = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const inputClass = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors";
  const errorInputClass = "w-full bg-secondary border border-destructive rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-destructive transition-colors";

  // Só Pago/Recebido entra no resultado; estorno/reembolso abatem o original; transferência fica fora.
  const filteredIds = new Set(filteredTransactions.map(t => t.id));
  const reportable = reportRows(rawTx).filter((r: any) => filteredIds.has(r.id));
  const totalRevenue = reportable.filter((r: any) => r.type === 'receita').reduce((s, r: any) => s + Number(r.amount), 0);
  const totalStructureExpenses = reportable.filter((r: any) => r.type === 'gasto').reduce((s, r: any) => s + Number(r.amount), 0);
  const totalProductCost = reportable.filter((r: any) => r.type === 'receita').reduce((s, r: any) => s + (Number(r.custo_produto) || 0), 0);
  const totalExpenses = totalStructureExpenses + totalProductCost;

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground text-sm">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Financeiro"
        title={<>Caixa & <span className="text-primary glow-text">transações</span></>}
        description="Receitas, gastos de estrutura e comissões em um só lugar — sempre em USD."
        actions={
          <div className="flex gap-2">
            <button onClick={() => setShowAccounts(true)} className="flex items-center gap-2 bg-secondary border border-border text-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:border-primary/50">
              <Wallet size={16} /> Contas
            </button>
            <button onClick={() => setShowSuppliersManager(true)} className="flex items-center gap-2 bg-secondary border border-border text-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:border-primary/50">
              Fornecedores
            </button>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 shadow-[0_0_20px_hsl(var(--primary)/0.4)]">
              <Plus size={16} /> Nova transação
            </button>
          </div>
        }
      />

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
            {filterCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors">
            <option value="all">Todos tipos</option>
            <option value="receita">Receita</option>
            <option value="gasto">Gasto</option>
            <option value="transferencia">Transferência</option>
            <option value="estorno">Estorno</option>
            <option value="reembolso">Reembolso</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors">
            <option value="all">Todos status</option>
            {(Object.keys(STATUS_LABEL) as TxStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {([['pagar', 'Contas a pagar', payables, 'text-destructive'], ['receber', 'Contas a receber', receivables, 'text-primary']] as const).map(([k, label, data, color]) => (
          <button key={k} onClick={() => setView(v => v === k ? 'todos' : k)} className={cn('text-left bg-card border rounded-xl p-4 transition-colors', view === k ? 'border-primary' : 'border-border hover:border-primary/50')}>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{label} <span className="opacity-70">({data.items.length})</span></p>
              {data.overdue.length > 0 && <span className="text-[10px] px-2 py-0.5 rounded bg-destructive/15 text-destructive">{data.overdue.length} atrasado(s)</span>}
            </div>
            <p className={cn('text-xl font-bold', color)}>{fmt(data.total)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Próximos 7 dias: <span className="font-mono text-foreground">{fmt(data.next7Total)}</span> · {data.next7.length} vencimento(s)</p>
            {data.next7.slice(0, 3).map(i => (
              <p key={i.id} className="text-[11px] text-muted-foreground truncate">{formatDateBR(i.due_date || i.date)} · {i.description} · <span className="font-mono">{fmt(Math.abs(Number(i.amount)))}</span></p>
            ))}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 border-glow">
          <p className="text-xs text-muted-foreground">Receitas totais (pagas/recebidas)</p>
          <p className="text-xl font-bold text-primary">{fmt(totalRevenue)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 border-glow">
          <p className="text-xs text-muted-foreground">Gastos totais (pagos)</p>
          <p className="text-xl font-bold text-destructive">{fmt(totalExpenses)}</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 flex-wrap">
          {(['todos', 'pagar', 'receber'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${view === v ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {v === 'todos' ? 'Todos lançamentos' : v === 'pagar' ? 'Contas a pagar' : 'Contas a receber'}
            </button>
          ))}
          <h3 className="font-display text-sm font-semibold ml-1">({visibleTransactions.length})</h3>
        </div>
        <button onClick={() => { setEditingId(null); setForm(emptyForm()); setShowForm(true); }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 glow-box">
          <Plus size={16} /> Adicionar
        </button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-semibold">{editingId ? 'Editar lançamento' : 'Nova Transação'}</h3>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {/* Seletor de moeda do lançamento */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Moeda do lançamento</label>
                <div className="flex rounded-lg border border-border bg-secondary p-0.5 w-fit">
                  {(['USD', 'BRL'] as const).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setInputCurrency(c)}
                      className={cn(
                        'px-4 py-1.5 rounded-md text-xs font-semibold transition-all',
                        inputCurrency === c ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {c === 'USD' ? 'USD ($)' : 'BRL (R$)'}
                    </button>
                  ))}
                </div>
                {inputCurrency === 'BRL' && (
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                    Convertido para USD @ R$ {usdToBrl.toFixed(4)} no momento do salvamento.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Data</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className={errors.date ? errorInputClass : inputClass} />
                {errors.date && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.date}</p>}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Tipo</label>
                <select
                  value={form.type}
                  onChange={e => {
                    const v = e.target.value as any;
                    setForm(p => {
                      const next = { ...p, type: v };
                      if (v === 'fornecedores') next.category = 'Fornecedores';
                      else if (v === 'marketing') next.category = 'Marketing';
                      else if (v === 'custo_op') next.category = 'Custo Operacional';
                      else if (v === 'gasto') next.category = 'BM Comum';
                      return next;
                    });
                  }}
                  className={inputClass}
                >
                  <option value="gasto">Gasto da Estrutura de aluguel</option>
                  <option value="receita">Venda</option>
                  <option value="fornecedores">Fornecedores (Custo de Produto)</option>
                  <option value="marketing">Marketing (Anúncios / Social)</option>
                  <option value="custo_op">Custo Operacional (Ferramentas / Suporte)</option>
                  <option value="outros">Outros gastos</option>
                  <option value="transferencia">Transferência entre contas</option>
                  <option value="estorno">Estorno (de uma venda/receita)</option>
                  <option value="reembolso">Reembolso (de um gasto)</option>
                </select>
                {form.type === 'transferencia' && <p className="text-[10px] text-muted-foreground mt-1">Só move dinheiro entre contas — não entra como receita, gasto ou lucro.</p>}
              </div>
              {(form.type === 'estorno' || form.type === 'reembolso') && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Lançamento original</label>
                  <select value={form.relatedId} onChange={e => setForm(p => ({ ...p, relatedId: e.target.value }))} className={errors.related ? errorInputClass : inputClass}>
                    <option value="">Selecione…</option>
                    {transactions.filter(t => t.type === (form.type === 'estorno' ? 'receita' : 'gasto') && t.id !== editingId).slice(0, 300).map(t => (
                      <option key={t.id} value={t.id}>{formatDateBR(t.date)} · {t.description} · {fmt(t.amount)}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1">O valor abate {form.type === 'estorno' ? 'a receita' : 'o gasto'} desse lançamento nos relatórios.</p>
                  {errors.related && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.related}</p>}
                </div>
              )}
              {form.type === 'gasto' && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Categoria</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={inputClass}>
                    {keepCat(ASSET_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              {form.type === 'receita' && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Categoria</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={inputClass}>
                    {keepCat(CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              {form.type !== 'transferencia' && <div>
                <label className="block text-xs text-muted-foreground mb-1">Cliente (opcional)</label>
                <select value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))} className={inputClass}>
                  <option value="">Sem cliente</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>}
              {form.type === 'fornecedores' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-muted-foreground">Fornecedor</label>
                    <button
                      type="button"
                      onClick={() => setShowNewSupplier(s => !s)}
                      className="text-[11px] text-primary hover:underline"
                    >
                      {showNewSupplier ? 'Cancelar' : '+ Cadastrar novo'}
                    </button>
                  </div>
                  {!showNewSupplier ? (
                    <select
                      value={form.supplierId}
                      onChange={e => setForm(p => ({ ...p, supplierId: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">Selecione um fornecedor</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={newSupplierName}
                        onChange={e => setNewSupplierName(e.target.value)}
                        placeholder="Nome do fornecedor"
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const id = await createSupplier();
                          if (id) setForm(p => ({ ...p, supplierId: id }));
                        }}
                        className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold whitespace-nowrap"
                      >
                        Salvar
                      </button>
                    </div>
                  )}
                </div>
              )}
              {(() => {
                const symbol = inputCurrency === 'BRL' ? 'R$' : '$';
                const previewUsd = (raw: string) => {
                  const n = parseFloat(raw);
                  if (!n || inputCurrency !== 'BRL' || usdToBrl <= 0) return null;
                  return `≈ $${(n / usdToBrl).toFixed(2)} USD`;
                };
                return (
                  <>
                    {form.type === 'gasto' && (
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Custo do produto ({symbol})</label>
                        <input type="number" step="0.01" value={form.custoProduto} onChange={e => setForm(p => ({ ...p, custoProduto: e.target.value }))} placeholder="0.00" className={errors.amount ? errorInputClass : inputClass} />
                        {previewUsd(form.custoProduto) && <p className="text-[10px] text-primary mt-1 font-mono">{previewUsd(form.custoProduto)}</p>}
                        {errors.amount && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.amount}</p>}
                      </div>
                    )}
                    {form.type === 'receita' && (
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Valor de venda ({symbol})</label>
                          <input type="number" step="0.01" value={form.valorVenda} onChange={e => setForm(p => ({ ...p, valorVenda: e.target.value }))} placeholder="0.00" className={errors.amount ? errorInputClass : inputClass} />
                          {previewUsd(form.valorVenda) && <p className="text-[10px] text-primary mt-1 font-mono">{previewUsd(form.valorVenda)}</p>}
                          {errors.amount && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.amount}</p>}
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Custo do produto ({symbol})</label>
                          <input type="number" step="0.01" value={form.custoProduto} onChange={e => setForm(p => ({ ...p, custoProduto: e.target.value }))} placeholder="0.00" className={inputClass} />
                          {previewUsd(form.custoProduto)
                            ? <p className="text-[10px] text-primary mt-1 font-mono">{previewUsd(form.custoProduto)}</p>
                            : <p className="text-[10px] text-muted-foreground mt-1">Subtraído do lucro.</p>}
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Quantidade</label>
                          <input type="number" min="0" step="1" value={form.quantidade} onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))} placeholder="0" className={inputClass} />
                          <p className="text-[10px] text-muted-foreground mt-1">Produtos vendidos.</p>
                        </div>
                      </div>
                    )}
                    {(form.type === 'outros' || form.type === 'fornecedores' || form.type === 'marketing' || form.type === 'custo_op' || form.type === 'transferencia' || form.type === 'estorno' || form.type === 'reembolso') && (
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Valor ({symbol})</label>
                        <input type="number" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" className={errors.amount ? errorInputClass : inputClass} />
                        {previewUsd(form.amount) && <p className="text-[10px] text-primary mt-1 font-mono">{previewUsd(form.amount)}</p>}
                        {errors.amount && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.amount}</p>}
                      </div>
                    )}
                  </>
                );
              })()}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Descrição</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={errors.description ? errorInputClass : inputClass} />
                {errors.description && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle size={12} />{errors.description}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as TxStatus }))} className={inputClass}>
                    <option value="pendente">Pendente</option>
                    <option value="confirmado">Pago/Recebido</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1">Vira "Atrasado" sozinho se vencer pendente.</p>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Forma de pagamento</label>
                  <select value={form.paymentMethod} onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value }))} className={inputClass}>
                    <option value="">Não informado</option>
                    {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Vencimento</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} className={errors.dueDate ? errorInputClass : inputClass} />
                  {errors.dueDate && <p className="text-xs text-destructive mt-1">{errors.dueDate}</p>}
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Data de pagamento</label>
                  <input type="date" value={form.paidAt} disabled={form.status !== 'confirmado'} onChange={e => setForm(p => ({ ...p, paidAt: e.target.value }))} className={cn(inputClass, form.status !== 'confirmado' && 'opacity-50')} />
                </div>
                <div className={form.type === 'transferencia' ? '' : 'col-span-2'}>
                  <label className="block text-xs text-muted-foreground mb-1">{form.type === 'transferencia' ? 'Conta de origem' : 'Conta'}</label>
                  <select value={form.accountId} onChange={e => setForm(p => ({ ...p, accountId: e.target.value }))} className={errors.accounts ? errorInputClass : inputClass}>
                    <option value="">{form.type === 'transferencia' ? 'Selecione…' : 'Sem conta'}</option>
                    {accounts.filter(a => a.active || a.id === form.accountId).map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                  </select>
                </div>
                {form.type === 'transferencia' && (
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Conta de destino</label>
                    <select value={form.destAccountId} onChange={e => setForm(p => ({ ...p, destAccountId: e.target.value }))} className={errors.accounts ? errorInputClass : inputClass}>
                      <option value="">Selecione…</option>
                      {accounts.filter(a => a.active || a.id === form.destAccountId).map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                    </select>
                  </div>
                )}
              </div>
              {errors.accounts && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{errors.accounts}</p>}
              {accounts.length === 0 && <p className="text-[10px] text-muted-foreground">Cadastre contas em "Contas" no topo da página.</p>}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Observação</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className={inputClass} />
              </div>
              <button onClick={handleSave} className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 glow-box">Salvar</button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <div className="space-y-2">
        {visibleTransactions.map(t => {
          const st = effectiveStatus({ status: t.status, due_date: t.dueDate });
          const isSpecial = t.type === 'transferencia' || t.type === 'estorno' || t.type === 'reembolso';
          const orig = t.relatedId ? txById.get(t.relatedId) : undefined;
          return (
          <div key={t.id} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded ${t.type === 'receita' ? 'bg-primary/10 text-primary' : isSpecial ? 'bg-secondary text-foreground border border-border' : t.subcategory === 'outros_gastos' ? 'bg-amber-500/10 text-amber-400' : 'bg-destructive/10 text-destructive'}`}>
                  {t.type === 'receita' ? 'Venda' : isSpecial ? TYPE_LABEL[t.type] : t.subcategory === 'outros_gastos' ? 'Outros Gastos' : 'Gasto Estrutura'}
                </span>
                <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded">{t.category}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLE[st]}`}>{STATUS_LABEL[st]}</span>
                {t.paymentMethod && <span className="text-[11px] text-muted-foreground">{PAYMENT_METHODS[t.paymentMethod]}</span>}
              </div>
              <p className="text-sm mt-1">{t.description}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateBR(t.date)}
                {t.dueDate && <> · Vence {formatDateBR(t.dueDate)}</>}
                {t.paidAt && st === 'confirmado' && <> · Pago em {formatDateBR(t.paidAt)}</>}
                {t.type === 'transferencia'
                  ? <> · {accName(t.accountId) || '?'} → {accName(t.destAccountId) || '?'}</>
                  : accName(t.accountId) && <> · Conta: {accName(t.accountId)}</>}
              </p>
              {orig && <p className="text-[11px] text-muted-foreground">Ligado a: {formatDateBR(orig.date)} · {orig.description} ({fmt(orig.amount)})</p>}
              {t.notes && <p className="text-[11px] text-muted-foreground italic mt-0.5">Obs.: {t.notes}</p>}
              {!isSpecial && (() => {
                const isVenda = t.type === 'receita';
                const isOutros = t.subcategory === 'outros_gastos';
                const isGastoEst = t.type === 'gasto' && !isOutros;
                const considerLabel = isVenda ? 'Valor de venda' : isGastoEst ? 'Custo do produto' : 'Valor';
                const impactLabel = st !== 'confirmado' ? 'ainda não entra no resultado' : isVenda ? '+ entra como receita no lucro' : '− sai como gasto do lucro';
                const impactColor = isVenda ? 'text-primary' : 'text-destructive';
                return (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                    <span className="text-muted-foreground">{considerLabel} considerado:</span>
                    <span className="font-mono font-semibold text-foreground">{fmt(t.amount)}</span>
                    <span className={`${impactColor} font-medium`}>{impactLabel}</span>
                    {isVenda && t.quantidade > 0 && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">Qtd:</span>
                        <span className="font-mono font-semibold text-foreground">{t.quantidade}</span>
                      </>
                    )}
                    {isVenda && t.custoProduto > 0 && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">Custo:</span>
                        <span className="font-mono text-destructive">−{fmt(t.custoProduto)}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">Lucro:</span>
                        <span className={`font-mono font-semibold ${(t.amount - t.custoProduto) >= 0 ? 'text-primary' : 'text-destructive'}`}>{fmt(t.amount - t.custoProduto)}</span>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`font-semibold ${t.type === 'receita' ? 'text-primary' : t.type === 'gasto' ? 'text-destructive' : 'text-foreground'}`}>{t.type === 'estorno' || t.type === 'reembolso' ? '−' : ''}{fmt(t.amount)}</span>
              {(st === 'pendente' || st === 'atrasado') && (
                <button onClick={() => markPaid(t)} title={t.type === 'receita' ? 'Marcar como recebido' : 'Marcar como pago'} className="text-muted-foreground hover:text-primary"><CheckCircle2 size={15} /></button>
              )}
              <button onClick={() => openEdit(t)} title="Editar" className="text-muted-foreground hover:text-primary"><Pencil size={14} /></button>
              <button onClick={() => openHistory(t)} title="Histórico" className="text-muted-foreground hover:text-primary"><History size={14} /></button>
              <button onClick={() => handleDelete(t.id)} title="Apagar" className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
            </div>
          </div>
          );
        })}
        {visibleTransactions.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Nenhuma transação encontrada.</p>}
      </div>

      {showAccounts && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-semibold">Contas financeiras</h3>
              <button onClick={() => setShowAccounts(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <input value={accForm.name} onChange={e => setAccForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome (ex.: Banco Inter)" className={cn(inputClass, 'col-span-2')} />
              <select value={accForm.account_type} onChange={e => setAccForm(p => ({ ...p, account_type: e.target.value }))} className={inputClass}>
                {Object.entries(ACCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={accForm.currency} onChange={e => setAccForm(p => ({ ...p, currency: e.target.value }))} className={inputClass}>
                <option value="USD">USD</option><option value="BRL">BRL</option><option value="USDT">USDT</option><option value="EUR">EUR</option>
              </select>
              <input type="number" step="0.01" value={accForm.initial_balance} onChange={e => setAccForm(p => ({ ...p, initial_balance: e.target.value }))} placeholder="Saldo inicial" className={inputClass} />
              <button onClick={saveAccount} className="bg-primary text-primary-foreground rounded-lg text-xs font-semibold"><Plus size={14} className="inline" /> Adicionar conta</button>
            </div>
            <div className="space-y-1.5">
              {accounts.length === 0 ? <p className="text-xs text-muted-foreground text-center py-6">Nenhuma conta cadastrada.</p> : accounts.map(a => (
                <div key={a.id} className={cn('flex items-center justify-between bg-secondary/40 border border-border rounded-lg px-3 py-2', !a.active && 'opacity-50')}>
                  <div>
                    <p className="text-sm">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground">{ACCOUNT_TYPES[a.account_type] || a.account_type} · {a.currency} · inicial {a.initial_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn('font-mono text-sm font-semibold', (balances[a.id] ?? 0) >= 0 ? 'text-primary' : 'text-destructive')}>
                      {(balances[a.id] ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {a.currency}
                    </span>
                    <button onClick={() => toggleAccount(a)} className="text-[11px] text-muted-foreground hover:text-foreground">{a.active ? 'Desativar' : 'Reativar'}</button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">Saldo atual = saldo inicial + recebidos − pagos (só lançamentos Pago/Recebido; transferências movem entre contas).</p>
          </motion.div>
        </motion.div>
      )}

      {historyFor && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-display text-sm font-semibold">Histórico de alterações</h3>
              <button onClick={() => setHistoryFor(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">{historyFor.description}</p>
            {historyRows.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Sem alterações registradas (lançamentos antigos não têm histórico anterior a esta melhoria).</p>
            ) : historyRows.map(h => (
              <div key={h.id} className="border-l-2 border-primary/40 pl-3 mb-3">
                <p className="text-xs"><span className="font-semibold">{h.action === 'insert' ? 'Criado' : h.action === 'delete' ? 'Apagado' : 'Alterado'}</span> por {h.changed_by_email || 'sistema (automático)'} · {format(new Date(h.created_at), 'dd/MM/yyyy HH:mm')}</p>
                {h.action === 'update' && Object.entries(h.changes || {}).map(([k, v]: any) => (
                  <p key={k} className="text-[11px] text-muted-foreground">{FIELD_LABEL[k] || k}: <span className="line-through">{fmtHistValue(k, v.old)}</span> → <span className="text-foreground">{fmtHistValue(k, v.new)}</span></p>
                ))}
              </div>
            ))}
          </motion.div>
        </motion.div>
      )}

      {showSuppliersManager && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-semibold">Fornecedores cadastrados</h3>
              <button onClick={() => { setShowSuppliersManager(false); setShowNewSupplier(false); setNewSupplierName(''); }} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="flex gap-2 mb-4">
              <input
                value={newSupplierName}
                onChange={e => setNewSupplierName(e.target.value)}
                placeholder="Nome do novo fornecedor"
                className={inputClass}
              />
              <button onClick={() => createSupplier()} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold whitespace-nowrap">
                <Plus size={14} className="inline" /> Adicionar
              </button>
            </div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {suppliers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhum fornecedor cadastrado.</p>
              ) : suppliers.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-secondary/40 border border-border rounded-lg px-3 py-2">
                  <span className="text-sm">{s.name}</span>
                  <button onClick={() => deleteSupplier(s.id)} className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default Financial;
