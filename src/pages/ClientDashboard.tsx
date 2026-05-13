import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, CreditCard, AlertTriangle, Shield, DollarSign, CalendarIcon, TrendingUp, Smartphone, Globe, Bitcoin, ShieldCheck, Sparkles, Ban, LayoutDashboard, FileText, Receipt, ImageIcon, Users as UsersIcon } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDateLocal, formatDateBR, formatDateShortBR } from '@/lib/date-utils';
import { supabase } from '@/integrations/supabase/client';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import AdScaleLogo from '@/components/AdScaleLogo';

const ClientDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [savedAccounts, setSavedAccounts] = useState<any[]>([]);
  const [activeAccounts, setActiveAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [customStart, setCustomStart] = useState<Date>(new Date());
  const [customEnd, setCustomEnd] = useState<Date>(new Date());
  const [tab, setTab] = useState<'resumo' | 'contrato' | 'cobrancas' | 'paginas'>('resumo');
  const [pages, setPages] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.email) return;
      const { data: clientData } = await supabase.from('clients').select('*').eq('email', user.email).maybeSingle();
      if (clientData) {
        setClient(clientData);
        const [{ data: commData }, { data: blocked }, { data: assigns }, { data: pageAssigns }] = await Promise.all([
          supabase.from('commissions').select('*').eq('client_id', clientData.id).order('date', { ascending: false }),
          supabase.from('meta_blocked_accounts_log').select('*, ad_account:meta_ad_accounts(name, meta_account_id)').eq('client_id', clientData.id).order('detected_at', { ascending: false }),
          supabase.from('meta_ad_account_assignments').select('*, ad_account:meta_ad_accounts(*)').eq('client_id', clientData.id).eq('active', true),
          supabase.from('meta_page_assignments').select('*, page:meta_pages(*)').eq('client_id', clientData.id).eq('active', true),
        ]);
        setCommissions(commData || []);
        setSavedAccounts(blocked || []);
        setActiveAccounts(assigns || []);
        setPages((pageAssigns || []).map((a: any) => a.page).filter(Boolean));
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const fmt = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const getFilterRange = () => {
    const now = new Date();
    switch (periodFilter) {
      case 'today': return { start: startOfDay(now), end: endOfDay(now) };
      case 'week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
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

  const allTimeTotals = useMemo(() => {
    const daily = commissions.filter(c => c.type === 'daily');
    const paid = commissions.filter(c => c.type === 'paid');
    return {
      commission: daily.reduce((s, c) => s + Number(c.amount), 0),
      paid: paid.reduce((s, c) => s + Number(c.amount), 0),
      adSpend: daily.reduce((s, c) => s + Number((c as any).ad_spend || 0), 0),
    };
  }, [commissions]);

  const periodTotals = useMemo(() => {
    const daily = filteredCommissions.filter(c => c.type === 'daily');
    const paid = filteredCommissions.filter(c => c.type === 'paid');
    return {
      commission: daily.reduce((s, c) => s + Number(c.amount), 0),
      paid: paid.reduce((s, c) => s + Number(c.amount), 0),
      adSpend: daily.reduce((s, c) => s + Number((c as any).ad_spend || 0), 0),
    };
  }, [filteredCommissions]);

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

  const pendingTotal = allTimeTotals.commission - allTimeTotals.paid;
  const cobrancasCount = pendingBillings.length + (pendingTotal > 0 ? 1 : 0);

  const paymentMsg = (method: string) =>
    `Olá! Sou o cliente ${client.name}. Gostaria de realizar o pagamento do saldo pendente de ${fmt(pendingTotal)} via *${method}*.`;

  return (
    <div className="min-h-screen bg-background">
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
          <button onClick={async () => { await logout(); navigate('/login'); }} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary">
            <LogOut size={16} />
          </button>
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
          <TabsList className="w-full grid grid-cols-4 h-auto p-1 bg-secondary/60 border border-border">
            <TabsTrigger value="resumo" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 gap-2 text-xs sm:text-sm">
              <LayoutDashboard size={14} /> Resumo
            </TabsTrigger>
            <TabsTrigger value="contrato" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 gap-2 text-xs sm:text-sm">
              <FileText size={14} /> Contrato
            </TabsTrigger>
            <TabsTrigger value="paginas" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2.5 gap-2 text-xs sm:text-sm">
              <ImageIcon size={14} /> Páginas
              {pages.length > 0 && (
                <span className="ml-1 bg-primary/20 text-primary text-[10px] font-bold rounded-full px-1.5 py-0.5">{pages.length}</span>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-primary/10 border border-primary/30 p-4">
                <ShieldCheck size={18} className="text-primary" />
                <div className="text-2xl font-bold text-primary mt-2">{savedAccounts.length}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-0.5">Contas Economizadas</div>
                <div className="text-[10px] text-muted-foreground/60 mt-1">Bloqueios resolvidos</div>
              </div>
              <div className="rounded-xl bg-card border border-border p-4">
                <Shield size={18} className="text-emerald-400" />
                <div className="text-2xl font-bold text-emerald-400 mt-2">{activeAccounts.length}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-0.5">Contas Ativas</div>
                <div className="text-[10px] text-muted-foreground/60 mt-1">Operando para você</div>
              </div>
              <div className="rounded-xl bg-card border border-border p-4">
                <TrendingUp size={18} className="text-sky-400" />
                <div className="text-2xl font-bold text-sky-400 mt-2">{fmt(allTimeTotals.adSpend)}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-0.5">Investido em Ads</div>
                <div className="text-[10px] text-muted-foreground/60 mt-1">Gasto gerenciado</div>
              </div>
              <div className="rounded-xl bg-card border border-border p-4">
                <Ban size={18} className="text-amber-400" />
                <div className="text-2xl font-bold text-amber-400 mt-2">{savedAccounts.filter(s => s.resolved_at).length}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-0.5">Eventos Resolvidos</div>
                <div className="text-[10px] text-muted-foreground/60 mt-1">Riscos neutralizados</div>
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
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-secondary rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{(client.ad_accounts || 0) - (client.used_accounts || 0) - (client.blocked_accounts || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Disponíveis</p>
                </div>
                <div className="bg-secondary rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{client.used_accounts || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Em uso</p>
                </div>
                <div className="bg-secondary rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-destructive">{client.blocked_accounts || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Bloqueadas</p>
                </div>
              </div>
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
                    <p className="font-medium text-primary mt-1">{client.percentage_value}%</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Aplicado quando o gasto semanal for menor que $20k.</p>
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
              const ws = startOfWeek(now, { weekStartsOn: 1 });
              const we = endOfWeek(now, { weekStartsOn: 1 });
              const weekSpend = commissions
                .filter((c: any) => c.type === 'daily' && isWithinInterval(parseDateLocal(c.date), { start: ws, end: we }))
                .reduce((s: number, c: any) => s + Number(c.ad_spend || 0), 0);
              const tiers = [
                { min: 20000, pct: 4 },
                { min: 40000, pct: 3 },
                { min: 80000, pct: 2 },
                { min: 200000, pct: 1 },
              ];
              const currentRate = [...tiers].reverse().find(t => weekSpend > t.min)?.pct ?? (Number(client.percentage_value) || 0);
              const nextTier = tiers.find(t => weekSpend <= t.min);
              const remaining = nextTier ? Math.max(0, nextTier.min - weekSpend) : 0;
              const progressMax = nextTier ? nextTier.min : 200000;
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
                      <p className="text-[11px] text-success mt-2">Você atingiu a meta máxima — 1% sobre o gasto.</p>
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

          {/* COBRANÇAS */}
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
