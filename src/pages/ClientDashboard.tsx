import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { LogOut, CreditCard, AlertTriangle, Shield, DollarSign, CalendarIcon, TrendingUp, Smartphone, Globe, Bitcoin, ShieldCheck, Sparkles, Ban, LayoutDashboard, FileText, Receipt, ImageIcon, Users as UsersIcon, LifeBuoy, Plus, CheckCircle2, Clock, Layers, ShieldAlert, Send, X, RefreshCw, Info, Pencil, Trash2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDateLocal, formatDateBR, formatDateShortBR } from '@/lib/date-utils';
import { supabase } from '@/integrations/supabase/client';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import AdScaleLogo from '@/components/AdScaleLogo';
import { useCommissionTiers, getTierPctFromTiers } from '@/lib/commission-tiers';
import { splitOverdueVsCurrent } from '@/lib/billing-status';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const ClientDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { clientId: viewAsClientId } = useParams<{ clientId?: string }>();
  const isAdminView = !!viewAsClientId && (user?.role === 'admin' || user?.role === 'support');
  const [client, setClient] = useState<any>(null);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [savedAccounts, setSavedAccounts] = useState<any[]>([]);
  const [activeAccounts, setActiveAccounts] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [customStart, setCustomStart] = useState<Date>(new Date());
  const [customEnd, setCustomEnd] = useState<Date>(new Date());
  const [tab, setTab] = useState<'resumo' | 'contrato' | 'cobrancas' | 'estrutura' | 'suporte'>('resumo');
  const [pages, setPages] = useState<any[]>([]);
  const [supportRequests, setSupportRequests] = useState<any[]>([]);
  const [reqType, setReqType] = useState<'add_ad_account' | 'add_page' | 'other'>('add_ad_account');
  const [reqQty, setReqQty] = useState<number>(1);
  const [reqDesc, setReqDesc] = useState<string>('');
  const [reqBmId, setReqBmId] = useState<string>('');
  const [reqPageNames, setReqPageNames] = useState<string[]>([]);
  const [submittingReq, setSubmittingReq] = useState(false);
  const [editingReqId, setEditingReqId] = useState<string | null>(null);

  const [lastAccountsSync, setLastAccountsSync] = useState<Date | null>(null);
  const [refreshingAccounts, setRefreshingAccounts] = useState(false);
  const clientIdRef = useRef<string | null>(null);

  const fetchAccounts = useCallback(async (clientId: string) => {
    const { data: assigns } = await supabase
      .from('meta_ad_account_assignments')
      .select('*, ad_account:meta_ad_accounts(*)')
      .eq('client_id', clientId)
      .eq('active', true);
    const list = assigns || [];
    setActiveAccounts(list);
    const latest = list
      .map((a: any) => a.ad_account?.last_synced_at)
      .filter(Boolean)
      .sort()
      .pop();
    if (latest) setLastAccountsSync(new Date(latest));

    // Load insights for these ad accounts (last 12 months window is plenty)
    const accountIds = list.map((a: any) => a.ad_account?.id).filter(Boolean);
    if (accountIds.length > 0) {
      const since = new Date();
      since.setMonth(since.getMonth() - 12);
      const sinceStr = since.toISOString().split('T')[0];
      const { data: ins } = await supabase
        .from('meta_ad_insights')
        .select('ad_account_id, date, spend')
        .in('ad_account_id', accountIds)
        .gte('date', sinceStr)
        .order('date', { ascending: true })
        .limit(20000);
      setInsights(ins || []);
    } else {
      setInsights([]);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let clientQuery = supabase.from('clients').select('*');
      if (isAdminView) {
        clientQuery = clientQuery.eq('id', viewAsClientId!);
      } else {
        if (!user?.email) return;
        clientQuery = clientQuery.eq('email', user.email);
      }
      const { data: clientData } = await clientQuery.maybeSingle();
      if (clientData) {
        setClient(clientData);
        clientIdRef.current = clientData.id;
        const [{ data: commData }, { data: blocked }, { data: pageAssigns }, { data: reqs }] = await Promise.all([
          supabase.from('commissions').select('*').eq('client_id', clientData.id).order('date', { ascending: false }),
          supabase.from('meta_blocked_accounts_log').select('*, ad_account:meta_ad_accounts(name, meta_account_id)').eq('client_id', clientData.id).order('detected_at', { ascending: false }),
          supabase.from('meta_page_assignments').select('*, page:meta_pages(*)').eq('client_id', clientData.id).eq('active', true),
          supabase.from('support_requests').select('*').eq('client_id', clientData.id).order('created_at', { ascending: false }),
        ]);
        await fetchAccounts(clientData.id);
        setCommissions(commData || []);
        setSavedAccounts(blocked || []);
        setPages((pageAssigns || []).map((a: any) => a.page).filter(Boolean));
        setSupportRequests(reqs || []);
      }
      setLoading(false);
    };
    fetchData();
  }, [user, viewAsClientId, isAdminView, fetchAccounts]);

  // Realtime: refresh ad accounts whenever sync updates them or assignments change
  useEffect(() => {
    if (!client?.id) return;
    const channel = supabase
      .channel(`client-accounts-${client.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_ad_accounts' }, () => {
        fetchAccounts(client.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_ad_account_assignments', filter: `client_id=eq.${client.id}` }, () => {
        fetchAccounts(client.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [client?.id, fetchAccounts]);

  const refreshAccounts = async () => {
    if (!client?.id) return;
    setRefreshingAccounts(true);
    await fetchAccounts(client.id);
    setRefreshingAccounts(false);
    toast.success('Contas atualizadas');
  };


  const resetReqForm = () => {
    setReqDesc(''); setReqQty(1); setReqBmId(''); setReqPageNames([]); setEditingReqId(null);
  };

  // Mantém a lista de nomes de páginas com o mesmo tamanho da quantidade
  useEffect(() => {
    if (reqType !== 'add_page') return;
    setReqPageNames(prev => {
      const next = [...prev];
      if (next.length < reqQty) {
        while (next.length < reqQty) next.push('');
      } else if (next.length > reqQty) {
        next.length = reqQty;
      }
      return next;
    });
  }, [reqQty, reqType]);

  const submitRequest = async () => {
    if (!client) return;
    if (reqType === 'add_ad_account' && !reqBmId.trim()) {
      toast.error('Informe o ID da BM onde deseja receber as contas.');
      return;
    }
    if (reqType === 'add_page') {
      const names = reqPageNames.slice(0, reqQty).map(n => (n || '').trim());
      if (names.some(n => !n)) {
        toast.error(`Informe o nome de todas as ${reqQty} páginas solicitadas.`);
        return;
      }
    }
    setSubmittingReq(true);
    const payload: any = {
      client_id: client.id,
      request_type: reqType,
      quantity: reqQty,
      description: reqDesc || null,
      bm_meta_id: reqType === 'add_ad_account' ? reqBmId.trim() : null,
      page_names: reqType === 'add_page' ? reqPageNames.slice(0, reqQty).map(n => n.trim()) : null,
    };
    if (editingReqId) {
      const { data, error } = await supabase.from('support_requests')
        .update(payload).eq('id', editingReqId).select().single();
      setSubmittingReq(false);
      if (error) { toast.error('Erro ao atualizar: ' + error.message); return; }
      setSupportRequests(prev => prev.map(r => r.id === editingReqId ? data : r));
      resetReqForm();
      toast.success('Solicitação atualizada!');
      return;
    }
    const { data, error } = await supabase.from('support_requests').insert(payload).select().single();
    setSubmittingReq(false);
    if (error) { toast.error('Erro ao enviar solicitação: ' + error.message); return; }
    setSupportRequests(prev => [data, ...prev]);
    resetReqForm();
    toast.success('Solicitação enviada! Nossa equipe foi notificada.');
  };

  const startEditRequest = (r: any) => {
    setEditingReqId(r.id);
    setReqType(r.request_type);
    setReqQty(r.quantity || 1);
    setReqDesc(r.description || '');
    setReqBmId(r.bm_meta_id || '');
    setReqPageNames(Array.isArray(r.page_names) ? r.page_names : []);
    setTab('suporte');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteRequest = async (id: string) => {
    if (!confirm('Excluir esta solicitação?')) return;
    const { error } = await supabase.from('support_requests').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir: ' + error.message); return; }
    setSupportRequests(prev => prev.filter(r => r.id !== id));
    if (editingReqId === id) resetReqForm();
    toast.success('Solicitação excluída.');
  };

  const fmt = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const getFilterRange = () => {
    const now = new Date();
    switch (periodFilter) {
      case 'today': return { start: startOfDay(now), end: endOfDay(now) };
      case 'week': return { start: startOfWeek(now, { weekStartsOn: 4 }), end: endOfWeek(now, { weekStartsOn: 4 }) };
      case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'custom': return { start: startOfDay(customStart), end: endOfDay(customEnd) };
    }
  };

  const filteredCommissions = useMemo(() => {
    const range = getFilterRange();
    return commissions.filter(c => {
      const d = parseDateLocal(c.date);
      return isWithinInterval(d, { start: range.start, end: range.end });
    });
  }, [commissions, periodFilter, customStart, customEnd]);

  // Tier logic — tiers come from DB (admin-configurable)
  const { tiers: commissionTiers } = useCommissionTiers();
  const getTierPct = (weekSpend: number, basePct: number) =>
    getTierPctFromTiers(weekSpend, basePct, commissionTiers);

  // Commission for a given spend list, grouped by week so tier discount is applied correctly
  const computeCommissionForSpend = (rows: { date: string; spend: number }[]) => {
    if (!client) return 0;
    if (client.client_type === 'venda') return 0; // venda uses fixed_value, not per-spend commission
    const basePct = Number(client.percentage_value) || 0;
    // Group by ISO week
    const byWeek: Record<string, number> = {};
    rows.forEach(r => {
      const d = parseDateLocal(r.date);
      const ws = startOfWeek(d, { weekStartsOn: 4 });
      const key = ws.toISOString().slice(0, 10);
      byWeek[key] = (byWeek[key] || 0) + Number(r.spend || 0);
    });
    let total = 0;
    Object.values(byWeek).forEach(weekTotal => {
      const rate = getTierPct(weekTotal, basePct);
      total += weekTotal * (rate / 100);
    });
    return total;
  };

  const allTimeTotals = useMemo(() => {
    const paid = commissions.filter(c => c.type === 'paid');
    const adSpend = insights.reduce((s, i) => s + Number(i.spend || 0), 0);
    return {
      commission: computeCommissionForSpend(insights as any),
      paid: paid.reduce((s, c) => s + Number(c.amount), 0),
      adSpend,
    };
  }, [commissions, insights, client, commissionTiers]);

  const periodTotals = useMemo(() => {
    const range = getFilterRange();
    const insightsInRange = insights.filter(i => {
      const d = parseDateLocal(i.date);
      return isWithinInterval(d, { start: range.start, end: range.end });
    });
    const paid = filteredCommissions.filter(c => c.type === 'paid');
    const adSpend = insightsInRange.reduce((s, i) => s + Number(i.spend || 0), 0);
    return {
      commission: computeCommissionForSpend(insightsInRange as any),
      paid: paid.reduce((s, c) => s + Number(c.amount), 0),
      adSpend,
    };
  }, [filteredCommissions, insights, periodFilter, customStart, customEnd, client, commissionTiers]);

  // Weekly commission history (real, from insights, by ISO week)
  const weeklyCommissionHistory = useMemo(() => {
    if (!client || client.client_type === 'venda') return [] as { weekStart: Date; spend: number; commission: number }[];
    const basePct = Number(client.percentage_value) || 0;
    const byWeek: Record<string, number> = {};
    insights.forEach((i: any) => {
      const d = parseDateLocal(i.date);
      const ws = startOfWeek(d, { weekStartsOn: 4 });
      const key = ws.toISOString().slice(0, 10);
      byWeek[key] = (byWeek[key] || 0) + Number(i.spend || 0);
    });
    return Object.entries(byWeek)
      .map(([k, spend]) => {
        const rate = getTierPct(spend, basePct);
        return { weekStart: parseDateLocal(k), spend, commission: spend * (rate / 100) };
      })
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  }, [insights, client, commissionTiers]);

  // Credit ledger: REAL week-by-week history. Applies plan_credit FIFO from the
  // earliest week with spend, week by week, until credit is exhausted.
  const creditPlan = useMemo(() => {
    const credit = Number(client?.plan_credit || 0);
    if (!client || client.client_type === 'venda') return null;
    const weeks = weeklyCommissionHistory.filter(w => w.commission > 0);
    if (weeks.length === 0) return null;

    let remaining = credit;
    const rows = weeks.map(w => {
      const applied = Math.min(remaining, w.commission);
      const pays = Math.max(0, w.commission - applied);
      remaining = Math.max(0, remaining - applied);
      return {
        weekStart: w.weekStart,
        spend: w.spend,
        commission: w.commission,
        creditApplied: applied,
        clientPays: pays,
        remainingAfter: remaining,
      };
    });

    const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
    const totalApplied = rows.reduce((s, r) => s + r.creditApplied, 0);
    const totalPaying = rows.reduce((s, r) => s + r.clientPays, 0);

    return {
      totalCredit: credit,
      remaining,
      totalCommission,
      totalApplied,
      totalPaying,
      rows,
    };
  }, [client, weeklyCommissionHistory]);


  const pendingBillings = useMemo(
    () => commissions.filter(c => c.type === 'weekly_billing' && (c as any).status !== 'pago'),
    [commissions]
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground text-sm">Carregando...</p></div>;

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Cadastro de cliente não encontrado.</p>
      </div>
    );
  }

  const originalCredit = Number(client?.plan_credit || 0);
  const creditUsed = creditPlan?.totalApplied || 0;
  const availableCredit = creditPlan ? creditPlan.remaining : originalCredit;
  const pendingTotal = Math.max(0, allTimeTotals.commission - allTimeTotals.paid - creditUsed);

  // Split entre saldo da semana corrente (pendente) e saldo já vencido (atrasado)
  const billingSplit = splitOverdueVsCurrent(
    weeklyCommissionHistory,
    originalCredit,
    allTimeTotals.paid,
  );
  const overdueTotal = billingSplit.overdue;
  const currentPendingTotal = billingSplit.currentPending;

  const cobrancasCount = pendingBillings.length + (pendingTotal > 0 ? 1 : 0);

  const paymentMsg = (method: string) =>
    `Olá! Sou o cliente ${client.name}. Gostaria de realizar o pagamento do saldo pendente de ${fmt(pendingTotal)} via *${method}*.`;

  const overdueMsg = (method: string) =>
    `Olá! Sou o cliente ${client.name}. Estou regularizando o *saldo atrasado* de ${fmt(overdueTotal)} via *${method}*.`;


  return (
    <div className="min-h-screen bg-background">
      {isAdminView && (
        <div className="sticky top-0 z-50 bg-primary text-primary-foreground border-b border-primary/60 px-4 lg:px-8 py-2.5 flex items-center justify-between text-xs shadow-lg">
          <div className="flex items-center gap-2">
            <Shield size={14} />
            <span className="font-semibold uppercase tracking-wider">Modo Administrador</span>
            <span className="opacity-90 hidden sm:inline">— visualizando como <strong>{client.name}</strong></span>
          </div>
          <button onClick={() => navigate('/clients')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background/20 hover:bg-background/30 text-primary-foreground font-medium border border-background/30">
            <X size={13} /> Sair da visualização
          </button>
        </div>
      )}
      <header className="border-b border-border px-4 lg:px-8 py-4 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur z-20">
        <div className="flex items-center gap-3 text-primary">
          <AdScaleLogo size={28} />
          <p className="text-xs text-muted-foreground hidden sm:block border-l border-border pl-3">Painel do Cliente</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-foreground">{client.name}</p>
            <p className="text-[10px] text-muted-foreground">{client.email}</p>
          </div>
          {isAdminView ? (
            <button onClick={() => navigate('/clients')} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary" title="Voltar para Clientes">
              <X size={16} />
            </button>
          ) : (
            <button onClick={async () => { await logout(); navigate('/login'); }} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </header>


      <div className="p-4 lg:p-8 max-w-5xl mx-auto">
        {/* Hero header KPI strip */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5 mb-5">
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/15 blur-[60px] pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-primary/80 mb-3">
              <Sparkles size={11} /> Bem-vindo, {client.name?.split(' ')[0]}
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-1">
              Sua operação em <span className="text-primary glow-text">tempo real</span>
            </h2>
            <p className="text-xs text-muted-foreground max-w-xl">
              Acompanhe seu investimento, contrato e cobranças em um só lugar. A agência protege seus ativos 24/7.
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-5">
          <TabsList className="w-full grid grid-cols-3 sm:grid-cols-5 h-auto p-1 bg-secondary/60 border border-border">
            <TabsTrigger value="resumo" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 gap-2 text-xs sm:text-sm">
              <LayoutDashboard size={14} /> Resumo
            </TabsTrigger>
            <TabsTrigger value="contrato" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 gap-2 text-xs sm:text-sm">
              <FileText size={14} /> Contrato
            </TabsTrigger>
            <TabsTrigger value="estrutura" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 gap-2 text-xs sm:text-sm">
              <Layers size={14} /> Estrutura
              {(activeAccounts.length + pages.length) > 0 && (
                <span className="ml-1 bg-primary/20 text-primary text-[10px] font-bold rounded-full px-1.5 py-0.5">{activeAccounts.length + pages.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="suporte" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 gap-2 text-xs sm:text-sm relative">
              <LifeBuoy size={14} /> Suporte
              {supportRequests.filter(r => r.status === 'pendente' || r.status === 'em_andamento').length > 0 && (
                <span className="absolute -top-1 -right-1 sm:static sm:ml-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {supportRequests.filter(r => r.status === 'pendente' || r.status === 'em_andamento').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="cobrancas" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 gap-2 text-xs sm:text-sm relative">
              <Receipt size={14} /> Cobranças
              {cobrancasCount > 0 && (
                <span className="absolute -top-1 -right-1 sm:static sm:ml-1 bg-warning text-warning-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {cobrancasCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* RESUMO */}
          <TabsContent value="resumo" className="space-y-5 mt-0">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {(() => {
                const blockedUnique = new Set(
                  (savedAccounts || [])
                    .filter((s: any) => !s.event_type || /block|bloq|disable|ban/i.test(s.event_type))
                    .map((s: any) => s.ad_account_id)
                ).size;
                const currentlyBlocked = activeAccounts.filter((a: any) => a.ad_account?.status === 'blocked' || (a.ad_account?.disable_reason ?? 0) > 0).length;
                const savedTotal = Math.max(blockedUnique, currentlyBlocked);
                return (
                  <div className="rounded-xl bg-primary/10 border border-primary/30 p-4">
                    <ShieldCheck size={18} className="text-primary" />
                    <div className="text-2xl font-bold text-primary mt-2">{savedTotal}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-0.5">Contas Economizadas</div>
                    <div className="text-[10px] text-muted-foreground/60 mt-1">Bloqueios absorvidos pela operação — você paga por performance, não por conta</div>
                  </div>
                );
              })()}
              <div className="rounded-xl bg-card border border-border p-4">
                <Shield size={18} className="text-emerald-400" />
                <div className="text-2xl font-bold text-emerald-400 mt-2">{activeAccounts.filter((a: any) => !(a.ad_account?.status === 'blocked' || (a.ad_account?.disable_reason ?? 0) > 0)).length}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-0.5">Contas Ativas</div>
                <div className="text-[10px] text-muted-foreground/60 mt-1">Operando para você</div>
              </div>
              <div className="rounded-xl bg-card border border-border p-4">
                <TrendingUp size={18} className="text-sky-400" />
                <div className="text-2xl font-bold text-sky-400 mt-2">{fmt(periodTotals.adSpend)}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-0.5">Investido em Ads</div>
                <div className="text-[10px] text-muted-foreground/60 mt-1">{periodFilter === 'today' ? 'Hoje' : periodFilter === 'week' ? 'Esta semana' : periodFilter === 'month' ? 'Este mês' : 'Período custom'}</div>
              </div>
              <div className="rounded-xl bg-card border border-border p-4">
                <DollarSign size={18} className="text-amber-400" />
                <div className="text-2xl font-bold text-amber-400 mt-2">{fmt(periodTotals.commission)}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-0.5">Comissão Agência</div>
                <div className="text-[10px] text-muted-foreground/60 mt-1">{periodFilter === 'today' ? 'Hoje' : periodFilter === 'week' ? 'Esta semana' : periodFilter === 'month' ? 'Este mês' : 'Período custom'}</div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-primary/15 to-emerald-500/10 border border-primary/30 p-4">
                <CreditCard size={18} className="text-primary" />
                <div className="text-2xl font-bold text-primary mt-2">{fmt(availableCredit)}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-0.5">Crédito Disponível</div>
                <div className="text-[10px] text-muted-foreground/60 mt-1">
                  {creditUsed > 0
                    ? <>Usado <span className="text-primary/80 font-semibold">{fmt(creditUsed)}</span> de {fmt(originalCredit)}</>
                    : 'Abatido automaticamente da comissão'}
                </div>
              </div>
            </div>

            {/* Period Filter + Totals */}
            <div className="bg-card border border-border rounded-xl p-5 border-glow">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <h3 className="font-display text-sm font-semibold flex items-center gap-2">
                  <TrendingUp size={16} className="text-primary" /> Resumo por Período
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {(['today', 'week', 'month', 'custom'] as const).map(p => (
                    <button key={p} onClick={() => setPeriodFilter(p)}
                      className={cn("px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                        periodFilter === p ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                      )}>
                      {p === 'today' ? 'Hoje' : p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : 'Personalizado'}
                    </button>
                  ))}
                </div>
              </div>

              {periodFilter === 'custom' && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-secondary border border-border hover:border-primary">
                        <CalendarIcon size={12} /> De: {format(customStart, 'dd/MM/yyyy', { locale: ptBR })}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customStart} onSelect={d => d && setCustomStart(d)} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-secondary border border-border hover:border-primary">
                        <CalendarIcon size={12} /> Até: {format(customEnd, 'dd/MM/yyyy', { locale: ptBR })}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customEnd} onSelect={d => d && setCustomEnd(d)} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-secondary rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Gasto em Ads</p>
                  <p className="text-base sm:text-lg font-bold text-foreground mt-1">{fmt(periodTotals.adSpend)}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Comissão</p>
                  <p className="text-base sm:text-lg font-bold text-primary mt-1">{fmt(periodTotals.commission)}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pago</p>
                  <p className="text-base sm:text-lg font-bold text-success mt-1">{fmt(periodTotals.paid)}</p>
                </div>
              </div>
            </div>

            {/* Billing cycle notice */}
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 flex items-start gap-3">
              <Info size={16} className="text-amber-300 mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-amber-300">Ciclo de cobrança: quinta a quinta.</strong> A semana fecha na quinta-feira e o pagamento é gerado na sexta. Isso garante que todo o gasto do período já esteja consolidado nas contas de anúncio antes do faturamento — a sexta-feira ainda está em andamento e não é incluída na semana cobrada.
              </div>
            </div>

            {/* Credit runway: week-by-week */}
            {creditPlan && (
              <div className="bg-card border border-primary/30 rounded-xl p-5 border-glow relative overflow-hidden">
                <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/10 blur-[60px] pointer-events-none" />
                <div className="relative">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                    <h3 className="font-display text-sm font-semibold flex items-center gap-2">
                      <CreditCard size={16} className="text-primary" /> Plano de Crédito — histórico semana a semana
                    </h3>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-primary" /> Crédito abatido</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> A pagar</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Histórico real de comissão gerada por semana a partir do gasto das suas contas de anúncio. Crédito total de <strong className="text-primary">{fmt(creditPlan.totalCredit)}</strong> · abatido até hoje <strong className="text-foreground">{fmt(creditPlan.totalApplied)}</strong> · saldo restante <strong className="text-primary">{fmt(creditPlan.remaining)}</strong> · valor a pagar acumulado <strong className="text-amber-300">{fmt(creditPlan.totalPaying)}</strong>.
                  </p>

                  <div className="space-y-2.5">
                    {creditPlan.rows.map((r, idx) => {
                      const pct = Math.max(1, (r.creditApplied / r.commission) * 100);
                      const isFirstPaying = r.creditApplied < r.commission && (idx === 0 || creditPlan.rows[idx - 1].clientPays === 0);
                      return (
                        <div key={idx} className={cn(
                          "rounded-lg border p-3",
                          isFirstPaying ? "border-amber-400/40 bg-amber-400/5" : "border-border bg-secondary/40"
                        )}>
                          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-muted-foreground">Semana {idx + 1}</span>
                              <span className="text-xs font-medium text-foreground">
                                {format(r.weekStart, "dd 'de' MMM yyyy", { locale: ptBR })}
                              </span>
                              {isFirstPaying && r.clientPays > 0 && (
                                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-semibold">
                                  Início dos pagamentos
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Saldo: <span className="text-primary font-semibold">{fmt(r.remainingAfter)}</span>
                            </div>
                          </div>
                          <div className="relative h-6 rounded-md bg-background overflow-hidden border border-border">
                            {r.creditApplied > 0 && (
                              <div
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/80 to-primary flex items-center px-2"
                                style={{ width: `${pct}%` }}
                              >
                                <span className="text-[10px] font-bold text-primary-foreground whitespace-nowrap">
                                  −{fmt(r.creditApplied)}
                                </span>
                              </div>
                            )}
                            {r.clientPays > 0 && (
                              <div
                                className="absolute inset-y-0 right-0 bg-amber-400/80 flex items-center justify-end px-2"
                                style={{ width: `${100 - pct}%` }}
                              >
                                <span className="text-[10px] font-bold text-background whitespace-nowrap">
                                  {fmt(r.clientPays)}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                            <span>Gasto: <span className="text-foreground font-medium">{fmt(r.spend)}</span> · Comissão: <span className="text-foreground font-medium">{fmt(r.commission)}</span></span>
                            <span>
                              {r.creditApplied >= r.commission && '100% coberto pelo crédito'}
                              {r.creditApplied > 0 && r.creditApplied < r.commission && 'Crédito esgotado nesta semana'}
                              {r.creditApplied === 0 && 'Pagamento integral via Pix/Cripto'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}


            {/* Saved accounts */}
            {savedAccounts.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5 border-glow">
                <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-primary" /> Contas Salvas pela Agência
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {savedAccounts.slice(0, 12).map(s => (
                    <span key={s.id} className="text-[10px] px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary/90 font-mono">
                      {s.ad_account?.name || s.ad_account?.meta_account_id || 'Conta'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Ad Accounts */}
            <div className="bg-card border border-border rounded-xl p-5 border-glow">
              <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
                <Shield size={16} className="text-primary" /> Contas de Anúncio
              </h3>
              {(() => {
                const total = client.ad_accounts || 0;
                const used = activeAccounts.length;
                const blockedCount = activeAccounts.filter((a: any) => a.ad_account?.status === 'blocked' || (a.ad_account?.disable_reason ?? 0) > 0).length;
                const activeCount = used - blockedCount;
                const available = Math.max(0, total - used);
                return (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-secondary rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-primary">{available}</p>
                      <p className="text-xs text-muted-foreground mt-1">Disponíveis</p>
                    </div>
                    <div className="bg-secondary rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
                      <p className="text-xs text-muted-foreground mt-1">Em uso</p>
                    </div>
                    <div className="bg-secondary rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-destructive">{blockedCount}</p>
                      <p className="text-xs text-muted-foreground mt-1">Bloqueadas</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </TabsContent>

          {/* CONTRATO */}
          <TabsContent value="contrato" className="space-y-5 mt-0">
            <div className="bg-card border border-border rounded-xl p-5 border-glow">
              <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
                <CreditCard size={16} className="text-primary" /> Detalhes do Contrato
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="bg-secondary/60 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipo de Cliente</p>
                  <p className="font-medium mt-1">{client.client_type === 'venda' ? 'Venda (Valor Fixo)' : 'Aluguel (% sobre Gasto)'}</p>
                </div>
                {client.client_type === 'venda' ? (
                  <div className="bg-secondary/60 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor Fixo</p>
                    <p className="font-medium text-primary mt-1">{fmt(Number(client.fixed_value) || 0)}</p>
                  </div>
                ) : (
                  <div className="bg-secondary/60 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Percentual base</p>
                    <p className="font-medium text-primary mt-1">{Number(client.percentage_value) || 0}%</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Percentual definido no contrato. Conforme as metas de gasto semanal forem atingidas, a taxa diminui progressivamente.</p>
                  </div>
                )}
                <div className="bg-secondary/60 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cobrança</p>
                  <p className="font-medium mt-1">Semanal — toda sexta-feira</p>
                </div>
                {client.observations && (
                  <div className="sm:col-span-2 bg-secondary/60 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Observações</p>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{client.observations}</p>
                  </div>
                )}
              </div>
            </div>

            {client.client_type !== 'venda' && (() => {
              const now = new Date();
              const ws = startOfWeek(now, { weekStartsOn: 4 });
              const we = endOfWeek(now, { weekStartsOn: 4 });
              const weekSpend = insights
                .filter((i: any) => isWithinInterval(parseDateLocal(i.date), { start: ws, end: we }))
                .reduce((s: number, i: any) => s + Number(i.spend || 0), 0);
              const tiers = [...commissionTiers]
                .map(t => ({ min: t.min_spend, pct: t.pct }))
                .sort((a, b) => a.min - b.min);
              const currentRate = [...tiers].reverse().find(t => weekSpend > t.min)?.pct ?? (Number(client.percentage_value) || 0);
              const nextTier = tiers.find(t => weekSpend <= t.min);
              const remaining = nextTier ? Math.max(0, nextTier.min - weekSpend) : 0;
              const topTier = tiers[tiers.length - 1];
              const progressMax = nextTier ? nextTier.min : (topTier?.min || 200000);
              const progressPct = Math.min(100, (weekSpend / progressMax) * 100);
              return (
                <div className="bg-card border border-border rounded-xl p-5 border-glow">
                  <h3 className="font-display text-sm font-semibold mb-1 flex items-center gap-2">
                    <TrendingUp size={16} className="text-primary" /> Metas semanais de desconto
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Quanto mais sua conta gastar na semana, menor o percentual cobrado pela agência.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div className="bg-secondary/60 rounded-lg p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Gasto desta semana</p>
                      <p className="font-bold text-lg text-foreground mt-1">{fmt(weekSpend)}</p>
                    </div>
                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Percentual atual</p>
                      <p className="font-bold text-lg text-primary mt-1">{currentRate}%</p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                    {nextTier ? (
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Faltam <strong className="text-primary">{fmt(remaining)}</strong> para atingir <strong className="text-primary">{nextTier.pct}%</strong> (acima de {fmt(nextTier.min)}).
                      </p>
                    ) : (
                      <p className="text-[11px] text-success mt-2">Você atingiu a meta máxima — {topTier?.pct ?? 1}% sobre o gasto.</p>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {tiers.map(t => {
                      const reached = weekSpend > t.min;
                      const active = currentRate === t.pct;
                      return (
                        <li
                          key={t.min}
                          className={cn(
                            "flex items-center justify-between rounded-lg px-3 py-2 border text-sm",
                            active ? "bg-primary/10 border-primary/40" :
                            reached ? "bg-success/10 border-success/30" :
                            "bg-secondary/40 border-border"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span className={cn(
                              "w-2 h-2 rounded-full",
                              active ? "bg-primary animate-pulse" : reached ? "bg-success" : "bg-muted-foreground/40"
                            )} />
                            Acima de {fmt(t.min)}
                          </span>
                          <span className={cn("font-semibold",
                            active ? "text-primary" : reached ? "text-success" : "text-muted-foreground"
                          )}>{t.pct}%</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })()}

            <div className="bg-card border border-border rounded-xl p-5 border-glow">
              <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
                <DollarSign size={16} className="text-primary" /> Histórico Acumulado
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-secondary rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Gasto Total Ads</p>
                  <p className="text-sm font-bold text-foreground mt-1">{fmt(allTimeTotals.adSpend)}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Comissão Total</p>
                  <p className="text-sm font-bold text-primary mt-1">{fmt(allTimeTotals.commission)}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Pago</p>
                  <p className="text-sm font-bold text-success mt-1">{fmt(allTimeTotals.paid)}</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ESTRUTURA */}
          <TabsContent value="estrutura" className="space-y-5 mt-0">
            {/* Ad accounts breakdown by status */}
            {(() => {
              const total = client.ad_accounts || 0;
              const used = activeAccounts.length;
              const blockedCount = activeAccounts.filter((a: any) => a.ad_account?.status === 'blocked' || (a.ad_account?.disable_reason ?? 0) > 0).length;
              const activeCount = used - blockedCount;
              const available = Math.max(0, total - used);
              return (
                <div className="bg-card border border-border rounded-xl p-5 border-glow">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                    <h3 className="font-display text-sm font-semibold flex items-center gap-2">
                      <CreditCard size={16} className="text-primary" /> Contas de Anúncio
                    </h3>
                    <div className="flex items-center gap-2">
                      {lastAccountsSync && (
                        <span className="text-[10px] text-muted-foreground">
                          Sincronizado {formatDistanceToNow(lastAccountsSync, { addSuffix: true, locale: ptBR })}
                        </span>
                      )}
                      <button
                        onClick={refreshAccounts}
                        disabled={refreshingAccounts}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-secondary border border-border hover:border-primary hover:text-primary disabled:opacity-50 transition-colors"
                        title="Atualizar"
                      >
                        <RefreshCw size={11} className={refreshingAccounts ? 'animate-spin' : ''} />
                        Atualizar
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-center">
                      <ShieldCheck size={16} className="text-emerald-400 mx-auto mb-1" />
                      <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Ativas</p>
                    </div>
                    <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-center">
                      <Ban size={16} className="text-destructive mx-auto mb-1" />
                      <p className="text-2xl font-bold text-destructive">{blockedCount}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Banidas</p>
                    </div>
                    <div className="rounded-xl bg-primary/10 border border-primary/30 p-3 text-center">
                      <Sparkles size={16} className="text-primary mx-auto mb-1" />
                      <p className="text-2xl font-bold text-primary">{available}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Disponíveis</p>
                    </div>
                  </div>

                  {activeAccounts.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-border rounded-lg">
                      <CreditCard size={24} className="mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma conta atribuída ainda.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeAccounts.map((a: any) => {
                        const acc = a.ad_account;
                        if (!acc) return null;
                        const isBlocked = acc.status === 'blocked' || (acc.disable_reason ?? 0) > 0;
                        return (
                          <div key={a.id} className="bg-secondary/40 border border-border rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", isBlocked ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-400")}>
                                {isBlocked ? <Ban size={16} /> : <ShieldCheck size={16} />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">{acc.name}</p>
                                <p className="text-[11px] text-muted-foreground font-mono truncate">ID: {acc.meta_account_id}</p>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
                                  <span>Saldo: <span className="text-foreground/80">{fmt(Number(acc.balance) || 0)}</span></span>
                                  <span>Gasto: <span className="text-foreground/80">{fmt(Number(acc.amount_spent) || 0)}</span></span>
                                  {acc.currency && <span>Moeda: <span className="text-foreground/80">{acc.currency}</span></span>}
                                  {acc.last_synced_at && (
                                    <span>Atualizado: <span className="text-foreground/80">{formatDistanceToNow(new Date(acc.last_synced_at), { addSuffix: true, locale: ptBR })}</span></span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={cn("text-[10px] px-2 py-1 rounded-md border font-medium inline-flex items-center gap-1",
                                isBlocked ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              )}>
                                {isBlocked ? <Ban size={10} /> : <ShieldCheck size={10} />}
                                {isBlocked ? (acc.disable_reason_label || 'Banida') : 'Ativa'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}


            {/* Pages */}
            <div className="bg-card border border-border rounded-xl p-5 border-glow">
              <h3 className="font-display text-sm font-semibold mb-1 flex items-center gap-2">
                <ImageIcon size={16} className="text-primary" /> Suas páginas Meta
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Páginas atribuídas ao seu contrato e status atual.
              </p>
              {pages.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-border rounded-lg">
                  <ImageIcon size={28} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma página atribuída ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pages.map((p: any) => {
                    const restricted = p.is_restricted;
                    const unpublished = p.is_published === false;
                    const statusLabel = restricted ? 'Restrita' : unpublished ? 'Despublicada' : 'Ativa';
                    const statusClass = restricted ? 'text-destructive' : unpublished ? 'text-warning' : 'text-emerald-400';
                    const StatusIcon = restricted || unpublished ? ShieldAlert : ShieldCheck;
                    return (
                      <div key={p.id} className="bg-secondary/40 border border-border rounded-lg p-3 flex gap-3">
                        {p.picture_url ? (
                          <img src={p.picture_url} alt={p.name} className="w-12 h-12 rounded-lg object-cover border border-border shrink-0" loading="lazy" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground shrink-0"><ImageIcon size={20} /></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{p.category || 'Sem categoria'}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                            <span className="flex items-center gap-1 text-primary">
                              <UsersIcon size={11} />
                              {(p.followers_count ?? p.fan_count ?? 0).toLocaleString('en-US')}
                            </span>
                            <span className={cn("flex items-center gap-1", statusClass)}>
                              <StatusIcon size={11} />
                              {statusLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* SUPORTE */}
          <TabsContent value="suporte" className="space-y-5 mt-0">
            <div className="bg-card border border-border rounded-xl p-5 border-glow">
              <h3 className="font-display text-sm font-semibold mb-1 flex items-center gap-2">
                <LifeBuoy size={16} className="text-primary" /> Solicitar serviço
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Peça contas de anúncio ou páginas adicionais. Nossa equipe é notificada automaticamente.
              </p>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {([
                    { v: 'add_ad_account', label: 'Adicionar conta', Icon: CreditCard },
                    { v: 'add_page', label: 'Adicionar página', Icon: ImageIcon },
                    { v: 'other', label: 'Outro', Icon: LifeBuoy },
                  ] as const).map(({ v, label, Icon }) => (
                    <button
                      key={v}
                      onClick={() => setReqType(v)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors",
                        reqType === v
                          ? "bg-primary/15 border-primary/50 text-primary"
                          : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>

                {reqType !== 'other' && (
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Quantidade</label>
                    <input
                      type="number" min={1} max={50}
                      value={reqQty}
                      onChange={e => setReqQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-32 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                )}

                {reqType === 'add_ad_account' && (
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                      <Building2 size={11} /> ID da BM (onde receber as contas) *
                    </label>
                    <input
                      type="text"
                      value={reqBmId}
                      onChange={e => setReqBmId(e.target.value)}
                      placeholder="Ex: 1469807817968606"
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                )}

                {reqType === 'add_page' && reqQty > 0 && (
                  <div className="space-y-2">
                    <label className="block text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <ImageIcon size={11} /> Nomes das páginas ({reqQty}) *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Array.from({ length: reqQty }).map((_, i) => (
                        <input
                          key={i}
                          type="text"
                          value={reqPageNames[i] || ''}
                          onChange={e => setReqPageNames(prev => {
                            const next = [...prev];
                            while (next.length < reqQty) next.push('');
                            next[i] = e.target.value;
                            return next;
                          })}
                          placeholder={`Página ${i + 1}`}
                          className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Observações (opcional)</label>
                  <textarea
                    value={reqDesc}
                    onChange={e => setReqDesc(e.target.value)}
                    placeholder="Detalhes adicionais sobre o pedido..."
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary h-24 resize-none"
                  />
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={submitRequest}
                    disabled={submittingReq || (reqType === 'other' && !reqDesc.trim())}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
                  >
                    <Send size={14} /> {submittingReq ? 'Salvando...' : editingReqId ? 'Salvar alterações' : 'Enviar solicitação'}
                  </button>
                  {editingReqId && (
                    <button onClick={resetReqForm} className="px-4 py-2.5 rounded-xl text-sm font-medium border border-border text-muted-foreground hover:text-foreground">
                      Cancelar edição
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Histórico de solicitações */}
            <div className="bg-card border border-border rounded-xl p-5 border-glow">
              <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
                <Clock size={16} className="text-primary" /> Minhas solicitações
              </h3>
              {supportRequests.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-border rounded-lg">
                  <LifeBuoy size={24} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma solicitação enviada ainda.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {supportRequests.map((r: any) => {
                    const typeLabel = r.request_type === 'add_ad_account' ? 'Adicionar conta' : r.request_type === 'add_page' ? 'Adicionar página' : 'Outro';
                    const statusColor =
                      r.status === 'concluida' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                      r.status === 'em_andamento' ? 'text-warning bg-warning/10 border-warning/30' :
                      r.status === 'cancelada' ? 'text-muted-foreground bg-secondary border-border' :
                      'text-primary bg-primary/10 border-primary/30';
                    const StatusIcon = r.status === 'concluida' ? CheckCircle2 : r.status === 'em_andamento' ? Clock : r.status === 'cancelada' ? X : AlertTriangle;
                    return (
                      <div key={r.id} className="bg-secondary/40 border border-border rounded-lg p-3 flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold">{typeLabel}</p>
                            {r.request_type !== 'other' && (
                              <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">x{r.quantity}</span>
                            )}
                          </div>
                          {r.bm_meta_id && (
                            <p className="text-[11px] text-primary flex items-center gap-1 mt-0.5">
                              <Building2 size={11} /> BM: {r.bm_meta_id}
                            </p>
                          )}
                          {Array.isArray(r.page_names) && r.page_names.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {r.page_names.map((n: string, i: number) => (
                                <span key={i} className="text-[10px] bg-primary/10 text-primary border border-primary/30 px-1.5 py-0.5 rounded">
                                  <ImageIcon size={9} className="inline mr-1" />{n}
                                </span>
                              ))}
                            </div>
                          )}
                          {r.description && <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{r.description}</p>}
                          <p className="text-[10px] text-muted-foreground/70 mt-1">
                            {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={cn("text-[10px] px-2 py-1 rounded-md border font-medium flex items-center gap-1", statusColor)}>
                            <StatusIcon size={11} />
                            {r.status === 'pendente' ? 'Pendente' : r.status === 'em_andamento' ? 'Em andamento' : r.status === 'concluida' ? 'Concluída' : 'Cancelada'}
                          </span>
                          {r.status === 'pendente' && (
                            <div className="flex gap-1">
                              <button onClick={() => startEditRequest(r)} title="Editar" className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-primary hover:border-primary/50">
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => deleteRequest(r.id)} title="Excluir" className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="cobrancas" className="space-y-5 mt-0">
            {/* Saldo principal */}
            <div className={cn(
              "rounded-2xl p-5 border",
              pendingTotal > 0 ? "bg-gradient-to-br from-warning/15 via-card to-card border-warning/40" : "bg-gradient-to-br from-success/10 via-card to-card border-success/30"
            )}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Saldo Pendente</p>
                  <p className={cn("font-display text-3xl font-bold", pendingTotal > 0 ? "text-warning" : "text-success")}>
                    {fmt(Math.max(0, pendingTotal))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {pendingTotal > 0 ? 'Cobrança realizada toda sexta-feira' : 'Tudo em dia! Obrigado.'}
                  </p>
                </div>
                {pendingTotal > 0 && <AlertTriangle size={36} className="text-warning" />}
              </div>
            </div>

            {/* Comissões pendentes por semana (preview antes da validação) */}
            {creditPlan && creditPlan.rows.some(r => r.clientPays > 0) && (
              <div className="bg-card border border-border rounded-xl p-5 border-glow">
                <h3 className="font-display text-sm font-semibold mb-1 flex items-center gap-2">
                  <CalendarIcon size={16} className="text-primary" /> Comissões Pendentes por Semana
                </h3>
                <p className="text-[11px] text-muted-foreground mb-4">
                  Valores calculados a partir do gasto sincronizado da Meta. Prévia antes da validação do pagamento na sexta-feira.
                </p>
                <div className="space-y-2">
                  {creditPlan.rows.filter(r => r.clientPays > 0).map((r, idx) => {
                    const weekEnd = new Date(r.weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 6);
                    const rate = r.spend > 0 ? (r.commission / r.spend) * 100 : 0;
                    return (
                      <div key={idx} className="bg-secondary/40 border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <CalendarIcon size={12} className="text-primary" />
                            <span className="text-xs font-semibold">
                              {format(r.weekStart, "dd/MM", { locale: ptBR })} — {format(weekEnd, "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </div>
                          <span className="text-[10px] uppercase tracking-wider bg-warning/15 text-warning border border-warning/30 px-2 py-0.5 rounded">
                            A pagar: {fmt(r.clientPays)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                          <div className="bg-background/40 rounded p-2">
                            <p className="text-muted-foreground/70 uppercase tracking-wider text-[9px]">Gasto sincronizado</p>
                            <p className="font-bold text-foreground mt-0.5">{fmt(r.spend)}</p>
                          </div>
                          <div className="bg-background/40 rounded p-2">
                            <p className="text-muted-foreground/70 uppercase tracking-wider text-[9px]">Taxa</p>
                            <p className="font-bold text-primary mt-0.5">{rate.toFixed(2)}%</p>
                          </div>
                          <div className="bg-background/40 rounded p-2">
                            <p className="text-muted-foreground/70 uppercase tracking-wider text-[9px]">Comissão calc.</p>
                            <p className="font-bold text-amber-400 mt-0.5">{fmt(r.commission)}</p>
                          </div>
                          <div className="bg-background/40 rounded p-2">
                            <p className="text-muted-foreground/70 uppercase tracking-wider text-[9px]">Crédito aplicado</p>
                            <p className="font-bold text-emerald-400 mt-0.5">−{fmt(r.creditApplied)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total estimado a pagar</span>
                  <span className="font-bold text-warning text-base">
                    {fmt(creditPlan.rows.reduce((s, r) => s + r.clientPays, 0))}
                  </span>
                </div>
              </div>
            )}

            {/* Cobranças semanais pendentes */}
            {pendingBillings.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5 border-glow">
                <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
                  <Receipt size={16} className="text-warning" /> Cobranças Semanais Pendentes
                </h3>
                <div className="space-y-2">
                  {pendingBillings.map((b: any) => (
                    <div key={b.id} className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-xs font-semibold text-warning">{b.note || 'Cobrança Semanal'}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Período: {b.billing_week_start ? formatDateShortBR(b.billing_week_start) : ''} — {b.billing_week_end ? formatDateShortBR(b.billing_week_end) : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-warning">{fmt(Number(b.amount))}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{b.status === 'parcial' ? 'Parcial' : 'Pendente'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Opções de pagamento */}
            {pendingTotal > 0 && (
              <div className="bg-card border border-border rounded-xl p-5 border-glow">
                <h3 className="font-display text-sm font-semibold mb-2 flex items-center gap-2">
                  <DollarSign size={16} className="text-primary" /> Opções de Pagamento
                </h3>
                <p className="text-xs text-muted-foreground mb-4">Escolha a forma de pagamento e você será redirecionado para o WhatsApp:</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <a href={`https://wa.me/553198416336?text=${encodeURIComponent(paymentMsg('PIX'))}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/20 transition-all group">
                    <Smartphone size={24} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-semibold text-emerald-500">PIX</span>
                    <span className="text-[10px] text-muted-foreground text-center">Transferência instantânea</span>
                  </a>
                  <a href={`https://wa.me/553198416336?text=${encodeURIComponent(paymentMsg('Payoneer'))}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-sky-500/10 border border-sky-500/30 hover:border-sky-500/60 hover:bg-sky-500/20 transition-all group">
                    <Globe size={24} className="text-sky-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-semibold text-sky-500">PAYONEER</span>
                    <span className="text-[10px] text-muted-foreground text-center">Internacional</span>
                  </a>
                  <a href={`https://wa.me/553198416336?text=${encodeURIComponent(paymentMsg('Crypto'))}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/20 transition-all group">
                    <Bitcoin size={24} className="text-amber-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-semibold text-amber-500">CRYPTO</span>
                    <span className="text-[10px] text-muted-foreground text-center">Criptomoedas</span>
                  </a>
                </div>
              </div>
            )}

            {/* Histórico */}
            {commissions.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5 border-glow">
                <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
                  <DollarSign size={16} className="text-primary" /> Histórico de Lançamentos
                </h3>
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {commissions.map((comm: any) => (
                    <div key={comm.id} className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2 text-xs",
                      comm.type === 'weekly_billing' ? 'bg-warning/10 border border-warning/20' : 'bg-secondary'
                    )}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`w-2 h-2 rounded-full ${comm.type === 'daily' ? 'bg-primary' : comm.type === 'paid' ? 'bg-success' : 'bg-warning'}`} />
                        <span className="text-muted-foreground">{formatDateBR(comm.date)}</span>
                        <span className="text-muted-foreground">
                          {comm.type === 'daily' ? 'Comissão' : comm.type === 'paid' ? 'Pagamento' : '📋 Cobrança'}
                        </span>
                        {comm.type === 'daily' && Number(comm.ad_spend || 0) > 0 && (
                          <span className="text-muted-foreground">(Ads: {fmt(Number(comm.ad_spend))})</span>
                        )}
                        {comm.note && <span className="text-muted-foreground italic">- {comm.note}</span>}
                      </div>
                      <span className={`font-semibold ${comm.type === 'daily' ? 'text-primary' : comm.type === 'paid' ? 'text-success' : 'text-warning'}`}>
                        {comm.type === 'paid' ? '-' : '+'}{fmt(Number(comm.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ClientDashboard;
