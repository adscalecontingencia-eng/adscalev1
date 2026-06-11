import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Building2, ShieldCheck, ShieldAlert, UserX, HardDrive, Search, Settings, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import BackupsManagerDialog from './BackupsManagerDialog';
import BMDetailDrawer from './BMDetailDrawer';
import DetectedProfilesDialog from './DetectedProfilesDialog';
import { ScanLine } from 'lucide-react';
import { toast } from 'sonner';

type TabKey = 'all' | 'active' | 'blocked' | 'unassigned';

interface BM { id: string; meta_bm_id: string; name: string; status: string | null; verification_status: string | null; account_count: number | null }
interface Account { id: string; bm_id: string | null; status: string | null }
interface Assignment { ad_account_id: string; active: boolean }
interface Backup { id: string; name: string }
interface BackupAssignment { bm_id: string; backup_id: string }
interface Profile { bm_id: string }

const BMPanelTab: React.FC = () => {
  const [bms, setBms] = useState<BM[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [backupAssignments, setBackupAssignments] = useState<BackupAssignment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [minBackups, setMinBackups] = useState(2);
  const [search, setSearch] = useState('');
  const [showBackupsManager, setShowBackupsManager] = useState(false);
  const [showDetected, setShowDetected] = useState(false);
  const [detail, setDetail] = useState<BM | null>(null);
  const [tab, setTab] = useState<TabKey>('all');
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    const [b, a, asn, bk, ba, p, s] = await Promise.all([
      supabase.from('meta_business_managers').select('id, meta_bm_id, name, status, verification_status, account_count').order('name'),
      supabase.from('meta_ad_accounts').select('id, bm_id, status'),
      supabase.from('meta_ad_account_assignments').select('ad_account_id, active').eq('active', true),
      supabase.from('bm_backups').select('id, name'),
      supabase.from('bm_backup_assignments').select('bm_id, backup_id'),
      supabase.from('bm_profiles').select('bm_id'),
      supabase.from('support_settings').select('value').eq('key', 'min_backups_per_bm').maybeSingle(),
    ]);
    setBms((b.data || []) as BM[]);
    setAccounts((a.data || []) as Account[]);
    setAssignments((asn.data || []) as Assignment[]);
    setBackups((bk.data || []) as Backup[]);
    setBackupAssignments((ba.data || []) as BackupAssignment[]);
    setProfiles((p.data || []) as Profile[]);
    if (s.data?.value) setMinBackups(Number(s.data.value) || 2);
  };

  useEffect(() => { load(); }, []);

  const assignedAdAccountIds = useMemo(() => new Set(assignments.map(a => a.ad_account_id)), [assignments]);

  const bmStats = (bmId: string) => {
    const accs = accounts.filter(a => a.bm_id === bmId);
    const active = accs.filter(a => a.status === 'active').length;
    const blocked = accs.length - active;
    const hasClient = accs.some(a => assignedAdAccountIds.has(a.id));
    const backupCount = backupAssignments.filter(x => x.bm_id === bmId).length;
    const profileCount = profiles.filter(p => p.bm_id === bmId).length;
    return { active, blocked, total: accs.length, hasClient, backupCount, profileCount };
  };

  const classify = (bm: BM) => {
    // BM "status" no Meta vem como verification_status (verified, not_verified, pending_submission, rejected).
    // Só considera bloqueada quando rejeitada OU quando todas as contas estão bloqueadas.
    const { active, total, hasClient } = bmStats(bm.id);
    const rejected = (bm.status || '').toLowerCase() === 'rejected';
    const allBlocked = total > 0 && active === 0;
    if (rejected || allBlocked) return 'blocked';
    return hasClient ? 'active' : 'unassigned';
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return bms.filter(b => !q || b.name.toLowerCase().includes(q) || b.meta_bm_id.includes(q));
  }, [bms, search]);

  const groups = useMemo(() => ({
    active: filtered.filter(b => classify(b) === 'active'),
    blocked: filtered.filter(b => classify(b) === 'blocked'),
    unassigned: filtered.filter(b => classify(b) === 'unassigned'),
  }), [filtered, accounts, assignments]);

  const kpis = useMemo(() => {
    const outOfBackup = bms.filter(b => backupAssignments.filter(x => x.bm_id === b.id).length < minBackups).length;
    return {
      total: bms.length,
      active: groups.active.length,
      blocked: groups.blocked.length,
      unassigned: groups.unassigned.length,
      outOfBackup,
    };
  }, [bms, groups, backupAssignments, minBackups]);

  const sync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('meta-sync', { body: { action: 'start_sync_accounts' } });
      if (error) throw error;
      toast.success('Sincronização iniciada em segundo plano');
      setTimeout(load, 4000);
    } catch (e: any) {
      toast.error(e.message || 'Falha ao sincronizar');
    } finally {
      setTimeout(() => setSyncing(false), 3000);
    }
  };

  const tabs: { key: TabKey; label: string; count: number; tone: 'primary' | 'destructive' | 'amber' | 'neutral' }[] = [
    { key: 'all', label: 'Todas', count: filtered.length, tone: 'neutral' },
    { key: 'active', label: 'Ativas', count: groups.active.length, tone: 'primary' },
    { key: 'blocked', label: 'Bloqueadas', count: groups.blocked.length, tone: 'destructive' },
    { key: 'unassigned', label: 'Sem cliente', count: groups.unassigned.length, tone: 'amber' },
  ];
  const currentBms = tab === 'all' ? filtered : tab === 'active' ? groups.active : tab === 'blocked' ? groups.blocked : groups.unassigned;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <KPI label="BMs totais" value={kpis.total} icon={Building2} cls="text-foreground" />
        <KPI label="Ativas c/ cliente" value={kpis.active} icon={ShieldCheck} cls="text-primary" />
        <KPI label="Bloqueadas" value={kpis.blocked} icon={ShieldAlert} cls="text-destructive" />
        <KPI label="Sem cliente" value={kpis.unassigned} icon={UserX} cls="text-amber-400" />
        <KPI label="Fora do backup mínimo" value={kpis.outOfBackup} icon={HardDrive} cls={kpis.outOfBackup > 0 ? "text-red-400" : "text-muted-foreground"} />
      </div>

      {/* Toolbar */}
      <div className="bg-card border border-border rounded-xl p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar BM..."
            className="w-full pl-9 bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <button onClick={sync} disabled={syncing} className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-xs font-semibold inline-flex items-center gap-1 hover:opacity-90 disabled:opacity-60">
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Sincronizando...' : 'Sincronizar BMs + Contas'}
        </button>
        <button onClick={() => setShowDetected(true)} className="bg-primary/15 border border-primary/40 text-primary rounded-lg px-3 py-2 text-xs inline-flex items-center gap-1 hover:bg-primary/25">
          <ScanLine size={12} /> Detectar perfis
        </button>
        <button onClick={() => setShowBackupsManager(true)} className="bg-secondary border border-border rounded-lg px-3 py-2 text-xs inline-flex items-center gap-1 hover:border-primary/50">
          <Settings size={12} /> Gerenciar backups
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map(t => {
          const active = tab === t.key;
          const toneActive = {
            primary: 'border-primary text-primary',
            destructive: 'border-destructive text-destructive',
            amber: 'border-amber-400 text-amber-300',
            neutral: 'border-foreground text-foreground',
          }[t.tone];
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-4 py-2 text-xs font-semibold border-b-2 transition-colors inline-flex items-center gap-2",
                active ? toneActive : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-secondary">{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {currentBms.length === 0 ? (
        <p className="text-sm text-muted-foreground/60 text-center py-12">Nenhuma BM nesta categoria</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {currentBms.map(bm => (
            <BMCard key={bm.id} bm={bm} stats={bmStats(bm.id)} minBackups={minBackups} onOpen={() => setDetail(bm)} />
          ))}
        </div>
      )}

      <BackupsManagerDialog open={showBackupsManager} onClose={() => setShowBackupsManager(false)} onChange={load} />
      <DetectedProfilesDialog open={showDetected} onClose={() => setShowDetected(false)} onChanged={load} />
      <BMDetailDrawer bm={detail} open={!!detail} onClose={() => setDetail(null)} minBackups={minBackups} onChanged={load} />
    </div>
  );
};

