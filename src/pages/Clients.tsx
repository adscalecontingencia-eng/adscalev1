import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, X, DollarSign, CheckCircle, ChevronDown, ChevronUp, CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Client {
  id: string;
  number: string;
  name: string;
  companyName: string;
  email: string;
  password: string;
  observations: string;
  paymentType: 'fixed' | 'percentage' | 'both';
  fixedValue?: number;
  percentageValue?: number;
  adAccounts: number;
  usedAccounts: number;
  blockedAccounts: number;
}

interface Commission {
  id: string;
  clientId: string;
  date: string;
  amount: number;
  type: 'daily' | 'paid';
  note?: string;
}

const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>(() => JSON.parse(localStorage.getItem('adscale_clients') || '[]'));
  const [commissions, setCommissions] = useState<Commission[]>(() => JSON.parse(localStorage.getItem('adscale_commissions') || '[]'));
  const [showForm, setShowForm] = useState(false);
  const [showCommissionForm, setShowCommissionForm] = useState<string | null>(null);
  const [showPaidForm, setShowPaidForm] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Client | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Client>>({ paymentType: 'fixed', adAccounts: 0, usedAccounts: 0, blockedAccounts: 0 });
  const [commissionAmount, setCommissionAmount] = useState('');
  const [commissionNote, setCommissionNote] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [commissionDate, setCommissionDate] = useState<Date>(new Date());
  const [paidDate, setPaidDate] = useState<Date>(new Date());

  useEffect(() => { localStorage.setItem('adscale_clients', JSON.stringify(clients)); }, [clients]);
  useEffect(() => { localStorage.setItem('adscale_commissions', JSON.stringify(commissions)); }, [commissions]);

  useEffect(() => {
    if (clients.length === 0) {
      const demo: Client = {
        id: 'client-1', number: '001', name: 'Cliente Demo', companyName: 'Empresa Demo',
        email: 'cliente1@gmail.com', password: 'Cliente1', observations: 'Cliente de demonstração. Contrato padrão com 10% sobre gasto.',
        paymentType: 'percentage', percentageValue: 10, adAccounts: 5, usedAccounts: 3, blockedAccounts: 1,
      };
      setClients([demo]);
    }
  }, []);

  const handleSave = () => {
    if (!form.name || !form.email || !form.number) return;
    if (editing) {
      setClients(prev => prev.map(c => c.id === editing.id ? { ...c, ...form } as Client : c));
    } else {
      const newClient: Client = {
        id: `client-${Date.now()}`, number: form.number || '', name: form.name || '',
        companyName: form.companyName || '', email: form.email || '', password: form.password || '123456',
        observations: form.observations || '', paymentType: form.paymentType || 'fixed',
        fixedValue: form.fixedValue, percentageValue: form.percentageValue,
        adAccounts: form.adAccounts || 0, usedAccounts: form.usedAccounts || 0, blockedAccounts: form.blockedAccounts || 0,
      };
      setClients(prev => [...prev, newClient]);
    }
    resetForm();
  };

  const resetForm = () => {
    setForm({ paymentType: 'fixed', adAccounts: 0, usedAccounts: 0, blockedAccounts: 0 });
    setEditing(null);
    setShowForm(false);
  };

  const handleEdit = (c: Client) => { setForm(c); setEditing(c); setShowForm(true); };
  const handleDelete = (id: string) => setClients(prev => prev.filter(c => c.id !== id));

  const handleAddCommission = (clientId: string) => {
    const amount = parseFloat(commissionAmount);
    if (isNaN(amount) || amount <= 0) return;
    const newCommission: Commission = {
      id: `comm-${Date.now()}`, clientId, date: commissionDate.toISOString(),
      amount, type: 'daily', note: commissionNote || undefined,
    };
    setCommissions(prev => [...prev, newCommission]);
    setCommissionAmount('');
    setCommissionNote('');
    setCommissionDate(new Date());
    setShowCommissionForm(null);
  };

  const handleAddPaid = (clientId: string) => {
    const amount = parseFloat(paidAmount);
    if (isNaN(amount) || amount <= 0) return;
    const paid: Commission = {
      id: `comm-${Date.now()}`, clientId, date: paidDate.toISOString(),
      amount, type: 'paid',
    };
    setCommissions(prev => [...prev, paid]);
    setPaidAmount('');
    setPaidDate(new Date());
    setShowPaidForm(null);
  };

  const getClientCommissions = (clientId: string) => commissions.filter(c => c.clientId === clientId);
  const getAccumulated = (clientId: string) => {
    const cc = getClientCommissions(clientId);
    const daily = cc.filter(c => c.type === 'daily').reduce((s, c) => s + c.amount, 0);
    const paid = cc.filter(c => c.type === 'paid').reduce((s, c) => s + c.amount, 0);
    return { daily, paid, pending: daily - paid };
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.companyName.toLowerCase().includes(search.toLowerCase()) ||
    c.number.includes(search)
  );

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const inputClass = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..." className={`${inputClass} pl-10`} />
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 glow-box whitespace-nowrap">
          <Plus size={16} /> Novo Cliente
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-semibold">{editing ? 'Editar Cliente' : 'Novo Cliente'}</h3>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Número</label>
                  <input value={form.number || ''} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} className={inputClass} required />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Nome</label>
                  <input value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputClass} required />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Empresa</label>
                <input value={form.companyName || ''} onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">E-mail (login)</label>
                  <input type="email" value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={inputClass} required />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Senha</label>
                  <input value={form.password || ''} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Observações (contrato)</label>
                <textarea value={form.observations || ''} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))} className={`${inputClass} h-24 resize-none`} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Tipo de Pagamento</label>
                <select value={form.paymentType} onChange={e => setForm(p => ({ ...p, paymentType: e.target.value as any }))} className={inputClass}>
                  <option value="fixed">Valor Fixo</option>
                  <option value="percentage">% sobre Gasto</option>
                  <option value="both">Fixo + %</option>
                </select>
              </div>
              {(form.paymentType === 'fixed' || form.paymentType === 'both') && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Valor Fixo (R$)</label>
                  <input type="number" value={form.fixedValue || ''} onChange={e => setForm(p => ({ ...p, fixedValue: +e.target.value }))} className={inputClass} />
                </div>
              )}
              {(form.paymentType === 'percentage' || form.paymentType === 'both') && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Percentual (%)</label>
                  <input type="number" value={form.percentageValue || ''} onChange={e => setForm(p => ({ ...p, percentageValue: +e.target.value }))} className={inputClass} />
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Contas disponíveis</label>
                  <input type="number" value={form.adAccounts || 0} onChange={e => setForm(p => ({ ...p, adAccounts: +e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Contas usadas</label>
                  <input type="number" value={form.usedAccounts || 0} onChange={e => setForm(p => ({ ...p, usedAccounts: +e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Contas bloqueadas</label>
                  <input type="number" value={form.blockedAccounts || 0} onChange={e => setForm(p => ({ ...p, blockedAccounts: +e.target.value }))} className={inputClass} />
                </div>
              </div>
              <button onClick={handleSave} className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 glow-box">
                {editing ? 'Salvar Alterações' : 'Cadastrar Cliente'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Client List */}
      <div className="space-y-3">
        {filtered.map(c => {
          const acc = getAccumulated(c.id);
          const isExpanded = expandedClient === c.id;
          const clientComms = getClientCommissions(c.id);

          return (
            <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-border rounded-xl overflow-hidden border-glow">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">#{c.number}</span>
                      <h4 className="font-semibold text-sm">{c.name}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.companyName}</p>
                    <p className="text-xs text-muted-foreground mt-1">{c.email}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs">
                      <span className="text-primary">
                        {c.paymentType === 'fixed' ? `Fixo: R$${c.fixedValue}` : c.paymentType === 'percentage' ? `${c.percentageValue}% sobre gasto` : `Fixo R$${c.fixedValue} + ${c.percentageValue}%`}
                      </span>
                      <span className="text-muted-foreground">Contas: {c.adAccounts - c.usedAccounts - c.blockedAccounts} disponíveis</span>
                    </div>
                  </div>
                  <div className="flex gap-1 sm:gap-2 shrink-0 ml-2">
                    <button onClick={() => handleEdit(c)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(c.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                  </div>
                </div>

                {/* Commission Summary */}
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-3">
                    <div className="bg-secondary rounded-lg p-2 sm:p-3 text-center">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Acumulado</p>
                      <p className="text-xs sm:text-sm font-bold text-primary">{fmt(acc.daily)}</p>
                    </div>
                    <div className="bg-secondary rounded-lg p-2 sm:p-3 text-center">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Pago</p>
                      <p className="text-xs sm:text-sm font-bold text-success">{fmt(acc.paid)}</p>
                    </div>
                    <div className="bg-secondary rounded-lg p-2 sm:p-3 text-center">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Pendente</p>
                      <p className={`text-xs sm:text-sm font-bold ${acc.pending > 0 ? 'text-warning' : 'text-muted-foreground'}`}>{fmt(acc.pending)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setShowCommissionForm(showCommissionForm === c.id ? null : c.id)} className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">
                      <DollarSign size={12} /> Lançar Comissão
                    </button>
                    <button onClick={() => setShowPaidForm(showPaidForm === c.id ? null : c.id)} className="flex items-center gap-1.5 text-xs bg-success/10 text-success px-3 py-1.5 rounded-lg hover:bg-success/20 transition-colors">
                      <CheckCircle size={12} /> Comissão Paga
                    </button>
                    <button onClick={() => setExpandedClient(isExpanded ? null : c.id)} className="flex items-center gap-1.5 text-xs bg-secondary text-muted-foreground px-3 py-1.5 rounded-lg hover:text-foreground transition-colors ml-auto">
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Histórico
                    </button>
                  </div>

                  {/* Commission Form */}
                  {showCommissionForm === c.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-3 space-y-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className={cn("flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm bg-secondary border border-border text-foreground hover:border-primary transition-colors whitespace-nowrap")}>
                              <CalendarIcon size={14} />
                              {format(commissionDate, "dd/MM/yyyy", { locale: ptBR })}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={commissionDate} onSelect={(d) => d && setCommissionDate(d)} initialFocus className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                        <input type="number" placeholder="Valor R$" value={commissionAmount} onChange={e => setCommissionAmount(e.target.value)} className={`${inputClass} flex-1`} />
                        <input placeholder="Nota (opcional)" value={commissionNote} onChange={e => setCommissionNote(e.target.value)} className={`${inputClass} flex-1`} />
                        <button onClick={() => handleAddCommission(c.id)} className="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 whitespace-nowrap">Adicionar</button>
                      </div>
                    </motion.div>
                  )}

                  {/* Paid Form */}
                  {showPaidForm === c.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-3 flex flex-col sm:flex-row gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className={cn("flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm bg-secondary border border-border text-foreground hover:border-primary transition-colors whitespace-nowrap")}>
                            <CalendarIcon size={14} />
                            {format(paidDate, "dd/MM/yyyy", { locale: ptBR })}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={paidDate} onSelect={(d) => d && setPaidDate(d)} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                      <input type="number" placeholder="Valor pago R$" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} className={`${inputClass} flex-1`} />
                      <button onClick={() => handleAddPaid(c.id)} className="bg-success text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 whitespace-nowrap">Registrar Pagamento</button>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Commission History */}
              {isExpanded && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="border-t border-border bg-secondary/50 p-4">
                  <h5 className="text-xs font-semibold text-muted-foreground mb-2">Histórico de Comissões</h5>
                  {clientComms.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma comissão lançada.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {clientComms.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(comm => (
                        <div key={comm.id} className="flex items-center justify-between bg-card rounded-lg px-3 py-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${comm.type === 'daily' ? 'bg-primary' : 'bg-success'}`} />
                            <span className="text-muted-foreground">{format(new Date(comm.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                            {comm.note && <span className="text-muted-foreground italic">- {comm.note}</span>}
                          </div>
                          <span className={`font-semibold ${comm.type === 'daily' ? 'text-primary' : 'text-success'}`}>
                            {comm.type === 'paid' ? '-' : '+'}{fmt(comm.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Nenhum cliente encontrado.</p>}
      </div>
    </div>
  );
};

export default Clients;
