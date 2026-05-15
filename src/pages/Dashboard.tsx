import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Users, Server, CalendarIcon, Activity, Sparkles, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDateLocal } from '@/lib/date-utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, LineChart, Line } from 'recharts';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import AdScaleLogo from '@/components/AdScaleLogo';
import { useAuth } from '@/contexts/AuthContext';

type DateFilter = 'today' | '7days' | 'custom' | 'range';

const CHART_COLORS = ['hsl(120,100%,50%)', 'hsl(160,80%,45%)', 'hsl(45,100%,55%)', 'hsl(200,100%,55%)', 'hsl(280,80%,60%)'];

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [dateFilter, setDateFilter] = useState<DateFilter>('7days');
  const [customDate, setCustomDate] = useState<Date | undefined>(new Date());
  const [rangeFrom, setRangeFrom] = useState<Date | undefined>(undefined);
  const [rangeTo, setRangeTo] = useState<Date | undefined>(undefined);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [txRes, clientRes] = await Promise.all([
        supabase.from('transactions').select('*'),
        supabase.from('clients').select('*'),
      ]);
      if (txRes.data) setTransactions(txRes.data);
      if (clientRes.data) setClients(clientRes.data);
    };
    fetchData();
  }, []);

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter((t: any) => {
      const d = parseDateLocal(t.date);
      if (dateFilter === 'today') return d.toDateString() === now.toDateString();
      if (dateFilter === '7days') return d >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (dateFilter === 'custom' && customDate) return d.getMonth() === customDate.getMonth() && d.getFullYear() === customDate.getFullYear() && d.getDate() === customDate.getDate();
      if (dateFilter === 'range') {
        if (rangeFrom && rangeTo) { const from = new Date(rangeFrom); from.setHours(0,0,0,0); const to = new Date(rangeTo); to.setHours(23,59,59,999); return d >= from && d <= to; }
        if (rangeFrom) { const from = new Date(rangeFrom); from.setHours(0,0,0,0); return d >= from; }
      }
      return true;
    });
  }, [transactions, dateFilter, customDate, rangeFrom, rangeTo]);

  const revenue = filteredTransactions.filter((t: any) => t.type === 'receita').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const expenses = filteredTransactions.filter((t: any) => t.type === 'gasto').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const activeClients = clients.filter((c: any) => (c.ad_accounts || 0) > 0).length;
  const profit = revenue - expenses;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const structureCosts = filteredTransactions.filter((t: any) => t.type === 'gasto');
  const perfilCosts = structureCosts.filter((t: any) => t.category === 'Perfil').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const bmComumCosts = structureCosts.filter((t: any) => t.category === 'BM Comum').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const bmVerifCosts = structureCosts.filter((t: any) => t.category === 'BM Verificada').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const bmDisparoCosts = structureCosts.filter((t: any) => t.category === 'BM Disparo').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const paginaCosts = structureCosts.filter((t: any) => t.category === 'Pagina').reduce((s: number, t: any) => s + Number(t.amount), 0);

  const pieData = [
    { name: 'Perfil', value: perfilCosts },
    { name: 'BM Comum', value: bmComumCosts },
    { name: 'BM Verificada', value: bmVerifCosts },
    { name: 'BM Disparo', value: bmDisparoCosts },
    { name: 'Pagina', value: paginaCosts },
  ].filter(d => d.value > 0);

  const buildClientProfits = (typeFilter: 'aluguel' | 'venda') => clients
    .filter((c: any) => ((c.client_type as string) || 'aluguel') === typeFilter)
    .map((c: any) => {
      const cRevenue = filteredTransactions.filter((t: any) => t.client_id === c.id && t.type === 'receita').reduce((s: number, t: any) => s + Number(t.amount), 0);
      const cExpenses = filteredTransactions.filter((t: any) => t.client_id === c.id && t.type === 'gasto').reduce((s: number, t: any) => s + Number(t.amount), 0);
      return { name: c.company_name || c.name, profit: cRevenue - cExpenses, revenue: cRevenue, expenses: cExpenses };
    })
    .filter((c: any) => c.revenue > 0 || c.expenses > 0);

  const clientProfitsAluguel = useMemo(() => buildClientProfits('aluguel'), [clients, filteredTransactions]);
  const clientProfitsVenda = useMemo(() => buildClientProfits('venda'), [clients, filteredTransactions]);
  const clientProfits = [...clientProfitsAluguel, ...clientProfitsVenda];

  const dailyData = useMemo(() => {
    const days: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dayStr = d.toDateString();
      const dayRevenue = transactions.filter((t: any) => parseDateLocal(t.date).toDateString() === dayStr && t.type === 'receita').reduce((s: number, t: any) => s + Number(t.amount), 0);
      const dayExpenses = transactions.filter((t: any) => parseDateLocal(t.date).toDateString() === dayStr && t.type === 'gasto').reduce((s: number, t: any) => s + Number(t.amount), 0);
      days.push({ date: format(d, 'dd/MM', { locale: ptBR }), faturamento: dayRevenue, gastos: dayExpenses, lucro: dayRevenue - dayExpenses });
    }
    return days;
  }, [transactions]);

  const monthlyData = useMemo(() => {
    const months: any[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.getMonth();
      const year = d.getFullYear();
      const monthRevenue = transactions.filter((t: any) => { const td = parseDateLocal(t.date); return td.getMonth() === month && td.getFullYear() === year && t.type === 'receita'; }).reduce((s: number, t: any) => s + Number(t.amount), 0);
      const monthExpenses = transactions.filter((t: any) => { const td = parseDateLocal(t.date); return td.getMonth() === month && td.getFullYear() === year && t.type === 'gasto'; }).reduce((s: number, t: any) => s + Number(t.amount), 0);
      months.push({ date: format(d, 'MMM/yy', { locale: ptBR }), receitas: monthRevenue, gastos: monthExpenses, lucro: monthRevenue - monthExpenses });
    }
    return months;
  }, [transactions]);

  const fmt = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const fmtCompact = (v: number) => `$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`;

  const tooltipStyle = {
    backgroundColor: 'hsl(0,0%,5% / 0.95)',
    border: '1px solid hsl(120,100%,50% / 0.25)',
    borderRadius: '12px',
    color: 'hsl(0,0%,95%)',
    backdropFilter: 'blur(12px)',
    fontSize: '12px',
    padding: '10px 12px',
  } as any;

  // KPI sparkline data (uses dailyData)
  const sparkRevenue = dailyData.map(d => ({ v: d.faturamento }));
  const sparkProfit = dailyData.map(d => ({ v: d.lucro }));
  const sparkExpenses = dailyData.map(d => ({ v: d.gastos }));

  const dateLabel =
    dateFilter === 'today' ? 'Hoje'
    : dateFilter === '7days' ? 'Últimos 7 dias'
    : dateFilter === 'custom' ? 'Data específica'
    : 'Período personalizado';

  return (
    <div className="space-y-6">
      {/* HERO */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card/60 to-background p-6 sm:p-8"
      >
        {/* decorative halos */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/15 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-primary/5 blur-[100px] pointer-events-none" />
        {/* grid texture */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)', backgroundSize: '36px 36px' }}
        />

        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-primary/80 mb-3">
              <Sparkles size={12} />
              Command Center
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground leading-tight">
              Bem-vindo de volta
              {user?.email ? <span className="text-primary glow-text">.</span> : null}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-lg">
              Visão consolidada da operação · {dateLabel.toLowerCase()}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Margem operacional</div>
              <div className={`font-display text-2xl font-bold ${margin >= 0 ? 'text-primary glow-text' : 'text-destructive'}`}>
                {margin.toFixed(1)}%
              </div>
            </div>
            <div className="text-primary opacity-90">
              <AdScaleLogo size={32} variant="mark" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* DATE FILTER PILLS */}
      <div className="flex flex-wrap gap-2 items-center">
        {(['today', '7days', 'custom', 'range'] as DateFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setDateFilter(f)}
            className={cn(
              'relative px-4 py-2 rounded-full text-xs font-medium transition-all border',
              dateFilter === f
                ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_20px_hsl(var(--primary)/0.4)]'
                : 'bg-card/40 backdrop-blur text-muted-foreground border-border/60 hover:text-foreground hover:border-primary/40'
            )}
          >
            {f === 'today' ? 'Hoje' : f === '7days' ? 'Últimos 7 dias' : f === 'custom' ? 'Data específica' : 'Período'}
          </button>
        ))}
        {dateFilter === 'custom' && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2 rounded-full text-xs bg-card/40 backdrop-blur border border-border/60 text-foreground hover:border-primary/50 transition-colors">
                <CalendarIcon size={13} />
                {customDate ? format(customDate, "dd 'de' MMM, yyyy", { locale: ptBR }) : 'Selecionar data'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customDate} onSelect={setCustomDate} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        )}
        {dateFilter === 'range' && (
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 px-4 py-2 rounded-full text-xs bg-card/40 backdrop-blur border border-border/60 text-foreground hover:border-primary/50 transition-colors">
                  <CalendarIcon size={13} />
                  {rangeFrom ? format(rangeFrom, 'dd/MM/yyyy', { locale: ptBR }) : 'De'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={rangeFrom} onSelect={setRangeFrom} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">→</span>
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 px-4 py-2 rounded-full text-xs bg-card/40 backdrop-blur border border-border/60 text-foreground hover:border-primary/50 transition-colors">
                  <CalendarIcon size={13} />
                  {rangeTo ? format(rangeTo, 'dd/MM/yyyy', { locale: ptBR }) : 'Até'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={rangeTo} onSelect={setRangeTo} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Faturamento" value={fmt(revenue)} delta="+12%" deltaUp tone="primary" icon={DollarSign} sparkData={sparkRevenue} sparkColor="hsl(120,100%,50%)" />
        <KpiCard label="Lucro" value={fmt(profit)} delta={`${margin.toFixed(1)}%`} deltaUp={profit >= 0} tone={profit >= 0 ? 'primary' : 'danger'} icon={Activity} sparkData={sparkProfit} sparkColor={profit >= 0 ? 'hsl(120,100%,50%)' : 'hsl(0,84%,60%)'} />
        <KpiCard label="Gastos Estrutura" value={fmt(expenses)} delta="—" deltaUp={false} tone="warn" icon={TrendingDown} sparkData={sparkExpenses} sparkColor="hsl(0,84%,60%)" />
        <KpiCard label="Clientes Ativos" value={String(activeClients)} delta={`${clients.length} total`} deltaUp icon={Users} sparkData={[]} sparkColor="hsl(200,100%,55%)" tone="info" />
      </div>

      {/* MAIN CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PanelCard className="lg:col-span-2" title="Faturamento vs Gastos" subtitle="Últimos 7 dias" icon={BarChart3}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(120,100%,50%)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(120,100%,50%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(0,84%,60%)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(0,84%,60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(0,0%,15%)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'hsl(0,0%,55%)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(0,0%,55%)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtCompact} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => fmt(value)} />
                <Area type="monotone" dataKey="faturamento" stroke="hsl(120,100%,50%)" strokeWidth={2.5} fill="url(#colorRevenue)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                <Area type="monotone" dataKey="gastos" stroke="hsl(0,84%,60%)" strokeWidth={2} fill="url(#colorExpenses)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>

        <PanelCard title="Custos por Estrutura" subtitle={dateLabel} icon={Server}>
          {pieData.length > 0 ? (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value" stroke="none">
                      {pieData.map((_e, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => fmt(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-3">
                {pieData.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-muted-foreground">{p.name}</span>
                    </div>
                    <span className="font-mono text-foreground">{fmt(p.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">Nenhum gasto no período.</div>
          )}
        </PanelCard>
      </div>

      {/* MONTHLY */}
      <PanelCard title="Receitas vs Gastos" subtitle="Últimos 6 meses" icon={DollarSign}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(0,0%,15%)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'hsl(0,0%,55%)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(0,0%,55%)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtCompact} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => fmt(value)} cursor={{ fill: 'hsl(0,0%,12% / 0.4)' }} />
              <Bar dataKey="receitas" name="Receitas" fill="hsl(120,100%,50%)" radius={[6, 6, 0, 0]} maxBarSize={32} />
              <Bar dataKey="gastos" name="Gastos" fill="hsl(0,84%,60%)" radius={[6, 6, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </PanelCard>

      {/* STRUCTURE BREAKDOWN MINI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Perfil', value: perfilCosts, color: 'hsl(160,80%,45%)' },
          { label: 'BM Comum', value: bmComumCosts, color: 'hsl(120,100%,50%)' },
          { label: 'BM Verificada', value: bmVerifCosts, color: 'hsl(180,100%,50%)' },
          { label: 'BM Disparo', value: bmDisparoCosts, color: 'hsl(45,100%,55%)' },
          { label: 'Pagina', value: paginaCosts, color: 'hsl(200,100%,55%)' },
        ].map(item => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden bg-card/60 backdrop-blur border border-border/60 rounded-xl p-4 hover:border-primary/30 transition-all"
          >
            <div className="absolute top-0 left-0 h-full w-1" style={{ background: item.color, boxShadow: `0 0 12px ${item.color}` }} />
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">{item.label}</p>
            <p className="text-lg font-bold font-display tracking-tight">{fmt(item.value)}</p>
          </motion.div>
        ))}
      </div>

      {/* CLIENT PROFITS */}
      <PanelCard title="Lucro por Cliente" subtitle={`${clientProfits.length} clientes ativos no período`} icon={Users}>
        {clientProfits.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma transação encontrada para o período.</p>
        ) : (
          <>
            <div className="h-56 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clientProfits} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(0,0%,15%)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(0,0%,55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(0,0%,55%)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtCompact} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => fmt(value)} cursor={{ fill: 'hsl(0,0%,12% / 0.4)' }} />
                  <Bar dataKey="revenue" name="Receita" fill="hsl(120,100%,50%)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="expenses" name="Gastos" fill="hsl(0,84%,60%)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5">
              {clientProfits.map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-secondary/40 hover:bg-secondary/70 transition-colors rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-xs font-bold">
                      {c.name?.[0]?.toUpperCase() || '·'}
                    </div>
                    <span className="text-sm">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.profit >= 0 ? <ArrowUpRight size={14} className="text-primary" /> : <ArrowDownRight size={14} className="text-destructive" />}
                    <span className={`text-sm font-mono font-semibold ${c.profit >= 0 ? 'text-primary' : 'text-destructive'}`}>{fmt(c.profit)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </PanelCard>
    </div>
  );
};

/* ----------------- subcomponents ----------------- */

const KpiCard: React.FC<{
  label: string; value: string; delta?: string; deltaUp?: boolean;
  icon: any; sparkData: { v: number }[]; sparkColor: string;
  tone?: 'primary' | 'warn' | 'danger' | 'info';
}> = ({ label, value, delta, deltaUp, icon: Icon, sparkData, sparkColor, tone = 'primary' }) => {
  const toneRing =
    tone === 'primary' ? 'before:bg-primary/40' :
    tone === 'warn' ? 'before:bg-amber-500/40' :
    tone === 'danger' ? 'before:bg-destructive/40' :
    'before:bg-blue-500/40';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 hover:border-primary/40 transition-all group",
        "before:content-[''] before:absolute before:-top-px before:left-6 before:right-6 before:h-px",
        toneRing
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center',
          tone === 'primary' && 'bg-primary/10 text-primary',
          tone === 'warn' && 'bg-amber-500/10 text-amber-400',
          tone === 'danger' && 'bg-destructive/10 text-destructive',
          tone === 'info' && 'bg-blue-500/10 text-blue-400',
        )}>
          <Icon size={18} />
        </div>
        {delta && (
          <div className={`flex items-center gap-1 text-[11px] font-medium ${deltaUp ? 'text-primary' : 'text-destructive'}`}>
            {deltaUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {delta}
          </div>
        )}
      </div>
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-display font-bold tracking-tight text-foreground">{value}</p>

      {sparkData.length > 0 && (
        <div className="h-10 mt-3 -mx-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={1.8} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
};

const PanelCard: React.FC<{
  title: string; subtitle?: string; icon?: any;
  children: React.ReactNode; className?: string;
}> = ({ title, subtitle, icon: Icon, children, className }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    className={cn(
      'relative rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 hover:border-primary/30 transition-colors',
      className
    )}
  >
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Icon size={15} />
          </div>
        )}
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground tracking-wide">{title}</h3>
          {subtitle && <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
    {children}
  </motion.div>
);

export default Dashboard;
