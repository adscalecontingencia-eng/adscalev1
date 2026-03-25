import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SupportUser {
  id: string;
  name: string;
  email: string;
  permissions: string[];
  auth_user_id?: string;
}

const PERMISSION_OPTIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'clients', label: 'Clientes' },
  { key: 'financial', label: 'Financeiro' },
  { key: 'support', label: 'Suporte' },
  { key: 'users', label: 'Usuários' },
];

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<SupportUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ name: string; email: string; password: string; permissions: string[] }>({
    name: '', email: '', password: '', permissions: ['support'],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('support_users').select('*').order('created_at', { ascending: false });
    if (error) { toast.error('Erro ao carregar colaboradores'); return; }
    setUsers((data || []).map(u => ({
      id: u.id, name: u.name, email: u.email,
      permissions: u.permissions || [],
      auth_user_id: (u as any).auth_user_id || undefined,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.email || !form.password) {
      toast.error('Preencha todos os campos');
      return;
    }
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) { toast.error('Sessão expirada'); return; }

      const res = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create_user',
          email: form.email,
          password: form.password,
          name: form.name,
          role: 'support',
          permissions: form.permissions,
        },
      });

      if (res.error || res.data?.error) {
        toast.error(res.data?.error || 'Erro ao cadastrar colaborador');
        return;
      }

      toast.success('Colaborador cadastrado!');
      setForm({ name: '', email: '', password: '', permissions: ['support'] });
      setShowForm(false);
      fetchUsers();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: SupportUser) => {
    if (!user.auth_user_id) {
      // Legacy user without auth - just delete from table
      const { error } = await supabase.from('support_users').delete().eq('id', user.id);
      if (error) { toast.error('Erro ao remover'); return; }
    } else {
      const res = await supabase.functions.invoke('manage-users', {
        body: { action: 'delete_user', user_id: user.auth_user_id },
      });
      if (res.error || res.data?.error) {
        toast.error('Erro ao remover');
        return;
      }
      // Also delete from support_users table
      await supabase.from('support_users').delete().eq('auth_user_id', user.auth_user_id);
    }
    toast.success('Colaborador removido!');
    setUsers(prev => prev.filter(u => u.id !== user.id));
  };

  const togglePermission = (key: string) => {
    setForm(p => {
      const perms = p.permissions;
      return { ...p, permissions: perms.includes(key) ? perms.filter(k => k !== key) : [...perms, key] };
    });
  };

  const inputClass = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors";

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground text-sm">Carregando...</p></div>;

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
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">E-mail</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Senha</label>
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className={inputClass} placeholder="Mínimo 6 caracteres" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-2">Permissões</label>
                <div className="flex flex-wrap gap-2">
                  {PERMISSION_OPTIONS.map(p => (
                    <button key={p.key} onClick={() => togglePermission(p.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs transition-all ${form.permissions.includes(p.key) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleSave} disabled={saving}
                className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 glow-box disabled:opacity-50">
                {saving ? 'Cadastrando...' : 'Cadastrar'}
              </button>
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
                </div>
                <p className="text-xs text-muted-foreground">{u.email}</p>
                <div className="flex gap-1 mt-2">
                  {u.permissions.map(p => (
                    <span key={p} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{PERMISSION_OPTIONS.find(o => o.key === p)?.label || p}</span>
                  ))}
                </div>
              </div>
              <button onClick={() => handleDelete(u)} className="p-2 text-muted-foreground hover:text-destructive"><X size={14} /></button>
            </div>
          </div>
        ))}
        {users.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Nenhum colaborador cadastrado.</p>}
      </div>
    </div>
  );
};

export default UsersPage;
