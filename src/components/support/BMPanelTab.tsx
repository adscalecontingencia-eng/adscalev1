import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Building2, ShieldCheck, ShieldAlert, UserX, HardDrive, Search, Settings, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import BackupsManagerDialog from './BackupsManagerDialog';
import BMDetailDrawer from './BMDetailDrawer';
import DetectedProfilesDialog from './DetectedProfilesDialog';
import { ScanLine } from 'lucide-react';

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
    if (bm.status !== 'active') return 'blocked';
    const { hasClient } = bmStats(bm.id);
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
        <button onClick={() => setShowDetected(true)} className="bg-primary/15 border border-primary/40 text-primary rounded-lg px-3 py-2 text-xs inline-flex items-center gap-1 hover:bg-primary/25">
          <ScanLine size={12} /> Detectar perfis
        </button>
        <button onClick={() => setShowBackupsManager(true)} className="bg-secondary border border-border rounded-lg px-3 py-2 text-xs inline-flex items-center gap-1 hover:border-primary/50">
          <Settings size={12} /> Gerenciar backups
        </button>
      </div>

      {/* 4 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3">
        <Column title="Todas" subtitle="todas as BMs cadastradas" tone="neutral" bms={filtered} bmStats={bmStats} minBackups={minBackups} onOpen={setDetail} />
        <Column title="Ativas" subtitle="com cliente atribuído" tone="primary" bms={groups.active} bmStats={bmStats} minBackups={minBackups} onOpen={setDetail} />
        <Column title="Bloqueadas" subtitle="status ≠ ativa" tone="destructive" bms={groups.blocked} bmStats={bmStats} minBackups={minBackups} onOpen={setDetail} />
        <Column title="Sem cliente" subtitle="ativas, sem atribuição" tone="amber" bms={groups.unassigned} bmStats={bmStats} minBackups={minBackups} onOpen={setDetail} />
      </div>

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

const Column: React.FC<{
  title: string;
  subtitle: string;
  tone: 'primary' | 'destructive' | 'amber' | 'neutral';
  bms: BM[];
  bmStats: (id: string) => any;
  minBackups: number;
  onOpen: (bm: BM) => void;
}> = ({ title, subtitle, tone, bms, bmStats, minBackups, onOpen }) => {
  const toneCls = {
    primary: 'border-primary/40 bg-primary/5',
    destructive: 'border-destructive/40 bg-destructive/5',
    amber: 'border-amber-500/40 bg-amber-500/5',
    neutral: 'border-border bg-secondary/20',
  }[tone];
  const badgeCls = {
    primary: 'bg-primary/20 text-primary',
    destructive: 'bg-destructive/20 text-destructive',
    amber: 'bg-amber-500/20 text-amber-300',
    neutral: 'bg-secondary text-foreground',
  }[tone];
  return (
    <div className={cn("rounded-xl border p-3 min-h-[200px]", toneCls)}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-[10px] text-muted-foreground">{subtitle}</div>
        </div>
        <span className={cn("text-[10px] font-bold rounded-full px-2 py-0.5", badgeCls)}>{bms.length}</span>
      </div>
      {bms.length === 0 ? (
        <p className="text-[11px] text-muted-foreground/60 text-center py-8">Nenhuma BM</p>
      ) : (
        <div className="space-y-2">
          {bms.map(bm => {
            const st = bmStats(bm.id);
            const outOfBackup = st.backupCount < minBackups;
            return (
              <button
                key={bm.id}
                onClick={() => onOpen(bm)}
                className="w-full text-left bg-secondary/60 hover:bg-secondary border border-border hover:border-primary/40 rounded-lg p-3 transition-colors"
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
          })}
        </div>
      )}
    </div>
  );
};

export default BMPanelTab;
