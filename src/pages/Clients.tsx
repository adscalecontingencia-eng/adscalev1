import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHero } from '@/components/ui-kit';
import { Plus, Search, Edit2, Trash2, X, DollarSign, CheckCircle, ChevronDown, ChevronUp, CalendarIcon, Receipt, Pencil, CalendarClock, Eye, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, startOfWeek, endOfWeek, isWithinInterval, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays, addDays, nextFriday, isFriday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDateLocal, formatDateBR } from '@/lib/date-utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCommissionTiers, getTierPctFromTiers, CommissionTier } from '@/lib/commission-tiers';
import { useAuth } from '@/contexts/AuthContext';
import { logAudit } from '@/lib/audit';
import ClientKPIBar from '@/components/clients/ClientKPIBar';
import ClientFiltersBar, { TypeFilter, StatusFilter, SortKey } from '@/components/clients/ClientFiltersBar';
import TiersDialog from '@/components/clients/TiersDialog';
import ClientCard, { ClientStatus } from '@/components/clients/ClientCard';
import ClientHistoryDrawer from '@/components/clients/ClientHistoryDrawer';
import { splitOverdueVsCurrent, WeeklyRow } from '@/lib/billing-status';

interface Client {
  id: string;
  number: string;
  name: string;
  companyName: string;
  email: string;
  password: string;
  observations: string;
  clientType: 'aluguel' | 'venda';
  paymentType: 'fixed' | 'percentage' | 'both';
  fixedValue?: number;
  percentageValue?: number;
  planCredit?: number;
  adAccounts: number;
  usedAccounts: number;
  blockedAccounts: number;
  whatsappPhone?: string;
  whatsappGroupLink?: string;
  partnerId?: string | null;
}

