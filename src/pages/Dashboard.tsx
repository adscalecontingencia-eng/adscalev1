import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Users, Server } from 'lucide-react';

type DateFilter = 'today' | '7days' | 'custom';

const Dashboard: React.FC = () => {
  const [dateFilter, setDateFilter] = useState<DateFilter>('7days');
  const [customMonth, setCustomMonth] = useState(new Date().getMonth());
  const [customYear, setCustomYear] = useState(new Date().getFullYear());

  const transactions = JSON.parse(localStorage.getItem('adscale_transactions') || '[]');
  const clients = JSON.parse(localStorage.getItem('adscale_clients') || '[]');

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter((t: any) => {
      const d = new Date(t.date);
      if (dateFilter === 'today') {
        return d.toDateString() === now.toDateString();
      } else if (dateFilter === '7days') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return d >= weekAgo;
      } else {
        return d.getMonth() === customMonth && d.getFullYear() === customYear;
      }
    });
  }, [transactions, dateFilter, customMonth, customYear]);

  const revenue = filteredTransactions.filter((t: any) => t.type === 'receita').reduce((s: number, t: any) => s + t.amount, 0);
  const expenses = filteredTransactions.filter((t: any) => t.type === 'gasto').reduce((s: number, t: any) => s + t.amount, 0);
  const profit = revenue - expenses;

  // Structure costs breakdown
  const structureCosts = filteredTransactions.filter((t: any) => t.type === 'gasto');
  const bmCosts = structureCosts.filter((t: any) => t.category === 'BMs').reduce((s: number, t: any) => s + t.amount, 0);
  const perfisCosts = structureCosts.filter((t: any) => t.category === 'Perfis').reduce((s: number, t: any) => s + t.amount, 0);
  const proxyCosts = structureCosts.filter((t: any) => t.category === 'Proxy').reduce((s: number, t: any) => s + t.amount, 0);
  const multiloginCosts = structureCosts.filter((t: any) => t.category === 'Multilogin').reduce((s: number, t: any) => s + t.amount, 0);

  // Per-client profit
  const clientProfits = clients.map((c: any) => {
    const cRevenue = filteredTransactions.filter((t: any) => t.clientId === c.id && t.type === 'receita').reduce((s: number, t: any) => s + t.amount, 0);
    const cExpenses = filteredTransactions.filter((t: any) => t.clientId === c.id && t.type === 'gasto').reduce((s: number, t: any) => s + t.amount, 0);
    return { name: c.companyName || c.name, profit: cRevenue - cExpenses, revenue: cRevenue };
  }).filter((c: any) => c.revenue > 0 || c.profit !== 0);

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const StatCard = ({ icon: Icon, label, value, trend }: { icon: any; label: string; value: string; trend?: 'up' | 'down' }) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-5 border-glow">
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon size={18} className="text-primary" />
        </div>
        {trend && (trend === 'up' ? <TrendingUp size={16} className="text-success" /> : <TrendingDown size={16} className="text-destructive" />)}
      </div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-bold font-display">{value}</p>
    </motion.div>
  );

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {(['today', '7days', 'custom'] as DateFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setDateFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm transition-all ${dateFilter === f ? 'bg-primary text-primary-foreground glow-box' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
          >
            {f === 'today' ? 'Hoje' : f === '7days' ? 'Últimos 7 dias' : 'Personalizado'}
          </button>
        ))}
        {dateFilter === 'custom' && (
          <div className="flex gap-2">
            <select value={customMonth} onChange={e => setCustomMonth(+e.target.value)} className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground">
              {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={customYear} onChange={e => setCustomYear(+e.target.value)} className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Faturamento" value={fmt(revenue)} trend="up" />
        <StatCard icon={BarChart3} label="Lucro" value={fmt(profit)} trend={profit >= 0 ? 'up' : 'down'} />
        <StatCard icon={TrendingDown} label="Gastos de Estrutura" value={fmt(expenses)} trend="down" />
        <StatCard icon={Users} label="Clientes Ativos" value={String(clients.length)} />
      </div>

      {/* Structure Breakdown */}
      <div className="bg-card border border-border rounded-xl p-5 border-glow">
        <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
          <Server size={16} className="text-primary" /> Custos por Estrutura
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "BM's", value: bmCosts },
            { label: 'Perfis', value: perfisCosts },
            { label: 'Proxy', value: proxyCosts },
            { label: 'Multilogin', value: multiloginCosts },
          ].map(item => (
            <div key={item.label} className="bg-secondary rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className="text-lg font-bold">{fmt(item.value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Per-client profit */}
      <div className="bg-card border border-border rounded-xl p-5 border-glow">
        <h3 className="font-display text-sm font-semibold mb-4">Lucro por Cliente</h3>
        {clientProfits.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma transação encontrada para o período.</p>
        ) : (
          <div className="space-y-2">
            {clientProfits.map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-secondary rounded-lg px-4 py-3">
                <span className="text-sm">{c.name}</span>
                <span className={`text-sm font-semibold ${c.profit >= 0 ? 'text-primary' : 'text-destructive'}`}>{fmt(c.profit)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
