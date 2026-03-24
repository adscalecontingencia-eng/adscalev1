import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react';

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

const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>(() => JSON.parse(localStorage.getItem('adscale_clients') || '[]'));
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<Partial<Client>>({ paymentType: 'fixed', adAccounts: 0, usedAccounts: 0, blockedAccounts: 0 });

  useEffect(() => { localStorage.setItem('adscale_clients', JSON.stringify(clients)); }, [clients]);

  // Seed demo client if empty
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
        id: `client-${Date.now()}`,
        number: form.number || '',
        name: form.name || '',
        companyName: form.companyName || '',
        email: form.email || '',
        password: form.password || '123456',
        observations: form.observations || '',
        paymentType: form.paymentType || 'fixed',
        fixedValue: form.fixedValue,
        percentageValue: form.percentageValue,
        adAccounts: form.adAccounts || 0,
        usedAccounts: form.usedAccounts || 0,
        blockedAccounts: form.blockedAccounts || 0,
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

  const handleEdit = (c: Client) => {
    setForm(c);
    setEditing(c);
    setShowForm(true);
  };

  const handleDelete = (id: string) => setClients(prev => prev.filter(c => c.id !== id));

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.companyName.toLowerCase().includes(search.toLowerCase()) ||
    c.number.includes(search)
  );

  const inputClass = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..." className={`${inputClass} pl-10`} />
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 glow-box">
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
        {filtered.map(c => (
          <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-border rounded-xl p-4 border-glow">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">#{c.number}</span>
                  <h4 className="font-semibold text-sm">{c.name}</h4>
                </div>
                <p className="text-xs text-muted-foreground">{c.companyName}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.email}</p>
                <div className="flex gap-3 mt-2 text-xs">
                  <span className="text-primary">
                    {c.paymentType === 'fixed' ? `Fixo: R$${c.fixedValue}` : c.paymentType === 'percentage' ? `${c.percentageValue}% sobre gasto` : `Fixo R$${c.fixedValue} + ${c.percentageValue}%`}
                  </span>
                  <span className="text-muted-foreground">Contas: {c.adAccounts - c.usedAccounts - c.blockedAccounts} disponíveis</span>
                </div>
                {c.observations && <p className="text-xs text-muted-foreground mt-2 italic">"{c.observations}"</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(c)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(c.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
              </div>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Nenhum cliente encontrado.</p>}
      </div>
    </div>
  );
};

export default Clients;
