import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDateLocal } from '@/lib/date-utils';
import { Building2, Plus, Users, X, Save, Trash2, Calendar as CalendarIcon, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BM { id: string; meta_bm_id: string; name: string; status: string | null }
interface Profile { id: string; bm_id: string; profile_name: string; profile_role?: string | null; notes?: string | null }
interface Activity { id: string; bm_id: string | null; activity_date: string; availability: string; accounts_available: number | null; activity_notes: string; created_at: string }

const AVAIL_OPTS = [
  { v: 'disponivel', label: 'Disponível', cls: 'bg-primary/15 text-primary border-primary/40' },
  { v: 'parcial', label: 'Parcial', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
  { v: 'indisponivel', label: 'Indisponível', cls: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40' },
  { v: 'bloqueada', label: 'Bloqueada', cls: 'bg-destructive/15 text-destructive border-destructive/40' },
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
    if (error) { toast.error('Erro: ' + error.message); return; }
    setNewProfileName('');
    setShowProfileDialog(null);
    toast.success('Perfil adicionado');
    load();
  };

  const removeProfile = async (id: string) => {
    if (!confirm('Remover este perfil da BM?')) return;
    await supabase.from('bm_profiles').delete().eq('id', id);
    load();
  };

  const submitLog = async (bmId: string) => {
    const f = logForm[bmId];
    if (!f?.notes?.trim()) { toast.error('Descreva a atividade'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('bm_activity_log').insert({
      bm_id: bmId,
      availability: f.availability || 'disponivel',
      accounts_available: Number(f.accounts || 0),
      activity_notes: f.notes.trim(),
      created_by: user?.id,
    });
    if (error) { toast.error('Erro: ' + error.message); return; }
    setLogForm(prev => ({ ...prev, [bmId]: { availability: 'disponivel', accounts: 0, notes: '' } }));
    toast.success('Atividade registrada');
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
        <KPI icon={Building2} label="BMs cadastradas" value={bms.length} color="text-primary" />
        <KPI icon={Users} label="Perfis distintos" value={profileGroups.length} color="text-sky-400" />
        <KPI icon={Sparkles} label="Disponíveis hoje" value={
          new Set(activities.filter(a => a.activity_date === todayStr && a.availability === 'disponivel').map(a => a.bm_id)).size
        } color="text-emerald-400" />
        <KPI icon={CalendarIcon} label="Registros hoje" value={todayCount} color="text-amber-400" />
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar BM por nome ou ID..."
            className="flex-1 min-w-[200px] bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
          {filterProfile && (
            <button onClick={() => setFilterProfile('')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <X size={12} /> Limpar filtro
            </button>
          )}
        </div>
        {profileGroups.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Perfis vinculados (clique para filtrar)</div>
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
          <p className="text-center text-muted-foreground text-sm py-8">Nenhuma BM encontrada.</p>
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
                    {last?.activity_date && <span className="opacity-70 ml-1">· {format(parseDateLocal(last.activity_date), 'dd/MM', { locale: ptBR })}</span>}
                  </span>
                )}
                {!last && <span className="text-[10px] text-muted-foreground/60">Sem registro</span>}
              </div>

              {isOpen && (
                <div className="border-t border-border p-4 space-y-4 bg-secondary/10" onClick={e => e.stopPropagation()}>
                  {/* Perfis */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Perfis vinculados</h4>
                      <button onClick={() => { setShowProfileDialog(bm.id); setNewProfileName(''); }}
                        className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Plus size={12} /> Adicionar perfil
                      </button>
                    </div>
                    {bmProfiles.length === 0 ? (
                      <p className="text-xs text-muted-foreground/70">Nenhum perfil cadastrado nesta BM.</p>
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
                    {showProfileDialog === bm.id && (
                      <div className="mt-2 flex gap-2">
                        <input
                          autoFocus
                          value={newProfileName}
                          onChange={e => setNewProfileName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addProfile(bm.id)}
                          placeholder="Nome do usuário Meta (ex: João Silva)"
                          className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                        />
                        <button onClick={() => addProfile(bm.id)} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold">Salvar</button>
                        <button onClick={() => setShowProfileDialog(null)} className="text-muted-foreground px-2"><X size={14} /></button>
                      </div>
                    )}
                  </div>

                  {/* Registro diário */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Registrar atividade de hoje</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_auto] gap-2">
                      <input
                        value={f.notes}
                        onChange={e => setLogForm(p => ({ ...p, [bm.id]: { ...f, notes: e.target.value } }))}
                        placeholder="O que foi feito / status atual..."
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
                        placeholder="Contas disp."
                        className="bg-secondary border border-border rounded-lg px-2 py-2 text-sm"
                      />
                      <button onClick={() => submitLog(bm.id)}
                        className="bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                        <Save size={12} /> Registrar
                      </button>
                    </div>
                  </div>

                  {/* Histórico */}
                  {acts.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Histórico ({acts.length})</h4>
                      <div className="space-y-1 max-h-56 overflow-auto pr-1">
                        {acts.map(a => {
                          const opt = AVAIL_OPTS.find(o => o.v === a.availability);
                          return (
                            <div key={a.id} className="flex items-start gap-2 bg-card border border-border rounded-lg px-3 py-2 text-xs">
                              <span className={cn("text-[10px] px-1.5 py-0.5 rounded border shrink-0", opt?.cls)}>{opt?.label}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-foreground/90 whitespace-pre-wrap">{a.activity_notes}</p>
                                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                  {format(parseDateLocal(a.activity_date), "dd 'de' MMM", { locale: ptBR })}
                                  {a.accounts_available ? ` · ${a.accounts_available} contas` : ''}
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
