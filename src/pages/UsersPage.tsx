import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PageHero } from '@/components/ui-kit';
import { Plus, X, Shield, KeyRound, Pencil, Trash2 } from 'lucide-react';
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
  { key: 'meta', label: 'Meta Ads' },
  { key: 'marketplace', label: 'Marketplace' },
];

const inputClass = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors";

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<SupportUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', permissions: ['support'] as string[] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<SupportUser | null>(null);
  const [editForm, setEditForm] = useState({ name: '', new_email: '', new_password: '', permissions: [] as string[] });
  const [editSaving, setEditSaving] = useState(false);

  const fetchUsers = async () => {
    const { data, error } = await supabase.from('support_users').select('*').order('created_at', { ascending: false });
    if (error) { toast.error('Erro ao carregar colaboradores'); return; }
    setUsers((data || []).map((u: any) => ({
      id: u.id, name: u.name, email: u.email,
      permissions: u.permissions || [],
      auth_user_id: u.auth_user_id || undefined,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Senha deve ter ao menos 6 caracteres');
      return;
    }
    if (!form.email.includes('@')) {
      toast.error('E-mail inválido');
      return;
    }
    setSaving(true);
    try {
      const res = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create_user',
          email: form.email.trim().toLowerCase(),
          password: form.password,
          name: form.name.trim(),
          role: 'support',
          permissions: form.permissions,
        },
      });
      if (res.error || (res.data as any)?.error) {
        toast.error((res.data as any)?.error || res.error?.message || 'Erro ao cadastrar colaborador');
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

  const openEdit = (u: SupportUser) => {
    setEditing(u);
    setEditForm({ name: u.name, new_email: u.email, new_password: '', permissions: [...u.permissions] });
  };

  const handleEditSave = async () => {
    if (!editing) return;
    setEditSaving(true);
    try {
      // 1) name + permissions
      if (editForm.name !== editing.name || JSON.stringify(editForm.permissions) !== JSON.stringify(editing.permissions)) {
        const r = await supabase.functions.invoke('manage-users', {
          body: { action: 'update_support_permissions', support_user_id: editing.id, name: editForm.name.trim(), permissions: editForm.permissions },
        });
        if (r.error || (r.data as any)?.error) {
          toast.error((r.data as any)?.error || 'Falha ao atualizar dados');
          return;
        }
      }
      // 2) email/password (auth)
      const emailChanged = editForm.new_email.trim().toLowerCase() !== editing.email.toLowerCase();
      const pwdSet = editForm.new_password.length > 0;
      if ((emailChanged || pwdSet) && editing.auth_user_id) {
        if (pwdSet && editForm.new_password.length < 6) {
          toast.error('Senha deve ter ao menos 6 caracteres');
          return;
        }
        const r = await supabase.functions.invoke('manage-users', {
          body: {
            action: 'reset_login',
            support_user_id: editing.id,
            new_email: emailChanged ? editForm.new_email.trim().toLowerCase() : undefined,
            new_password: pwdSet ? editForm.new_password : undefined,
          },
        });
        if (r.error || (r.data as any)?.error) {
          toast.error((r.data as any)?.error || 'Falha ao atualizar login');
          return;
        }
      } else if ((emailChanged || pwdSet) && !editing.auth_user_id) {
        toast.error('Colaborador legado sem usuário de autenticação. Recadastre.');
        return;
      }
      toast.success('Colaborador atualizado!');
      setEditing(null);
      fetchUsers();
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (user: SupportUser) => {
    if (!confirm(`Remover colaborador ${user.name}?`)) return;
    if (!user.auth_user_id) {
      const { error } = await supabase.from('support_users').delete().eq('id', user.id);
      if (error) { toast.error('Erro ao remover'); return; }
    } else {
      const res = await supabase.functions.invoke('manage-users', {
        body: { action: 'delete_user', user_id: user.auth_user_id },
      });
      if (res.error || (res.data as any)?.error) {
        toast.error((res.data as any)?.error || 'Erro ao remover');
        return;
      }
      await supabase.from('support_users').delete().eq('auth_user_id', user.auth_user_id);
    }
    toast.success('Colaborador removido!');
    setUsers(prev => prev.filter(u => u.id !== user.id));
  };

  const togglePermission = (key: string, target: 'create' | 'edit') => {
    if (target === 'create') {
      setForm(p => ({ ...p, permissions: p.permissions.includes(key) ? p.permissions.filter(k => k !== key) : [...p.permissions, key] }));
    } else {
      setEditForm(p => ({ ...p, permissions: p.permissions.includes(key) ? p.permissions.filter(k => k !== key) : [...p.permissions, key] }));
    }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground text-sm">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Equipe"
        title={<>Usuários & <span className="text-primary glow-text">permissões</span></>}
        description={`${users.length} colaborador(es) com acesso ao painel.`}
        actions={
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 shadow-[0_0_20px_hsl(var(--primary)/0.4)]">
            <Plus size={16} /> Novo Colaborador
          </button>
        }
      />

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
                    <button key={p.key} onClick={() => togglePermission(p.key, 'create')}
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

      {editing && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-semibold flex items-center gap-2"><KeyRound size={14} className="text-primary" /> Editar colaborador</h3>
              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Nome</label>
                <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">E-mail de acesso</label>
                <input type="email" value={editForm.new_email} onChange={e => setEditForm(p => ({ ...p, new_email: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Nova senha <span className="text-muted-foreground/60">(deixe vazio para manter)</span></label>
                <input type="password" value={editForm.new_password} onChange={e => setEditForm(p => ({ ...p, new_password: e.target.value }))} className={inputClass} placeholder="Mínimo 6 caracteres" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-2">Permissões</label>
                <div className="flex flex-wrap gap-2">
                  {PERMISSION_OPTIONS.map(p => (
                    <button key={p.key} onClick={() => togglePermission(p.key, 'edit')}
                      className={`px-3 py-1.5 rounded-lg text-xs transition-all ${editForm.permissions.includes(p.key) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              {!editing.auth_user_id && (
                <p className="text-[11px] text-amber-400">⚠️ Colaborador legado sem login Auth. Para alterar email/senha, recadastre.</p>
              )}
              <button onClick={handleEditSave} disabled={editSaving}
                className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 glow-box disabled:opacity-50">
                {editSaving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <div className="space-y-3">
        {users.map(u => (
          <div key={u.id} className="bg-card border border-border rounded-xl p-4 border-glow">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={14} className="text-primary" />
                  <h4 className="text-sm font-medium">{u.name}</h4>
                  {!u.auth_user_id && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">legado</span>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {u.permissions.map(p => (
                    <span key={p} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{PERMISSION_OPTIONS.find(o => o.key === p)?.label || p}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(u)} title="Editar login/permissões" className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-secondary"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(u)} title="Remover" className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-secondary"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
        {users.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Nenhum colaborador cadastrado.</p>}
      </div>
    </div>
  );
};

export default UsersPage;
