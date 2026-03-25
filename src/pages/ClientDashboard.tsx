import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, CreditCard, AlertTriangle, BarChart3, Shield, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

const ClientDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'week' | 'month'>('week');
  const [client, setClient] = useState<any>(null);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground text-sm">Carregando...</p></div>;

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Cadastro de cliente não encontrado.</p>
      </div>
    );
  }

  const dailyTotal = commissions.filter(c => c.type === 'daily').reduce((s, c) => s + Number(c.amount), 0);
  const paidTotal = commissions.filter(c => c.type === 'paid').reduce((s, c) => s + Number(c.amount), 0);
  const pendingTotal = dailyTotal - paidTotal;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 lg:px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-sm font-bold text-primary glow-text">AD SCALE</h1>
          <p className="text-xs text-muted-foreground">Painel do Cliente</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{client.name}</span>
          <button onClick={() => { logout(); navigate('/login'); }} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
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

        {commissions.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 border-glow">
            <h3 className="font-display text-sm font-semibold mb-4 flex items-center gap-2">
              <DollarSign size={16} className="text-primary" /> Histórico de Comissões
            </h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-secondary rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Acumulado</p>
                <p className="text-sm font-bold text-primary">{fmt(dailyTotal)}</p>
              </div>
              <div className="bg-secondary rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Pago</p>
                <p className="text-sm font-bold text-success">{fmt(paidTotal)}</p>
              </div>
              <div className="bg-secondary rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Pendente</p>
                <p className="text-sm font-bold text-warning">{fmt(pendingTotal)}</p>
              </div>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {commissions.map((comm: any) => (
                <div key={comm.id} className="flex items-center justify-between bg-secondary rounded-lg px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${comm.type === 'daily' ? 'bg-primary' : 'bg-success'}`} />
                    <span className="text-muted-foreground">{format(new Date(comm.date), "dd/MM/yyyy", { locale: ptBR })}</span>
                    <span className="text-muted-foreground">{comm.type === 'daily' ? 'Comissão' : 'Pagamento'}</span>
                    {comm.note && <span className="text-muted-foreground italic">- {comm.note}</span>}
                  </div>
                  <span className={`font-semibold ${comm.type === 'daily' ? 'text-primary' : 'text-success'}`}>
                    {comm.type === 'paid' ? '-' : '+'}{fmt(Number(comm.amount))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

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
