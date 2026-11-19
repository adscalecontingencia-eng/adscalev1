import React, { useEffect, useMemo, useState } from 'react';
import { tr } from '@/i18n';
import { getDateLocale } from '@/i18n/format';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDateLocal } from '@/lib/date-utils';
import { Building2, Plus, Users, X, Save, Trash2, Calendar as CalendarIcon, ChevronDown, ChevronRight, Sparkles, RefreshCw, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import BMNotesPanel from './BMNotesPanel';

interface BM { id: string; meta_bm_id: string; name: string; status: string | null }
interface Profile { id: string; bm_id: string; profile_name: string; profile_role?: string | null; notes?: string | null }
interface Activity { id: string; bm_id: string | null; activity_date: string; availability: string; accounts_available: number | null; activity_notes: string; created_at: string }

const AVAIL_OPTS = [
  { v: 'disponivel', get label() { return tr('sup.bma.av.disponivel'); }, cls: 'bg-primary/15 text-primary border-primary/40' },
  { v: 'parcial', get label() { return tr('sup.bma.av.parcial'); }, cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
  { v: 'indisponivel', get label() { return tr('sup.bma.av.indisponivel'); }, cls: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40' },
  { v: 'bloqueada', get label() { return tr('sup.bma.av.bloqueada'); }, cls: 'bg-destructive/15 text-destructive border-destructive/40' },
];

// Cor estável por nome de perfil (hash simples)
const profileColor = (name: string) => {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hues = [142, 200, 280, 340, 30, 60, 180, 220, 320];
  const hue = hues[h % hues.length];
  return { bg: `hsl(${hue} 80% 16%)`, border: `hsl(${hue} 70% 45% / 0.5)`, fg: `hsl(${hue} 90% 75%)` };
};

const BMActivityTab: React.FC = () => {
  const [bms, setBms] = useState<BM[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [filterProfile, setFilterProfile] = useState<string>('');
  const [showProfileDialog, setShowProfileDialog] = useState<string | null>(null); // bm_id
  const [newProfileName, setNewProfileName] = useState('');
  const [logForm, setLogForm] = useState<Record<string, { availability: string; accounts: number; notes: string }>>({});
  const [metaUsers, setMetaUsers] = useState<Record<string, { id: string; name: string; email?: string | null; role?: string | null; kind: string }[]>>({});
  const [loadingMeta, setLoadingMeta] = useState<Record<string, boolean>>({});

  const fetchMetaUsers = async (bm: BM) => {
    setLoadingMeta(p => ({ ...p, [bm.id]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('meta-bm-users', { body: { meta_bm_id: bm.meta_bm_id } });
      if (error || data?.erro) throw new Error(error?.message || data?.erro);
      const users = (data?.usuarios || []) as any[];
      setMetaUsers(p => ({ ...p, [bm.id]: users }));
      if (users.length === 0) toast.info(tr('sup.bma.noUsers'));
      else toast.success(tr('sup.bma.usersLoaded', { n: users.length }));
      if (data?.erros?.length) console.warn('Meta errors:', data.erros);
    } catch (e: any) {
      toast.error(tr('sup.bma.metaErr') + ' ' + e.message);
    } finally {
      setLoadingMeta(p => ({ ...p, [bm.id]: false }));
    }
  };

  const addProfileFromMeta = async (bmId: string, name: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('bm_profiles').insert({ bm_id: bmId, profile_name: name, created_by: user?.id });
    if (error) { toast.error(tr('sup.bma.err') + ' ' + error.message); return; }
    toast.success(tr('sup.bma.linked', { name }));
    load();
  };

  const load = async () => {
    const [bRes, pRes, aRes] = await Promise.all([
      supabase.from('meta_business_managers').select('id,meta_bm_id,name,status').order('name'),
      supabase.from('bm_profiles').select('*').order('profile_name'),
      supabase.from('bm_activity_log').select('*').order('activity_date', { ascending: false }).limit(500),
    ]);
    setBms((bRes.data || []) as BM[]);
    setProfiles((pRes.data || []) as Profile[]);
    setActivities((aRes.data || []) as Activity[]);
  };

  useEffect(() => { load(); }, []);

  // Agrupa perfis por nome para listar todos os perfis distintos
  const profileGroups = useMemo(() => {
    const map = new Map<string, { name: string; bmIds: Set<string> }>();
    profiles.forEach(p => {
      if (!map.has(p.profile_name)) map.set(p.profile_name, { name: p.profile_name, bmIds: new Set() });
      map.get(p.profile_name)!.bmIds.add(p.bm_id);
    });
    return Array.from(map.values()).sort((a, b) => b.bmIds.size - a.bmIds.size);
  }, [profiles]);

  const filteredBms = useMemo(() => {
    const q = search.toLowerCase().trim();
    return bms.filter(b => {
      if (q && !(b.name.toLowerCase().includes(q) || b.meta_bm_id.includes(q))) return false;
      if (filterProfile) {
        const has = profiles.some(p => p.bm_id === b.id && p.profile_name === filterProfile);
        if (!has) return false;
      }
      return true;
    });
  }, [bms, search, filterProfile, profiles]);

  const profilesByBm = (bmId: string) => profiles.filter(p => p.bm_id === bmId);
  const activitiesByBm = (bmId: string) => activities.filter(a => a.bm_id === bmId);
  const lastActivity = (bmId: string) => activitiesByBm(bmId)[0];

  const addProfile = async (bmId: string) => {
    const name = newProfileName.trim();
    if (!name) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('bm_profiles').insert({ bm_id: bmId, profile_name: name, created_by: user?.id });
    if (error) { toast.error(tr('sup.bma.err') + ' ' + error.message); return; }
    setNewProfileName('');
    setShowProfileDialog(null);
    toast.success(tr('sup.bma.added'));
    load();
  };

  const removeProfile = async (id: string) => {
    if (!confirm(tr('sup.bma.confirmRemove'))) return;
    await supabase.from('bm_profiles').delete().eq('id', id);
    load();
  };

  const submitLog = async (bmId: string) => {
    const f = logForm[bmId];
    if (!f?.notes?.trim()) { toast.error(tr('sup.bma.describe')); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('bm_activity_log').insert({
      bm_id: bmId,
      availability: f.availability || 'disponivel',
      accounts_available: Number(f.accounts || 0),
      activity_notes: f.notes.trim(),
      created_by: user?.id,
    });
    if (error) { toast.error(tr('sup.bma.err') + ' ' + error.message); return; }
    setLogForm(prev => ({ ...prev, [bmId]: { availability: 'disponivel', accounts: 0, notes: '' } }));
    toast.success(tr('sup.bma.logged'));
    load();
  };

  const deleteActivity = async (id: string) => {
    await supabase.from('bm_activity_log').delete().eq('id', id);
    load();
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayCount = activities.filter(a => a.activity_date === todayStr).length;

  return (
    <div className="space-y-5">
      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI icon={Building2} label={tr('sup.bma.bms')} value={bms.length} color="text-primary" />
        <KPI icon={Users} label={tr('sup.bma.profiles')} value={profileGroups.length} color="text-sky-400" />
        <KPI icon={Sparkles} label={tr('sup.bma.availToday')} value={
          new Set(activities.filter(a => a.activity_date === todayStr && a.availability === 'disponivel').map(a => a.bm_id)).size
        } color="text-emerald-400" />
        <KPI icon={CalendarIcon} label={tr('sup.bma.logsToday')} value={todayCount} color="text-amber-400" />
      </div>

      <BMNotesPanel />


      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tr('sup.bma.search')}
            className="flex-1 min-w-[200px] bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
          {filterProfile && (
            <button onClick={() => setFilterProfile('')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <X size={12} /> {tr('sup.bma.clearFilter')}
            </button>
          )}
        </div>
        {profileGroups.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{tr('sup.bma.linkedProfilesClick')}</div>
            <div className="flex flex-wrap gap-1.5">
              {profileGroups.map(p => {
                const c = profileColor(p.name);
                const active = filterProfile === p.name;
                return (
                  <button
                    key={p.name}
                    onClick={() => setFilterProfile(active ? '' : p.name)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 transition-opacity",
                      active ? "ring-2 ring-primary/60" : "opacity-90 hover:opacity-100"
                    )}
                    style={{ background: c.bg, borderColor: c.border, color: c.fg }}
                  >
                    <Users size={11} />
                    {p.name}
                    <span className="text-[10px] opacity-80">· {p.bmIds.size}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Lista de BMs */}
      <div className="space-y-2">
        {filteredBms.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">{tr('sup.bma.noBm')}</p>
        )}
        {filteredBms.map(bm => {
          const bmProfiles = profilesByBm(bm.id);
          const last = lastActivity(bm.id);
          const lastOpt = last ? AVAIL_OPTS.find(o => o.v === last.availability) : null;
          const isOpen = !!expanded[bm.id];
          const f = logForm[bm.id] || { availability: 'disponivel', accounts: 0, notes: '' };
          const acts = activitiesByBm(bm.id);

          return (
            <div key={bm.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 flex flex-wrap items-center gap-3 cursor-pointer hover:bg-secondary/30"
                onClick={() => setExpanded(p => ({ ...p, [bm.id]: !isOpen }))}>
                {isOpen ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                <Building2 size={16} className="text-primary" />
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold">{bm.name}</h3>
                    <span className="text-[10px] font-mono text-muted-foreground">{bm.meta_bm_id}</span>
                  </div>
                  {bmProfiles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {bmProfiles.map(p => {
                        const c = profileColor(p.profile_name);
                        return (
                          <span key={p.id} className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 border"
                            style={{ background: c.bg, borderColor: c.border, color: c.fg }}>
                            <Users size={9} /> {p.profile_name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                {lastOpt && (
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", lastOpt.cls)}>
                    {lastOpt.label}
                    {last?.activity_date && <span className="opacity-70 ml-1">· {format(parseDateLocal(last.activity_date), 'dd/MM', { locale: getDateLocale() })}</span>}
                  </span>
                )}
                {!last && <span className="text-[10px] text-muted-foreground/60">{tr('sup.bma.noLog')}</span>}
              </div>

              {isOpen && (
                <div className="border-t border-border p-4 space-y-4 bg-secondary/10" onClick={e => e.stopPropagation()}>
                  {/* Perfis */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{tr('sup.bma.linkedProfiles')}</h4>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => fetchMetaUsers(bm)}
                          disabled={loadingMeta[bm.id]}
                          className="text-xs text-sky-400 hover:underline flex items-center gap-1 disabled:opacity-50"
                          title={tr('sup.bma.searchMetaTitle')}
                        >
                          <RefreshCw size={12} className={loadingMeta[bm.id] ? 'animate-spin' : ''} />
                          {loadingMeta[bm.id] ? tr('sup.bma.searching') : tr('sup.bma.searchMeta')}
                        </button>
                        <button onClick={() => { setShowProfileDialog(bm.id); setNewProfileName(''); }}
                          className="text-xs text-primary hover:underline flex items-center gap-1">
                          <Plus size={12} /> {tr('sup.bma.addManual')}
                        </button>
                      </div>
                    </div>
                    {bmProfiles.length === 0 ? (
                      <p className="text-xs text-muted-foreground/70">{tr('sup.bma.noProfiles')}</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {bmProfiles.map(p => {
                          const c = profileColor(p.profile_name);
                          return (
                            <span key={p.id} className="text-xs px-2 py-1 rounded-md inline-flex items-center gap-1.5 border"
                              style={{ background: c.bg, borderColor: c.border, color: c.fg }}>
                              <Users size={11} /> {p.profile_name}
                              <button onClick={() => removeProfile(p.id)} className="opacity-60 hover:opacity-100 hover:text-destructive">
                                <X size={11} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Sugestões vindas da Meta */}
                    {metaUsers[bm.id] && metaUsers[bm.id].length > 0 && (
                      <div className="mt-3 p-2 rounded-lg border border-sky-500/30 bg-sky-500/5">
                        <div className="text-[10px] uppercase tracking-wider text-sky-400 mb-1.5 flex items-center gap-1">
                          <Sparkles size={10} /> {tr('sup.bma.found', { n: metaUsers[bm.id].length })}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {metaUsers[bm.id].map(u => {
                            const already = bmProfiles.some(p => p.profile_name.toLowerCase() === (u.name || '').toLowerCase());
                            return (
                              <button
                                key={u.id + u.kind}
                                disabled={already}
                                onClick={() => addProfileFromMeta(bm.id, u.name)}
                                className={cn(
                                  "text-xs px-2 py-1 rounded-md inline-flex items-center gap-1.5 border transition-colors",
                                  already
                                    ? "opacity-50 cursor-not-allowed bg-secondary border-border"
                                    : "bg-secondary border-border hover:border-sky-400 hover:bg-sky-500/10"
                                )}
                                title={already ? tr('sup.bma.already') : tr('sup.bma.addUser', { name: u.name + (u.role ? ' · ' + u.role : '') })}
                              >
                                {already ? <Users size={11} /> : <Download size={11} />}
                                <span>{u.name || u.id}</span>
                                {u.role && <span className="text-[9px] opacity-60">· {u.role}</span>}
                                <span className="text-[9px] opacity-50">· {u.kind}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {showProfileDialog === bm.id && (
                      <div className="mt-2 flex gap-2">
                        <input
                          autoFocus
                          value={newProfileName}
                          onChange={e => setNewProfileName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addProfile(bm.id)}
                          placeholder={tr('sup.bma.namePh')}
                          className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                        />
                        <button onClick={() => addProfile(bm.id)} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold">{tr('sup.bma.save')}</button>
                        <button onClick={() => setShowProfileDialog(null)} className="text-muted-foreground px-2"><X size={14} /></button>
                      </div>
                    )}
                  </div>

                  {/* Registro diário */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{tr('sup.bma.logToday')}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_auto] gap-2">
                      <input
                        value={f.notes}
                        onChange={e => setLogForm(p => ({ ...p, [bm.id]: { ...f, notes: e.target.value } }))}
                        placeholder={tr('sup.bma.whatPh')}
                        className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                      />
                      <select
                        value={f.availability}
                        onChange={e => setLogForm(p => ({ ...p, [bm.id]: { ...f, availability: e.target.value } }))}
                        className="bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                      >
                        {AVAIL_OPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                      </select>
                      <input
                        type="number" min={0}
                        value={f.accounts}
                        onChange={e => setLogForm(p => ({ ...p, [bm.id]: { ...f, accounts: Number(e.target.value) } }))}
                        placeholder={tr('sup.bma.accPh')}
                        className="bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                      />
                      <button onClick={() => submitLog(bm.id)}
                        className="bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                        <Save size={12} /> {tr('sup.bma.log')}
                      </button>
                    </div>
                  </div>

                  {/* Histórico */}
                  {acts.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{tr('sup.bma.history', { n: acts.length })}</h4>
                      <div className="space-y-1 max-h-56 overflow-auto pr-1">
                        {acts.map(a => {
                          const opt = AVAIL_OPTS.find(o => o.v === a.availability);
                          return (
                            <div key={a.id} className="flex items-start gap-2 bg-card border border-border rounded-lg px-3 py-2 text-xs">
                              <span className={cn("text-[10px] px-1.5 py-0.5 rounded border shrink-0", opt?.cls)}>{opt?.label}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-foreground/90 whitespace-pre-wrap">{a.activity_notes}</p>
                                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                  {format(parseDateLocal(a.activity_date), "d MMM", { locale: getDateLocale() })}
                                  {a.accounts_available ? ` ${tr('sup.bma.accounts', { n: a.accounts_available })}` : ''}
                                </p>
                              </div>
                              <button onClick={() => deleteActivity(a.id)} className="text-muted-foreground hover:text-destructive">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const KPI: React.FC<{ icon: any; label: string; value: number; color: string }> = ({ icon: Icon, label, value, color }) => (
  <div className="bg-card border border-border rounded-xl p-4">
    <Icon size={16} className={color} />
    <div className={cn("text-2xl font-bold mt-1.5", color)}>{value}</div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
  </div>
);

export default BMActivityTab;
