import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, Search, ShieldCheck, ShieldAlert, RefreshCw, Save, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Detected { bm_id: string; meta_user_id: string; user_name: string | null; user_email: string | null; user_kind: string | null }
interface Whitelist { id?: string; meta_user_id: string; display_name: string; backup_id: string | null }
interface Backup { id: string; name: string }
interface BM { id: string; name: string }

const inputCls = "bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary";

const DetectedProfilesDialog: React.FC<{ open: boolean; onClose: () => void; onChanged?: () => void }> = ({ open, onClose, onChanged }) => {
  const [detected, setDetected] = useState<Detected[]>([]);
  const [whitelist, setWhitelist] = useState<Record<string, Whitelist>>({});
  const [backups, setBackups] = useState<Backup[]>([]);
  const [bms, setBms] = useState<BM[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'mine' | 'third'>('all');
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [job, setJob] = useState<{ id: string; status: string; progress_current: number; progress_total: number; synced_count: number; message: string | null; errors: any[] } | null>(null);

  const load = async () => {
    const [d, w, b, m] = await Promise.all([
      supabase.from('bm_detected_users').select('bm_id, meta_user_id, user_name, user_email, user_kind'),
      supabase.from('meta_user_whitelist').select('id, meta_user_id, display_name, backup_id'),
      supabase.from('bm_backups').select('id, name').order('name'),
      supabase.from('meta_business_managers').select('id, name'),
    ]);
    setDetected((d.data || []) as Detected[]);
    const map: Record<string, Whitelist> = {};
    (w.data || []).forEach((row: any) => { map[row.meta_user_id] = row; });
    setWhitelist(map);
    setBackups((b.data || []) as Backup[]);
    setBms((m.data || []) as BM[]);
  };

  useEffect(() => { if (open) { load(); setDirty(new Set()); } }, [open]);

  // Polling do job em background (mesma estratégia de Conexões Meta)
  useEffect(() => {
    if (!job?.id) return;
    const jobId = job.id;
    let finished = false;

    const apply = (j: any) => {
      if (!j || finished) return;
      setJob({
        id: j.id, status: j.status, progress_current: j.progress_current,
        progress_total: j.progress_total, synced_count: j.synced_count,
        message: j.message, errors: j.errors || [],
      });
      if (j.status === 'completed' || j.status === 'failed') {
        finished = true;
        setScanning(false);
        if (j.status === 'completed') {
          toast.success(j.message || 'Scan concluído');
          load();
          onChanged?.();
        } else {
          toast.error(j.message || 'Scan falhou — veja a Auditoria');
        }
        setTimeout(() => setJob(null), 6000);
      }
    };

    const channel = supabase
      .channel(`scan-job-${jobId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meta_sync_jobs', filter: `id=eq.${jobId}` },
        (payload) => apply(payload.new))
      .subscribe();

    const interval = setInterval(async () => {
      if (finished) return;
      const { data } = await supabase.from('meta_sync_jobs').select('*').eq('id', jobId).maybeSingle();
      apply(data);
    }, 2500);

    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, [job?.id]);

  const grouped = useMemo(() => {
    const m = new Map<string, { meta_user_id: string; name: string; email: string | null; kind: string | null; bms: string[] }>();
    for (const d of detected) {
      const cur = m.get(d.meta_user_id) || { meta_user_id: d.meta_user_id, name: d.user_name || '(sem nome)', email: d.user_email, kind: d.user_kind, bms: [] };
      cur.bms.push(d.bm_id);
      if (d.user_name && !cur.name.startsWith(d.user_name)) cur.name = d.user_name;
      m.set(d.meta_user_id, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.bms.length - a.bms.length);
  }, [detected]);

  const bmName = (id: string) => bms.find(b => b.id === id)?.name || id.slice(0, 8);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return grouped.filter(g => {
      if (q && !g.name.toLowerCase().includes(q) && !g.meta_user_id.includes(q) && !(g.email || '').toLowerCase().includes(q)) return false;
      const isMine = !!whitelist[g.meta_user_id];
      if (filter === 'mine' && !isMine) return false;
      if (filter === 'third' && isMine) return false;
      return true;
    });
  }, [grouped, search, filter, whitelist]);

  const update = (metaId: string, patch: Partial<Whitelist>, displayName: string) => {
    setWhitelist(prev => {
      const cur = prev[metaId] || { meta_user_id: metaId, display_name: displayName, backup_id: null };
      return { ...prev, [metaId]: { ...cur, ...patch } };
    });
    setDirty(prev => new Set(prev).add(metaId));
  };

  const remove = (metaId: string) => {
    setWhitelist(prev => { const n = { ...prev }; delete n[metaId]; return n; });
    setDirty(prev => new Set(prev).add(metaId));
  };

  const runScan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('scan-bm-backups', { body: { action: 'start' } });
      if (error) throw error;
      if (data?.job_id) {
        setJob({ id: data.job_id, status: 'pending', progress_current: 0, progress_total: 0, synced_count: 0, message: 'Iniciando...', errors: [] });
        toast.info('Scan iniciado em segundo plano');
      } else {
        setScanning(false);
        toast.error('Falha ao iniciar scan');
      }
    } catch (e: any) {
      setScanning(false);
      toast.error(e.message || 'Falha no scan');
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      for (const id of dirty) {
        const row = whitelist[id];
        if (row) {
          await supabase.from('meta_user_whitelist').upsert(
            { meta_user_id: row.meta_user_id, display_name: row.display_name, backup_id: row.backup_id, meta_user_kind: grouped.find(g => g.meta_user_id === id)?.kind || null },
            { onConflict: 'meta_user_id' }
          );
        } else {
          await supabase.from('meta_user_whitelist').delete().eq('meta_user_id', id);
        }
      }
      toast.success('Whitelist salva. Rodando sync de backups...');
      await supabase.functions.invoke('scan-bm-backups', { body: {} });
      await load();
      setDirty(new Set());
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || 'Falha ao salvar');
    } finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="font-display text-base font-semibold flex items-center gap-2"><ShieldCheck size={18} className="text-primary" /> Perfis detectados nas BMs</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Marque "É meu" e vincule a um backup. O sistema vai detectar automaticamente quais BMs cada backup cobre.</p>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="p-4 border-b border-border flex flex-wrap items-center gap-2">
          <button onClick={runScan} disabled={scanning} className="bg-primary text-primary-foreground px-3 py-2 rounded text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-60">
            <RefreshCw size={12} className={scanning ? 'animate-spin' : ''} /> {scanning ? 'Escaneando...' : 'Escanear BMs agora'}
          </button>
          <button onClick={save} disabled={saving || dirty.size === 0} className="bg-secondary border border-border hover:border-primary/50 px-3 py-2 rounded text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50">
            <Save size={12} /> Salvar ({dirty.size})
          </button>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nome, email ou ID..." className={cn(inputCls, "w-full pl-9")} />
          </div>
          <div className="flex border border-border rounded-lg overflow-hidden">
            {(['all', 'mine', 'third'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-2 text-xs", filter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary')}>
                {f === 'all' ? 'Todos' : f === 'mine' ? 'Meus' : 'Terceiros'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-auto p-4">
          {grouped.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <ShieldAlert size={28} className="mx-auto mb-2 text-muted-foreground/50" />
              Nenhum perfil detectado ainda. Clique em <strong className="text-primary">Escanear BMs agora</strong>.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-secondary/60 sticky top-0">
                <tr>
                  <th className="text-left px-2 py-2">Perfil</th>
                  <th className="text-left px-2 py-2">Meta ID</th>
                  <th className="text-center px-2 py-2">Em # BMs</th>
                  <th className="text-center px-2 py-2">É meu?</th>
                  <th className="text-left px-2 py-2 min-w-[160px]">Vincular ao backup</th>
                  <th className="text-left px-2 py-2">BMs</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(g => {
                  const wl = whitelist[g.meta_user_id];
                  const mine = !!wl;
                  return (
                    <tr key={g.meta_user_id} className={cn("border-t border-border", mine && "bg-primary/5")}>
                      <td className="px-2 py-2">
                        <div className="font-medium">{g.name}</div>
                        {g.email && <div className="text-[10px] text-muted-foreground">{g.email}</div>}
                      </td>
                      <td className="px-2 py-2 font-mono text-[10px] text-muted-foreground">{g.meta_user_id}</td>
                      <td className="px-2 py-2 text-center font-bold">{g.bms.length}</td>
                      <td className="px-2 py-2 text-center">
                        <input type="checkbox" checked={mine} onChange={e => e.target.checked ? update(g.meta_user_id, {}, g.name) : remove(g.meta_user_id)} className="w-4 h-4" />
                      </td>
                      <td className="px-2 py-2">
                        {mine ? (
                          <div className="flex items-center gap-1">
                            <HardDrive size={11} className="text-primary shrink-0" />
                            <select value={wl?.backup_id || ''} onChange={e => update(g.meta_user_id, { backup_id: e.target.value || null }, g.name)} className={cn(inputCls, "text-xs py-1 flex-1")}>
                              <option value="">— sem backup —</option>
                              {backups.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                          </div>
                        ) : <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1 max-w-[300px]">
                          {g.bms.slice(0, 4).map(id => (
                            <span key={id} className="text-[10px] bg-secondary border border-border rounded px-1.5 py-0.5">{bmName(id)}</span>
                          ))}
                          {g.bms.length > 4 && <span className="text-[10px] text-muted-foreground">+{g.bms.length - 4}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetectedProfilesDialog;
