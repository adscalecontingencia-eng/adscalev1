import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, CreditCard, AlertTriangle, BarChart3, Shield, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ClientDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'week' | 'month'>('week');

  const clients = JSON.parse(localStorage.getItem('adscale_clients') || '[]');
  const client = clients.find((c: any) => c.email === user?.email);
  const transactions = JSON.parse(localStorage.getItem('adscale_transactions') || '[]');
  const commissions = JSON.parse(localStorage.getItem('adscale_commissions') || '[]');
  const clientCommissions = commissions.filter((c: any) => c.clientId === client?.id);
  // Daily percentage entries for this client
  const clientEntries = JSON.parse(localStorage.getItem(`adscale_client_entries_${client?.id}`) || '[]');

  const now = new Date();
  const isFriday = now.getDay() === 5;

  // Calculate weekly percentage total
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
  const weekEntries = clientEntries.filter((e: any) => new Date(e.date) >= weekStart);
  const weeklyPercentageTotal = weekEntries.reduce((s: number, e: any) => s + (e.spend * (client?.percentageValue || 0) / 100), 0);

  // Ad account stats
  const filteredEntries = useMemo(() => {
    if (!client) return [];
    const cutoff = new Date();
    if (filter === 'week') cutoff.setDate(cutoff.getDate() - 7);
    else cutoff.setMonth(cutoff.getMonth() - 1);
    return clientEntries.filter((e: any) => new Date(e.date) >= cutoff);
  }, [clientEntries, filter, client]);

  const fmt = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Cadastro de cliente não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-4 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-display text-sm font-bold text-primary glow-text">AD SCALE</h1>
            <h1 className="font-display text-sm font-bold text-primary glow-text">AD SCALE</h1>
            <p className="text-xs text-muted-foreground">Painel do Cliente</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{client.name}</span>
          <button onClick={() => { logout(); navigate('/login'); }} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
        {/* Friday Alert */}
        {isFriday && client.paymentType !== 'fixed' && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle size={20} className="text-warning" />
            <div>
              <p className="text-sm font-semibold text-warning">Pagamento Semanal</p>
              <p className="text-xs text-muted-foreground">Valor da comissão desta semana: <strong className="text-foreground">{fmt(weeklyPercentageTotal)}</strong></p>
            </div>
          </motion.div>
        )}

        {/* Contract Details */}
        <div className="bg-card border border-border rounded-xl p-5 border-glow">
          <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
            <CreditCard size={16} className="text-primary" /> Contrato
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Tipo de Pagamento</p>
              <p className="font-medium">{client.paymentType === 'fixed' ? 'Valor Fixo' : client.paymentType === 'percentage' ? '% sobre Gasto' : 'Fixo + %'}</p>
            </div>
            {(client.paymentType === 'fixed' || client.paymentType === 'both') && (
              <div>
                <p className="text-muted-foreground text-xs">Valor Fixo</p>
                <p className="font-medium text-primary">{fmt(client.fixedValue || 0)}</p>
              </div>
            )}
            {(client.paymentType === 'percentage' || client.paymentType === 'both') && (
              <div>
                <p className="text-muted-foreground text-xs">Percentual</p>
                <p className="font-medium text-primary">{client.percentageValue}%</p>
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

        {/* Daily % Calculation */}
        {(client.paymentType === 'percentage' || client.paymentType === 'both') && (
          <div className="bg-card border border-border rounded-xl p-5 border-glow">
            <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
              <BarChart3 size={16} className="text-primary" /> Cálculo Diário de %
            </h3>
            {weekEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum lançamento esta semana.</p>
            ) : (
              <div className="space-y-2">
                {weekEntries.map((e: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-secondary rounded-lg px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">{new Date(e.date).toLocaleDateString('pt-BR')}</span>
                    <span className="text-xs">Gasto: {fmt(e.spend)}</span>
                    <span className="text-xs text-primary font-semibold">{client.percentageValue}% = {fmt(e.spend * client.percentageValue / 100)}</span>
                  </div>
                ))}
                <div className="flex justify-between bg-primary/10 rounded-lg px-4 py-3 mt-2">
                  <span className="text-sm font-semibold">Total Semanal</span>
                  <span className="text-sm font-bold text-primary">{fmt(weeklyPercentageTotal)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Commissions History */}
        {clientCommissions.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 border-glow">
            <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
              <DollarSign size={16} className="text-primary" /> Histórico de Comissões
            </h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-secondary rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Acumulado</p>
                <p className="text-sm font-bold text-primary">{fmt(clientCommissions.filter((c: any) => c.type === 'daily').reduce((s: number, c: any) => s + c.amount, 0))}</p>
              </div>
              <div className="bg-secondary rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Pago</p>
                <p className="text-sm font-bold text-success">{fmt(clientCommissions.filter((c: any) => c.type === 'paid').reduce((s: number, c: any) => s + c.amount, 0))}</p>
              </div>
              <div className="bg-secondary rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Pendente</p>
                <p className="text-sm font-bold text-warning">{fmt(clientCommissions.filter((c: any) => c.type === 'daily').reduce((s: number, c: any) => s + c.amount, 0) - clientCommissions.filter((c: any) => c.type === 'paid').reduce((s: number, c: any) => s + c.amount, 0))}</p>
              </div>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {clientCommissions.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((comm: any) => (
                <div key={comm.id} className="flex items-center justify-between bg-secondary rounded-lg px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${comm.type === 'daily' ? 'bg-primary' : 'bg-success'}`} />
                    <span className="text-muted-foreground">{format(new Date(comm.date), "dd/MM/yyyy", { locale: ptBR })}</span>
                    <span className="text-muted-foreground">{comm.type === 'daily' ? 'Comissão' : 'Pagamento'}</span>
                    {comm.note && <span className="text-muted-foreground italic">- {comm.note}</span>}
                  </div>
                  <span className={`font-semibold ${comm.type === 'daily' ? 'text-primary' : 'text-success'}`}>
                    {comm.type === 'paid' ? '-' : '+'}{fmt(comm.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ad Accounts */}
        <div className="bg-card border border-border rounded-xl p-5 border-glow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-semibold flex items-center gap-2">
              <Shield size={16} className="text-primary" /> Contas de Anúncio
            </h3>
            <div className="flex gap-2">
              {(['week', 'month'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
                >
                  {f === 'week' ? 'Semanal' : 'Mensal'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-secondary rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-primary">{client.adAccounts - client.usedAccounts - client.blockedAccounts}</p>
              <p className="text-xs text-muted-foreground mt-1">Disponíveis</p>
            </div>
            <div className="bg-secondary rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{client.usedAccounts}</p>
              <p className="text-xs text-muted-foreground mt-1">Em uso</p>
            </div>
            <div className="bg-secondary rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-destructive">{client.blockedAccounts}</p>
              <p className="text-xs text-muted-foreground mt-1">Bloqueadas</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
