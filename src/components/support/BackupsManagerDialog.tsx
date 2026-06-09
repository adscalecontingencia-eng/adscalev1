import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, Plus, Trash2, HardDrive, Save, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BM { id: string; meta_bm_id: string; name: string }
interface Backup { id: string; name: string; kind: string | null; description: string | null }
interface Assignment { id: string; bm_id: string; backup_id: string }

const inputCls = "bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary";

const BackupsManagerDialog: React.FC<{ open: boolean; onClose: () => void; onChange?: () => void }> = ({ open, onClose, onChange }) => {
  const [bms, setBms] = useState<BM[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [minBackups, setMinBackups] = useState(2);
  const [newBackup, setNewBackup] = useState({ name: '', kind: 'HD', description: '' });
  const [search, setSearch] = useState('');

  const load = async () => {
    const [b, bk, a, s] = await Promise.all([
      supabase.from('meta_business_managers').select('id, meta_bm_id, name').order('name'),
      supabase.from('bm_backups').select('*').order('name'),
      supabase.from('bm_backup_assignments').select('*'),
      supabase.from('support_settings').select('value').eq('key', 'min_backups_per_bm').maybeSingle(),
    ]);
    setBms((b.data || []) as BM[]);
    setBackups((bk.data || []) as Backup[]);
    setAssignments((a.data || []) as Assignment[]);
    if (s.data?.value) setMinBackups(Number(s.data.value) || 2);
  };

  useEffect(() => { if (open) load(); }, [open]);

  const isAssigned = (bmId: string, backupId: string) => assignments.some(a => a.bm_id === bmId && a.backup_id === backupId);

  const toggle = async (bmId: string, backupId: string) => {
    const existing = assignments.find(a => a.bm_id === bmId && a.backup_id === backupId);
    if (existing) {
      await supabase.from('bm_backup_assignments').delete().eq('id', existing.id);
      setAssignments(p => p.filter(x => x.id !== existing.id));
    } else {
      const { data } = await supabase.from('bm_backup_assignments').insert({ bm_id: bmId, backup_id: backupId }).select().single();
      if (data) setAssignments(p => [...p, data as Assignment]);
    }
    onChange?.();
  };

  const addBackup = async () => {
    if (!newBackup.name.trim()) return;
    const { data, error } = await supabase.from('bm_backups').insert(newBackup).select().single();
    if (error) { toast.error(error.message); return; }
    setBackups(p => [...p, data as Backup]);
    setNewBackup({ name: '', kind: 'HD', description: '' });
    toast.success('Backup criado');
  };

  const deleteBackup = async (id: string) => {
    if (!confirm('Excluir este backup? Todas as marcações de BMs nele serão removidas.')) return;
    await supabase.from('bm_backups').delete().eq('id', id);
    setBackups(p => p.filter(b => b.id !== id));
    setAssignments(p => p.filter(a => a.backup_id !== id));
    onChange?.();
  };

  const saveMin = async () => {
    await supabase.from('support_settings').upsert({ key: 'min_backups_per_bm', value: minBackups as any });
    toast.success('Regra mínima atualizada');
    onChange?.();
  };

  const bmsFiltered = useMemo(() => {
    const q = search.toLowerCase();
    return bms.filter(b => !q || b.name.toLowerCase().includes(q) || b.meta_bm_id.includes(q));
  }, [bms, search]);

  const bmBackupCount = (bmId: string) => assignments.filter(a => a.bm_id === bmId).length;
  const outOfRule = bms.filter(b => bmBackupCount(b.id) < minBackups);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-display text-base font-semibold flex items-center gap-2"><HardDrive size={18} className="text-primary" /> Backups manuais das BMs</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Regra mínima */}
          <div className="bg-secondary/40 border border-border rounded-lg p-3 flex flex-wrap items-center gap-3">
            <span className="text-sm">Mínimo de backups por BM:</span>
            <input type="number" min={0} value={minBackups} onChange={e => setMinBackups(Number(e.target.value))} className={cn(inputCls, "w-20")} />
            <button onClick={saveMin} className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs font-semibold inline-flex items-center gap-1"><Save size={12} /> Salvar</button>
            {outOfRule.length > 0 && (
              <span className="ml-auto text-xs text-red-400">⚠️ {outOfRule.length} BM(s) fora da regra</span>
            )}
          </div>

          {/* Catálogo */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Catálogo de backups</div>
            <div className="grid sm:grid-cols-2 gap-2 mb-3">
              {backups.map(b => (
                <div key={b.id} className="bg-secondary/40 border border-border rounded-lg p-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{b.name}</div>
                    <div className="text-[10px] text-muted-foreground">{b.kind}{b.description ? ` · ${b.description}` : ''}</div>
                  </div>
                  <button onClick={() => deleteBackup(b.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-center bg-secondary/40 border border-border rounded-lg p-2">
              <input placeholder="Nome (ex: HD Externo 01)" value={newBackup.name} onChange={e => setNewBackup(p => ({ ...p, name: e.target.value }))} className={cn(inputCls, "flex-1 min-w-[150px]")} />
              <select value={newBackup.kind} onChange={e => setNewBackup(p => ({ ...p, kind: e.target.value }))} className={inputCls}>
                {['HD', 'Drive', 'Cofre', 'Nuvem', 'Outro'].map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <input placeholder="Descrição (opcional)" value={newBackup.description} onChange={e => setNewBackup(p => ({ ...p, description: e.target.value }))} className={cn(inputCls, "flex-1 min-w-[150px]")} />
              <button onClick={addBackup} className="bg-primary text-primary-foreground px-3 py-2 rounded text-xs font-semibold inline-flex items-center gap-1"><Plus size={12} /> Adicionar</button>
            </div>
          </div>

          {/* Matriz BM × Backup */}
          {backups.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Matriz BM × Backup</div>
                <input placeholder="Buscar BM..." value={search} onChange={e => setSearch(e.target.value)} className={cn(inputCls, "text-xs w-48")} />
              </div>
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/60">
                    <tr>
                      <th className="text-left px-2 py-2 sticky left-0 bg-secondary/60">BM</th>
                      <th className="text-center px-2 py-2">#</th>
                      {backups.map(b => (
                        <th key={b.id} className="px-2 py-2 text-center min-w-[80px]">{b.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bmsFiltered.map(bm => {
                      const count = bmBackupCount(bm.id);
                      const violates = count < minBackups;
                      return (
                        <tr key={bm.id} className={cn("border-t border-border", violates && "bg-red-500/5")}>
                          <td className="px-2 py-2 sticky left-0 bg-card">
                            <div className="font-medium">{bm.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{bm.meta_bm_id}</div>
                          </td>
                          <td className={cn("text-center font-bold", violates ? "text-red-400" : "text-primary")}>{count}</td>
                          {backups.map(b => {
                            const on = isAssigned(bm.id, b.id);
                            return (
                              <td key={b.id} className="text-center">
                                <button
                                  onClick={() => toggle(bm.id, b.id)}
                                  className={cn(
                                    "w-6 h-6 rounded border inline-flex items-center justify-center",
                                    on ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-primary/50"
                                  )}
                                >
                                  {on && <Check size={14} />}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BackupsManagerDialog;
