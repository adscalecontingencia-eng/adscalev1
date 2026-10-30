import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus, KeyRound, Trash2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { AGENCY_PERMISSIONS } from '@/lib/agency-permissions';

interface Member { id: string; name: string; email: string; permissions: string[]; active: boolean; created_at: string }

const call = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('agency-members', { body });
  if (error) {
    let msg = 'Não foi possível concluir.';
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
};

const PermPicker = ({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) => (
  <div className="grid sm:grid-cols-2 gap-2">
    {AGENCY_PERMISSIONS.map(p => (
      <label key={p.key} className="flex items-start gap-2 rounded-lg border border-border/60 p-2.5 cursor-pointer hover:bg-secondary/40">
        <Checkbox checked={value.includes(p.key)} onCheckedChange={v => onChange(v ? [...value, p.key] : value.filter(x => x !== p.key))} />
        <span><span className="text-sm font-medium block">{p.label}</span><span className="text-[11px] text-muted-foreground">{p.hint}</span></span>
      </label>
    ))}
  </div>
);

/** Agency owner manages collaborators and which panel sections each one can open. */
export const AgencyUsers: React.FC<{ agencyId: string; isDemo: boolean }> = ({ agencyId, isDemo }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', permissions: ['suporte'] as string[] });
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Member | null>(null);
  const [pwFor, setPwFor] = useState<Member | null>(null);
  const [newPw, setNewPw] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('agency_members').select('id, name, email, permissions, active, created_at').eq('agency_client_id', agencyId).order('created_at');
    setMembers((data as Member[]) || []);
  }, [agencyId]);
  useEffect(() => { load(); }, [load]);

  const run = async (body: Record<string, unknown>, ok: string) => {
    if (isDemo) { toast.info('Conta de demonstração: usuários não são salvos.'); return false; }
    setBusy(true);
    try { await call(body); toast.success(ok); await load(); return true; }
    catch (e: any) { toast.error(e.message); return false; }
    finally { setBusy(false); }
  };

  const create = async () => {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 8) return toast.error('Preencha nome, e-mail e uma senha com pelo menos 8 caracteres.');
    if (!form.permissions.length) return toast.error('Escolha pelo menos uma área que o colaborador pode acessar.');
    if (await run({ action: 'create', ...form }, 'Colaborador criado.')) { setOpen(false); setForm({ name: '', email: '', password: '', permissions: ['suporte'] }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <p className="text-sm text-muted-foreground">Adicione pessoas da sua equipe e escolha quais áreas do painel cada uma pode abrir. Só você, dono da agência, vê esta página.</p>
        </div>
        <Button className="gap-2" onClick={() => setOpen(true)}><UserPlus size={15} />Novo colaborador</Button>
      </div>

      <Card><CardHeader><CardTitle className="text-base">Colaboradores ({members.length})</CardTitle></CardHeader><CardContent className="space-y-2">
        {members.map(m => (
          <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 p-3">
            <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary text-sm font-bold">{m.name[0]?.toUpperCase()}</div>
            <div className="flex-1 min-w-[180px]">
              <p className="text-sm font-medium">{m.name} {!m.active && <span className="text-[10px] uppercase text-destructive ml-1">bloqueado</span>}</p>
              <p className="text-xs text-muted-foreground">{m.email}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {AGENCY_PERMISSIONS.filter(p => m.permissions.includes(p.key)).map(p => <span key={p.key} className="text-[10px] rounded-full bg-primary/10 border border-primary/30 text-primary px-2 py-0.5">{p.label}</span>)}
                {!m.permissions.length && <span className="text-[10px] text-muted-foreground">Sem acesso a nenhuma área</span>}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">Ativo
              <Switch checked={m.active} disabled={busy} onCheckedChange={v => run({ action: 'update', member_id: m.id, active: v }, v ? 'Acesso liberado.' : 'Acesso bloqueado.')} />
            </label>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEdit({ ...m })}><ShieldCheck size={13} />Permissões</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setPwFor(m); setNewPw(''); }}><KeyRound size={13} />Senha</Button>
            <Button size="icon" variant="ghost" disabled={busy} onClick={() => { if (confirm(`Remover o acesso de ${m.name}?`)) run({ action: 'delete', member_id: m.id }, 'Colaborador removido.'); }}><Trash2 size={14} /></Button>
          </div>
        ))}
        {!members.length && <p className="text-sm text-muted-foreground py-4">Nenhum colaborador ainda.</p>}
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Novo colaborador</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>E-mail de acesso</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Senha inicial</Label><Input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="mín. 8 caracteres" /></div>
          </div>
          <Label className="mt-2">O que ele pode acessar</Label>
          <PermPicker value={form.permissions} onChange={v => setForm({ ...form, permissions: v })} />
          <p className="text-[11px] text-muted-foreground">Ele entra pela mesma página de login do painel e vê só as áreas marcadas.</p>
          <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={busy} onClick={create}>Criar acesso</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!edit} onOpenChange={v => !v && setEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Permissões de {edit?.name}</DialogTitle></DialogHeader>
          {edit && <PermPicker value={edit.permissions} onChange={v => setEdit({ ...edit, permissions: v })} />}
          <DialogFooter><Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button disabled={busy} onClick={async () => { if (edit && await run({ action: 'update', member_id: edit.id, permissions: edit.permissions }, 'Permissões salvas.')) setEdit(null); }}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwFor} onOpenChange={v => !v && setPwFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova senha para {pwFor?.name}</DialogTitle></DialogHeader>
          <Input type="text" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="mín. 8 caracteres" />
          <DialogFooter><Button variant="ghost" onClick={() => setPwFor(null)}>Cancelar</Button>
            <Button disabled={busy || newPw.length < 8} onClick={async () => { if (pwFor && await run({ action: 'reset_password', member_id: pwFor.id, password: newPw }, 'Senha alterada.')) setPwFor(null); }}>Salvar senha</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
