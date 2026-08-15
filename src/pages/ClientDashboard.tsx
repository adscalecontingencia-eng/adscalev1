import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { LogOut, CreditCard, AlertTriangle, Shield, DollarSign, CalendarIcon, TrendingUp, Smartphone, Globe, Bitcoin, ShieldCheck, Sparkles, Ban, LayoutDashboard, FileText, Receipt, ImageIcon, Users as UsersIcon, LifeBuoy, Plus, CheckCircle2, Clock, Layers, ShieldAlert, Send, X, RefreshCw, Info, Pencil, Trash2, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay, formatDistanceToNow } from 'date-fns';
import { ptBR, enUS, es as esLocale } from 'date-fns/locale';
import { parseDateLocal, formatDateBR, formatDateShortBR } from '@/lib/date-utils';
import { supabase } from '@/integrations/supabase/client';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import AdScaleLogo from '@/components/AdScaleLogo';
import { useCommissionTiers, getTierPctFromTiers } from '@/lib/commission-tiers';
import { getBillingDueDate, getLastClosedBillingWeekRange, splitOverdueVsCurrent } from '@/lib/billing-status';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ClientNotificationCenter from '@/components/client/ClientNotificationCenter';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import LoyaltyTierCard from '@/components/clients/LoyaltyTierCard';
import { computeLoyaltyProgress, LOYALTY_TIERS } from '@/lib/loyalty-tiers';
import PartnerBannersStrip from '@/components/PartnerBannersStrip';

const ClientDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { clientId: viewAsClientId } = useParams<{ clientId?: string }>();
  const isAdminView = !!viewAsClientId && (user?.role === 'admin' || user?.role === 'support');
  const [client, setClient] = useState<any>(null);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [savedAccounts, setSavedAccounts] = useState<any[]>([]);
  const [activeAccounts, setActiveAccounts] = useState<any[]>([]);
  // Contas atribuídas que perderam acesso / foram arquivadas: saem de "ativas"
  // e passam a contar no bloco de contas economizadas.
  const [archivedAccounts, setArchivedAccounts] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [customStart, setCustomStart] = useState<Date>(new Date());
  const [customEnd, setCustomEnd] = useState<Date>(new Date());
  const [tab, setTab] = useState<'resumo' | 'contrato' | 'cobrancas' | 'estrutura' | 'suporte'>('resumo');
  // Paginação do histórico semanal (Plano de Crédito). 8 semanas por página.
  const [historyPage, setHistoryPage] = useState(0);
  const [historyFilter, setHistoryFilter] = useState<'recent' | 'all' | 'paying' | 'covered'>('recent');
  const [pages, setPages] = useState<any[]>([]);
  const [supportRequests, setSupportRequests] = useState<any[]>([]);
  const [reqType, setReqType] = useState<'add_ad_account' | 'add_page' | 'add_bm'>('add_ad_account');
  const [reqQty, setReqQty] = useState<number>(1);
  const [reqDesc, setReqDesc] = useState<string>('');
  const [reqBmId, setReqBmId] = useState<string>('');
  const [reqPageNames, setReqPageNames] = useState<string[]>([]);
  const [submittingReq, setSubmittingReq] = useState(false);
  const [editingReqId, setEditingReqId] = useState<string | null>(null);
  const [adAccountRequestLimit, setAdAccountRequestLimit] = useState<number>(5);
  const [adAccountRequestNotice, setAdAccountRequestNotice] = useState<string>('');
  const dateLocale = i18n.language?.startsWith('en') ? enUS : i18n.language?.startsWith('es') ? esLocale : ptBR;
  const numberLocale = i18n.language?.startsWith('en') ? 'en-US' : i18n.language?.startsWith('es') ? 'es-ES' : 'pt-BR';

  const [lastAccountsSync, setLastAccountsSync] = useState<Date | null>(null);
  const [refreshingAccounts, setRefreshingAccounts] = useState(false);
  const [overdueDialogOpen, setOverdueDialogOpen] = useState(false);
  const overdueDialogShownRef = useRef(false);
  const clientIdRef = useRef<string | null>(null);
  // Período global da aba Estrutura (aplica-se a todas as contas)
  const [estruturaPeriod, setEstruturaPeriod] = useState<'today' | 'billing_week' | '7d' | '30d' | 'all' | 'custom'>('billing_week');
  const [estruturaCustomStart, setEstruturaCustomStart] = useState<Date>(new Date(Date.now() - 6 * 86400000));
  const [estruturaCustomEnd, setEstruturaCustomEnd] = useState<Date>(new Date());

  const fmtISO = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const withTimeout = async <T,>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} demorou demais para responder`)), ms);
    });
    try {
      return await Promise.race([Promise.resolve(promise), timeout]);
    } finally {
      clearTimeout(timer!);
    }
  };

  const syncClosedBillingWeek = async (accountIds?: string[]) => {
    const range = getLastClosedBillingWeekRange(new Date());
    try {
      await withTimeout(supabase.functions.invoke('meta-sync', {
        body: {
          action: 'sync_insights',
          since: fmtISO(range.start),
          until: fmtISO(new Date()),
          ...(accountIds && accountIds.length > 0 ? { account_ids: accountIds, skip_refresh: true } : {}),
        },
      }), 45000, 'Sync Meta');
    } catch (e) {
      console.warn('[ClientDashboard] sync da semana fechada falhou:', e);
    }
  };

  const fetchAccounts = useCallback(async (clientId: string) => {
    const { data: assigns } = await withTimeout<{ data: any[] | null }>(supabase
      .from('meta_ad_account_assignments')
      .select('*, ad_account:meta_ad_accounts(*)')
      .eq('client_id', clientId) as any, 10000, 'Contas de anúncio');
    const assignments = assigns || [];
    const assigned = assignments.filter((a: any) => a.active);
    // Arquivada (archived_at) = perdeu acesso / foi retirada. Não conta como ativa.
    const list = assigned.filter((a: any) => !a.ad_account?.archived_at);
    const archived = assigned.filter((a: any) => !!a.ad_account?.archived_at);
    setActiveAccounts(list);
    setArchivedAccounts(archived);
    const latest = assignments
      .map((a: any) => a.ad_account?.last_synced_at)
      .filter(Boolean)
      .sort()
      .pop();
    if (latest) setLastAccountsSync(new Date(latest));

    // Load insights for these ad accounts.
    // CRÍTICO: filtra por vigência (effective_from / effective_to) para nunca
    // contar gasto anterior à atribuição da conta a este cliente.
    const assignmentsForInsights = assignments.filter((a: any) => a.ad_account?.id);
    if (assignmentsForInsights.length > 0) {
      const accountIds = Array.from(new Set(assignmentsForInsights.map((a: any) => String(a.ad_account.id)))) as string[];
      const { data: allAccountAssignments } = await withTimeout<{ data: any[] | null }>(supabase
        .from('meta_ad_account_assignments')
        .select('ad_account_id, client_id, active, effective_from, effective_to, assigned_at')
        .in('ad_account_id', accountIds) as any, 10000, 'Atribuições de contas');
      type AssignmentWindow = { client_id: string; active: boolean; from: string | null; to: string | null; assigned_at: string | null };
      const windowsByAccount = new Map<string, AssignmentWindow[]>();
      (allAccountAssignments || []).forEach((a: any) => {
        const list = windowsByAccount.get(a.ad_account_id) || [];
        list.push({
          client_id: a.client_id,
          active: !!a.active,
          from: a.effective_from || null,
          to: a.effective_to || null,
          assigned_at: a.assigned_at || null,
        });
        windowsByAccount.set(a.ad_account_id, list);
      });
      const belongsToClientOnDate = (adAccountId: string, dateISO: string) => {
        const picked = (windowsByAccount.get(adAccountId) || [])
          .filter(a => (!a.from || dateISO >= a.from) && (!a.to || dateISO <= a.to))
          .sort((a, b) => {
            if (a.active !== b.active) return a.active ? -1 : 1;
            const fromCmp = String(b.from || '').localeCompare(String(a.from || ''));
            if (fromCmp !== 0) return fromCmp;
            return String(b.assigned_at || '').localeCompare(String(a.assigned_at || ''));
          })[0];
        return picked?.client_id === clientId;
      };
      const fallback = new Date();
      fallback.setMonth(fallback.getMonth() - 12);
      const fallbackStr = fallback.toISOString().split('T')[0];
      const earliestFrom = assignmentsForInsights
        .map((a: any) => a.effective_from)
        .filter(Boolean)
        .sort()[0] as string | undefined;
      const globalSince = earliestFrom && earliestFrom > fallbackStr ? earliestFrom : fallbackStr;

      // Busca única (paginada) de todos os insights das contas do cliente.
      // Antes era 1 request por conta — em clientes com muitas contas isso
      // deixava o dashboard extremamente lento.
      const PAGE = 1000;
      const fetchedRows: any[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await withTimeout<{ data: any[] | null; error: any }>(supabase
          .from('meta_ad_insights')
          .select('ad_account_id, date, spend, impressions, clicks, cpm, cpc, ctr, reach, purchases, revenue')
          .in('ad_account_id', accountIds)
          .gte('date', globalSince)
          .order('date', { ascending: false })
          .range(from, from + PAGE - 1) as any, 15000, 'Insights de anúncio');
        if (error) throw error;
        const rows = data || [];
        fetchedRows.push(...rows);
        if (rows.length < PAGE || fetchedRows.length >= 20000) break;
      }

      // Janela de vigência por conta (effective_from / effective_to da atribuição deste cliente)
      const windowByAccount = new Map<string, { from: string | null; to: string | null }>();
      assignmentsForInsights.forEach((a: any) => {
        windowByAccount.set(String(a.ad_account.id), {
          from: a.effective_from || null,
          to: a.effective_to || null,
        });
      });

      const seen = new Set<string>();
      setInsights(fetchedRows.filter((row: any) => {
        const dateISO = String(row.date).slice(0, 10);
        const w = windowByAccount.get(String(row.ad_account_id));
        if (!w) return false;
        if (w.from && dateISO < w.from) return false;
        if (w.to && dateISO > w.to) return false;
        if (!belongsToClientOnDate(row.ad_account_id, dateISO)) return false;
        const key = `${row.ad_account_id}|${dateISO}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }));
      return accountIds;

    } else {
      setInsights([]);
      return [];
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const t0 = performance.now();
      const ctx = {
        isAdminView,
        viewAsClientId: viewAsClientId || null,
        userId: user?.id || null,
        userEmail: user?.email || null,
        userRole: user?.role || null,
        ts: new Date().toISOString(),
      };

      // Aguarda o AuthContext resolver antes de tentar buscar
      if (!isAdminView && !user?.email) {
        if (user === null) {
          // Sessão resolvida porém sem usuário logado — registramos para diagnóstico
          console.warn('[ClientDashboard][telemetry] sem user.email após resolução do AuthContext', ctx);
          setLoading(false);
        } else {
          // Auth ainda carregando — apenas log de debug, sem ruído de erro
          console.debug('[ClientDashboard][telemetry] aguardando user.email do AuthContext', ctx);
        }
        return;
      }

      setLoading(true);
      try {
        let clientQuery = supabase.from('clients').select('*');
        if (isAdminView) {
          clientQuery = clientQuery.eq('id', viewAsClientId!);
        } else {
          clientQuery = clientQuery.eq('email', user!.email);
        }
        const { data: clientData, error: clientErr } = await clientQuery.maybeSingle();
        if (clientErr) {
          console.error('[ClientDashboard][telemetry] erro ao buscar cliente', {
            ...ctx,
            error: { code: (clientErr as any).code, message: clientErr.message, details: (clientErr as any).details },
            elapsed_ms: Math.round(performance.now() - t0),
          });
        }
        if (clientData) {
          setClient(clientData);
          clientIdRef.current = clientData.id;
          const [commRes, blockedRes, pagesRes, reqsRes] = await Promise.all([
            supabase.from('commissions').select('*').eq('client_id', clientData.id).order('date', { ascending: false }),
            supabase.from('meta_blocked_accounts_log').select('*, ad_account:meta_ad_accounts(name, meta_account_id)').eq('client_id', clientData.id).order('detected_at', { ascending: false }),
            supabase.from('meta_page_assignments').select('*, page:meta_pages(*)').eq('client_id', clientData.id).eq('active', true),
            supabase.from('support_requests').select('*').eq('client_id', clientData.id).order('created_at', { ascending: false }),
          ]);
          // Telemetria por sub-consulta para facilitar diagnóstico
          const subErrors: Record<string, any> = {};
          if (commRes.error) subErrors.commissions = commRes.error.message;
          if (blockedRes.error) subErrors.blocked = blockedRes.error.message;
          if (pagesRes.error) subErrors.pages = pagesRes.error.message;
          if (reqsRes.error) subErrors.requests = reqsRes.error.message;
          if (Object.keys(subErrors).length > 0) {
            console.warn('[ClientDashboard][telemetry] falhas em sub-consultas', { ...ctx, clientId: clientData.id, subErrors });
          }
          const accountIds = await fetchAccounts(clientData.id);
          setCommissions(commRes.data || []);
          setSavedAccounts(blockedRes.data || []);
          setPages((pagesRes.data || []).map((a: any) => a.page).filter(Boolean));
          setSupportRequests(reqsRes.data || []);
          console.debug('[ClientDashboard][telemetry] dados carregados', {
            ...ctx,
            clientId: clientData.id,
            commissions: commRes.data?.length || 0,
            blocked: blockedRes.data?.length || 0,
            pages: pagesRes.data?.length || 0,
            requests: reqsRes.data?.length || 0,
            elapsed_ms: Math.round(performance.now() - t0),
          });
          syncClosedBillingWeek(accountIds)
            .then(() => fetchAccounts(clientData.id))
            .catch((e) => console.warn('[ClientDashboard] atualização em background falhou:', e));
        } else if (!clientErr) {
          // Sem registro de cliente para este e-mail/ID — situação importante de rastrear
          console.warn('[ClientDashboard][telemetry] cliente não encontrado', {
            ...ctx,
            lookup: isAdminView ? { by: 'id', value: viewAsClientId } : { by: 'email', value: user?.email },
            elapsed_ms: Math.round(performance.now() - t0),
          });
        }
      } catch (e: any) {
        console.error('[ClientDashboard][telemetry] erro inesperado', {
          ...ctx,
          error: { message: e?.message, stack: e?.stack },
          elapsed_ms: Math.round(performance.now() - t0),
        });
      } finally {
        setLoading(false);
      }
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
    const accountIds = activeAccounts.map((a: any) => a.ad_account?.id).filter(Boolean);
    await syncClosedBillingWeek(accountIds);
    await fetchAccounts(client.id);
    setRefreshingAccounts(false);
    toast.success(t('clientDash.messages.accountsUpdated'));
  };


  const resetReqForm = () => {
    setReqDesc(''); setReqQty(1); setReqBmId(''); setReqPageNames([]); setEditingReqId(null);
  };

  const supportRequestTypeLabel = (type: string) =>
    type === 'add_ad_account' ? t('clientDash.support.addAccount') :
    type === 'add_page' ? t('clientDash.support.addPage') :
    type === 'add_bm' ? t('clientDash.support.addBm') :
    t('clientDash.support.other');

  // Carrega configurações públicas de pedidos (limite + aviso)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('support_settings')
        .select('key, value')
        .in('key', ['ad_account_request_limit', 'ad_account_request_notice']);
      if (!data) return;
      for (const row of data) {
        if (row.key === 'ad_account_request_limit') {
          const n = typeof row.value === 'number' ? row.value : Number(row.value);
          if (Number.isFinite(n) && n > 0) setAdAccountRequestLimit(Math.floor(n));
        } else if (row.key === 'ad_account_request_notice') {
          setAdAccountRequestNotice(typeof row.value === 'string' ? row.value : String(row.value ?? ''));
        }
      }
    })();
  }, []);

  // Se o tipo é "adicionar conta", garante que a quantidade respeita o limite
  useEffect(() => {
    if (reqType === 'add_ad_account' && reqQty > adAccountRequestLimit) {
      setReqQty(adAccountRequestLimit);
    }
  }, [reqType, adAccountRequestLimit, reqQty]);

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
    if (!isAdminView && !/emerson/i.test(client?.name || '') && billingSplit.overdue > 25) {
      toast.error(t('clientDash.messages.paymentPending', { amount: billingSplit.overdue.toFixed(2) }));
      return;
    }
    if (!client) return;
    // Bloqueia abrir novo ticket da MESMA categoria se já houver um em aberto
    if (!editingReqId) {
      const openSame = supportRequests.find((r: any) =>
        r.request_type === reqType && (r.status === 'pendente' || r.status === 'em_andamento')
      );
      if (openSame) {
        toast.error(t('clientDash.messages.duplicateRequest', { label: supportRequestTypeLabel(reqType) }));
        return;
      }
    }
    if (reqType === 'add_ad_account' && !reqBmId.trim()) {
      toast.error(t('clientDash.messages.bmRequired'));
      return;
    }
    if (reqType === 'add_ad_account' && reqQty > adAccountRequestLimit) {
      toast.error(t('clientDash.messages.limitExceeded', { limit: adAccountRequestLimit }));
      return;
    }
    if (reqType === 'add_page') {
      const names = reqPageNames.slice(0, reqQty).map(n => (n || '').trim());
      if (names.some(n => !n)) {
        toast.error(t('clientDash.messages.pageNamesRequired', { count: reqQty }));
        return;
      }
    }
    setSubmittingReq(true);
    const payload: any = {
      client_id: client.id,
      request_type: reqType,
      quantity: reqType === 'add_bm' ? 1 : reqQty,
      description: reqDesc || null,
      bm_meta_id: reqType === 'add_ad_account' ? reqBmId.trim() : null,
      page_names: reqType === 'add_page' ? reqPageNames.slice(0, reqQty).map(n => n.trim()) : null,
    };
    if (editingReqId) {
      const { data, error } = await supabase.from('support_requests')
        .update(payload).eq('id', editingReqId).select().single();
      setSubmittingReq(false);
      if (error) { toast.error(t('clientDash.messages.updateError', { message: error.message })); return; }
      setSupportRequests(prev => prev.map(r => r.id === editingReqId ? data : r));
      resetReqForm();
      toast.success(t('clientDash.messages.requestUpdated'));
      return;
    }
    const { data, error } = await supabase.from('support_requests').insert(payload).select().single();
    setSubmittingReq(false);
    if (error) { toast.error(t('clientDash.messages.sendError', { message: error.message })); return; }
    setSupportRequests(prev => [data, ...prev]);
    resetReqForm();
    toast.success(t('clientDash.messages.requestSent'));
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
    if (!confirm(t('clientDash.messages.confirmDelete'))) return;
    const { error } = await supabase.from('support_requests').delete().eq('id', id);
    if (error) { toast.error(t('clientDash.messages.deleteError', { message: error.message })); return; }
    setSupportRequests(prev => prev.filter(r => r.id !== id));
    if (editingReqId === id) resetReqForm();
    toast.success(t('clientDash.messages.requestDeleted'));
  };

  const fmt = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const getFilterRange = () => {
    const now = new Date();
    switch (periodFilter) {
      case 'today': return { start: startOfDay(now), end: endOfDay(now) };
      case 'week': return getLastClosedBillingWeekRange(now);
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

  // Tier logic — tiers come from DB (admin-configurable globally).
  // Se o cliente tiver `custom_tiers` definidos, esses sobrescrevem os globais.
  const { tiers: globalCommissionTiers } = useCommissionTiers();
  const commissionTiers = useMemo(() => {
    const ct = (client as any)?.custom_tiers;
    if (Array.isArray(ct) && ct.length > 0) {
      return ct
        .filter((t: any) => Number.isFinite(Number(t?.min_spend)) && Number.isFinite(Number(t?.pct)))
        .map((t: any) => ({ min_spend: Number(t.min_spend), pct: Number(t.pct) }));
    }
    return globalCommissionTiers;
  }, [client, globalCommissionTiers]);
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
      const ws = startOfWeek(d, { weekStartsOn: 5 });
      const key = format(ws, 'yyyy-MM-dd');
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

  const paidCommissionRows = useMemo(
    () => commissions
      .filter(c => c.type === 'paid')
      .map(c => ({ date: c.date, amount: Number(c.amount || 0) })),
    [commissions]
  );

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
      const ws = startOfWeek(d, { weekStartsOn: 5 });
      const key = format(ws, 'yyyy-MM-dd');
      byWeek[key] = (byWeek[key] || 0) + Number(i.spend || 0);
    });
    return Object.entries(byWeek)
      .map(([k, spend]) => {
        const rate = getTierPct(spend, basePct);
        return { weekStart: parseDateLocal(k), spend, commission: spend * (rate / 100) };
      })
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  }, [insights, client, commissionTiers]);

  // Credit ledger: REAL week-by-week history. Aplica plan_credit FIFO a partir
  // da semana em que o crédito foi adicionado (plan_credit_start_date) — NUNCA
  // retroativo a semanas anteriores. O crédito é aplicado uma única vez e
  // consumido conforme as semanas com gasto vão acontecendo.
  const creditPlan = useMemo(() => {
    const credit = Number(client?.plan_credit || 0);
    if (!client || client.client_type === 'venda') return null;
    if (weeklyCommissionHistory.length === 0) return null;

    // Crédito disponível abate qualquer semana com dívida (inclusive vencidas)
    // antes de exibir como atrasado. Ignoramos plan_credit_start_date aqui
    // para manter coerência com `splitOverdueVsCurrent`.
    const startDateStr: string | null = (client as any)?.plan_credit_start_date || null;
    const startTs = 0;

    let remaining = credit;
    const paymentPool = paidCommissionRows
      .map(p => ({
        ts: parseDateLocal(String(p.date)).getTime(),
        remaining: Math.max(0, Number(p.amount || 0)),
      }))
      .filter(p => p.remaining > 0)
      .sort((a, b) => a.ts - b.ts);

    const rows = weeklyCommissionHistory.map(w => {
      const eligible = w.commission > 0 && w.weekStart.getTime() >= startTs;
      const applied = eligible ? Math.min(remaining, w.commission) : 0;
      const afterCredit = Math.max(0, w.commission - applied);
      remaining = Math.max(0, remaining - applied);

      const dueTs = getBillingDueDate(w.weekStart).getTime();
      let paidApplied = 0;
      let oweAfterPayment = afterCredit;
      for (const payment of paymentPool) {
        if (oweAfterPayment <= 0.0001) break;
        if (payment.ts < dueTs || payment.remaining <= 0) continue;
        const pay = Math.min(payment.remaining, oweAfterPayment);
        payment.remaining -= pay;
        paidApplied += pay;
        oweAfterPayment -= pay;
      }
      const stillOwed = Math.max(0, afterCredit - paidApplied);

      return {
        weekStart: w.weekStart,
        spend: w.spend,
        commission: w.commission,
        creditApplied: applied,
        // `clientPays` = bruto após crédito (antes de pagamentos). Mantido para
        // compat de leitura/UX em "Plano de Crédito". Quem reflete o devido real
        // é `stillOwed`.
        clientPays: afterCredit,
        paidApplied,
        stillOwed,
        remainingAfter: remaining,
      };
    });

    const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
    const totalApplied = rows.reduce((s, r) => s + r.creditApplied, 0);
    const totalStillOwed = rows.reduce((s, r) => s + r.stillOwed, 0);
    const totalPaidApplied = rows.reduce((s, r) => s + r.paidApplied, 0);

    return {
      totalCredit: credit,
      remaining,
      totalCommission,
      totalApplied,
      totalStillOwed,
      totalPaidApplied,
      startDate: startDateStr,
      rows,
    };
  }, [client, weeklyCommissionHistory, paidCommissionRows]);


  const pendingBillings = useMemo(
    () => commissions.filter(c => c.type === 'weekly_billing' && (c as any).status !== 'pago'),
    [commissions]
  );

  // Split entre saldo da semana corrente (pendente) e saldo já vencido (atrasado)
  const billingSplit = useMemo(
    () => splitOverdueVsCurrent(
      weeklyCommissionHistory,
      Number(client?.plan_credit || 0),
      allTimeTotals.paid,
      new Date(),
      (client as any)?.plan_credit_start_date || null,
      paidCommissionRows,
    ),
    [weeklyCommissionHistory, client, allTimeTotals.paid, paidCommissionRows]
  );

  // Pop-up automático quando há saldo atrasado (apenas 1x por sessão)
  useEffect(() => {
    if (loading || isAdminView) return;
    if (billingSplit.overdue > 0 && !overdueDialogShownRef.current) {
      overdueDialogShownRef.current = true;
      setOverdueDialogOpen(true);
    }
  }, [loading, isAdminView, billingSplit.overdue]);

  // Loyalty tier: calcula progressão pela comissão paga acumulada
  const loyalty = useMemo(
    () => computeLoyaltyProgress(allTimeTotals.paid, client?.percentage_value),
    [allTimeTotals.paid, client?.percentage_value],
  );

  // Auto-ajuste do percentual base ao cruzar meta (apenas rental)
  const loyaltyAdjustedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!client || client.client_type !== 'aluguel') return;
    const currentPct = Number(client.percentage_value) || 0;
    const targetPct = loyalty.current.basePct;
    // Só reduz — nunca aumenta um pct que admin possa ter definido manualmente
    if (currentPct <= targetPct) return;
    const key = `${client.id}:${targetPct}`;
    if (loyaltyAdjustedRef.current === key) return;
    loyaltyAdjustedRef.current = key;
    (async () => {
      const { error } = await supabase
        .from('clients')
        .update({ percentage_value: targetPct })
        .eq('id', client.id);
      if (!error) {
        setClient((c: any) => c ? { ...c, percentage_value: targetPct } : c);
        toast.success(t('clientDash.messages.levelUnlocked', { level: loyalty.current.label, pct: targetPct }), { duration: 8000 });
      }
    })();
  }, [client, loyalty.current.basePct, loyalty.current.label]);

  // Pop-up de boas-vindas / incentivo (1x por sessão por cliente)
  const [loyaltyDialogOpen, setLoyaltyDialogOpen] = useState(false);
  const loyaltyDialogShownRef = useRef(false);
  useEffect(() => {
    if (loading || isAdminView || !client) return;
    if (client.client_type !== 'aluguel') return;
    if (loyaltyDialogShownRef.current) return;
    const storageKey = `loyalty-popup:${client.id}:${loyalty.current.id}:${loyalty.nearNext ? 'near' : 'idle'}`;
    if (sessionStorage.getItem(storageKey)) return;
    // Mostra se: acabou de subir de tier (não-standard) OU está perto do próximo
    if (loyalty.current.id !== 'standard' || loyalty.nearNext) {
      loyaltyDialogShownRef.current = true;
      sessionStorage.setItem(storageKey, '1');
      setTimeout(() => setLoyaltyDialogOpen(true), 600);
    }
  }, [loading, isAdminView, client, loyalty.current.id, loyalty.nearNext]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground text-sm">{t('common.loading')}</p></div>;


  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">{t('clientDash.messages.clientNotFound')}</p>
      </div>
    );
  }

  const originalCredit = Number(client?.plan_credit || 0);
  const creditUsed = creditPlan?.totalApplied || 0;
  const availableCredit = creditPlan ? creditPlan.remaining : originalCredit;
  const pendingTotal = creditPlan?.totalStillOwed ?? Math.max(0, allTimeTotals.commission - allTimeTotals.paid - creditUsed);
  const overdueTotal = billingSplit.overdue;
  const currentPendingTotal = billingSplit.currentPending;
  // Allowlist de clientes liberados para abrir suporte mesmo com saldo atrasado.
  const supportOverdueBypass = /emerson/i.test(client?.name || '');
  const supportBlockedByOverdue = !supportOverdueBypass && overdueTotal > 25;

  const cobrancasCount = pendingBillings.length + (pendingTotal > 0 ? 1 : 0);

  const paymentMsg = (method: string) =>
    t('clientDash.whatsapp.payment', { name: client.name, amount: fmt(pendingTotal), method });

  const overdueMsg = (method: string) =>
    t('clientDash.whatsapp.overdue', { name: client.name, amount: fmt(overdueTotal), method });


  return (
    <div className="min-h-screen bg-background">
      {isAdminView && (
        <div className="sticky top-0 z-50 bg-primary text-primary-foreground border-b border-primary/60 px-4 lg:px-8 py-2.5 flex items-center justify-between text-xs shadow-lg">
          <div className="flex items-center gap-2">
            <Shield size={14} />
            <span className="font-semibold uppercase tracking-wider">{t('clientDash.adminView.mode')}</span>
            <span className="opacity-90 hidden sm:inline">— {t('clientDash.adminView.viewingAs', { name: client.name })}</span>
          </div>
          <button onClick={() => navigate('/clients')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background/20 hover:bg-background/30 text-primary-foreground font-medium border border-background/30">
            <X size={13} /> {t('clientDash.adminView.exit')}
          </button>
        </div>
      )}
      <header className="border-b border-border px-4 lg:px-8 py-4 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur z-20">
        <div className="flex items-center gap-3 text-primary">
          <AdScaleLogo size={28} />
          <p className="text-xs text-muted-foreground hidden sm:block border-l border-border pl-3">{t('clientDash.header')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-foreground">{client.name}</p>
            <p className="text-[10px] text-muted-foreground">{client.email}</p>
          </div>
          <LanguageSwitcher />
          <ThemeToggle />
          {!isAdminView && user?.id && (
            <ClientNotificationCenter
              clientId={client.id}
              authUserId={user.id}
              ads={activeAccounts}
              pages={pages}
            />
          )}
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


      <div className="p-4 lg:p-8 max-w-[1400px] mx-auto space-y-6">
        <PartnerBannersStrip placement="client_dashboard" />
        {/* Hero + Loyalty — side-by-side no desktop */}
        <div className={cn(
          'grid gap-5 mb-5',
          client.client_type === 'aluguel' ? 'lg:grid-cols-12' : 'grid-cols-1'
        )}>
          <div className={cn(
            'relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6 flex flex-col justify-between',
            client.client_type === 'aluguel' ? 'lg:col-span-4' : ''
          )}>
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/15 blur-[60px] pointer-events-none" />
            <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-primary/10 blur-[80px] pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-primary/80 mb-3">
                <Sparkles size={11} /> {t('clientDash.welcome')}, {client.name?.split(' ')[0]}
              </div>
              <h2 className="font-display text-2xl lg:text-3xl font-bold text-foreground mb-2 leading-tight">
                {t('clientDash.heroTitle1')} <span className="text-primary glow-text">{t('clientDash.heroTitle2')}</span>
              </h2>
              <p className="text-xs text-muted-foreground max-w-md">
                {t('clientDash.heroDesc')}
              </p>
            </div>
            <div className="relative mt-6 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2.5 py-1">
                <ShieldCheck size={11} /> {t('clientDash.tagProtected')}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary bg-primary/10 border border-primary/30 rounded-full px-2.5 py-1">
                <Sparkles size={11} /> {t('clientDash.tagAutoSync')}
              </span>
            </div>
          </div>

          {client.client_type === 'aluguel' && (
            <div className="lg:col-span-8">
              <LoyaltyTierCard progress={loyalty} className="h-full" />
            </div>
          )}
        </div>



        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-5">
          <TabsList className="w-full grid grid-cols-3 sm:grid-cols-5 h-auto p-1 bg-secondary/60 border border-border">
            <TabsTrigger value="resumo" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 gap-2 text-xs sm:text-sm">
              <LayoutDashboard size={14} /> {t('clientDash.tabs.overview')}
            </TabsTrigger>
            <TabsTrigger value="contrato" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 gap-2 text-xs sm:text-sm">
              <FileText size={14} /> {t('clientDash.tabs.contract')}
            </TabsTrigger>
            <TabsTrigger value="estrutura" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 gap-2 text-xs sm:text-sm">
              <Layers size={14} /> {t('clientDash.tabs.structure')}
              {(activeAccounts.length + pages.length) > 0 && (
                <span className="ml-1 bg-primary/20 text-primary text-[10px] font-bold rounded-full px-1.5 py-0.5">{activeAccounts.length + pages.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="suporte" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 gap-2 text-xs sm:text-sm relative">
              <LifeBuoy size={14} /> {t('clientDash.tabs.support')}
              {supportRequests.filter(r => r.status === 'pendente' || r.status === 'em_andamento').length > 0 && (
                <span className="absolute -top-1 -right-1 sm:static sm:ml-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {supportRequests.filter(r => r.status === 'pendente' || r.status === 'em_andamento').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="cobrancas" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 gap-2 text-xs sm:text-sm relative">
              <Receipt size={14} /> {t('clientDash.tabs.billing')}
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
                const blockedIds = new Set<string>([
                  ...(savedAccounts || [])
                    .filter((s: any) => !s.event_type || /block|bloq|disable|ban/i.test(s.event_type))
                    .map((s: any) => String(s.ad_account_id)),
                  // contas arquivadas (sem acesso) também entram como economizadas
                  ...archivedAccounts.map((a: any) => String(a.ad_account?.id)).filter(Boolean),
                ]);
                const currentlyBlocked = activeAccounts.filter((a: any) => a.ad_account?.status === 'blocked' || (a.ad_account?.disable_reason ?? 0) > 0).length;
                const savedTotal = Math.max(blockedIds.size, currentlyBlocked);
                return (
                  <div className="rounded-xl bg-primary/10 border border-primary/30 p-4">
                    <ShieldCheck size={18} className="text-primary" />
                    <div className="text-2xl font-bold text-primary mt-2">{savedTotal}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-0.5">{t('clientDash.kpi.savedAccounts')}</div>
                    <div className="text-[10px] text-muted-foreground/60 mt-1">{t('clientDash.kpi.savedAccountsDesc')}</div>
                  </div>
                );
              })()}
              <div className="rounded-xl bg-card border border-border p-4">
                <Shield size={18} className="text-emerald-400" />
                <div className="text-2xl font-bold text-emerald-400 mt-2">{activeAccounts.filter((a: any) => !(a.ad_account?.status === 'blocked' || (a.ad_account?.disable_reason ?? 0) > 0)).length}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-0.5">{t('clientDash.kpi.activeAccounts')}</div>
                <div className="text-[10px] text-muted-foreground/60 mt-1">{t('clientDash.kpi.activeAccountsDesc')}</div>
              </div>
              <div className="rounded-xl bg-card border border-border p-4">
                <TrendingUp size={18} className="text-sky-400" />
                <div className="text-2xl font-bold text-sky-400 mt-2">{fmt(periodTotals.adSpend)}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-0.5">{t('clientDash.kpi.adSpend')}</div>
                <div className="text-[10px] text-muted-foreground/60 mt-1">{periodFilter === 'today' ? t('clientDash.periods.today') : periodFilter === 'week' ? t('clientDash.periods.closedWeek') : periodFilter === 'month' ? t('clientDash.periods.thisMonth') : t('clientDash.periods.custom')}</div>
              </div>
              <div className="rounded-xl bg-card border border-border p-4">
                <DollarSign size={18} className="text-amber-400" />
                <div className="text-2xl font-bold text-amber-400 mt-2">{fmt(periodTotals.commission)}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-0.5">{t('clientDash.kpi.agencyCommission')}</div>
                <div className="text-[10px] text-muted-foreground/60 mt-1">{periodFilter === 'today' ? t('clientDash.periods.today') : periodFilter === 'week' ? t('clientDash.periods.closedWeek') : periodFilter === 'month' ? t('clientDash.periods.thisMonth') : t('clientDash.periods.custom')}</div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-primary/15 to-emerald-500/10 border border-primary/30 p-4">
                <CreditCard size={18} className="text-primary" />
                <div className="text-2xl font-bold text-primary mt-2">{fmt(availableCredit)}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-0.5">{t('clientDash.kpi.creditAvailable')}</div>
                <div className="text-[10px] text-muted-foreground/60 mt-1">
                  {creditUsed > 0
                    ? <>{t('clientDash.kpi.creditUsed')} <span className="text-primary/80 font-semibold">{fmt(creditUsed)}</span> {t('clientDash.kpi.creditOf')} {fmt(originalCredit)}</>
                    : t('clientDash.kpi.creditAuto')}
                </div>
              </div>
            </div>

            {/* Period Filter + Totals */}
            <div className="bg-card border border-border rounded-xl p-5 border-glow">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <h3 className="font-display text-sm font-semibold flex items-center gap-2">
                  <TrendingUp size={16} className="text-primary" /> {t('clientDash.periodPanel.title')}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {(['today', 'week', 'month', 'custom'] as const).map(p => (
                    <button key={p} onClick={() => setPeriodFilter(p)}
                      className={cn("px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                        periodFilter === p ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                      )}>
                      {p === 'today' ? t('clientDash.periods.today') : p === 'week' ? t('clientDash.periods.weekClosed') : p === 'month' ? t('clientDash.periods.month') : t('clientDash.periods.customLabel')}
                    </button>
                  ))}
                </div>
              </div>

              {periodFilter === 'custom' && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-secondary border border-border hover:border-primary">
                        <CalendarIcon size={12} /> {t('clientDash.periodPanel.from')} {format(customStart, 'dd/MM/yyyy', { locale: dateLocale })}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customStart} onSelect={d => d && setCustomStart(d)} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-secondary border border-border hover:border-primary">
                        <CalendarIcon size={12} /> {t('clientDash.periodPanel.to')} {format(customEnd, 'dd/MM/yyyy', { locale: dateLocale })}
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
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clientDash.periodPanel.spend')}</p>
                  <p className="text-base sm:text-lg font-bold text-foreground mt-1">{fmt(periodTotals.adSpend)}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clientDash.periodPanel.commission')}</p>
                  <p className="text-base sm:text-lg font-bold text-primary mt-1">{fmt(periodTotals.commission)}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clientDash.periodPanel.paid')}</p>
                  <p className="text-base sm:text-lg font-bold text-success mt-1">{fmt(periodTotals.paid)}</p>
                </div>
              </div>
            </div>

            {/* Billing cycle notice */}
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 flex items-start gap-3">
              <Info size={16} className="text-amber-300 mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-amber-300">{t('clientDash.billingCycle.title')}</strong> {t('clientDash.billingCycle.desc')}
              </div>
            </div>

            {/* Credit runway: week-by-week */}
            {creditPlan && (
              <div className="bg-card border border-primary/30 rounded-xl p-5 border-glow relative overflow-hidden">
                <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/10 blur-[60px] pointer-events-none" />
                <div className="relative">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                    <h3 className="font-display text-sm font-semibold flex items-center gap-2">
                      <CreditCard size={16} className="text-primary" /> {t('clientDash.creditHistory.title')}
                    </h3>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-primary" /> {t('clientDash.creditHistory.credited')}</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> {t('clientDash.creditHistory.payable')}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    {t('clientDash.creditHistory.desc', { total: fmt(creditPlan.totalCredit), applied: fmt(creditPlan.totalApplied), remaining: fmt(creditPlan.remaining), owed: fmt(creditPlan.totalStillOwed) })}
                  </p>

                  {(() => {
                    const PAGE_SIZE = 8;
                    // Filtro do histórico
                    const filteredRows = creditPlan.rows.filter(r => {
                      if (historyFilter === 'paying') return r.stillOwed > 0;
                      if (historyFilter === 'covered') return r.creditApplied >= r.commission && r.commission > 0;
                      return true; // 'recent' | 'all'
                    });
                    // 'recent' mostra do mais novo p/ o mais antigo, paginado
                    const ordered = historyFilter === 'all'
                      ? filteredRows
                      : [...filteredRows].reverse();
                    const totalPages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
                    const pageIdx = Math.min(historyPage, totalPages - 1);
                    const pageRows = historyFilter === 'all'
                      ? ordered
                      : ordered.slice(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE);

                    return (
                      <>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clientDash.creditHistory.filter')}</span>
                          {([
                            { k: 'recent', l: t('clientDash.creditHistory.recent') },
                            { k: 'paying', l: t('clientDash.creditHistory.open') },
                            { k: 'covered', l: t('clientDash.creditHistory.covered') },
                            { k: 'all', l: t('clientDash.creditHistory.all', { count: creditPlan.rows.length }) },
                          ] as const).map(opt => (
                            <button
                              key={opt.k}
                              onClick={() => { setHistoryFilter(opt.k); setHistoryPage(0); }}
                              className={cn(
                                "text-[10px] px-2.5 py-1 rounded-md border transition-colors",
                                historyFilter === opt.k
                                  ? "border-primary/50 bg-primary/10 text-primary"
                                  : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {opt.l}
                            </button>
                          ))}
                        </div>

                        <div className="space-y-2.5">
                          {pageRows.map((r, localIdx) => {
                            const absoluteIdx = creditPlan.rows.indexOf(r);
                            const pct = r.commission > 0 ? Math.max(1, (r.creditApplied / r.commission) * 100) : 0;
                            const isFirstPaying = r.creditApplied < r.commission
                              && r.stillOwed > 0
                              && (absoluteIdx === 0 || creditPlan.rows[absoluteIdx - 1].stillOwed === 0);
                            return (
                              <div key={absoluteIdx} className={cn(
                                "rounded-lg border p-3",
                                isFirstPaying ? "border-amber-400/40 bg-amber-400/5" : "border-border bg-secondary/40"
                              )}>
                                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-muted-foreground">{t('clientDash.creditHistory.week', { number: absoluteIdx + 1 })}</span>
                                    <span className="text-xs font-medium text-foreground">
                                      {format(r.weekStart, "dd MMM yyyy", { locale: dateLocale })}
                                    </span>
                                    {isFirstPaying && (
                                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-semibold">
                                        {t('clientDash.creditHistory.firstOpen')}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {t('clientDash.creditHistory.balance')} <span className="text-primary font-semibold">{fmt(r.remainingAfter)}</span>
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
                                  {r.stillOwed > 0 && (
                                    <div
                                      className="absolute inset-y-0 right-0 bg-amber-400/80 flex items-center justify-end px-2"
                                      style={{ width: `${100 - pct}%` }}
                                    >
                                      <span className="text-[10px] font-bold text-background whitespace-nowrap">
                                        {fmt(r.stillOwed)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                                  <span>{t('clientDash.creditHistory.spend')} <span className="text-foreground font-medium">{fmt(r.spend)}</span> · {t('clientDash.creditHistory.commission')} <span className="text-foreground font-medium">{fmt(r.commission)}</span></span>
                                  <span>
                                    {r.creditApplied >= r.commission && r.commission > 0 && t('clientDash.creditHistory.fullyCovered')}
                                    {r.creditApplied > 0 && r.creditApplied < r.commission && t('clientDash.creditHistory.creditEnded')}
                                    {r.creditApplied === 0 && r.commission > 0 && t('clientDash.creditHistory.fullPayment')}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                          {pageRows.length === 0 && (
                            <p className="text-xs text-muted-foreground/60 text-center py-6">{t('clientDash.creditHistory.noWeeks')}</p>
                          )}
                        </div>

                        {historyFilter !== 'all' && totalPages > 1 && (
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                            <button
                              onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
                              disabled={pageIdx === 0}
                              className="text-[11px] inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border bg-secondary/40 hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <ChevronLeft size={12} /> {t('clientDash.creditHistory.newer')}
                            </button>
                            <span className="text-[10px] text-muted-foreground">
                              {t('clientDash.creditHistory.page', { page: pageIdx + 1, total: totalPages, count: ordered.length })}
                            </span>
                            <button
                              onClick={() => setHistoryPage(p => Math.min(totalPages - 1, p + 1))}
                              disabled={pageIdx >= totalPages - 1}
                              className="text-[11px] inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border bg-secondary/40 hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {t('clientDash.creditHistory.older')} <ChevronRight size={12} />
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}


            {/* Saved accounts (inclui contas arquivadas / sem acesso) */}
            {(savedAccounts.length > 0 || archivedAccounts.length > 0) && (
              <div className="bg-card border border-border rounded-xl p-5 border-glow">
                <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-primary" /> {t('clientDash.accounts.savedByAgency')}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {savedAccounts.slice(0, 12).map(s => (
                    <span key={s.id} className="text-[10px] px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary/90 font-mono">
                      {s.ad_account?.name || s.ad_account?.meta_account_id || t('clientDash.accounts.accountFallback')}
                    </span>
                  ))}
                  {archivedAccounts.slice(0, 24).map((a: any) => (
                    <span key={`arch-${a.id}`} className="text-[10px] px-2 py-1 rounded-md bg-muted/40 border border-border text-muted-foreground font-mono">
                      {a.ad_account?.name || a.ad_account?.meta_account_id || t('clientDash.accounts.accountFallback')}
                    </span>
                  ))}
                </div>
              </div>
            )}


            {/* Ad Accounts */}
            <div className="bg-card border border-border rounded-xl p-5 border-glow">
              <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
                <Shield size={16} className="text-primary" /> {t('clientDash.accounts.adAccounts')}
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
                      <p className="text-xs text-muted-foreground mt-1">{t('clientDash.accounts.available')}</p>
                    </div>
                    <div className="bg-secondary rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('clientDash.accounts.inUse')}</p>
                    </div>
                    <div className="bg-secondary rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-destructive">{blockedCount}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('clientDash.accounts.blocked')}</p>
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
                <CreditCard size={16} className="text-primary" /> {t('clientDash.contract.details')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="bg-secondary/60 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clientDash.contract.clientType')}</p>
                  <p className="font-medium mt-1">{client.client_type === 'venda' ? t('clientDash.contract.fixedSale') : t('clientDash.contract.rentalSpend')}</p>
                </div>
                {client.client_type === 'venda' ? (
                  <div className="bg-secondary/60 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clientDash.contract.fixedValue')}</p>
                    <p className="font-medium text-primary mt-1">{fmt(Number(client.fixed_value) || 0)}</p>
                  </div>
                ) : (
                  <div className="bg-secondary/60 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clientDash.contract.basePct')}</p>
                    <p className="font-medium text-primary mt-1">{Number(client.percentage_value) || 0}%</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{t('clientDash.contract.basePctDesc')}</p>
                  </div>
                )}
                <div className="bg-secondary/60 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clientDash.contract.billing')}</p>
                  <p className="font-medium mt-1">{t('clientDash.contract.weeklyFriday')}</p>
                </div>
                {client.observations && (
                  <div className="sm:col-span-2 bg-secondary/60 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clientDash.contract.observations')}</p>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{client.observations}</p>
                  </div>
                )}
              </div>
            </div>

            {client.client_type !== 'venda' && (() => {
              const now = new Date();
                const { start: ws, end: we } = getLastClosedBillingWeekRange(now);
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
                    <TrendingUp size={16} className="text-primary" /> {t('clientDash.contract.weeklyGoals')}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    {t('clientDash.contract.weeklyGoalsDesc')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div className="bg-secondary/60 rounded-lg p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clientDash.contract.lastClosedSpend')}</p>
                      <p className="font-bold text-lg text-foreground mt-1">{fmt(weekSpend)}</p>
                    </div>
                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clientDash.contract.currentPct')}</p>
                      <p className="font-bold text-lg text-primary mt-1">{currentRate}%</p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                    {nextTier ? (
                      <p className="text-[11px] text-muted-foreground mt-2">
                        {t('clientDash.contract.remainingToReach', { amount: fmt(remaining), pct: nextTier.pct, min: fmt(nextTier.min) })}
                      </p>
                    ) : (
                      <p className="text-[11px] text-success mt-2">{t('clientDash.contract.topGoalReached', { pct: topTier?.pct ?? 1 })}</p>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {tiers.map(tier => {
                      const reached = weekSpend > tier.min;
                      const active = currentRate === tier.pct;
                      return (
                        <li
                          key={tier.min}
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
                            {t('clientDash.contract.above', { amount: fmt(tier.min) })}
                          </span>
                          <span className={cn("font-semibold",
                            active ? "text-primary" : reached ? "text-success" : "text-muted-foreground"
                          )}>{tier.pct}%</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })()}

            <div className="bg-card border border-border rounded-xl p-5 border-glow">
              <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
                <DollarSign size={16} className="text-primary" /> {t('clientDash.contract.accumulatedHistory')}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-secondary rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clientDash.contract.totalAdSpend')}</p>
                  <p className="text-sm font-bold text-foreground mt-1">{fmt(allTimeTotals.adSpend)}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clientDash.contract.totalCommission')}</p>
                  <p className="text-sm font-bold text-primary mt-1">{fmt(allTimeTotals.commission)}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clientDash.contract.totalPaid')}</p>
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
                      <CreditCard size={16} className="text-primary" /> {t('clientDash.accounts.adAccounts')}
                    </h3>
                    <div className="flex items-center gap-2">
                      {lastAccountsSync && (
                        <span className="text-[10px] text-muted-foreground">
                          {t('clientDash.structure.synced', { time: formatDistanceToNow(lastAccountsSync, { addSuffix: true, locale: dateLocale }) })}
                        </span>
                      )}
                      <button
                        onClick={refreshAccounts}
                        disabled={refreshingAccounts}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-secondary border border-border hover:border-primary hover:text-primary disabled:opacity-50 transition-colors"
                        title={t('clientDash.structure.refresh')}
                      >
                        <RefreshCw size={11} className={refreshingAccounts ? 'animate-spin' : ''} />
                        {t('clientDash.structure.refresh')}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-center">
                      <ShieldCheck size={16} className="text-emerald-400 mx-auto mb-1" />
                      <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{t('clientDash.structure.active')}</p>
                    </div>
                    <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-center">
                      <Ban size={16} className="text-destructive mx-auto mb-1" />
                      <p className="text-2xl font-bold text-destructive">{blockedCount}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{t('clientDash.structure.banned')}</p>
                    </div>
                  </div>

                  {/* Filtro global de período da aba Estrutura */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-4 border-b border-border/60">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clientDash.structure.metricsPeriod')}</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {([
                        { v: 'today', l: t('clientDash.structure.today') },
                        { v: 'billing_week', l: t('clientDash.structure.lastClosedWeek') },
                        { v: '7d', l: t('clientDash.structure.rolling7') },
                        { v: '30d', l: t('clientDash.structure.rolling30') },
                        { v: 'all', l: t('clientDash.structure.allTime') },
                        { v: 'custom', l: t('clientDash.structure.custom') },
                      ] as const).map(o => (
                        <button
                          key={o.v}
                          onClick={() => setEstruturaPeriod(o.v)}
                          className={cn(
                            "text-[10px] px-2.5 py-1 rounded-md border transition-colors",
                            estruturaPeriod === o.v
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                          )}
                        >
                          {o.l}
                        </button>
                      ))}
                      {estruturaPeriod === 'custom' && (
                        <>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-secondary border border-border hover:border-primary">
                                <CalendarIcon size={10} /> {format(estruturaCustomStart, 'dd/MM/yyyy', { locale: dateLocale })}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <Calendar mode="single" selected={estruturaCustomStart} onSelect={d => d && setEstruturaCustomStart(d)} className="p-3 pointer-events-auto" />
                            </PopoverContent>
                          </Popover>
                          <span className="text-[10px] text-muted-foreground">{t('clientDash.structure.until')}</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-secondary border border-border hover:border-primary">
                                <CalendarIcon size={10} /> {format(estruturaCustomEnd, 'dd/MM/yyyy', { locale: dateLocale })}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <Calendar mode="single" selected={estruturaCustomEnd} onSelect={d => d && setEstruturaCustomEnd(d)} className="p-3 pointer-events-auto" />
                            </PopoverContent>
                          </Popover>
                        </>
                      )}
                    </div>
                  </div>

                  {activeAccounts.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-border rounded-lg">
                      <CreditCard size={24} className="mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">{t('clientDash.structure.noAccounts')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeAccounts.map((a: any) => {
                        const acc = a.ad_account;
                        if (!acc) return null;
                        const isBlocked = acc.status === 'blocked' || (acc.disable_reason ?? 0) > 0;
                        const now = new Date();
                        const closedBillingWeek = getLastClosedBillingWeekRange(now);
                        const since =
                          estruturaPeriod === 'today' ? startOfDay(now) :
                          estruturaPeriod === 'billing_week' ? closedBillingWeek.start :
                          estruturaPeriod === '7d' ? startOfDay(new Date(now.getTime() - 6 * 86400000)) :
                          estruturaPeriod === '30d' ? startOfDay(new Date(now.getTime() - 29 * 86400000)) :
                          estruturaPeriod === 'custom' ? startOfDay(estruturaCustomStart) :
                          new Date(0);
                        const until =
                          estruturaPeriod === 'billing_week' ? closedBillingWeek.end :
                          estruturaPeriod === 'custom' ? endOfDay(estruturaCustomEnd) :
                          endOfDay(now);
                        const accInsights = insights.filter((i: any) => {
                          if (i.ad_account_id !== acc.id) return false;
                          const d = parseDateLocal(i.date);
                          return d >= since && d <= until;
                        });
                        const m = accInsights.reduce((s: any, i: any) => ({
                          spend: s.spend + Number(i.spend || 0),
                          impressions: s.impressions + Number(i.impressions || 0),
                          clicks: s.clicks + Number(i.clicks || 0),
                          purchases: s.purchases + Number(i.purchases || 0),
                          revenue: s.revenue + Number(i.revenue || 0),
                        }), { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 });
                        const ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
                        const cpc = m.clicks > 0 ? m.spend / m.clicks : 0;
                        const cpm = m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0;
                        const roas = m.spend > 0 ? m.revenue / m.spend : 0;
                        return (
                          <div key={a.id} className="bg-secondary/40 border border-border rounded-lg p-3 space-y-3">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", isBlocked ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-400")}>
                                  {isBlocked ? <Ban size={16} /> : <ShieldCheck size={16} />}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold truncate">{acc.name}</p>
                                  <p className="text-[11px] text-muted-foreground font-mono truncate">ID: {acc.meta_account_id}</p>
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
                                    <span>{t('clientDash.structure.balance')} <span className="text-foreground/80">{fmt(Number(acc.balance) || 0)}</span></span>
                                    {acc.currency && <span>{t('clientDash.structure.currency')} <span className="text-foreground/80">{acc.currency}</span></span>}
                                    {acc.last_synced_at && (
                                      <span>{t('clientDash.structure.updated')} <span className="text-foreground/80">{formatDistanceToNow(new Date(acc.last_synced_at), { addSuffix: true, locale: dateLocale })}</span></span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <span className={cn("text-[10px] px-2 py-1 rounded-md border font-medium inline-flex items-center gap-1 shrink-0",
                                isBlocked ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              )}>
                                {isBlocked ? <Ban size={10} /> : <ShieldCheck size={10} />}
                                {isBlocked ? (acc.disable_reason_label || t('clientDash.structure.bannedStatus')) : t('clientDash.structure.activeStatus')}
                              </span>
                            </div>

                            {/* Real metrics from insights (período controlado no topo da aba) */}
                            <div className="border-t border-border/60 pt-3 space-y-2">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('clientDash.structure.realMetrics')}</span>
                              {accInsights.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground italic">{t('clientDash.structure.noAdData')}</p>
                              ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  {[
                                    { l: t('clientDash.structure.spend'), v: fmt(m.spend), c: 'text-foreground' },
                                    { l: t('clientDash.structure.revenue'), v: fmt(m.revenue), c: 'text-emerald-400' },
                                    { l: 'ROAS', v: `${roas.toFixed(2)}x`, c: roas >= 1 ? 'text-emerald-400' : 'text-destructive' },
                                    { l: t('clientDash.structure.purchases'), v: m.purchases.toLocaleString(numberLocale), c: 'text-foreground' },
                                    { l: t('clientDash.structure.impressions'), v: m.impressions.toLocaleString(numberLocale), c: 'text-foreground' },
                                    { l: t('clientDash.structure.clicks'), v: m.clicks.toLocaleString(numberLocale), c: 'text-foreground' },
                                    { l: 'CTR', v: `${ctr.toFixed(2)}%`, c: 'text-foreground' },
                                    { l: 'CPC', v: fmt(cpc), c: 'text-foreground' },
                                  ].map(k => (
                                    <div key={k.l} className="bg-background/60 border border-border/60 rounded-md px-2 py-1.5">
                                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{k.l}</p>
                                      <p className={cn("text-xs font-bold mt-0.5 truncate", k.c)}>{k.v}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Relatório consolidado: Gasto x Comissão por conta */}
            {(() => {
              if (!client || client.client_type === 'venda') return null;
              const now = new Date();
              const closedBillingWeek = getLastClosedBillingWeekRange(now);
              const since =
                estruturaPeriod === 'today' ? startOfDay(now) :
                estruturaPeriod === 'billing_week' ? closedBillingWeek.start :
                estruturaPeriod === '7d' ? startOfDay(new Date(now.getTime() - 6 * 86400000)) :
                estruturaPeriod === '30d' ? startOfDay(new Date(now.getTime() - 29 * 86400000)) :
                estruturaPeriod === 'custom' ? startOfDay(estruturaCustomStart) :
                new Date(0);
              const until =
                estruturaPeriod === 'billing_week' ? closedBillingWeek.end :
                estruturaPeriod === 'custom' ? endOfDay(estruturaCustomEnd) :
                endOfDay(now);
              const periodLabel =
                estruturaPeriod === 'today' ? t('clientDash.structure.today') :
                estruturaPeriod === 'billing_week' ? `${format(closedBillingWeek.start, 'dd/MM', { locale: dateLocale })} → ${format(closedBillingWeek.end, 'dd/MM', { locale: dateLocale })}` :
                estruturaPeriod === '7d' ? t('clientDash.structure.last7Days') :
                estruturaPeriod === '30d' ? t('clientDash.structure.last30Days') :
                estruturaPeriod === 'custom' ? `${format(estruturaCustomStart, 'dd/MM/yyyy', { locale: dateLocale })} → ${format(estruturaCustomEnd, 'dd/MM/yyyy', { locale: dateLocale })}` :
                t('clientDash.structure.wholePeriod');

              const rows = activeAccounts.map((a: any) => {
                const acc = a.ad_account;
                if (!acc) return null;
                const spend = insights.reduce((s: number, i: any) => {
                  if (i.ad_account_id !== acc.id) return s;
                  const d = parseDateLocal(i.date);
                  if (d < since || d > until) return s;
                  return s + Number(i.spend || 0);
                }, 0);
                const isBlocked = acc.status === 'blocked' || (acc.disable_reason ?? 0) > 0;
                return {
                  id: a.id,
                  name: acc.name as string,
                  metaId: acc.meta_account_id as string,
                  isBlocked,
                  disableLabel: acc.disable_reason_label as string | null,
                  spend,
                };
              }).filter(Boolean) as { id: string; name: string; metaId: string; isBlocked: boolean; disableLabel: string | null; spend: number }[];

              const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
              const basePct = Number(client.percentage_value) || 0;
              const effectivePct = getTierPct(totalSpend, basePct);
              const withCommission = rows
                .filter(r => r.spend > 0)
                .map(r => ({ ...r, commission: r.spend * (effectivePct / 100) }))
                .sort((a, b) => b.spend - a.spend);
              const totalCommission = totalSpend * (effectivePct / 100);

              return (
                <div className="bg-card border border-border rounded-xl p-5 border-glow">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                    <div>
                      <h3 className="font-display text-sm font-semibold flex items-center gap-2">
                        <Layers size={16} className="text-primary" /> {t('clientDash.structure.accountsStructure')}
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t('clientDash.structure.spendCommissionByAccount', { period: periodLabel })}
                      </p>
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-md bg-primary/10 border border-primary/30 text-primary font-medium">
                      {t('clientDash.structure.currentTier', { pct: effectivePct.toFixed(2) })}
                    </span>
                  </div>

                  {withCommission.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-border rounded-lg">
                      <p className="text-sm text-muted-foreground">{t('clientDash.structure.noData')}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border/60">
                      <table className="w-full text-xs">
                        <thead className="bg-secondary/60 text-muted-foreground">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium uppercase tracking-wider text-[10px]">{t('clientDash.structure.account')}</th>
                            <th className="text-left px-3 py-2 font-medium uppercase tracking-wider text-[10px]">ID Meta</th>
                            <th className="text-left px-3 py-2 font-medium uppercase tracking-wider text-[10px]">{t('clientDash.structure.status')}</th>
                            <th className="text-right px-3 py-2 font-medium uppercase tracking-wider text-[10px]">{t('clientDash.structure.periodSpend')}</th>
                            <th className="text-right px-3 py-2 font-medium uppercase tracking-wider text-[10px]">{t('clientDash.structure.estCommission')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {withCommission.map(r => (
                            <tr key={r.id} className="border-t border-border/40 hover:bg-secondary/30 transition-colors">
                              <td className="px-3 py-2 font-medium text-foreground">{r.name}</td>
                              <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{r.metaId}</td>
                              <td className="px-3 py-2">
                                <span className={cn(
                                  "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border",
                                  r.isBlocked
                                    ? "bg-destructive/10 border-destructive/30 text-destructive"
                                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                )}>
                                  {r.isBlocked ? <Ban size={9} /> : <ShieldCheck size={9} />}
                                  {r.isBlocked ? (r.disableLabel || t('clientDash.structure.bannedStatus')) : t('clientDash.structure.activeStatus')}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-foreground">{fmt(r.spend)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-primary">{fmt(r.commission)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-secondary/80 border-t-2 border-primary/40">
                          <tr>
                            <td colSpan={3} className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                              Total ({withCommission.length})
                            </td>
                            <td className="px-3 py-2.5 text-right font-display text-sm font-bold text-foreground">{fmt(totalSpend)}</td>
                            <td className="px-3 py-2.5 text-right font-display text-sm font-bold text-primary">{fmt(totalCommission)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                    * {t('clientDash.structure.commissionNote', { pct: effectivePct.toFixed(2) })}
                  </p>
                </div>
              );
            })()}


            {/* Pages */}
            <div className="bg-card border border-border rounded-xl p-5 border-glow">
              <h3 className="font-display text-sm font-semibold mb-1 flex items-center gap-2">
                <ImageIcon size={16} className="text-primary" /> {t('clientDash.structure.metaPages')}
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                {t('clientDash.structure.metaPagesDesc')}
              </p>
              {pages.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-border rounded-lg">
                  <ImageIcon size={28} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">{t('clientDash.structure.noPages')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pages.map((p: any) => {
                    const restricted = p.is_restricted;
                    const unpublished = p.is_published === false;
                    const statusLabel = restricted ? t('clientDash.structure.restricted') : unpublished ? t('clientDash.structure.unpublished') : t('clientDash.structure.activeStatus');
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
                          <p className="text-[11px] text-muted-foreground truncate">{p.category || t('clientDash.structure.noCategory')}</p>
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
                <LifeBuoy size={16} className="text-primary" /> {t('clientDash.support.requestService')}
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                {t('clientDash.support.requestDesc')}
              </p>

              {!isAdminView && supportBlockedByOverdue && (
                <div className="mb-4 rounded-xl border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-3">
                  <AlertTriangle size={18} className="text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-destructive">{t('clientDash.support.blockedTitle')}</p>
                    <p className="text-xs text-foreground/80 mt-1">
                      {t('clientDash.support.blockedDesc', { amount: overdueTotal.toFixed(2) })}
                    </p>
                  </div>
                </div>
              )}


              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {([
                    { v: 'add_ad_account', label: t('clientDash.support.addAccount'), Icon: CreditCard },
                    { v: 'add_page', label: t('clientDash.support.addPage'), Icon: ImageIcon },
                    { v: 'add_bm', label: t('clientDash.support.addBm'), Icon: Building2 },
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

                {reqType === 'add_ad_account' && adAccountRequestNotice && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-[12px] text-amber-200 flex items-start gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span className="whitespace-pre-wrap leading-relaxed">{adAccountRequestNotice}</span>
                  </div>
                )}

                {reqType === 'add_bm' && (
                  <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-[12px] text-primary flex items-start gap-2">
                    <Building2 size={14} className="shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      {t('clientDash.support.addBmDesc')}
                    </span>
                  </div>
                )}

                {(reqType === 'add_ad_account' || reqType === 'add_page') && (() => {
                  const maxAllowed = reqType === 'add_ad_account' ? adAccountRequestLimit : 50;
                  return (
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                        {t('clientDash.support.quantity')} {reqType === 'add_ad_account' && <span className="text-muted-foreground/70 normal-case">{t('clientDash.support.maxPerRequest', { max: maxAllowed })}</span>}
                      </label>
                      <input
                        type="number" min={1} max={maxAllowed}
                        value={reqQty}
                        onChange={e => {
                          const n = Math.max(1, Number(e.target.value) || 1);
                          setReqQty(Math.min(n, maxAllowed));
                        }}
                        className="w-32 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                  );
                })()}


                {reqType === 'add_ad_account' && (
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                      <Building2 size={11} /> {t('clientDash.support.bmId')}
                    </label>
                    <input
                      type="text"
                      value={reqBmId}
                      onChange={e => setReqBmId(e.target.value)}
                      placeholder="Ex: 1469807817968606"
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                    />
                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
                      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                      <span>{t('clientDash.support.cardSecurity')}</span>
                    </div>
                  </div>
                )}

                {reqType === 'add_page' && reqQty > 0 && (
                  <div className="space-y-2">
                    <label className="block text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <ImageIcon size={11} /> {t('clientDash.support.pageNames', { count: reqQty })}
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
                          placeholder={t('clientDash.support.pagePlaceholder', { number: i + 1 })}
                          className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{t('clientDash.support.notes')}</label>
                  <textarea
                    value={reqDesc}
                    onChange={e => setReqDesc(e.target.value)}
                    placeholder={t('clientDash.support.notesPlaceholder')}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary h-24 resize-none"
                  />
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={submitRequest}
                    disabled={submittingReq || (!isAdminView && supportBlockedByOverdue)}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
                  >
                    <Send size={14} /> {submittingReq ? t('clientDash.support.saving') : editingReqId ? t('clientDash.support.saveChanges') : t('clientDash.support.sendRequest')}
                  </button>
                  {editingReqId && (
                    <button onClick={resetReqForm} className="px-4 py-2.5 rounded-xl text-sm font-medium border border-border text-muted-foreground hover:text-foreground">
                      {t('clientDash.support.cancelEdit')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Histórico de solicitações */}
            <div className="bg-card border border-border rounded-xl p-5 border-glow">
              <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
                <Clock size={16} className="text-primary" /> {t('clientDash.support.myRequests')}
              </h3>
              {supportRequests.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-border rounded-lg">
                  <LifeBuoy size={24} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">{t('clientDash.support.noRequests')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {supportRequests.map((r: any) => {
                    const typeLabel = supportRequestTypeLabel(r.request_type);
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
                            {(r.request_type === 'add_ad_account' || r.request_type === 'add_page') && (
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
                            {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: dateLocale })}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={cn("text-[10px] px-2 py-1 rounded-md border font-medium flex items-center gap-1", statusColor)}>
                            <StatusIcon size={11} />
                            {r.status === 'pendente' ? t('clientDash.support.pending') : r.status === 'em_andamento' ? t('clientDash.support.inProgress') : r.status === 'concluida' ? t('clientDash.support.completed') : t('clientDash.support.canceled')}
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
            {/* Saldo Atrasado — destaque em vermelho quando há vencimento */}
            {overdueTotal > 0 && (
              <div className="rounded-2xl p-5 border bg-gradient-to-br from-destructive/15 via-card to-card border-destructive/50 shadow-[0_0_30px_-10px_hsl(var(--destructive)/0.5)]">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-destructive/80 mb-1">{t('clientDash.billing.overdueBalance')}</p>
                    <p className="font-display text-3xl font-bold text-destructive">{fmt(overdueTotal)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('clientDash.billing.overdueDesc')}
                    </p>
                  </div>
                  <button
                    onClick={() => setOverdueDialogOpen(true)}
                    className="bg-destructive text-destructive-foreground font-semibold px-4 py-2.5 rounded-lg text-sm hover:opacity-90 flex items-center gap-2"
                  >
                    <AlertTriangle size={16} /> {t('clientDash.billing.settleNow')}
                  </button>
                </div>
              </div>
            )}

            {/* Saldo principal (semana corrente) */}
            <div className={cn(
              "rounded-2xl p-5 border",
              currentPendingTotal > 0 ? "bg-gradient-to-br from-warning/15 via-card to-card border-warning/40" : "bg-gradient-to-br from-success/10 via-card to-card border-success/30"
            )}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">{t('clientDash.billing.pendingBalance')}</p>
                  <p className={cn("font-display text-3xl font-bold", currentPendingTotal > 0 ? "text-warning" : "text-success")}>
                    {fmt(Math.max(0, currentPendingTotal))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {currentPendingTotal > 0 ? t('clientDash.billing.nextFriday') : (overdueTotal > 0 ? t('clientDash.billing.onlyOverdueOpen') : t('clientDash.billing.allGood'))}
                  </p>
                </div>
                {currentPendingTotal > 0 && <AlertTriangle size={36} className="text-warning" />}
              </div>
            </div>

            {/* Comissões pendentes por semana (preview antes da validação) */}
            {creditPlan && creditPlan.rows.some(r => r.stillOwed > 0) && (
              <div className="bg-card border border-border rounded-xl p-5 border-glow">
                <h3 className="font-display text-sm font-semibold mb-1 flex items-center gap-2">
                  <CalendarIcon size={16} className="text-primary" /> {t('clientDash.billing.weeklyPending')}
                </h3>
                <p className="text-[11px] text-muted-foreground mb-4">
                  {t('clientDash.billing.pendingCommissionsDesc')}
                </p>
                <div className="space-y-2">
                  {creditPlan.rows.filter(r => r.stillOwed > 0).map((r, idx) => {
                    const weekEnd = new Date(r.weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 6);
                    const rate = r.spend > 0 ? (r.commission / r.spend) * 100 : 0;
                    const dueDate = getBillingDueDate(r.weekStart);
                    const isOverdue = Date.now() >= dueDate.getTime();
                    const isPaid = r.stillOwed <= 0;
                    return (
                      <div key={idx} className={cn(
                        "border rounded-lg p-3",
                        isPaid ? "bg-success/10 border-success/40" : isOverdue ? "bg-destructive/10 border-destructive/40" : "bg-secondary/40 border-border"
                      )}>
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <CalendarIcon size={12} className={isPaid ? "text-success" : isOverdue ? "text-destructive" : "text-primary"} />
                            <span className="text-xs font-semibold">
                              {format(r.weekStart, "dd/MM", { locale: dateLocale })} — {format(weekEnd, "dd/MM/yyyy", { locale: dateLocale })}
                            </span>
                            {isPaid ? (
                              <span className="text-[9px] uppercase tracking-wider bg-success/20 text-success border border-success/40 px-1.5 py-0.5 rounded">
                                {t('clientDash.billing.paid')}
                              </span>
                            ) : isOverdue && (
                              <span className="text-[9px] uppercase tracking-wider bg-destructive/20 text-destructive border border-destructive/40 px-1.5 py-0.5 rounded">
                                {t('clientDash.billing.overdue')}
                              </span>
                            )}
                          </div>
                          <span className={cn(
                            "text-[10px] uppercase tracking-wider border px-2 py-0.5 rounded",
                            isPaid
                              ? "bg-success/15 text-success border-success/40"
                              : isOverdue
                              ? "bg-destructive/15 text-destructive border-destructive/40"
                              : "bg-warning/15 text-warning border-warning/30"
                          )}>
                            {isPaid ? `${t('clientDash.billing.paid')}: ${fmt(r.paidApplied)}` : `${t('clientDash.creditHistory.payable')}: ${fmt(r.stillOwed)}`}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                          <div className="bg-background/40 rounded p-2">
                            <p className="text-muted-foreground/70 uppercase tracking-wider text-[9px]">{t('clientDash.billing.syncedSpend')}</p>
                            <p className="font-bold text-foreground mt-0.5">{fmt(r.spend)}</p>
                          </div>
                          <div className="bg-background/40 rounded p-2">
                            <p className="text-muted-foreground/70 uppercase tracking-wider text-[9px]">{t('clientDash.billing.rate')}</p>
                            <p className="font-bold text-primary mt-0.5">{rate.toFixed(2)}%</p>
                          </div>
                          <div className="bg-background/40 rounded p-2">
                            <p className="text-muted-foreground/70 uppercase tracking-wider text-[9px]">{t('clientDash.billing.calcCommission')}</p>
                            <p className="font-bold text-amber-400 mt-0.5">{fmt(r.commission)}</p>
                          </div>
                          <div className="bg-background/40 rounded p-2">
                            <p className="text-muted-foreground/70 uppercase tracking-wider text-[9px]">{t('clientDash.billing.creditApplied')}</p>
                            <p className="font-bold text-emerald-400 mt-0.5">−{fmt(r.creditApplied)}</p>
                          </div>
                          <div className="bg-background/40 rounded p-2">
                            <p className="text-muted-foreground/70 uppercase tracking-wider text-[9px]">{t('clientDash.billing.paid')}</p>
                            <p className="font-bold text-success mt-0.5">−{fmt(r.paidApplied)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {(() => {
                  // Mesma regra do card "Saldo Pendente / Atrasado": vencimento =
                  // 00:00 de weekStart + 7 dias (sexta seguinte). No próprio dia
                  // do vencimento já é atrasado; o que ainda não venceu é semana corrente.
                  const now = Date.now();
                  let overdueSum = 0;
                  let currentSum = 0;
                  creditPlan.rows.forEach(r => {
                    if (r.stillOwed <= 0) return;
                    const due = getBillingDueDate(r.weekStart);
                    if (now >= due.getTime()) overdueSum += r.stillOwed;
                    else currentSum += r.stillOwed;
                  });
                  return (
                    <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-xs">
                      {overdueSum > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">{t('clientDash.billing.overdueShort')}</span>
                          <span className="font-bold text-destructive">{fmt(overdueSum)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t('clientDash.billing.currentPending')}</span>
                        <span className="font-bold text-warning">{fmt(currentSum)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1.5 border-t border-border/60">
                        <span className="text-muted-foreground">{t('clientDash.billing.totalPayable')}</span>
                        <span className="font-bold text-warning text-base">{fmt(creditPlan.totalStillOwed)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Cobranças semanais pendentes */}
            {pendingBillings.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5 border-glow">
                <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2">
                  <Receipt size={16} className="text-warning" /> {t('clientDash.billing.weeklyPending')}
                </h3>
                <div className="space-y-2">
                  {pendingBillings.map((b: any) => (
                    <div key={b.id} className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-xs font-semibold text-warning">{b.note || t('clientDash.billing.weeklyBilling')}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {t('clientDash.billing.period')} {b.billing_week_start ? formatDateShortBR(b.billing_week_start) : ''} — {b.billing_week_end ? formatDateShortBR(b.billing_week_end) : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-warning">{fmt(Number(b.amount))}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{b.status === 'parcial' ? t('clientDash.billing.partial') : t('clientDash.billing.pending')}</p>
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
                  <DollarSign size={16} className="text-primary" /> {t('clientDash.billing.paymentOptions')}
                </h3>
                <p className="text-xs text-muted-foreground mb-4">{t('clientDash.billing.paymentOptionsDesc')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <a href={`https://wa.me/553198416336?text=${encodeURIComponent(paymentMsg('PIX'))}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/20 transition-all group">
                    <Smartphone size={24} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-semibold text-emerald-500">PIX</span>
                    <span className="text-[10px] text-muted-foreground text-center">{t('clientDash.billing.instantTransfer')}</span>
                  </a>
                  <a href={`https://wa.me/553198416336?text=${encodeURIComponent(paymentMsg('Payoneer'))}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-sky-500/10 border border-sky-500/30 hover:border-sky-500/60 hover:bg-sky-500/20 transition-all group">
                    <Globe size={24} className="text-sky-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-semibold text-sky-500">PAYONEER</span>
                    <span className="text-[10px] text-muted-foreground text-center">{t('clientDash.billing.international')}</span>
                  </a>
                  <a href={`https://wa.me/553198416336?text=${encodeURIComponent(paymentMsg('Crypto'))}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/20 transition-all group">
                    <Bitcoin size={24} className="text-amber-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-semibold text-amber-500">CRYPTO</span>
                    <span className="text-[10px] text-muted-foreground text-center">{t('clientDash.billing.crypto')}</span>
                  </a>
                </div>
              </div>
            )}

            {/* Histórico */}
            {commissions.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5 border-glow">
                <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
                  <DollarSign size={16} className="text-primary" /> {t('clientDash.billing.launchHistory')}
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
                          {comm.type === 'daily' ? t('clientDash.billing.commission') : comm.type === 'paid' ? t('clientDash.billing.payment') : t('clientDash.billing.billingEntry')}
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

      {/* Pop-up de Saldo Atrasado — redireciona para WhatsApp */}
      <Dialog open={overdueDialogOpen} onOpenChange={setOverdueDialogOpen}>
        <DialogContent className="max-w-md border-destructive/50">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-lg bg-destructive/15 text-destructive">
                <AlertTriangle size={20} />
              </div>
              <DialogTitle className="text-destructive">{t('clientDash.billing.overdueDialogTitle')}</DialogTitle>
            </div>
            <DialogDescription>
              {t('clientDash.billing.overdueDialogDesc', { amount: fmt(overdueTotal) })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground">{t('clientDash.billing.paymentOptionsDesc')}</p>
            <div className="grid grid-cols-3 gap-2">
              <a
                href={`https://wa.me/553198416336?text=${encodeURIComponent(overdueMsg('PIX'))}`}
                target="_blank" rel="noopener noreferrer"
                onClick={() => setOverdueDialogOpen(false)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/20 transition-all"
              >
                <Smartphone size={20} className="text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-500">PIX</span>
              </a>
              <a
                href={`https://wa.me/553198416336?text=${encodeURIComponent(overdueMsg('Payoneer'))}`}
                target="_blank" rel="noopener noreferrer"
                onClick={() => setOverdueDialogOpen(false)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 hover:border-sky-500/60 hover:bg-sky-500/20 transition-all"
              >
                <Globe size={20} className="text-sky-500" />
                <span className="text-xs font-semibold text-sky-500">PAYONEER</span>
              </a>
              <a
                href={`https://wa.me/553198416336?text=${encodeURIComponent(overdueMsg('Crypto'))}`}
                target="_blank" rel="noopener noreferrer"
                onClick={() => setOverdueDialogOpen(false)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/20 transition-all"
              >
                <Bitcoin size={20} className="text-amber-500" />
                <span className="text-xs font-semibold text-amber-500">CRYPTO</span>
              </a>
            </div>
            <button
              onClick={() => setOverdueDialogOpen(false)}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-2"
            >
              {t('clientDash.billing.remindLater')}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pop-up de Fidelidade (nível conquistado ou perto do próximo) */}
      <Dialog open={loyaltyDialogOpen} onOpenChange={setLoyaltyDialogOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0 bg-transparent">
          <div className={cn(
            'relative rounded-2xl border p-6 bg-gradient-to-br',
            loyalty.current.gradient,
            loyalty.current.id === 'elite' && 'border-amber-400/40',
            loyalty.current.id === 'premium' && 'border-violet-400/40',
            loyalty.current.id === 'standard' && 'border-primary/30',
          )}>
            <div className={cn('absolute -top-20 -right-20 w-56 h-56 rounded-full blur-[70px]', loyalty.current.glow)} />
            <div className="relative">
              <DialogHeader className="mb-3">
                <DialogTitle className={cn('font-display text-2xl', loyalty.current.accent)}>
                  {loyalty.current.id === 'standard'
                    ? t('clientDash.loyalty.standardNear', { pct: Math.round(loyalty.progressPct), level: loyalty.next?.label })
                    : loyalty.nearNext
                      ? t('clientDash.loyalty.nearNext', { level: loyalty.next?.label })
                      : t('clientDash.loyalty.unlocked', { level: loyalty.current.label })}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {loyalty.achievedTop
                    ? t('clientDash.loyalty.topReached')
                    : loyalty.nearNext
                      ? t('clientDash.loyalty.continueToReduce', { amount: fmt(loyalty.remainingToNext), pct: loyalty.next?.basePct })
                      : loyalty.current.tagline}
                </DialogDescription>
              </DialogHeader>

              <LoyaltyTierCard progress={loyalty} compact className="!bg-background/40 !border-border/40 !shadow-none" />

              <button
                onClick={() => setLoyaltyDialogOpen(false)}
                className="mt-4 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
              >
                {loyalty.nearNext ? t('clientDash.loyalty.letsGo') : t('clientDash.loyalty.continue')}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

};

export default ClientDashboard;
