import React, { useState, useEffect } from 'react';
import { tr } from '@/i18n';
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

const PERMISSION_OPTIONS = ([
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'clients', label: 'Clientes' },
  { key: 'financial', label: 'Financeiro' },
  { key: 'support', label: 'Suporte' },
  { key: 'users', label: 'Usuários' },
  { key: 'meta', label: 'Meta Ads' },
  { key: 'meta-connections', label: 'Conexões Meta' },
  { key: 'pages', label: 'Páginas' },
  { key: 'marketplace', label: 'Marketplace' },
]).map(o => ({ key: o.key, get label() { return tr(`admin.users.perm.${o.key}`); } }));

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
    if (error) { toast.error(tr('admin.users.loadError')); return; }
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
      toast.error(tr('admin.users.fillAll'));
      return;
    }
    if (form.password.length < 6) {
      toast.error(tr('admin.users.pw6'));
      return;
    }
    if (!form.email.includes('@')) {
      toast.error(tr('admin.users.invalidEmail'));
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
        toast.error((res.data as any)?.error || res.error?.message || tr('admin.users.createError'));
        return;
      }
      toast.success(tr('admin.users.created'));
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
          toast.error((r.data as any)?.error || tr('admin.users.updateDataFail'));
          return;
        }
      }
      // 2) email/password (auth)
      const emailChanged = editForm.new_email.trim().toLowerCase() !== editing.email.toLowerCase();
      const pwdSet = editForm.new_password.length > 0;
      if ((emailChanged || pwdSet) && editing.auth_user_id) {
        if (pwdSet && editForm.new_password.length < 6) {
          toast.error(tr('admin.users.pw6'));
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
          toast.error((r.data as any)?.error || tr('admin.users.updateLoginFail'));
          return;
        }
      } else if ((emailChanged || pwdSet) && !editing.auth_user_id) {
        toast.error(tr('admin.users.legacy'));
        return;
      }
      toast.success(tr('admin.users.updated'));
      setEditing(null);
      fetchUsers();
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (user: SupportUser) => {
    if (!confirm(tr('admin.users.confirmRemove', { name: user.name }))) return;
    if (!user.auth_user_id) {
      const { error } = await supabase.from('support_users').delete().eq('id', user.id);
      if (error) { toast.error(tr('admin.users.removeError')); return; }
    } else {
      const res = await supabase.functions.invoke('manage-users', {
        body: { action: 'delete_user', user_id: user.auth_user_id },
      });
      if (res.error || (res.data as any)?.error) {
        toast.error((res.data as any)?.error || tr('admin.users.removeError'));
        return;
      }
      await supabase.from('support_users').delete().eq('auth_user_id', user.auth_user_id);
    }
    toast.success(tr('admin.users.removed'));
    setUsers(prev => prev.filter(u => u.id !== user.id));
  };

  const togglePermission = (key: string, target: 'create' | 'edit') => {
    if (target === 'create') {
      setForm(p => ({ ...p, permissions: p.permissions.includes(key) ? p.permissions.filter(k => k !== key) : [...p.permissions, key] }));
    } else {
      setEditForm(p => ({ ...p, permissions: p.permissions.includes(key) ? p.permissions.filter(k => k !== key) : [...p.permissions, key] }));
    }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground text-sm">{tr('admin.users.loading')}</p></div>;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow={tr('admin.users.eyebrow')}
        title={<span dangerouslySetInnerHTML={{ __html: tr('admin.users.title').replace('<span>', '<span class="text-primary glow-text">') }} />}
        description={tr('admin.users.count', { n: users.length })}
        actions={
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 shadow-[0_0_20px_hsl(var(--primary)/0.4)]">
            <Plus size={16} /> {tr('admin.users.newUser')}
          </button>
        }
      />

      {showForm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-semibold">{tr('admin.users.newUser')}</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{tr('admin.users.name')}</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">E-mail</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{tr('admin.users.password')}</label>
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className={inputClass} placeholder={tr('admin.users.min6')} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-2">{tr('admin.users.permissions')}</label>
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
                {saving ? tr('admin.users.creating') : tr('admin.users.create')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {editing && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-semibold flex items-center gap-2"><KeyRound size={14} className="text-primary" /> {tr('admin.users.editTitle')}</h3>
              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{tr('admin.users.name')}</label>
                <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{tr('admin.users.loginEmail')}</label>
                <input type="email" value={editForm.new_email} onChange={e => setEditForm(p => ({ ...p, new_email: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{tr('admin.users.newPw')} <span className="text-muted-foreground/60">{tr('admin.users.keepEmpty')}</span></label>
                <input type="password" value={editForm.new_password} onChange={e => setEditForm(p => ({ ...p, new_password: e.target.value }))} className={inputClass} placeholder={tr('admin.users.min6')} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-2">{tr('admin.users.permissions')}</label>
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
                <p className="text-[11px] text-amber-400">{tr('admin.users.legacyWarn')}</p>
              )}
              <button onClick={handleEditSave} disabled={editSaving}
                className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:opacity-90 glow-box disabled:opacity-50">
                {editSaving ? tr('admin.users.saving') : tr('admin.users.saveChanges')}
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
                <button onClick={() => openEdit(u)} title={tr('admin.users.editTitleAttr')} className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-secondary"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(u)} title={tr('admin.users.remove')} className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-secondary"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
        {users.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">{tr('admin.users.none')}</p>}
      </div>
    </div>
  );
};

export default UsersPage;
