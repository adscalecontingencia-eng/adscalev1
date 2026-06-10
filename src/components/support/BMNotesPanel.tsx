import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StickyNote, Send, Trash2, Building2, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface BMLite { id: string; name: string; meta_bm_id: string }
interface Note { id: string; bm_id: string | null; content: string; author_name: string | null; created_at: string }

const BMNotesPanel: React.FC = () => {
  const { user } = useAuth();
  const [bms, setBms] = useState<BMLite[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [content, setContent] = useState('');
  const [bmId, setBmId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [filterBm, setFilterBm] = useState<string>('');

  const load = async () => {
    const [b, n] = await Promise.all([
      supabase.from('meta_business_managers').select('id,name,meta_bm_id').order('name'),
      supabase.from('bm_notes').select('*').order('created_at', { ascending: false }).limit(300),
    ]);
    setBms((b.data || []) as any);
    setNotes((n.data || []) as any);
  };
  useEffect(() => { load(); }, []);

  const bmById = useMemo(() => Object.fromEntries(bms.map(b => [b.id, b])), [bms]);

  const submit = async () => {
    const txt = content.trim();
    if (!txt) { toast.error('Escreva a anotação'); return; }
    const { error } = await supabase.from('bm_notes').insert({
      content: txt,
      bm_id: bmId || null,
      author_id: user?.id || null,
      author_name: user?.name || user?.email || null,
    });
    if (error) { toast.error(error.message); return; }
    setContent(''); setBmId('');
    toast.success('Anotação salva');
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Remover esta anotação?')) return;
    const { error } = await supabase.from('bm_notes').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return notes.filter(n => {
      if (filterBm && n.bm_id !== filterBm) return false;
      if (q) {
        const bmName = n.bm_id ? bmById[n.bm_id]?.name?.toLowerCase() || '' : '';
        if (!n.content.toLowerCase().includes(q) && !bmName.includes(q)) return false;
      }
      return true;
    });
  }, [notes, search, filterBm, bmById]);

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <StickyNote size={16} className="text-amber-400" />
        <h3 className="text-sm font-semibold">Anotações gerais</h3>
        <span className="text-[10px] text-muted-foreground">{notes.length} no total</span>
      </div>

      {/* Editor */}
      <div className="space-y-2">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={2}
          placeholder="Escreva uma anotação para o relatório (pode marcar uma BM específica)..."
          className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary resize-y"
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Building2 size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select
              value={bmId}
              onChange={e => setBmId(e.target.value)}
              className="w-full pl-7 bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary"
            >
              <option value="">Sem BM (geral)</option>
              {bms.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <button
            onClick={submit}
            className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-90"
          >
            <Send size={12} /> Salvar anotação
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar nas anotações..."
            className="w-full pl-7 bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={filterBm}
          onChange={e => setFilterBm(e.target.value)}
          className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary"
        >
          <option value="">Todas BMs</option>
          {bms.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {(search || filterBm) && (
          <button onClick={() => { setSearch(''); setFilterBm(''); }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <X size={12} /> Limpar
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="space-y-1.5 max-h-96 overflow-auto pr-1">
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground/70 text-center py-6">Nenhuma anotação ainda.</p>
        )}
        {filtered.map(n => {
          const bm = n.bm_id ? bmById[n.bm_id] : null;
          return (
            <div key={n.id} className="bg-secondary/30 border border-border rounded-lg px-3 py-2 text-xs">
              <div className="flex items-start justify-between gap-2">
                <p className="text-foreground/90 whitespace-pre-wrap flex-1">{n.content}</p>
                <button onClick={() => remove(n.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 size={11} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                {bm ? (
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/30 px-1.5 py-0.5 rounded">
                    <Building2 size={9} /> {bm.name}
                  </span>
                ) : (
                  <span className="bg-secondary border border-border px-1.5 py-0.5 rounded">Geral</span>
                )}
                <span>·</span>
                <span>{format(new Date(n.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                {n.author_name && <><span>·</span><span>{n.author_name}</span></>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BMNotesPanel;
