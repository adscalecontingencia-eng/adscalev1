import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Plus, X, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

type Area = 'pages' | 'meta_connections';

interface SupportUser { id: string; name: string; email: string }
interface Responsible { id: string; support_user_id: string; support_user?: SupportUser | null }

const AreaResponsibles: React.FC<{ area: Area; title?: string }> = ({ area, title = 'Responsáveis' }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [list, setList] = useState<Responsible[]>([]);
  const [users, setUsers] = useState<SupportUser[]>([]);
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState('');

  const load = async () => {
    const [r, u] = await Promise.all([
      supabase
        .from('area_responsibles')
        .select('id, support_user_id, support_user:support_users(id,name,email)')
        .eq('area', area),
      supabase.from('support_users').select('id,name,email').order('name'),
    ]);
    setList((r.data || []) as any);
    setUsers((u.data || []) as any);
  };

  useEffect(() => { load(); }, [area]);

  const add = async () => {
    if (!pick) return;
    const { error } = await supabase.from('area_responsibles').insert({
      area, support_user_id: pick, created_by: user?.id || null,
    });
    if (error) { toast.error(error.message); return; }
    setPick(''); setAdding(false);
    toast.success('Responsável adicionado');
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Remover este responsável?')) return;
    const { error } = await supabase.from('area_responsibles').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const available = users.filter(u => !list.some(r => r.support_user_id === u.id));

  return (
    <div className="bg-card border border-border rounded-xl p-3 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        <UserCheck size={14} className="text-primary" /> {title}
      </div>
      {list.length === 0 && !adding && (
        <span className="text-xs text-muted-foreground/70">Ninguém atribuído ainda.</span>
      )}
      {list.map(r => (
        <span key={r.id} className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-primary text-xs px-2 py-1 rounded-full">
          <Users size={11} />
          {r.support_user?.name || '—'}
          {isAdmin && (
            <button onClick={() => remove(r.id)} className="opacity-60 hover:opacity-100 hover:text-destructive">
              <X size={11} />
            </button>
          )}
        </span>
      ))}
      {isAdmin && (
        adding ? (
          <div className="flex items-center gap-1">
            <select
              value={pick}
              onChange={e => setPick(e.target.value)}
              className="bg-secondary border border-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-primary"
            >
              <option value="">Selecione um usuário...</option>
              {available.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button onClick={add} className="bg-primary text-primary-foreground px-2 py-1 rounded-lg text-xs font-semibold">OK</button>
            <button onClick={() => { setAdding(false); setPick(''); }} className="text-muted-foreground px-1"><X size={12} /></button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus size={12} /> Adicionar
          </button>
        )
      )}
    </div>
  );
};

export default AreaResponsibles;