// Metas semanais de desconto agora vêm da tabela `commission_tiers` (admin-editável).

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [clients, setClients] = useState<Client[]>([]);
  const [partners, setPartners] = useState<{ id: string; name: string; email: string }[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showCommissionForm, setShowCommissionForm] = useState<string | null>(null);
  const [showPaidForm, setShowPaidForm] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Client | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Client>>({ clientType: 'aluguel', paymentType: 'percentage', adAccounts: 0, usedAccounts: 0, blockedAccounts: 0 });
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
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('saldo_desc');
  const [tiersOpen, setTiersOpen] = useState(false);
  const [historyClientId, setHistoryClientId] = useState<string | null>(null);

  // Tiers admin-editable
  const { tiers: commissionTiers, reload: reloadTiers } = useCommissionTiers();
  const [tierDraft, setTierDraft] = useState<CommissionTier[] | null>(null);
  const [savingTiers, setSavingTiers] = useState(false);
  const getTierPercentage = (weekSpend: number, basePct: number) =>
    getTierPctFromTiers(weekSpend, basePct, commissionTiers);

  const tiersToShow = tierDraft ?? commissionTiers;

  const updateTierDraft = (idx: number, field: 'min_spend' | 'pct', value: number) => {
    const base = tierDraft ?? commissionTiers.map(t => ({ ...t }));
    const next = base.map((t, i) => i === idx ? { ...t, [field]: value } : t);
    setTierDraft(next);
  };
  const addTier = () => {
    const base = tierDraft ?? commissionTiers.map(t => ({ ...t }));
    setTierDraft([...base, { min_spend: 0, pct: 0 }]);
  };
  const removeTier = (idx: number) => {
    const base = tierDraft ?? commissionTiers.map(t => ({ ...t }));
    setTierDraft(base.filter((_, i) => i !== idx));
  };
  const saveTiers = async () => {
    if (!tierDraft) return;
    setSavingTiers(true);
    try {
      // Replace all: delete then insert
      const { error: delErr } = await supabase.from('commission_tiers').delete().not('id', 'is', null);
      if (delErr) throw delErr;
      const clean = tierDraft
        .filter(t => Number.isFinite(t.min_spend) && Number.isFinite(t.pct))
        .map(t => ({ min_spend: Number(t.min_spend), pct: Number(t.pct) }));
      if (clean.length > 0) {
        const { error: insErr } = await supabase.from('commission_tiers').insert(clean);
        if (insErr) throw insErr;
      }
      toast.success('Metas semanais atualizadas');
      setTierDraft(null);
      await reloadTiers();
    } catch (e: any) {
      toast.error('Falha ao salvar metas: ' + (e?.message || ''));
    } finally {
      setSavingTiers(false);
    }
  };

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
      clientType: ((c as any).client_type as 'aluguel' | 'venda') || 'aluguel',
      paymentType: (c.payment_type as 'fixed' | 'percentage' | 'both') || 'fixed',
      fixedValue: Number(c.fixed_value) || 0, percentageValue: Number(c.percentage_value) || 0,
      planCredit: Number((c as any).plan_credit) || 0,
      adAccounts: c.ad_accounts || 0, usedAccounts: c.used_accounts || 0, blockedAccounts: c.blocked_accounts || 0,
      whatsappPhone: (c as any).whatsapp_phone || '', whatsappGroupLink: (c as any).whatsapp_group_link || '',
      partnerId: (c as any).partner_id || null,
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

  // Insights + assignments (para calcular Saldo Pendente igual ao dashboard do cliente)
  const [insightsByClient, setInsightsByClient] = useState<Record<string, { date: string; spend: number }[]>>({});
  const fetchInsightsByClient = async () => {
    const [assignRes, insightsRes] = await Promise.all([
      supabase.from('meta_ad_account_assignments').select('ad_account_id, client_id, active').eq('active', true),
      supabase.from('meta_ad_insights').select('ad_account_id, date, spend').limit(50000),
    ]);
    if (assignRes.error || insightsRes.error) return;
    const accToClient = new Map<string, string>();
    (assignRes.data || []).forEach((a: any) => accToClient.set(a.ad_account_id, a.client_id));
    const byClient: Record<string, { date: string; spend: number }[]> = {};
    (insightsRes.data || []).forEach((i: any) => {
      const cid = accToClient.get(i.ad_account_id);
      if (!cid) return;
      if (!byClient[cid]) byClient[cid] = [];
      byClient[cid].push({ date: i.date, spend: Number(i.spend || 0) });
    });
    setInsightsByClient(byClient);
  };

  const fetchPartners = async () => {
    const { data } = await supabase.from('partners').select('id, name, email').order('name');
    setPartners((data as any) || []);
  };

  useEffect(() => { fetchClients(); fetchCommissions(); fetchInsightsByClient(); fetchPartners(); }, []);

  const calculateCommission = (client: Client, adSpend: number, weeklyAccumSpend?: number): number => {
    // Venda → valor fixo
    if (client.clientType === 'venda') {
      return client.fixedValue || 0;
    }
    // Aluguel → percentual com tier de desconto baseado no gasto semanal acumulado
    const totalWeek = (weeklyAccumSpend ?? 0) + adSpend;
    const rate = getTierPercentage(totalWeek, client.percentageValue || 0);
    return adSpend * (rate / 100);
  };

  // Soma de Ad Spend já lançado na semana corrente p/ um cliente (exclui weekly_billing)
  const getWeeklyAccumSpend = (clientId: string, refDate: Date): number => {
    const ws = startOfWeek(refDate, { weekStartsOn: 1 });
    const we = endOfWeek(refDate, { weekStartsOn: 1 });
    return commissions
      .filter(c => c.clientId === clientId && c.type === 'daily' &&
        isWithinInterval(parseDateLocal(c.date), { start: ws, end: we }))
      .reduce((s, c) => s + (c.adSpend || 0), 0);
  };

  const handleSave = async () => {
    const clientType: 'aluguel' | 'venda' = form.clientType === 'venda' ? 'venda' : 'aluguel';

    if (clientType === 'venda') {
      if (!form.name || !form.number) {
        toast.error('Preencha os campos obrigatórios: Nome e Número');
        return;
      }
    } else {
      if (!form.name || !form.email || !form.number) {
        toast.error('Preencha os campos obrigatórios: Número, Nome e E-mail');
        return;
      }
    }
    setSaving(true);

    // Para clientes de venda geramos um e-mail sintético (não usado para login)
    const sanitizedNumber = (form.number || '').replace(/\D/g, '') || Date.now().toString();
    const effectiveEmail = clientType === 'venda'
      ? (form.email || `venda-${sanitizedNumber}-${Date.now()}@adscale.local`)
      : form.email!;

    const paymentType: 'fixed' | 'percentage' = clientType === 'venda' ? 'fixed' : 'percentage';
    const fixedValue = clientType === 'venda' ? (form.fixedValue || 0) : 0;
    const percentageValue = clientType === 'aluguel' ? (form.percentageValue || 0) : 0;
    const planCredit = clientType === 'aluguel' ? (form.planCredit || 0) : 0;

    // Delta de crédito p/ lançar como receita (faturamento)
    const previousCredit = editing ? (editing.planCredit || 0) : 0;
    const creditDelta = clientType === 'aluguel' ? Math.max(0, planCredit - previousCredit) : 0;

    let savedClientId: string | null = editing ? editing.id : null;

    if (editing) {
      const payload: any = {
        number: form.number || '', name: form.name || '', company_name: form.companyName || '',
        email: effectiveEmail, observations: form.observations || '',
        client_type: clientType,
        payment_type: paymentType, fixed_value: fixedValue, percentage_value: percentageValue,
        ad_accounts: form.adAccounts || 0, used_accounts: form.usedAccounts || 0, blocked_accounts: form.blockedAccounts || 0,
        plan_credit: planCredit,
        whatsapp_phone: form.whatsappPhone || null, whatsapp_group_link: form.whatsappGroupLink || null,
        partner_id: form.partnerId || null,
      };
      const { error } = await supabase.from('clients').update(payload).eq('id', editing.id);
      if (error) { toast.error('Erro ao atualizar cliente'); setSaving(false); return; }
      toast.success('Cliente atualizado!');
    } else if (clientType === 'venda') {
      // Cliente de venda: cadastro simples, sem usuário de auth/login
      const { error } = await supabase.from('clients').insert({
        number: form.number || '', name: form.name || '',
        company_name: form.companyName || '',
        email: effectiveEmail, password: '',
        observations: form.observations || '',
        client_type: 'venda',
        payment_type: 'fixed', fixed_value: fixedValue, percentage_value: 0,
        ad_accounts: 0, used_accounts: 0, blocked_accounts: 0,
        whatsapp_phone: form.whatsappPhone || null,
        whatsapp_group_link: form.whatsappGroupLink || null,
        partner_id: form.partnerId || null,
      } as any);
      if (error) { toast.error('Erro ao cadastrar cliente: ' + error.message); setSaving(false); return; }
      toast.success('Cliente de venda cadastrado!');
    } else {
      const password = form.password || '123456';
      const res = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create_user', email: form.email, password, name: form.name, role: 'client',
          client_data: {
            number: form.number, companyName: form.companyName, observations: form.observations,
            clientType, paymentType, fixedValue, percentageValue, planCredit,
            adAccounts: form.adAccounts || 0,
            usedAccounts: form.usedAccounts || 0, blockedAccounts: form.blockedAccounts || 0,
            whatsappPhone: form.whatsappPhone || null, whatsappGroupLink: form.whatsappGroupLink || null,
          },
        },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || res.error?.message || 'Erro ao cadastrar cliente');
        setSaving(false); return;
      }
      toast.success('Cliente cadastrado!');
      savedClientId = (res.data as any)?.client_id || null;
      // fallback: busca pelo email criado
      if (!savedClientId) {
        const { data: cs } = await supabase.from('clients').select('id').eq('email', effectiveEmail).limit(1);
        savedClientId = cs?.[0]?.id || null;
      }
    }

    // Vincular ao parceiro indicado (separado para garantir que funciona via edge function de criação)
    if (savedClientId && form.partnerId !== undefined) {
      await supabase.from('clients').update({ partner_id: form.partnerId || null } as any).eq('id', savedClientId);
    }


    // Crédito adicionado: primeiro liquida comissões pendentes (FIFO),
    // o restante vira saldo de crédito disponível e é lançado como receita.
    if (creditDelta > 0 && savedClientId) {
      let remaining = creditDelta;
      let liquidated = 0;

      const { data: pendingComms } = await supabase
        .from('commissions')
        .select('*')
        .eq('client_id', savedClientId)
        .in('status', ['pendente', 'parcial'])
        .order('date', { ascending: true });

      for (const comm of (pendingComms || [])) {
        if (remaining <= 0) break;
        const pendente = Number(comm.valor_pendente ?? (Number(comm.amount) - Number(comm.valor_pago || 0)));
        if (pendente <= 0) continue;
        const pay = Math.min(remaining, pendente);
        const newPago = Number(comm.valor_pago || 0) + pay;
        const newPend = Math.max(0, Number(comm.amount) - newPago);
        const newStatus = newPend <= 0 ? 'pago' : 'parcial';
        await supabase.from('commissions').update({
          valor_pago: newPago,
          valor_pendente: newPend,
          status: newStatus,
        } as any).eq('id', comm.id);
        remaining -= pay;
        liquidated += pay;
      }

      // Ajusta plan_credit: subtrai a parte que foi usada para liquidar comissões.
      if (liquidated > 0) {
        const finalCredit = Math.max(0, planCredit - liquidated);
        await supabase.from('clients').update({ plan_credit: finalCredit } as any).eq('id', savedClientId);
      }

      // Lança como receita apenas a parte que sobrou como crédito real disponível.
      const receitaCredito = creditDelta - liquidated;
      if (receitaCredito > 0) {
        await supabase.from('transactions').insert({
          date: new Date().toISOString().split('T')[0],
          type: 'receita',
          category: 'Crédito do Plano',
          client_id: savedClientId,
          amount: receitaCredito,
          description: `Crédito do plano ${editing ? 'adicionado' : 'inicial'} - ${form.name}`,
        } as any);
      }

      if (liquidated > 0) {
        toast.success(`Crédito ${fmt(creditDelta)} • liquidou ${fmt(liquidated)} em comissões pendentes${receitaCredito > 0 ? ` • saldo ${fmt(receitaCredito)}` : ''}`);
      }
    }

    setSaving(false);
    resetForm();
    fetchClients();
  };

  const resetForm = () => {
    setForm({ clientType: 'aluguel', paymentType: 'percentage', adAccounts: 0, usedAccounts: 0, blockedAccounts: 0 });
    setEditing(null);
    setShowForm(false);
  };

  const handleEdit = (c: Client) => { setForm(c); setEditing(c); setShowForm(true); };

  const handleDelete = async (id: string) => {
    const c = clients.find(x => x.id === id);
    if (!confirm(`Excluir definitivamente o cliente "${c?.name}"?\n\nIsso removerá o login, comissões, lançamentos e atribuições deste cliente do banco de dados. Esta ação não pode ser desfeita.`)) return;
    const res = await supabase.functions.invoke('manage-users', { body: { action: 'delete_client', client_id: id } });
    if (res.error || (res.data as any)?.error) {
      toast.error((res.data as any)?.error || res.error?.message || 'Erro ao remover cliente');
      return;
    }
    toast.success('Cliente removido do banco de dados');
    setClients(prev => prev.filter(c => c.id !== id));
    fetchCommissions();
    logAudit({ action: 'client_deleted', entity: 'client', entity_id: id, before: c as any });
  };

  // "Lançar Gastos em Ads" — inserts ad spend, auto-calculates commission as PENDING
  const handleAddAdSpend = async (clientId: string) => {
    const adSpend = parseFloat(adSpendAmount);
    if (isNaN(adSpend) || adSpend <= 0) { toast.error('Informe um valor de gasto válido'); return; }
    
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    const accumWeek = getWeeklyAccumSpend(clientId, commissionDate);
    const commission = calculateCommission(client, adSpend, accumWeek);
    const percentApplied = client.clientType === 'aluguel'
      ? getTierPercentage(accumWeek + adSpend, client.percentageValue || 0)
      : 0;
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

    // Abate o crédito do plano (se aluguel) — a parte abatida NÃO gera receita,
    // pois o crédito já foi lançado como faturamento no cadastro do cliente.
    const availableCredit = client.clientType === 'aluguel' ? Math.max(0, client.planCredit || 0) : 0;
    const creditApplied = Math.min(availableCredit, commission);
    const billableAmount = commission - creditApplied;

    if (creditApplied > 0) {
      const newCredit = Math.max(0, availableCredit - creditApplied);
      await supabase.from('clients').update({ plan_credit: newCredit } as any).eq('id', clientId);
      await fetchClients();
    }

    if (billableAmount > 0) {
      const categoryType = client.clientType === 'venda' ? 'Comissão Fixa' : 'Comissão Semanal';
      const periodoStr = `${format(weekStart, 'dd/MM')} a ${format(weekEnd, 'dd/MM')}`;
      await supabase.from('transactions').insert({
        date: format(commissionDate, 'yyyy-MM-dd'),
        type: 'receita',
        category: categoryType,
        client_id: clientId,
        amount: billableAmount,
        description: `Comissão do cliente ${client.name} - período ${periodoStr}${creditApplied > 0 ? ` (crédito abatido: ${fmt(creditApplied)})` : ''}`,
      });
    }

    const msg = creditApplied > 0
      ? `Comissão ${fmt(commission)} • crédito abatido ${fmt(creditApplied)}${billableAmount > 0 ? ` • faturado ${fmt(billableAmount)}` : ' (100% pelo crédito)'}`
      : `Gasto em Ads: ${fmt(adSpend)} → Comissão pendente: ${fmt(commission)}`;
    toast.success(msg);
    setAdSpendAmount(''); setCommissionNote(''); setCommissionDate(new Date()); setShowCommissionForm(null);
    fetchCommissions();
  };

  // "Comissão Paga" — subtracts from pending commissions AND books revenue in Faturamento
  const handleAddPaid = async (clientId: string) => {
    if (!isAdmin) { toast.error('Apenas administradores podem validar pagamentos'); return; }
    const amount = parseFloat(paidAmount);
    if (isNaN(amount) || amount <= 0) return;

    const client = clients.find(c => c.id === clientId);
    const dateISO = paidDate.toISOString();
    const dateOnly = format(paidDate, 'yyyy-MM-dd');

    const { error } = await supabase.from('commissions').insert({
      client_id: clientId, date: dateISO, amount, type: 'paid',
    });
    if (error) { toast.error('Erro ao registrar pagamento'); return; }

    // Lança também em transactions p/ aparecer no Faturamento
    const { error: txError } = await supabase.from('transactions').insert({
      date: dateOnly,
      type: 'receita',
      category: 'Comissão Semanal',
      client_id: clientId,
      amount,
      description: `Pagamento de comissão — ${client?.name || 'cliente'}`,
    } as any);
    if (txError) {
      toast.error('Pagamento salvo, mas falhou ao lançar no Faturamento: ' + txError.message);
    }

    logAudit({ action: 'commission_payment_validated', entity: 'client', entity_id: clientId, after: { amount, date: dateISO } });

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

    toast.success('Pagamento registrado e lançado no Faturamento!');
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

  // Mark a weekly billing as paid (creates a 'paid' record and liquidates pending)
  const handleMarkBillingPaid = async (billing: Commission) => {
    const pendente = billing.valorPendente ?? billing.amount;
    if (pendente <= 0) { toast.info('Cobrança já está paga'); return; }
    const client = clients.find(c => c.id === billing.clientId);
    const now = new Date();
    const { error } = await supabase.from('commissions').insert({
      client_id: billing.clientId,
      date: now.toISOString(),
      amount: pendente,
      type: 'paid',
      note: `Pagamento da cobrança ${billing.note || `${billing.billingWeekStart}-${billing.billingWeekEnd}`}`,
    });
    if (error) { toast.error('Erro ao marcar como pago'); return; }

    // Lança também em transactions p/ aparecer no Faturamento
    const { error: txError } = await supabase.from('transactions').insert({
      date: format(now, 'yyyy-MM-dd'),
      type: 'receita',
      category: 'Comissão Semanal',
      client_id: billing.clientId,
      amount: pendente,
      description: `Pagamento de cobrança semanal — ${client?.name || 'cliente'}`,
    } as any);
    if (txError) toast.error('Pagamento salvo, mas falhou ao lançar no Faturamento: ' + txError.message);

    // Liquidate pending commissions FIFO (mirrors handleAddPaid)
    const clientDailyComms = commissions
      .filter(c => c.clientId === billing.clientId && (c.type === 'daily' || c.type === 'weekly_billing') && (c.status === 'pendente' || c.status === 'parcial'))
      .sort((a, b) => parseDateLocal(a.date).getTime() - parseDateLocal(b.date).getTime());
    let remaining = pendente;
    for (const comm of clientDailyComms) {
      if (remaining <= 0) break;
      const p = comm.valorPendente || (comm.amount - (comm.valorPago || 0));
      const payThis = Math.min(remaining, p);
      const newPago = (comm.valorPago || 0) + payThis;
      const newPendente = comm.amount - newPago;
      const newStatus = newPendente <= 0 ? 'pago' : 'parcial';
      await supabase.from('commissions').update({ valor_pago: newPago, valor_pendente: Math.max(0, newPendente), status: newStatus } as any).eq('id', comm.id);
      remaining -= payThis;
    }
    toast.success('Cobrança paga e lançada no Faturamento!');
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
  
  // All-time commission from REAL insights (matches ClientDashboard logic)
  const computeAllTimeCommissionFromInsights = (clientId: string): number => {
    const client = clients.find(c => c.id === clientId);
    if (!client || client.clientType === 'venda') return 0;
    const basePct = client.percentageValue || 0;
    const rows = insightsByClient[clientId] || [];
    if (rows.length === 0) return 0;
    const byWeek: Record<string, number> = {};
    rows.forEach(r => {
      const d = parseDateLocal(r.date);
      const ws = startOfWeek(d, { weekStartsOn: 4 });
      const key = format(ws, 'yyyy-MM-dd');
      byWeek[key] = (byWeek[key] || 0) + r.spend;
    });
    let total = 0;
    Object.values(byWeek).forEach(weekTotal => {
      const rate = getTierPercentage(weekTotal, basePct);
      total += weekTotal * (rate / 100);
    });
    return total;
  };

  // Weekly breakdown per client (uses ISO week starting Thursday, same as dashboard)
  const computeWeeklyForClient = (clientId: string): WeeklyRow[] => {
    const client = clients.find(c => c.id === clientId);
    if (!client || client.clientType === 'venda') return [];
    const basePct = client.percentageValue || 0;
    const rows = insightsByClient[clientId] || [];
    if (rows.length === 0) return [];
    const byWeek: Record<string, number> = {};
    rows.forEach(r => {
      const d = parseDateLocal(r.date);
      const ws = startOfWeek(d, { weekStartsOn: 4 });
      const key = format(ws, 'yyyy-MM-dd');
      byWeek[key] = (byWeek[key] || 0) + r.spend;
    });
    return Object.entries(byWeek).map(([k, spend]) => {
      const rate = getTierPercentage(spend, basePct);
      return { weekStart: parseDateLocal(k), spend, commission: spend * (rate / 100) };
    });
  };

  const getAccumulated = (clientId: string) => {
    const cc = getClientCommissions(clientId);
    const range = getFilterRange();

    const filtered = range
      ? cc.filter(c => isWithinInterval(parseDateLocal(c.date), { start: range.start, end: range.end }))
      : cc;

    const comissionTypes = filtered.filter(c => c.type === 'daily' || c.type === 'weekly_billing');
    // Ad Spend real vem dos insights da Meta (mesma fonte do dashboard do cliente),
    // não das comissões manuais. Filtra pelo período selecionado.
    const insightRows = insightsByClient[clientId] || [];
    const totalAdSpend = insightRows
      .filter(r => !range || isWithinInterval(parseDateLocal(r.date), { start: range.start, end: range.end }))
      .reduce((s, r) => s + (r.spend || 0), 0);

    // Comissão Pendente (no período): soma de valor_pendente
    const comissaoPendente = comissionTypes
      .filter(c => c.status === 'pendente' || c.status === 'parcial')
      .reduce((s, c) => s + (c.valorPendente || 0), 0);

    // Comissão Paga (no período): pagamentos do tipo 'paid' + valor_pago dos daily/weekly
    const paidRecords = filtered.filter(c => c.type === 'paid').reduce((s, c) => s + c.amount, 0);
    const valorPagoFromDaily = comissionTypes
      .filter(c => c.status === 'pago' || c.status === 'parcial')
      .reduce((s, c) => s + (c.valorPago || 0), 0);
    const comissaoPaga = paidRecords + valorPagoFromDaily;

    // Saldo Pendente vs Saldo Atrasado: separa semana corrente (ainda não venceu)
    // do que já passou da sexta de cobrança sem pagamento.
    const client = clients.find(c => c.id === clientId);
    const weeks = computeWeeklyForClient(clientId);
    const totalPaidAllTime = cc.filter(c => c.type === 'paid').reduce((s, c) => s + c.amount, 0);
    const planCredit = Number(client?.planCredit || 0);
    const split = splitOverdueVsCurrent(weeks, planCredit, totalPaidAllTime);
    const saldoPendente = split.currentPending;
    const saldoAtrasado = split.overdue;

    return { comissaoPendente, comissaoPaga, saldoPendente, saldoAtrasado, totalAdSpend };
  };

  const fmt = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const inputClass = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors";

  // Status agregado (em_dia / pendente / atrasado / sem_gasto)
  const getClientStatus = (clientId: string): ClientStatus => {
    const acc = getAccumulated(clientId);
    if (acc.saldoAtrasado > 0) return 'atrasado';
    if (acc.saldoPendente > 0) return 'pendente';
    if (acc.totalAdSpend <= 0) return 'sem_gasto';
    return 'em_dia';
  };

  // Lista filtrada + ordenada
  const filteredClients = useMemo(() => {
    const term = search.toLowerCase();
    let arr = clients.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.companyName.toLowerCase().includes(term) ||
      c.number.includes(search)
    );
    if (typeFilter !== 'all') arr = arr.filter(c => c.clientType === typeFilter);
    if (statusFilter !== 'all') arr = arr.filter(c => getClientStatus(c.id) === statusFilter);

    const withAcc = arr.map(c => ({ c, acc: getAccumulated(c.id) }));
    if (sort === 'saldo_desc') withAcc.sort((a, b) => b.acc.saldoPendente - a.acc.saldoPendente);
    else if (sort === 'az') withAcc.sort((a, b) => a.c.name.localeCompare(b.c.name));
    // 'recent' mantém ordem do fetch (created_at desc) que é a ordem em `clients`
    return withAcc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, commissions, insightsByClient, search, typeFilter, statusFilter, sort, periodFilter, customStart, customEnd, commissionTiers]);

  // KPIs globais (somam todos os clientes do período/filtros aplicados)
  const kpi = useMemo(() => {
    const aluguelCount = clients.filter(c => c.clientType === 'aluguel').length;
    const vendaCount = clients.filter(c => c.clientType === 'venda').length;
    let totalAdSpend = 0, totalPendente = 0, totalAtrasado = 0, totalPaga = 0, inadimplentes = 0;
    clients.forEach(c => {
      const acc = getAccumulated(c.id);
      totalAdSpend += acc.totalAdSpend;
      totalPendente += acc.saldoPendente;
      totalAtrasado += acc.saldoAtrasado;
      totalPaga += acc.comissaoPaga;
      if (acc.saldoAtrasado > 0) inadimplentes++;
    });
    return { totalClients: clients.length, aluguelCount, vendaCount, totalAdSpend, totalPendente, totalAtrasado, totalPaga, inadimplentes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, commissions, insightsByClient, periodFilter, customStart, customEnd, commissionTiers]);

  // Mapa de gasto diário por cliente (usado na sparkline do card)
  const spendByClient = insightsByClient;

  const historyClient = historyClientId ? clients.find(c => c.id === historyClientId) : null;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Clientes & Comissões"
        title={<>Carteira de <span className="text-primary glow-text">clientes</span></>}
        description="Gestão completa de clientes, comissões diárias e fechamento semanal de Ad Spend."
      />

      <ClientKPIBar kpi={kpi} />

      <ClientFiltersBar
        search={search}
        setSearch={setSearch}
        periodFilter={periodFilter}
        setPeriodFilter={setPeriodFilter}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        sort={sort}
        setSort={setSort}
        shownCount={filteredClients.length}
        totalCount={clients.length}
        onNewClient={() => { resetForm(); setShowForm(true); }}
        onOpenTiers={() => setTiersOpen(true)}
      />


      {showForm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-semibold">{editing ? 'Editar Cliente' : 'Novo Cliente'}</h3>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Tipo de Cliente</label>
                <select
                  value={form.clientType || 'aluguel'}
                  onChange={e => {
                    const ct = e.target.value as 'aluguel' | 'venda';
                    setForm(p => ({
                      ...p,
                      clientType: ct,
                      paymentType: ct === 'venda' ? 'fixed' : 'percentage',
                      fixedValue: ct === 'venda' ? (p.fixedValue || 0) : 0,
                      percentageValue: ct === 'aluguel' ? (p.percentageValue || 0) : 0,
                    }));
                  }}
                  className={inputClass}
                  disabled={!!editing}
                >
                  <option value="aluguel">Aluguel (acesso ao portal + comissão %)</option>
                  <option value="venda">Venda (cadastro simples — só Nome e Número)</option>
                </select>
              </div>

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

              {form.clientType !== 'venda' && (
                <>
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">WhatsApp (cliente)</label>
                      <input value={form.whatsappPhone || ''} onChange={e => setForm(p => ({ ...p, whatsappPhone: e.target.value }))} placeholder="5511999999999" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Link do Grupo WhatsApp</label>
                      <input value={form.whatsappGroupLink || ''} onChange={e => setForm(p => ({ ...p, whatsappGroupLink: e.target.value }))} placeholder="https://chat.whatsapp.com/..." className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Parceiro indicador (opcional)</label>
                    <select
                      value={form.partnerId || ''}
                      onChange={e => setForm(p => ({ ...p, partnerId: e.target.value || null }))}
                      className={inputClass}
                    >
                      <option value="">— Sem parceiro —</option>
                      {partners.map(pt => (
                        <option key={pt.id} value={pt.id}>{pt.name} ({pt.email})</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Vincula este cliente a um parceiro. A comissão do parceiro é gerada automaticamente a cada pagamento recebido.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Percentual base (%)</label>
                    <input type="number" value={form.percentageValue || ''} onChange={e => setForm(p => ({ ...p, percentageValue: +e.target.value }))} className={inputClass} />
                    <p className="text-[10px] text-muted-foreground mt-1">Aplicado quando o gasto semanal for menor que $20k.</p>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Crédito do Plano (USD)</label>
                    <input type="number" step="0.01" value={form.planCredit ?? ''} onChange={e => setForm(p => ({ ...p, planCredit: parseFloat(e.target.value) || 0 }))} placeholder="0.00" className={inputClass} />
                    <p className="text-[10px] text-muted-foreground mt-1">Crédito pré-pago que será abatido automaticamente das próximas comissões semanais. Não entra como faturamento.</p>
                  </div>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-[11px] text-muted-foreground">
                    As <strong className="text-primary">metas semanais de desconto</strong> são globais. Configure-as no botão
                    <strong className="text-foreground"> "Metas de Desconto"</strong> na lista de clientes.
                  </div>

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
                </>
              )}
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
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
                <div className="h-4 w-1/3 bg-secondary rounded mb-3" />
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map(j => (
                    <div key={j} className="h-14 bg-secondary rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && clients.length === 0 && (
          <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
            <UserPlus size={36} className="mx-auto text-muted-foreground/60 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Nenhum cliente cadastrado ainda</p>
            <p className="text-xs text-muted-foreground mb-4">Adicione seu primeiro cliente para começar a gerenciar comissões.</p>
            <button onClick={() => { resetForm(); setShowForm(true); }} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 glow-box">
              <Plus size={14} /> Cadastrar primeiro cliente
            </button>
          </div>
        )}

        {!loading && clients.length > 0 && filteredClients.length === 0 && (
          <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
            <Search size={32} className="mx-auto text-muted-foreground/60 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Nenhum cliente bate com os filtros atuais</p>
            <button
              onClick={() => { setSearch(''); setTypeFilter('all'); setStatusFilter('all'); }}
              className="text-xs text-primary hover:underline mt-2"
            >
              Limpar filtros
            </button>
          </div>
        )}

        <AnimatePresence initial={false}>
          {!loading && filteredClients.map(({ c, acc }) => (
            <ClientCard
              key={c.id}
              client={c}
              totalAdSpend={acc.totalAdSpend}
              comissaoPendente={acc.comissaoPendente}
              comissaoPaga={acc.comissaoPaga}
              saldoPendente={acc.saldoPendente}
              saldoAtrasado={acc.saldoAtrasado}
              status={getClientStatus(c.id)}
              spendByDay={spendByClient[c.id] || []}
              isAdmin={isAdmin}
              showPayForm={showPaidForm === c.id}
              paidAmount={paidAmount}
              setPaidAmount={setPaidAmount}
              paidDate={paidDate}
              setPaidDate={setPaidDate}
              onView={() => navigate(`/client-view/${c.id}`)}
              onEdit={() => handleEdit(c)}
              onDelete={() => handleDelete(c.id)}
              onTogglePayForm={() => setShowPaidForm(showPaidForm === c.id ? null : c.id)}
              onSubmitPay={() => handleAddPaid(c.id)}
              onOpenHistory={() => setHistoryClientId(c.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      <TiersDialog
        open={tiersOpen}
        onOpenChange={setTiersOpen}
        tiersToShow={tiersToShow}
        tierDraft={tierDraft}
        commissionTiers={commissionTiers}
        updateTierDraft={updateTierDraft}
        addTier={addTier}
        removeTier={removeTier}
        saveTiers={saveTiers}
        cancelDraft={() => setTierDraft(null)}
        savingTiers={savingTiers}
      />

      <ClientHistoryDrawer
        open={!!historyClient}
        onOpenChange={(o) => { if (!o) setHistoryClientId(null); }}
        clientName={historyClient?.name || ''}
        commissions={historyClient ? getClientCommissions(historyClient.id) : []}
        onEdit={startEditCommission}
        onDelete={handleDeleteCommission}
      />
    </div>
  );
};

export default Clients;

