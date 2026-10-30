import React, { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Plus, X, CheckCircle2, Clock, AlertTriangle, LifeBuoy, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const CATEGORIES = [
  { v: 'manutencao', l: 'Manutenção' }, { v: 'nova_conta', l: 'Nova conta' }, { v: 'bloqueio', l: 'Conta bloqueada' },
  { v: 'pagamento', l: 'Pagamento / limite' }, { v: 'paginas', l: 'Páginas' }, { v: 'outro', l: 'Outro' },
];
const STRUCTURES = ['BM Comum', 'BM Verificada', 'Perfil', 'Proxy', 'Multilogin'];
const STATUSES = [
  { v: 'pendente', l: 'Pendente' }, { v: 'em_andamento', l: 'Em andamento' }, { v: 'concluida', l: 'Concluída' }, { v: 'cancelada', l: 'Cancelada' },
];

const statusIcon = (s: string) => s === 'em_andamento' ? <Clock size={14} className="text-warning" />
  : s === 'concluida' ? <CheckCircle2 size={14} className="text-primary" />
  : s === 'cancelada' ? <X size={14} className="text-muted-foreground" /> : <AlertTriangle size={14} className="text-destructive" />;

/** Agency support desk — same flow as AD SCALE support (tasks with category, structure and status). */
export const AgencySupport: React.FC<{ agencyId: string; subs: any[] }> = ({ agencyId, subs }) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [filter, setFilter] = useState('todos');
  const [form, setForm] = useState({ title: '', description: '', category: 'manutencao', structure_type: 'BM Comum', sub_client_id: 'none' });

  const load = useCallback(async () => {
    const { data } = await supabase.from('agency_support_tasks').select('*').eq('agency_client_id', agencyId).order('created_at', { ascending: false });
    setTasks(data || []);
  }, [agencyId]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const title = form.title.trim();
    if (!title || title.length > 200) return toast.error('Informe um título (até 200 caracteres).');
    const { error } = await supabase.from('agency_support_tasks').insert({
      agency_client_id: agencyId, title, description: form.description.trim().slice(0, 2000) || null,
      category: form.category, structure_type: form.structure_type,
      sub_client_id: form.sub_client_id === 'none' ? null : form.sub_client_id,
    });
    if (error) return toast.error('Não foi possível criar o chamado.');
    toast.success('Chamado criado.');
    setForm({ title: '', description: '', category: 'manutencao', structure_type: 'BM Comum', sub_client_id: 'none' }); setShow(false); load();
  };
  const setStatus = async (id: string, status: string) => {
    const patch: any = { status, resolved_at: status === 'concluida' || status === 'cancelada' ? new Date().toISOString() : null };
    await supabase.from('agency_support_tasks').update(patch).eq('id', id); load();
  };
  const del = async (id: string) => { if (!confirm('Excluir este chamado?')) return; await supabase.from('agency_support_tasks').delete().eq('id', id); load(); };

  const count = (s: string) => tasks.filter(t => t.status === s).length;
  const list = filter === 'todos' ? tasks : tasks.filter(t => t.status === filter);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-6 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-primary">✱ Suporte & estrutura</p>
          <h2 className="text-2xl font-bold mt-1">Central de <span className="text-primary">suporte</span></h2>
          <p className="text-sm text-muted-foreground mt-1">Chamados dos seus clientes: manutenção, contas bloqueadas, pagamentos e estrutura.</p>
        </div>
        <Button className="ml-auto gap-2" onClick={() => setShow(s => !s)}><Plus size={14} />Novo chamado</Button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {[{ v: 'todos', l: `Todos · ${tasks.length}` }, ...STATUSES.map(s => ({ v: s.v, l: `${s.l} · ${count(s.v)}` }))].map(f => (
          <button key={f.v} onClick={() => setFilter(f.v)} className={`px-3 py-1.5 rounded-full border transition-colors ${filter === f.v ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 text-muted-foreground hover:text-foreground'}`}>{f.l}</button>
        ))}
      </div>

      {show && (
        <div className="rounded-xl border border-primary/30 bg-card/60 p-4 grid sm:grid-cols-2 gap-3">
          <Input placeholder="Título do chamado" maxLength={200} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Select value={form.sub_client_id} onValueChange={v => setForm({ ...form, sub_client_id: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">Sem cliente (interno)</SelectItem>{subs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map(c => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.structure_type} onValueChange={v => setForm({ ...form, structure_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STRUCTURES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Textarea className="sm:col-span-2" placeholder="Descrição" maxLength={2000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div className="sm:col-span-2 flex gap-2 justify-end"><Button variant="ghost" onClick={() => setShow(false)}>Cancelar</Button><Button onClick={create}>Criar chamado</Button></div>
        </div>
      )}

      <div className="space-y-2">
        {list.map(t => (
          <div key={t.id} className="rounded-xl border border-border/60 bg-card/60 p-4 flex flex-wrap items-start gap-3">
            <div className="mt-0.5">{statusIcon(t.status)}</div>
            <div className="flex-1 min-w-[220px]">
              <p className="font-medium">{t.title}</p>
              <div className="flex flex-wrap gap-2 mt-1 text-[11px] text-muted-foreground">
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">{CATEGORIES.find(c => c.v === t.category)?.l ?? t.category}</span>
                <span className="px-2 py-0.5 rounded-full bg-secondary">{t.structure_type}</span>
                <span>{subs.find(s => s.id === t.sub_client_id)?.name ?? 'Interno'}</span>
                <span>· {format(new Date(t.created_at), 'dd/MM/yyyy HH:mm')}</span>
              </div>
              {t.description && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{t.description}</p>}
            </div>
            <Select value={t.status} onValueChange={v => setStatus(t.id, v)}>
              <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="icon" variant="ghost" onClick={() => del(t.id)}><Trash2 size={14} /></Button>
          </div>
        ))}
        {!list.length && <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground"><LifeBuoy className="mx-auto mb-2 opacity-60" />Nenhum chamado aqui.</div>}
      </div>
    </div>
  );
};
