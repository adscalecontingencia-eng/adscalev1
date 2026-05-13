import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { PageHero } from '@/components/ui-kit';
import { Search, RefreshCw, Users, Calendar, ImageIcon, Filter, Link2, X, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface PageRow {
  id: string;
  meta_page_id: string;
  name: string;
  category: string | null;
  fan_count: number | null;
  followers_count: number | null;
  created_time: string | null;
  picture_url: string | null;
  is_published: boolean | null;
  is_restricted: boolean | null;
  bm_id: string | null;
  bm?: { id: string; name: string } | null;
  last_synced_at: string | null;
  assignment?: { id: string; client_id: string; client_name: string } | null;
}

interface ClientLite { id: string; name: string; company_name: string | null; }
interface BmLite { id: string; name: string; }

const PagesAdmin: React.FC = () => {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [bms, setBms] = useState<BmLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [bmFilter, setBmFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [assignOpen, setAssignOpen] = useState<string | null>(null);
  const [assignClient, setAssignClient] = useState<string>('');

  const fmtNum = (n: number | null | undefined) =>
    n == null ? '—' : n.toLocaleString('en-US');

  const fetchAll = async () => {
    setLoading(true);
    const [pagesRes, clientsRes, bmsRes, assignsRes] = await Promise.all([
      supabase
        .from('meta_pages')
        .select('id, meta_page_id, name, category, fan_count, followers_count, created_time, picture_url, is_published, is_restricted, bm_id, last_synced_at, bm:meta_business_managers(id, name)')
        .order('followers_count', { ascending: false, nullsFirst: false }),
      supabase.from('clients').select('id, name, company_name').order('name'),
      supabase.from('meta_business_managers').select('id, name').order('name'),
      supabase
        .from('meta_page_assignments')
        .select('id, page_id, client_id, active, client:clients(id, name)')
        .eq('active', true),
    ]);

    if (pagesRes.error) toast.error('Erro ao carregar páginas');
    if (clientsRes.data) setClients(clientsRes.data as any);
    if (bmsRes.data) setBms(bmsRes.data as any);

    const assignByPage = new Map<string, { id: string; client_id: string; client_name: string }>();
    (assignsRes.data || []).forEach((a: any) => {
      assignByPage.set(a.page_id, {
        id: a.id,
        client_id: a.client_id,
        client_name: a.client?.name || '—',
      });
    });

    setPages(
      ((pagesRes.data || []) as any[]).map((p) => ({
        ...p,
        assignment: assignByPage.get(p.id) || null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke('meta-sync', { body: { action: 'sync_pages' } });
    setSyncing(false);
    const payload = data as any;
    if (error || payload?.sucesso === false || payload?.erro) {
      toast.error(payload?.erro || error?.message || 'Erro ao sincronizar', { duration: 9000 });
      return;
    }
    const blockedDetails = payload?.detalhes_bloqueados ? ` (${payload.detalhes_bloqueados} sem detalhes por bloqueio da Meta)` : '';
    toast.success(`Sincronizadas ${payload?.paginas_sincronizadas ?? 0} páginas${blockedDetails}`, { duration: 7000 });
    if (payload?.avisos?.length || payload?.erros?.length) {
      toast.warning('Algumas BMs/campos foram bloqueados pela Meta, mas as páginas disponíveis foram importadas.', { duration: 9000 });
    }
    fetchAll();
  };

  const handleAssign = async (pageId: string) => {
    if (!assignClient) { toast.error('Selecione um cliente'); return; }
    // deactivate current
    await supabase
      .from('meta_page_assignments')
      .update({ active: false })
      .eq('page_id', pageId)
      .eq('active', true);
    const { error } = await supabase
      .from('meta_page_assignments')
      .insert({ page_id: pageId, client_id: assignClient, active: true });
    if (error) { toast.error('Erro ao atribuir página'); return; }
    toast.success('Página atribuída!');
    setAssignOpen(null);
    setAssignClient('');
    fetchAll();
  };

  const handleUnassign = async (assignmentId: string) => {
    const { error } = await supabase
      .from('meta_page_assignments')
      .update({ active: false })
      .eq('id', assignmentId);
    if (error) { toast.error('Erro ao remover atribuição'); return; }
    toast.success('Atribuição removida');
    fetchAll();
  };

  const filtered = useMemo(() => {
    return pages.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.meta_page_id.includes(search)) return false;
      if (bmFilter !== 'all' && p.bm_id !== bmFilter) return false;
      if (statusFilter === 'assigned' && !p.assignment) return false;
      if (statusFilter === 'unassigned' && p.assignment) return false;
      return true;
    });
  }, [pages, search, bmFilter, statusFilter]);

  const totals = useMemo(() => {
    const assigned = pages.filter((p) => p.assignment).length;
    const followers = pages.reduce((s, p) => s + (p.followers_count || p.fan_count || 0), 0);
    return { total: pages.length, assigned, unassigned: pages.length - assigned, followers };
  }, [pages]);

  const inputClass = "w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors";

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Estrutura Meta"
        title={<>Gestão de <span className="text-primary glow-text">páginas</span></>}
        description="Organize páginas do Meta, acompanhe seguidores e data de criação, e atribua cada página ao seu respectivo cliente."
        actions={
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 glow-box disabled:opacity-50"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar páginas'}
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Páginas totais" value={totals.total.toString()} />
        <StatCard label="Atribuídas" value={totals.assigned.toString()} accent="primary" />
        <StatCard label="Disponíveis" value={totals.unassigned.toString()} accent="warning" />
        <StatCard label="Seguidores totais" value={fmtNum(totals.followers)} />
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou ID da página..." className={`${inputClass} pl-10`} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={bmFilter} onChange={(e) => setBmFilter(e.target.value)} className={`${inputClass} max-w-xs`}>
            <option value="all">Todas BMs</option>
            {bms.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {(['all', 'assigned', 'unassigned'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                statusFilter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {s === 'all' ? 'Todas' : s === 'assigned' ? 'Atribuídas' : 'Sem cliente'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground text-sm py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center">
          <ImageIcon size={32} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma página encontrada. Clique em "Sincronizar páginas" para puxar do Meta.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-4 border-glow flex flex-col gap-3"
            >
              <div className="flex items-start gap-3">
                {p.picture_url ? (
                  <img src={p.picture_url} alt={p.name} className="w-12 h-12 rounded-lg object-cover border border-border" loading="lazy" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground"><ImageIcon size={20} /></div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm truncate">{p.name}</h4>
                  <p className="text-[11px] text-muted-foreground truncate">{p.category || 'Sem categoria'}</p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">ID: {p.meta_page_id}</p>
                </div>
                {p.is_restricted && (
                  <span className="text-[10px] bg-destructive/15 text-destructive px-2 py-0.5 rounded font-medium">Restrita</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-secondary/60 rounded-lg p-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Users size={10} /> Seguidores</p>
                  <p className="text-sm font-bold text-primary mt-0.5">{fmtNum(p.followers_count ?? p.fan_count)}</p>
                </div>
                <div className="bg-secondary/60 rounded-lg p-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Calendar size={10} /> Criada em</p>
                  <p className="text-sm font-bold mt-0.5">
                    {p.created_time ? format(new Date(p.created_time), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                  </p>
                </div>
              </div>

              {p.bm?.name && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Building2 size={12} /> BM: <span className="text-foreground">{p.bm.name}</span>
                </p>
              )}

              <div className="border-t border-border pt-3">
                {p.assignment ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                      <p className="text-xs truncate">
                        Cliente: <strong className="text-foreground">{p.assignment.client_name}</strong>
                      </p>
                    </div>
                    <button onClick={() => handleUnassign(p.assignment!.id)} className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1">
                      <X size={11} /> Remover
                    </button>
                  </div>
                ) : assignOpen === p.id ? (
                  <div className="flex gap-2">
                    <select value={assignClient} onChange={(e) => setAssignClient(e.target.value)} className={`${inputClass} flex-1 py-1.5 text-xs`}>
                      <option value="">Selecione um cliente...</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}{c.company_name ? ` (${c.company_name})` : ''}</option>
                      ))}
                    </select>
                    <button onClick={() => handleAssign(p.id)} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90">OK</button>
                    <button onClick={() => { setAssignOpen(null); setAssignClient(''); }} className="px-2 text-muted-foreground hover:text-foreground"><X size={14} /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAssignOpen(p.id); setAssignClient(''); }}
                    className="w-full flex items-center justify-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20"
                  >
                    <Link2 size={12} /> Atribuir cliente
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; accent?: 'primary' | 'warning' }> = ({ label, value, accent }) => (
  <div className="bg-card border border-border rounded-xl p-4">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className={cn(
      "font-display text-2xl font-bold mt-1",
      accent === 'primary' ? 'text-primary' : accent === 'warning' ? 'text-warning' : 'text-foreground'
    )}>{value}</p>
  </div>
);

export default PagesAdmin;
