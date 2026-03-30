import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, CreditCard, AlertTriangle, Shield, DollarSign, CalendarIcon, TrendingUp } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const ClientDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [customStart, setCustomStart] = useState<Date>(new Date());
  const [customEnd, setCustomEnd] = useState<Date>(new Date());

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.email) return;
      const { data: clientData } = await supabase.from('clients').select('*').eq('email', user.email).maybeSingle();
      if (clientData) {
        setClient(clientData);
        const { data: commData } = await supabase.from('commissions').select('*').eq('client_id', clientData.id).order('date', { ascending: false });
        setCommissions(commData || []);
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
      const d = new Date(c.date);
      return isWithinInterval(d, { start: range.start, end: range.end });
    });
  }, [commissions, periodFilter, customStart, customEnd]);

  // All-time totals
  const allTimeTotals = useMemo(() => {
    const daily = commissions.filter(c => c.type === 'daily');
    const paid = commissions.filter(c => c.type === 'paid');
    return {
      commission: daily.reduce((s, c) => s + Number(c.amount), 0),
      paid: paid.reduce((s, c) => s + Number(c.amount), 0),
      adSpend: daily.reduce((s, c) => s + Number((c as any).ad_spend || 0), 0),
    };
  }, [commissions]);

  // Period totals
  const periodTotals = useMemo(() => {
    const daily = filteredCommissions.filter(c => c.type === 'daily');
    const paid = filteredCommissions.filter(c => c.type === 'paid');
    return {
      commission: daily.reduce((s, c) => s + Number(c.amount), 0),
      paid: paid.reduce((s, c) => s + Number(c.amount), 0),
      adSpend: daily.reduce((s, c) => s + Number((c as any).ad_spend || 0), 0),
    };
  }, [filteredCommissions]);

  // Pending weekly billings (unpaid)
  const pendingBillings = useMemo(() => {
    return commissions.filter(c => c.type === 'weekly_billing' && (c as any).is_weekly_billing);
  }, [commissions]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground text-sm">Carregando...</p></div>;

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Cadastro de cliente não encontrado.</p>
      </div>
    );
  }

  const pendingTotal = allTimeTotals.commission - allTimeTotals.paid;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 lg:px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-sm font-bold text-primary glow-text">AD SCALE</h1>
          <p className="text-xs text-muted-foreground">Painel do Cliente</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{client.name}</span>
          <button onClick={async () => { await logout(); navigate('/login'); }} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">

        {/* Pending Billing Alerts */}
        {pendingBillings.length > 0 && (
          <div className="space-y-2">
            {pendingBillings.map(billing => (
              <div key={billing.id} className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-start gap-3 animate-pulse-slow">
                <AlertTriangle size={20} className="text-warning shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-warning">Cobrança Pendente</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {billing.note || 'Cobrança semanal'} — Valor: <strong className="text-warning">{fmt(Number(billing.amount))}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Período: {(billing as any).billing_week_start ? format(new Date((billing as any).billing_week_start), 'dd/MM', { locale: ptBR }) : ''} - {(billing as any).billing_week_end ? format(new Date((billing as any).billing_week_end), 'dd/MM', { locale: ptBR }) : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pending balance alert */}
        {pendingTotal > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle size={18} className="text-destructive" />
            <div>
              <p className="text-sm font-semibold text-destructive">Saldo pendente: {fmt(pendingTotal)}</p>
              <p className="text-xs text-muted-foreground">Total de comissões acumuladas menos pagamentos realizados.</p>
            </div>
          </div>
        )}

        {/* Contract */}
        <div className="bg-card border border-border rounded-xl p-5 border-glow">
          <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
            <CreditCard size={16} className="text-primary" /> Contrato
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Tipo de Pagamento</p>
              <p className="font-medium">{client.payment_type === 'fixed' ? 'Valor Fixo' : client.payment_type === 'percentage' ? '% sobre Gasto' : 'Fixo + %'}</p>
            </div>
            {(client.payment_type === 'fixed' || client.payment_type === 'both') && (
              <div>
                <p className="text-muted-foreground text-xs">Valor Fixo</p>
                <p className="font-medium text-primary">{fmt(Number(client.fixed_value) || 0)}</p>
              </div>
            )}
            {(client.payment_type === 'percentage' || client.payment_type === 'both') && (
              <div>
                <p className="text-muted-foreground text-xs">Percentual</p>
                <p className="font-medium text-primary">{client.percentage_value}%</p>
              </div>
            )}
            {client.observations && (
              <div className="sm:col-span-2">
                <p className="text-muted-foreground text-xs">Observações</p>
                <p className="text-sm mt-1">{client.observations}</p>
              </div>
            )}
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

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-secondary rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Gasto em Ads</p>
              <p className="text-lg font-bold text-foreground">{fmt(periodTotals.adSpend)}</p>
            </div>
            <div className="bg-secondary rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Comissão Agência</p>
              <p className="text-lg font-bold text-primary">{fmt(periodTotals.commission)}</p>
            </div>
            <div className="bg-secondary rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Pago no Período</p>
              <p className="text-lg font-bold text-success">{fmt(periodTotals.paid)}</p>
            </div>
          </div>
        </div>

        {/* Commission History */}
        {commissions.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 border-glow">
            <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
              <DollarSign size={16} className="text-primary" /> Histórico de Comissões
            </h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-secondary rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Gasto Total Ads</p>
                <p className="text-sm font-bold text-foreground">{fmt(allTimeTotals.adSpend)}</p>
              </div>
              <div className="bg-secondary rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Comissão Total</p>
                <p className="text-sm font-bold text-primary">{fmt(allTimeTotals.commission)}</p>
              </div>
              <div className="bg-secondary rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Pago</p>
                <p className="text-sm font-bold text-success">{fmt(allTimeTotals.paid)}</p>
              </div>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {commissions.map((comm: any) => (
                <div key={comm.id} className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-xs",
                  comm.type === 'weekly_billing' ? 'bg-warning/10 border border-warning/20' : 'bg-secondary'
                )}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`w-2 h-2 rounded-full ${comm.type === 'daily' ? 'bg-primary' : comm.type === 'paid' ? 'bg-success' : 'bg-warning'}`} />
                    <span className="text-muted-foreground">{format(new Date(comm.date), "dd/MM/yyyy", { locale: ptBR })}</span>
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
      </div>
    </div>
  );
};

export default ClientDashboard;
