import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Shield } from 'lucide-react';

interface SupportUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  permissions: string[];
}

const PERMISSION_OPTIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'clients', label: 'Clientes' },
  { key: 'financial', label: 'Financeiro' },
  { key: 'support', label: 'Suporte' },
  { key: 'users', label: 'Usuários' },
];

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<SupportUser[]>(() => JSON.parse(localStorage.getItem('adscale_support_users') || '[]'));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<SupportUser>>({ permissions: ['support'] });

  useEffect(() => { localStorage.setItem('adscale_support_users', JSON.stringify(users)); }, [users]);

  const handleSave = () => {
    if (!form.name || !form.email) return;
    const u: SupportUser = {
      id: `support-${Date.now()}`, name: form.name || '', email: form.email || '',
      password: form.password || '123456', role: form.role || 'Suporte',
      permissions: form.permissions || ['support'],
    };
    setUsers(prev => [...prev, u]);
    setForm({ permissions: ['support'] });
    setShowForm(false);
  };

  const handleDelete = (id: string) => setUsers(prev => prev.filter(u => u.id !== id));

  const togglePermission = (key: string) => {
    setForm(p => {
      const perms = p.permissions || [];
      return { ...p, permissions: perms.includes(key) ? perms.filter(k => k !== key) : [...perms, key] };
    });
  };

  const inputClass = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{users.length} colaborador(es)</p>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 glow-box">
          <Plus size={16} /> Novo Colaborador
        </button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-semibold">Novo Colaborador</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Nome</label>
                <input value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">E-mail</label>
                <input type="email" value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Senha</label>
                <input value={form.password || ''} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Função</label>
                <input value={form.role || ''} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} placeholder="Ex: Suporte, Analista" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-2">Permissões</label>
                <div className="flex flex-wrap gap-2">
                  {PERMISSION_OPTIONS.map(p => (
                    <button
                      key={p.key}
                      onClick={() => togglePermission(p.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs transition-all ${form.permissions?.includes(p.key) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleSave} className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 glow-box">Cadastrar</button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <div className="space-y-3">
        {users.map(u => (
          <div key={u.id} className="bg-card border border-border rounded-xl p-4 border-glow">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={14} className="text-primary" />
                  <h4 className="text-sm font-medium">{u.name}</h4>
                  <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded">{u.role}</span>
                </div>
                <p className="text-xs text-muted-foreground">{u.email}</p>
                <div className="flex gap-1 mt-2">
                  {u.permissions.map(p => (
                    <span key={p} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{PERMISSION_OPTIONS.find(o => o.key === p)?.label || p}</span>
                  ))}
                </div>
              </div>
              <button onClick={() => handleDelete(u.id)} className="p-2 text-muted-foreground hover:text-destructive"><X size={14} /></button>
            </div>
          </div>
        ))}
        {users.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Nenhum colaborador cadastrado.</p>}
      </div>
    </div>
  );
};

export default UsersPage;
