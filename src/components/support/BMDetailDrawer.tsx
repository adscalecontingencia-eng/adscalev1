import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Users, HardDrive, CreditCard, RefreshCw, ShieldCheck, ShieldAlert, Plus, AlertTriangle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BM { id: string; meta_bm_id: string; name: string; status: string | null; verification_status: string | null }
interface Profile { id: string; bm_id: string; profile_name: string; meta_user_id: string | null; is_whitelisted: boolean }
interface Backup { id: string; name: string; kind: string | null }
interface MetaUser { id: string; name: string; email?: string | null; role?: string | null; kind: string }
interface AdAccount { id: string; meta_account_id: string; name: string; status: string | null }

const BMDetailDrawer: React.FC<{
  bm: BM | null;
  open: boolean;
  onClose: () => void;
  minBackups: number;
  onChanged?: () => void;
}> = ({ bm, open, onClose, minBackups, onChanged }) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [metaUsers, setMetaUsers] = useState<MetaUser[]>([]);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const load = async () => {
    if (!bm) return;
    const [p, b, a, ac] = await Promise.all([
      supabase.from('bm_profiles').select('*').eq('bm_id', bm.id),
      supabase.from('bm_backups').select('*').order('name'),
      supabase.from('bm_backup_assignments').select('backup_id').eq('bm_id', bm.id),
      supabase.from('meta_ad_accounts').select('id, meta_account_id, name, status').eq('bm_id', bm.id).order('name'),
    ]);
    setProfiles((p.data || []) as Profile[]);
    setBackups((b.data || []) as Backup[]);
    setAssigned(((a.data || []) as any[]).map(x => x.backup_id));
    setAccounts((ac.data || []) as AdAccount[]);
  };

  useEffect(() => { if (open && bm) { load(); setMetaUsers([]); } }, [open, bm?.id]);

  const fetchMetaUsers = async () => {
    if (!bm) return;
    setLoadingMeta(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-bm-users', { body: { meta_bm_id: bm.meta_bm_id } });
      if (error || data?.erro) throw new Error(error?.message || data?.erro);
      setMetaUsers((data?.usuarios || []) as MetaUser[]);
      toast.success(`${data?.usuarios?.length || 0} usuário(s) carregado(s)`);
    } catch (e: any) {
      toast.error('Erro Meta: ' + e.message);
    } finally {
      setLoadingMeta(false);
    }
  };

  const isWhitelisted = (u: MetaUser) =>
    profiles.some(p =>
      p.is_whitelisted &&
      (p.meta_user_id === u.id ||
        p.profile_name.toLowerCase().trim() === u.name.toLowerCase().trim() ||
        (u.email && p.profile_name.toLowerCase().trim() === u.email.toLowerCase().trim()))
    );

  const addToWhitelist = async (u: MetaUser) => {
    if (!bm) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('bm_profiles').insert({
      bm_id: bm.id,
      profile_name: u.name,
      profile_role: u.role || null,
      meta_user_id: u.id,
      meta_user_kind: u.kind,
      is_whitelisted: true,
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`"${u.name}" adicionado à whitelist`);
    load();
    onChanged?.();
  };

  const createRemovalTask = async (u: MetaUser) => {
    if (!bm) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('internal_tasks').insert({
      title: `Remover usuário terceiro "${u.name}" da BM ${bm.name}`,
      description: `Usuário Meta: ${u.name}\nID: ${u.id}\nEmail: ${u.email || '—'}\nTipo: ${u.kind}\nBM: ${bm.name} (${bm.meta_bm_id})`,
      category: 'Fornecedores',
      structure_type: 'Agência',
      scope: 'agencia',
      priority: 'alta',
      status: 'pendente',
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Pendência criada em "Agência"');
  };

  const toggleBackup = async (backupId: string) => {
    if (!bm) return;
    if (assigned.includes(backupId)) {
      await supabase.from('bm_backup_assignments').delete().eq('bm_id', bm.id).eq('backup_id', backupId);
      setAssigned(p => p.filter(x => x !== backupId));
    } else {
      await supabase.from('bm_backup_assignments').insert({ bm_id: bm.id, backup_id: backupId });
      setAssigned(p => [...p, backupId]);
    }
    onChanged?.();
  };

  const removeProfile = async (id: string) => {
    if (!confirm('Remover da whitelist?')) return;
    await supabase.from('bm_profiles').delete().eq('id', id);
    load();
    onChanged?.();
  };

  if (!bm) return null;
  const thirdParties = metaUsers.filter(u => !isWhitelisted(u));
  const backupCount = assigned.length;
  const backupViolates = backupCount < minBackups;

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            {bm.name}
            <span className="text-xs font-mono text-muted-foreground">{bm.meta_bm_id}</span>
          </SheetTitle>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={cn("px-2 py-0.5 rounded border", bm.status === 'active' ? "bg-primary/15 text-primary border-primary/40" : "bg-destructive/15 text-destructive border-destructive/40")}>
              {bm.status === 'active' ? 'Ativa' : 'Bloqueada'}
            </span>
            {bm.verification_status && (
              <span className="px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">{bm.verification_status}</span>
            )}
          </div>
        </SheetHeader>

        <Tabs defaultValue="users">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="users"><Users size={14} className="mr-1" /> Usuários</TabsTrigger>
            <TabsTrigger value="backups"><HardDrive size={14} className="mr-1" /> Backups</TabsTrigger>
            <TabsTrigger value="accounts"><CreditCard size={14} className="mr-1" /> Contas</TabsTrigger>
          </TabsList>

          {/* USUÁRIOS */}
          <TabsContent value="users" className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Whitelist: <span className="text-primary font-semibold">{profiles.filter(p => p.is_whitelisted).length}</span>
                {metaUsers.length > 0 && <> · Terceiros detectados: <span className={cn("font-semibold", thirdParties.length > 0 ? "text-red-400" : "text-primary")}>{thirdParties.length}</span></>}
              </div>
              <button onClick={fetchMetaUsers} disabled={loadingMeta} className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs inline-flex items-center gap-1 hover:border-primary/50">
                <RefreshCw size={12} className={loadingMeta ? 'animate-spin' : ''} /> Buscar na Meta
              </button>
            </div>

            {/* Whitelist atual */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Whitelist (perfis próprios)</div>
              {profiles.length === 0 ? (
                <p className="text-xs text-muted-foreground/60">Nenhum perfil. Busque na Meta e adicione.</p>
              ) : (
                <div className="space-y-1">
                  {profiles.map(p => (
                    <div key={p.id} className="bg-secondary/40 border border-border rounded p-2 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-medium">{p.profile_name}</span>
                        {p.meta_user_id && <span className="ml-2 text-[10px] font-mono text-muted-foreground">{p.meta_user_id}</span>}
                      </div>
                      <button onClick={() => removeProfile(p.id)} className="text-muted-foreground hover:text-destructive text-[10px]">remover</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Usuários Meta */}
            {metaUsers.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Usuários atuais na Meta</div>
                <div className="space-y-1">
                  {metaUsers.map(u => {
                    const wl = isWhitelisted(u);
                    return (
                      <div key={u.id} className={cn(
                        "border rounded p-2 flex items-center justify-between gap-2 text-xs",
                        wl ? "bg-primary/5 border-primary/30" : "bg-red-500/5 border-red-500/40"
                      )}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {wl ? <ShieldCheck size={12} className="text-primary" /> : <ShieldAlert size={12} className="text-red-400" />}
                            <span className="font-medium">{u.name}</span>
                            <span className="text-[10px] bg-secondary px-1.5 rounded text-muted-foreground">{u.kind}</span>
                            {u.role && <span className="text-[10px] bg-secondary px-1.5 rounded text-muted-foreground">{u.role}</span>}
                          </div>
                          {u.email && <div className="text-[10px] text-muted-foreground">{u.email}</div>}
                          <div className="text-[10px] font-mono text-muted-foreground/70">{u.id}</div>
                        </div>
                        <div className="flex flex-col gap-1">
                          {!wl && (
                            <>
                              <button onClick={() => addToWhitelist(u)} className="bg-primary/10 text-primary border border-primary/30 rounded px-2 py-0.5 text-[10px] inline-flex items-center gap-1">
                                <Plus size={10} /> Whitelist
                              </button>
                              <button onClick={() => createRemovalTask(u)} className="bg-destructive/10 text-destructive border border-destructive/30 rounded px-2 py-0.5 text-[10px] inline-flex items-center gap-1">
                                <AlertTriangle size={10} /> Remover
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* BACKUPS */}
          <TabsContent value="backups" className="space-y-3 mt-4">
            <div className={cn(
              "rounded-lg border p-3 text-xs",
              backupViolates ? "bg-red-500/10 border-red-500/40 text-red-300" : "bg-primary/10 border-primary/30 text-primary"
            )}>
              {backupViolates ? (
                <>⚠️ Esta BM está em <b>{backupCount}</b> backup(s), abaixo do mínimo de <b>{minBackups}</b>.</>
              ) : (
                <>✅ Esta BM está em {backupCount} backup(s) (mínimo: {minBackups}).</>
              )}
            </div>
            {backups.length === 0 ? (
              <p className="text-xs text-muted-foreground/60">Nenhum backup cadastrado. Vá em "Gerenciar backups" para criar.</p>
            ) : (
              <div className="space-y-1">
                {backups.map(b => {
                  const on = assigned.includes(b.id);
                  return (
                    <label key={b.id} className={cn("flex items-center gap-2 p-2 rounded border cursor-pointer", on ? "bg-primary/10 border-primary/30" : "bg-secondary/40 border-border")}>
                      <input type="checkbox" checked={on} onChange={() => toggleBackup(b.id)} className="accent-primary" />
                      <HardDrive size={14} className="text-muted-foreground" />
                      <span className="text-sm flex-1">{b.name}</span>
                      {b.kind && <span className="text-[10px] text-muted-foreground">{b.kind}</span>}
                    </label>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* CONTAS */}
          <TabsContent value="accounts" className="space-y-2 mt-4">
            {accounts.length === 0 ? (
              <p className="text-xs text-muted-foreground/60">Nenhuma conta nesta BM.</p>
            ) : accounts.map(a => (
              <div key={a.id} className="bg-secondary/40 border border-border rounded p-2 flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">{a.meta_account_id}</div>
                </div>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", a.status === 'active' ? "bg-primary/10 text-primary border-primary/30" : "bg-destructive/10 text-destructive border-destructive/30")}>
                  {a.status === 'active' ? 'Ativa' : 'Bloqueada'}
                </span>
              </div>
            ))}
            <a href="#/meta-connections" className="block text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1">
              <ExternalLink size={11} /> Abrir em Conexões Meta
            </a>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default BMDetailDrawer;