const KPI: React.FC<{ label: string; value: number; icon: any; cls: string }> = ({ label, value, icon: Icon, cls }) => (
  <div className="bg-card border border-border rounded-xl p-3">
    <div className="flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <Icon size={14} className={cls} />
    </div>
    <div className={cn("text-2xl font-bold mt-1", cls)}>{value}</div>
  </div>
);

const BMCard: React.FC<{
  bm: BM;
  stats: any;
  minBackups: number;
  onOpen: () => void;
}> = ({ bm, stats: st, minBackups, onOpen }) => {
  const outOfBackup = st.backupCount < minBackups;
  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-card hover:bg-secondary border border-border hover:border-primary/40 rounded-lg p-3 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{bm.name}</div>
          <div className="text-[10px] font-mono text-muted-foreground">{bm.meta_bm_id}</div>
        </div>
        {bm.verification_status?.toLowerCase().includes('verified') && (
          <CheckCircle2 size={12} className="text-primary shrink-0" />
        )}
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        <span className="text-[10px] bg-secondary border border-border rounded px-1.5 py-0.5">
          {st.active}/{st.total} contas ok
        </span>
        {st.blocked > 0 && (
          <span className="text-[10px] bg-destructive/10 text-destructive border border-destructive/30 rounded px-1.5 py-0.5">
            {st.blocked} bloq.
          </span>
        )}
        <span className={cn("text-[10px] rounded px-1.5 py-0.5 border inline-flex items-center gap-1",
          outOfBackup ? "bg-red-500/10 text-red-300 border-red-500/40" : "bg-primary/10 text-primary border-primary/30"
        )}>
          <HardDrive size={9} /> {st.backupCount}/{minBackups}
        </span>
        {outOfBackup && (
          <span className="text-[10px] bg-red-500/15 text-red-300 border border-red-500/40 rounded px-1.5 py-0.5 inline-flex items-center gap-1">
            <AlertTriangle size={9} /> Fora do backup
          </span>
        )}
      </div>
    </button>
  );
};

export default BMPanelTab;
