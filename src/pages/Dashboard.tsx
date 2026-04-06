import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Users, Server, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDateLocal } from '@/lib/date-utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

type DateFilter = 'today' | '7days' | 'custom' | 'range';

const CHART_COLORS = ['hsl(120,100%,50%)', 'hsl(120,60%,45%)', 'hsl(45,100%,50%)', 'hsl(200,100%,50%)', 'hsl(0,84%,60%)'];

const Dashboard: React.FC = () => {
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
      const d = new Date(t.date);
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

  const structureCosts = filteredTransactions.filter((t: any) => t.type === 'gasto');
  const bmCosts = structureCosts.filter((t: any) => t.category === 'BMs').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const perfisCosts = structureCosts.filter((t: any) => t.category === 'Perfis').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const proxyCosts = structureCosts.filter((t: any) => t.category === 'Proxy').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const multiloginCosts = structureCosts.filter((t: any) => t.category === 'Multilogin').reduce((s: number, t: any) => s + Number(t.amount), 0);

  const pieData = [
    { name: "BM's", value: bmCosts },
    { name: 'Perfis', value: perfisCosts },
    { name: 'Proxy', value: proxyCosts },
    { name: 'Multilogin', value: multiloginCosts },
  ].filter(d => d.value > 0);

  const clientProfits = clients.map((c: any) => {
    const cRevenue = filteredTransactions.filter((t: any) => t.client_id === c.id && t.type === 'receita').reduce((s: number, t: any) => s + Number(t.amount), 0);
    const cExpenses = filteredTransactions.filter((t: any) => t.client_id === c.id && t.type === 'gasto').reduce((s: number, t: any) => s + Number(t.amount), 0);
    return { name: c.company_name || c.name, profit: cRevenue - cExpenses, revenue: cRevenue, expenses: cExpenses };
  }).filter((c: any) => c.revenue > 0 || c.profit !== 0);

  const dailyData = useMemo(() => {
    const days: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dayStr = d.toDateString();
      const dayRevenue = transactions.filter((t: any) => new Date(t.date).toDateString() === dayStr && t.type === 'receita').reduce((s: number, t: any) => s + Number(t.amount), 0);
      const dayExpenses = transactions.filter((t: any) => new Date(t.date).toDateString() === dayStr && t.type === 'gasto').reduce((s: number, t: any) => s + Number(t.amount), 0);
      days.push({ date: format(d, 'dd/MM', { locale: ptBR }), faturamento: dayRevenue, gastos: dayExpenses });
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
      const monthRevenue = transactions.filter((t: any) => { const td = new Date(t.date); return td.getMonth() === month && td.getFullYear() === year && t.type === 'receita'; }).reduce((s: number, t: any) => s + Number(t.amount), 0);
      const monthExpenses = transactions.filter((t: any) => { const td = new Date(t.date); return td.getMonth() === month && td.getFullYear() === year && t.type === 'gasto'; }).reduce((s: number, t: any) => s + Number(t.amount), 0);
      months.push({ date: format(d, 'MMM/yy', { locale: ptBR }), receitas: monthRevenue, gastos: monthExpenses, lucro: monthRevenue - monthExpenses });
    }
    return months;
  }, [transactions]);

  const fmt = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const StatCard = ({ icon: Icon, label, value, trend, color }: { icon: any; label: string; value: string; trend?: 'up' | 'down'; color?: string }) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-4 sm:p-5 border-glow hover:glow-box transition-shadow duration-300">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${color || 'bg-primary/10'}`}><Icon size={20} className={color ? 'text-foreground' : 'text-primary'} /></div>
        {trend && (trend === 'up' ? <TrendingUp size={18} className="text-success" /> : <TrendingDown size={18} className="text-destructive" />)}
      </div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg sm:text-xl font-bold font-display tracking-tight">{value}</p>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 items-center">
        {(['today', '7days', 'custom', 'range'] as DateFilter[]).map(f => (
          <button key={f} onClick={() => setDateFilter(f)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${dateFilter === f ? 'bg-primary text-primary-foreground glow-box' : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'}`}>
            {f === 'today' ? 'Hoje' : f === '7days' ? 'Últimos 7 dias' : f === 'custom' ? 'Data específica' : 'Período'}
          </button>
        ))}
        {dateFilter === 'custom' && (
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-secondary border border-border text-foreground hover:border-primary transition-colors")}>
                <CalendarIcon size={14} />
                {customDate ? format(customDate, "dd 'de' MMMM, yyyy", { locale: ptBR }) : 'Selecionar data'}
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
                <button className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-secondary border border-border text-foreground hover:border-primary transition-colors")}>
                  <CalendarIcon size={14} />
                  {rangeFrom ? format(rangeFrom, "dd/MM/yyyy", { locale: ptBR }) : 'De'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={rangeFrom} onSelect={setRangeFrom} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-sm text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-secondary border border-border text-foreground hover:border-primary transition-colors")}>
                  <CalendarIcon size={14} />
                  {rangeTo ? format(rangeTo, "dd/MM/yyyy", { locale: ptBR }) : 'Até'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={rangeTo} onSelect={setRangeTo} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={DollarSign} label="Faturamento" value={fmt(revenue)} trend="up" />
        <StatCard icon={BarChart3} label="Lucro" value={fmt(profit)} trend={profit >= 0 ? 'up' : 'down'} />
        <StatCard icon={TrendingDown} label="Gastos Estrutura" value={fmt(expenses)} trend="down" />
        <StatCard icon={Users} label="Clientes Ativos" value={String(activeClients)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-xl p-5 border-glow">
          <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-primary" /> Faturamento vs Gastos (7 dias)
          </h3>
          <div className="h-52 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(120,100%,50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(120,100%,50%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0,84%,60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(0,84%,60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,15%)" />
                <XAxis dataKey="date" tick={{ fill: 'hsl(0,0%,55%)', fontSize: 12 }} axisLine={false} />
                <YAxis tick={{ fill: 'hsl(0,0%,55%)', fontSize: 12 }} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(0,0%,7%)', border: '1px solid hsl(0,0%,15%)', borderRadius: '8px', color: 'hsl(0,0%,95%)' }} formatter={(value: number) => fmt(value)} />
                <Area type="monotone" dataKey="faturamento" stroke="hsl(120,100%,50%)" fill="url(#colorRevenue)" strokeWidth={2} />
                <Area type="monotone" dataKey="gastos" stroke="hsl(0,84%,60%)" fill="url(#colorExpenses)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-xl p-5 border-glow">
          <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
            <Server size={16} className="text-primary" /> Custos por Estrutura
          </h3>
          {pieData.length > 0 ? (
            <div className="h-52 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_entry, index) => (<Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(0,0%,7%)', border: '1px solid hsl(0,0%,15%)', borderRadius: '8px', color: 'hsl(0,0%,95%)' }} formatter={(value: number) => fmt(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 sm:h-64 flex items-center justify-center"><p className="text-sm text-muted-foreground">Nenhum gasto no período.</p></div>
          )}
        </motion.div>
      </div>

      {/* Monthly Revenue vs Expenses Chart */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card border border-border rounded-xl p-5 border-glow">
        <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
          <DollarSign size={16} className="text-primary" /> Receitas vs Gastos (últimos 6 meses)
        </h3>
        <div className="h-52 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,15%)" />
              <XAxis dataKey="date" tick={{ fill: 'hsl(0,0%,55%)', fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: 'hsl(0,0%,55%)', fontSize: 12 }} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(0,0%,7%)', border: '1px solid hsl(0,0%,15%)', borderRadius: '8px', color: 'hsl(0,0%,95%)' }} formatter={(value: number) => fmt(value)} />
              <Bar dataKey="receitas" name="Receitas" fill="hsl(120,100%,50%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos" name="Gastos" fill="hsl(0,84%,60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "BM's", value: bmCosts }, { label: 'Perfis', value: perfisCosts },
          { label: 'Proxy', value: proxyCosts }, { label: 'Multilogin', value: multiloginCosts },
        ].map(item => (
          <motion.div key={item.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border rounded-xl p-4 hover:border-glow transition-all">
            <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
            <p className="text-lg font-bold font-display">{fmt(item.value)}</p>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card border border-border rounded-xl p-5 border-glow">
        <h3 className="font-display text-sm font-semibold mb-4">Lucro por Cliente</h3>
        {clientProfits.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma transação encontrada para o período.</p>
        ) : (
          <>
            <div className="h-48 sm:h-64 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clientProfits}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,15%)" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(0,0%,55%)', fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: 'hsl(0,0%,55%)', fontSize: 12 }} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(0,0%,7%)', border: '1px solid hsl(0,0%,15%)', borderRadius: '8px', color: 'hsl(0,0%,95%)' }} formatter={(value: number) => fmt(value)} />
                  <Bar dataKey="revenue" name="Receita" fill="hsl(120,100%,50%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Gastos" fill="hsl(0,84%,60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {clientProfits.map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-secondary rounded-lg px-4 py-3">
                  <span className="text-sm">{c.name}</span>
                  <span className={`text-sm font-semibold ${c.profit >= 0 ? 'text-primary' : 'text-destructive'}`}>{fmt(c.profit)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default Dashboard;
