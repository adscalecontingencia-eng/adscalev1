import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Users, Server, CalendarIcon, Activity, Sparkles, ArrowUpRight, ArrowDownRight, Download, RefreshCw } from 'lucide-react';
import ExcelJS from 'exceljs';
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
import { syncAutoCommissions } from '@/lib/auto-commissions';
import { toast } from 'sonner';

type DateFilter = 'today' | '7days' | 'month' | 'custom' | 'range';
type ClientTypeFilter = 'geral' | 'aluguel' | 'venda';
type Currency = 'USD' | 'BRL';
const CHART_COLORS = ['hsl(120,100%,50%)', 'hsl(160,80%,45%)', 'hsl(45,100%,55%)', 'hsl(200,100%,55%)', 'hsl(280,80%,60%)'];

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [dateFilter, setDateFilter] = useState<DateFilter>('7days');
  const [clientTypeFilter, setClientTypeFilter] = useState<ClientTypeFilter>('geral');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [usdToBrl, setUsdToBrl] = useState<number>(5.0);
  const [customDate, setCustomDate] = useState<Date | undefined>(new Date());
  const [rangeFrom, setRangeFrom] = useState<Date | undefined>(undefined);
  const [rangeTo, setRangeTo] = useState<Date | undefined>(undefined);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [adAccounts, setAdAccounts] = useState<any[]>([]);

  // Cotação USD → BRL (atualiza ao montar e quando o usuário troca para BRL)
  useEffect(() => {
    const fetchRate = async () => {
      try {
        const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL');
        const json = await res.json();
        const bid = parseFloat(json?.USDBRL?.bid);
        if (!isNaN(bid) && bid > 0) setUsdToBrl(bid);
      } catch { /* mantém fallback */ }
    };
    fetchRate();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const [txRes, clientRes, accRes] = await Promise.all([
        supabase.from('transactions').select('*'),
        supabase.from('clients').select('*'),
        supabase.from('meta_ad_accounts').select('id,status,account_status'),
      ]);
      if (txRes.data) setTransactions(txRes.data);
      if (clientRes.data) setClients(clientRes.data);
      if (accRes.data) setAdAccounts(accRes.data);
    };
    fetchData();
    // Auto-sync pending commissions from synced ad spend (silent on mount)
    syncAutoCommissions().catch(() => { /* silent */ });
  }, []);

  const [syncing, setSyncing] = useState(false);
  const handleManualSync = async () => {
    setSyncing(true);
    const r = await syncAutoCommissions();
    setSyncing(false);
    if (r.errors > 0) toast.error('Erro ao sincronizar comissões');
    else if (r.inserted > 0) toast.success(`${r.inserted} comissão(ões) pendente(s) gerada(s) a partir dos gastos`);
    else toast.info('Comissões já estão sincronizadas');
  };

  // Mapa client_id → client_type para filtrar transações por tipo de cliente
  const clientTypeMap = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach((c: any) => m.set(c.id, (c.client_type as string) || 'aluguel'));
    return m;
  }, [clients]);

  const matchesClientType = (t: any) => {
    if (clientTypeFilter === 'geral') return true;
    if (!t.client_id) return false;
    return clientTypeMap.get(t.client_id) === clientTypeFilter;
  };

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter((t: any) => {
      if (!matchesClientType(t)) return false;
      const d = parseDateLocal(t.date);
      if (dateFilter === 'today') return d.toDateString() === now.toDateString();
      if (dateFilter === '7days') return d >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (dateFilter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (dateFilter === 'custom' && customDate) return d.getMonth() === customDate.getMonth() && d.getFullYear() === customDate.getFullYear() && d.getDate() === customDate.getDate();
      if (dateFilter === 'range') {
        if (rangeFrom && rangeTo) { const from = new Date(rangeFrom); from.setHours(0,0,0,0); const to = new Date(rangeTo); to.setHours(23,59,59,999); return d >= from && d <= to; }
        if (rangeFrom) { const from = new Date(rangeFrom); from.setHours(0,0,0,0); return d >= from; }
      }
      return true;
    });
  }, [transactions, dateFilter, customDate, rangeFrom, rangeTo, clientTypeFilter, clientTypeMap]);

  const revenue = filteredTransactions.filter((t: any) => t.type === 'receita').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const expenses = filteredTransactions.filter((t: any) => t.type === 'gasto').reduce((s: number, t: any) => s + Number(t.amount), 0);

  // Custo de Produtos = custo_produto lançado nas VENDAS (receitas).
  // Não somamos o custo dos gastos de estrutura aqui porque, nesses lançamentos,
  // amount === custo_produto (já está contabilizado em "expenses").
  const productCost = filteredTransactions
    .filter((t: any) => t.type === 'receita')
    .reduce((s: number, t: any) => s + (Number(t.custo_produto) || 0), 0);

  // Ticket Médio = faturamento médio por venda (transação tipo receita)
  const salesCount = filteredTransactions.filter((t: any) => t.type === 'receita').length;
  const avgTicket = salesCount > 0 ? revenue / salesCount : 0;

  const activeClients = clients.filter((c: any) => (c.ad_accounts || 0) > 0).length;
  const activeAccounts = adAccounts.filter((a: any) => a.account_status === 1).length;
  const profit = revenue - expenses - productCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const structureCosts = filteredTransactions.filter((t: any) => t.type === 'gasto');
  // Valor líquido por produto = receitas da categoria - (gastos de estrutura + custo do produto) da categoria
  const netByCategory = (cat: string) => {
    const catTx = filteredTransactions.filter((t: any) => t.category === cat);
    const rev = catTx.filter((t: any) => t.type === 'receita').reduce((s: number, t: any) => s + Number(t.amount), 0);
    const exp = catTx.filter((t: any) => t.type === 'gasto').reduce((s: number, t: any) => s + Number(t.amount), 0);
    const pCost = catTx.filter((t: any) => t.type === 'receita').reduce((s: number, t: any) => s + (Number(t.custo_produto) || 0), 0);
    return rev - exp - pCost;
  };
  const perfilCosts = structureCosts.filter((t: any) => t.category === 'Perfil').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const bmComumCosts = structureCosts.filter((t: any) => t.category === 'BM Comum').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const bmVerifCosts = structureCosts.filter((t: any) => t.category === 'BM Verificada').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const bmApiCosts = structureCosts.filter((t: any) => t.category === 'BM API').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const bmDisparoCosts = structureCosts.filter((t: any) => t.category === 'BM Disparo').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const paginaCosts = structureCosts.filter((t: any) => t.category === 'Pagina').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const perfilNet = netByCategory('Perfil');
  const bmComumNet = netByCategory('BM Comum');
  const bmVerifNet = netByCategory('BM Verificada');
  const bmApiNet = netByCategory('BM API');
  const bmDisparoNet = netByCategory('BM Disparo');
  const paginaNet = netByCategory('Pagina');

  const pieData = [
    { name: 'Perfil', value: perfilCosts },
    { name: 'BM Comum', value: bmComumCosts },
    { name: 'BM Verificada', value: bmVerifCosts },
    { name: 'BM API', value: bmApiCosts },
    { name: 'BM Disparo', value: bmDisparoCosts },
    { name: 'Pagina', value: paginaCosts },
  ].filter(d => d.value > 0);

  const buildClientProfits = (typeFilter: 'aluguel' | 'venda') => clients
    .filter((c: any) => ((c.client_type as string) || 'aluguel') === typeFilter)
    .map((c: any) => {
      const cTx = filteredTransactions.filter((t: any) => t.client_id === c.id);
      const cRevenue = cTx.filter((t: any) => t.type === 'receita').reduce((s: number, t: any) => s + Number(t.amount), 0);
      const cStructure = cTx.filter((t: any) => t.type === 'gasto').reduce((s: number, t: any) => s + Number(t.amount), 0);
      const cProductCost = cTx.filter((t: any) => t.type === 'receita').reduce((s: number, t: any) => s + (Number(t.custo_produto) || 0), 0);
      const cExpenses = cStructure + cProductCost;
      return { name: c.company_name || c.name, profit: cRevenue - cExpenses, revenue: cRevenue, expenses: cExpenses };
    })
    .filter((c: any) => c.revenue > 0 || c.expenses > 0);

  const clientProfitsAluguel = useMemo(() => buildClientProfits('aluguel'), [clients, filteredTransactions]);
  const clientProfitsVenda = useMemo(() => buildClientProfits('venda'), [clients, filteredTransactions]);
  const clientProfits = [...clientProfitsAluguel, ...clientProfitsVenda];

  // Para os gráficos temporais (diário/mensal) também respeitamos o filtro de tipo de cliente
  const baseTimeTransactions = useMemo(
    () => transactions.filter((t: any) => matchesClientType(t)),
    [transactions, clientTypeFilter, clientTypeMap],
  );

  const dailyData = useMemo(() => {
    const days: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dayStr = d.toDateString();
      const dayTx = baseTimeTransactions.filter((t: any) => parseDateLocal(t.date).toDateString() === dayStr);
      const dayRevenue = dayTx.filter((t: any) => t.type === 'receita').reduce((s: number, t: any) => s + Number(t.amount), 0);
      const dayStructure = dayTx.filter((t: any) => t.type === 'gasto').reduce((s: number, t: any) => s + Number(t.amount), 0);
      const dayProductCost = dayTx.filter((t: any) => t.type === 'receita').reduce((s: number, t: any) => s + (Number(t.custo_produto) || 0), 0);
      const dayExpenses = dayStructure + dayProductCost;
      days.push({ date: format(d, 'dd/MM', { locale: ptBR }), faturamento: dayRevenue, gastos: dayExpenses, lucro: dayRevenue - dayExpenses });
    }
    return days;
  }, [baseTimeTransactions]);

  const monthlyData = useMemo(() => {
    const months: any[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.getMonth();
      const year = d.getFullYear();
      const monthTx = baseTimeTransactions.filter((t: any) => { const td = parseDateLocal(t.date); return td.getMonth() === month && td.getFullYear() === year; });
      const monthRevenue = monthTx.filter((t: any) => t.type === 'receita').reduce((s: number, t: any) => s + Number(t.amount), 0);
      const monthStructure = monthTx.filter((t: any) => t.type === 'gasto').reduce((s: number, t: any) => s + Number(t.amount), 0);
      const monthProductCost = monthTx.filter((t: any) => t.type === 'receita').reduce((s: number, t: any) => s + (Number(t.custo_produto) || 0), 0);
      const monthExpenses = monthStructure + monthProductCost;
      months.push({ date: format(d, 'MMM/yy', { locale: ptBR }), receitas: monthRevenue, gastos: monthExpenses, lucro: monthRevenue - monthExpenses });
    }
    return months;
  }, [baseTimeTransactions]);

  // Conversão de moeda — todas as somas no banco são em USD
  const conv = (v: number) => currency === 'BRL' ? v * usdToBrl : v;
  const fmt = (v: number) => {
    const n = conv(v);
    return currency === 'BRL'
      ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };
  const fmtCompact = (v: number) => {
    const n = conv(v);
    const symbol = currency === 'BRL' ? 'R$' : '$';
    return `${symbol}${Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + 'k' : n.toFixed(0)}`;
  };

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

  // ============ EXPORTAR DASHBOARD PARA EXCEL ============
  const handleExportExcel = async () => {
    const sym = currency;
    const v = (n: number) => Number(conv(n).toFixed(2));
    const tipoLabel = clientTypeFilter === 'geral' ? 'Geral' : clientTypeFilter === 'aluguel' ? 'Aluguel' : 'Vendas';

    const wb = new ExcelJS.Workbook();
    wb.creator = 'AD SCALE';
    wb.created = new Date();

    const addSheet = (name: string, rows: any[][], widths: number[]) => {
      const ws = wb.addWorksheet(name);
      ws.columns = widths.map(w => ({ width: w }));
      rows.forEach(r => ws.addRow(r));
      // Header style on row 1 of data tables (skip Resumo special layout)
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FF0F0F0F' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF39FF14' } };
    };

    // 1) Resumo / KPIs
    const wsResumo = wb.addWorksheet('Resumo');
    wsResumo.columns = [{ width: 28 }, { width: 26 }];
    [
      ['AD SCALE — Dashboard'],
      ['Gerado em', format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })],
      ['Período', dateLabel],
      ['Tipo de cliente', tipoLabel],
      ['Moeda', sym + (sym === 'BRL' ? ` (cotação R$ ${usdToBrl.toFixed(4)})` : '')],
      [],
      ['Indicador', `Valor (${sym})`],
      ['Faturamento', v(revenue)],
      ['Gastos Estrutura', v(expenses)],
      ['Custo de Produtos', v(productCost)],
      ['Lucro', v(profit)],
      ['Margem (%)', Number(margin.toFixed(2))],
      ['Ticket Médio', v(avgTicket)],
      ['Vendas (qtd)', salesCount],
      ['Clientes Ativos', activeClients],
      ['Clientes Totais', clients.length],
    ].forEach(r => wsResumo.addRow(r));
    wsResumo.getRow(1).font = { bold: true, size: 14 };
    wsResumo.getRow(7).font = { bold: true, color: { argb: 'FF0F0F0F' } };
    wsResumo.getRow(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF39FF14' } };

    // 2) Diário
    addSheet('Diario', [
      ['Data', `Faturamento (${sym})`, `Gastos (${sym})`, `Lucro (${sym})`],
      ...dailyData.map(d => [d.date, v(d.faturamento), v(d.gastos), v(d.lucro)]),
    ], [12, 18, 18, 18]);

    // 3) Mensal
    addSheet('Mensal', [
      ['Mês', `Receitas (${sym})`, `Gastos (${sym})`, `Lucro (${sym})`],
      ...monthlyData.map(m => [m.date, v(m.receitas), v(m.gastos), v(m.lucro)]),
    ], [12, 18, 18, 18]);

    // 4) Custos por Estrutura
    const totalEstrutura = pieData.reduce((s, p) => s + p.value, 0);
    addSheet('Custos Estrutura', [
      ['Estrutura', `Custo (${sym})`, '% do total'],
      ...pieData.map(p => [
        p.name,
        v(p.value),
        totalEstrutura > 0 ? Number(((p.value / totalEstrutura) * 100).toFixed(2)) : 0,
      ]),
      ['Total', v(totalEstrutura), 100],
    ], [22, 18, 14]);

    // 5) Clientes Aluguel
    addSheet('Clientes Aluguel', [
      ['Cliente', `Faturamento (${sym})`, `Gastos (${sym})`, `Lucro (${sym})`],
      ...clientProfitsAluguel.map(c => [c.name, v(c.revenue), v(c.expenses), v(c.profit)]),
    ], [30, 18, 18, 18]);

    // 6) Clientes Vendas
    addSheet('Clientes Vendas', [
      ['Cliente', `Faturamento (${sym})`, `Gastos (${sym})`, `Lucro (${sym})`],
      ...clientProfitsVenda.map(c => [c.name, v(c.revenue), v(c.expenses), v(c.profit)]),
    ], [30, 18, 18, 18]);

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adscale-dashboard-${tipoLabel.toLowerCase()}-${sym}-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const dateLabel =
    dateFilter === 'today' ? 'Hoje'
    : dateFilter === '7days' ? 'Últimos 7 dias'
    : dateFilter === 'month' ? 'Esse Mês'
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
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium bg-card/40 backdrop-blur border border-primary/40 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
              title="Gerar comissões pendentes a partir dos gastos sincronizados"
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Sincronizando...' : 'Sincronizar Comissões'}
            </button>
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
        {(['today', '7days', 'month', 'custom', 'range'] as DateFilter[]).map(f => (
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
            {f === 'today' ? 'Hoje' : f === '7days' ? 'Últimos 7 dias' : f === 'month' ? 'Esse Mês' : f === 'custom' ? 'Data específica' : 'Período'}
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

      {/* CLIENT TYPE + CURRENCY TOGGLES */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mr-1">Tipo:</span>
          {(['geral', 'aluguel', 'venda'] as ClientTypeFilter[]).map(t => (
            <button
              key={t}
              onClick={() => setClientTypeFilter(t)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border',
                clientTypeFilter === t
                  ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_16px_hsl(var(--primary)/0.35)]'
                  : 'bg-card/40 backdrop-blur text-muted-foreground border-border/60 hover:text-foreground hover:border-primary/40'
              )}
            >
              {t === 'geral' ? 'Geral' : t === 'aluguel' ? 'Aluguel' : 'Vendas'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Moeda:</span>
          <div className="flex rounded-full border border-border/60 bg-card/40 backdrop-blur p-0.5">
            {(['USD', 'BRL'] as Currency[]).map(c => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold transition-all',
                  currency === c ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {c}
              </button>
            ))}
          </div>
          {currency === 'BRL' && (
            <span className="text-[10px] text-muted-foreground font-mono">@ R${usdToBrl.toFixed(2)}</span>
          )}
          <button
            onClick={handleExportExcel}
            translate="no"
            className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-[0_0_16px_hsl(var(--primary)/0.25)]"
            title="Exportar gráficos para Excel"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar Excel
          </button>
        </div>
      </div>
      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
        <KpiCard label="Faturamento" value={fmt(revenue)} delta="+12%" deltaUp tone="primary" icon={DollarSign} sparkData={sparkRevenue} sparkColor="hsl(120,100%,50%)" />
        <KpiCard label="Lucro" value={fmt(profit)} delta={`${margin.toFixed(1)}%`} deltaUp={profit >= 0} tone={profit >= 0 ? 'primary' : 'danger'} icon={Activity} sparkData={sparkProfit} sparkColor={profit >= 0 ? 'hsl(120,100%,50%)' : 'hsl(0,84%,60%)'} />
        <KpiCard label="Gastos Estrutura" value={fmt(expenses)} delta="—" deltaUp={false} tone="warn" icon={TrendingDown} sparkData={sparkExpenses} sparkColor="hsl(0,84%,60%)" />
        <KpiCard label="Custo de Produtos" value={fmt(productCost)} delta="—" deltaUp={false} tone="danger" icon={TrendingDown} sparkData={[]} sparkColor="hsl(0,84%,60%)" />
        <KpiCard label="Ticket Médio" value={fmt(avgTicket)} delta={`${salesCount} vendas`} deltaUp tone="info" icon={BarChart3} sparkData={[]} sparkColor="hsl(200,100%,55%)" />
        <KpiCard label="Clientes Ativos" value={String(activeClients)} delta={`${clients.length} total`} deltaUp icon={Users} sparkData={[]} sparkColor="hsl(200,100%,55%)" tone="info" />
        <KpiCard label="Contas Ativas" value={String(activeAccounts)} delta={`${adAccounts.length} total`} deltaUp tone="primary" icon={Server} sparkData={[]} sparkColor="hsl(120,100%,50%)" />
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
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: 'Perfil', value: perfilNet, color: 'hsl(160,80%,45%)' },
          { label: 'BM Comum', value: bmComumNet, color: 'hsl(120,100%,50%)' },
          { label: 'BM Verificada', value: bmVerifNet, color: 'hsl(180,100%,50%)' },
          { label: 'BM API', value: bmApiNet, color: 'hsl(280,80%,60%)' },
          { label: 'BM Disparo', value: bmDisparoNet, color: 'hsl(45,100%,55%)' },
          { label: 'Pagina', value: paginaNet, color: 'hsl(200,100%,55%)' },
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

      {/* CLIENT PROFITS — split by client_type */}
      <PanelCard title="Lucro por Cliente" subtitle={`${clientProfitsAluguel.length} aluguel · ${clientProfitsVenda.length} vendas`} icon={Users}>
        <Tabs defaultValue="aluguel" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="aluguel">Clientes Aluguel ({clientProfitsAluguel.length})</TabsTrigger>
            <TabsTrigger value="venda">Clientes Vendas ({clientProfitsVenda.length})</TabsTrigger>
          </TabsList>

          {(['aluguel', 'venda'] as const).map(tab => {
            const data = tab === 'aluguel' ? clientProfitsAluguel : clientProfitsVenda;
            const totalRevenue = data.reduce((s, c) => s + c.revenue, 0);
            const totalExpenses = data.reduce((s, c) => s + c.expenses, 0);
            const totalProfit = totalRevenue - totalExpenses;
            return (
              <TabsContent key={tab} value={tab} className="mt-0">
                {data.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Nenhuma transação encontrada para clientes de {tab === 'aluguel' ? 'aluguel' : 'venda'} no período.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="bg-secondary/40 rounded-lg px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Faturamento</p>
                        <p className="text-sm font-mono font-bold text-primary">{fmt(totalRevenue)}</p>
                      </div>
                      <div className="bg-secondary/40 rounded-lg px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Custo</p>
                        <p className="text-sm font-mono font-bold text-destructive">{fmt(totalExpenses)}</p>
                      </div>
                      <div className="bg-secondary/40 rounded-lg px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Lucro</p>
                        <p className={`text-sm font-mono font-bold ${totalProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>{fmt(totalProfit)}</p>
                      </div>
                    </div>
                    <div className="h-56 mb-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="2 4" stroke="hsl(0,0%,15%)" vertical={false} />
                          <XAxis dataKey="name" tick={{ fill: 'hsl(0,0%,55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: 'hsl(0,0%,55%)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmtCompact} />
                          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => fmt(value)} cursor={{ fill: 'hsl(0,0%,12% / 0.4)' }} />
                          <Bar dataKey="revenue" name="Faturamento" fill="hsl(120,100%,50%)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                          <Bar dataKey="expenses" name="Custo" fill="hsl(0,84%,60%)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-1.5">
                      {data.map((c: any, i: number) => (
                        <div key={i} className="flex items-center justify-between bg-secondary/40 hover:bg-secondary/70 transition-colors rounded-lg px-4 py-2.5">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                              {c.name?.[0]?.toUpperCase() || '·'}
                            </div>
                            <span className="text-sm truncate">{c.name}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs font-mono">
                            <span className="text-primary">{fmt(c.revenue)}</span>
                            <span className="text-destructive">−{fmt(c.expenses)}</span>
                            <span className="text-muted-foreground">=</span>
                            <span className={`font-semibold ${c.profit >= 0 ? 'text-primary' : 'text-destructive'} flex items-center gap-1`}>
                              {c.profit >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                              {fmt(c.profit)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
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
