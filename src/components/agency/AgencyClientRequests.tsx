import React, { useCallback, useEffect, useState } from 'react';
import { tr } from '@/i18n';
import { format, addHours } from 'date-fns';
import { Send, Save, Inbox, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const TYPE_KEYS = ['add_ad_account', 'add_page', 'add_bm', 'other'];
const typeLabel = (t: string) => (TYPE_KEYS.includes(t) ? tr(`agency.req.type.${t}`) : t);
const STATUSES = ['pendente', 'em_andamento', 'concluida', 'cancelada'].map(v => ({ v, get l() { return tr(`agency.req.st.${v}`); } }));

const demoRequests = (subs: any[]) => subs.slice(0, 2).map((s, i) => ({
  id: `demo-req-${i}`, client_id: s.id, request_type: i === 0 ? 'add_ad_account' : 'add_page', quantity: i === 0 ? 3 : 2,
  bm_meta_id: i === 0 ? '104857392018475' : null, page_names: i === 1 ? ['Loja Oficial', 'Loja Promo'] : null,
  description: i === 0 ? tr('agency.req.demoDesc') : null, status: 'pendente',
  created_at: addHours(new Date(), -(i + 1) * 5).toISOString(), agency_bm_id: null, agency_notes: null, forwarded_to_adscale_at: null,
}));

/** Pedidos de suporte feitos pelos clientes da agência no próprio painel. A agência completa e envia para a AD SCALE. */
export const AgencyClientRequests: React.FC<{ agencyId: string; subs: any[]; isDemo?: boolean }> = ({ agencyId, subs, isDemo }) => {
  const [reqs, setReqs] = useState<any[]>([]);
  const [draft, setDraft] = useState<Record<string, { bm: string; notes: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<'abertos' | 'enviados' | 'todos'>('abertos');

  const load = useCallback(async () => {
    if (isDemo) { setReqs(p => p.length ? p : demoRequests(subs)); return; }
    const { data } = await supabase.from('support_requests').select('*').eq('agency_client_id', agencyId).order('created_at', { ascending: false }).limit(300);
    setReqs(data || []);
  }, [agencyId, isDemo, subs]);
  useEffect(() => { load(); }, [load]);

  const nameOf = (r: any) => subs.find(s => s.client_id === r.client_id || s.id === r.client_id)?.name ?? tr('agency.req.client');
  const d = (r: any) => draft[r.id] ?? { bm: r.agency_bm_id || '', notes: r.agency_notes || '' };
  const setD = (id: string, v: Partial<{ bm: string; notes: string }>) => setDraft(p => ({ ...p, [id]: { ...d(reqs.find(r => r.id === id)), ...v } }));

  const save = async (r: any, opts: { status?: string; forward?: boolean }) => {
    const v = d(r);
    if (opts.forward && !v.bm.trim()) return void toast.error(tr('agency.req.needBm'));
    setBusy(r.id);
    if (isDemo) {
      setReqs(p => p.map(x => x.id === r.id ? { ...x, agency_bm_id: v.bm, agency_notes: v.notes, status: opts.status ?? x.status, forwarded_to_adscale_at: opts.forward ? new Date().toISOString() : x.forwarded_to_adscale_at } : x));
      setBusy(null); toast.success(opts.forward ? tr('agency.req.sentDemo') : tr('agency.req.savedDemo')); return;
    }
    const { error } = await supabase.rpc('agency_handle_support_request', { _id: r.id, _agency_bm_id: v.bm, _agency_notes: v.notes, _status: opts.status ?? null, _forward: !!opts.forward });
    setBusy(null);
    if (error) return void toast.error(tr('agency.req.saveError'));
    toast.success(opts.forward ? tr('agency.req.sent') : tr('agency.req.updated'));
    setDraft(p => { const n = { ...p }; delete n[r.id]; return n; });
    load();
  };

  const list = reqs.filter(r => filter === 'todos' ? true : filter === 'enviados' ? !!r.forwarded_to_adscale_at : !r.forwarded_to_adscale_at);
  const open = reqs.filter(r => !r.forwarded_to_adscale_at).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Inbox size={18} className="text-primary" />{tr('agency.req.title')}</h3>
        {open > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">{tr('agency.req.waitingN', { n: open })}</span>}
        <div className="ml-auto flex gap-2 text-xs">
          {([['abertos', tr('agency.req.f.open')], ['enviados', tr('agency.req.f.sent')], ['todos', tr('agency.req.f.all')]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} className={`px-3 py-1.5 rounded-full border transition-colors ${filter === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 text-muted-foreground hover:text-foreground'}`}>{l}</button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{tr('agency.req.intro')}</p>

      {list.map(r => {
        const v = d(r); const sent = !!r.forwarded_to_adscale_at;
        return (
          <div key={r.id} className={`rounded-xl border p-4 space-y-3 bg-card/60 ${sent ? 'border-border/60' : 'border-primary/40'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{typeLabel(r.request_type)}{r.quantity ? ` ×${r.quantity}` : ''}</p>
              <span className="text-xs text-primary">{nameOf(r)}</span>
              <span className="text-[11px] text-muted-foreground">· {format(new Date(r.created_at), 'dd/MM/yyyy HH:mm')}</span>
              {sent && <span className="ml-auto inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary"><CheckCircle2 size={12} />{tr('agency.req.sentAt', { when: format(new Date(r.forwarded_to_adscale_at), 'dd/MM HH:mm') })}</span>}
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-secondary/40 px-3 py-2">{tr('agency.req.clientBm')} <b className="font-mono">{r.bm_meta_id || '—'}</b></div>
              {Array.isArray(r.page_names) && r.page_names.length > 0 && <div className="rounded-md bg-secondary/40 px-3 py-2">{tr('agency.req.pages')} <b>{r.page_names.join(', ')}</b></div>}
            </div>
            {r.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tr('agency.req.clientRequest', { text: r.description })}</p>}
            <div className="grid sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">{tr('agency.req.agencyBm')}</label>
                <Input placeholder={tr('agency.req.bmPh')} maxLength={40} value={v.bm} onChange={e => setD(r.id, { bm: e.target.value.replace(/[^\d]/g, '') })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">{tr('agency.req.status')}</label>
                <Select value={r.status} onValueChange={st => save(r, { status: st })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">{tr('agency.req.namesNotes')}</label>
                <Textarea rows={3} maxLength={2000} placeholder={tr('agency.req.notesPh')} value={v.notes} onChange={e => setD(r.id, { notes: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" className="gap-2" disabled={busy === r.id} onClick={() => save(r, {})}><Save size={14} />{tr('agency.req.save')}</Button>
              {!sent && <Button size="sm" className="gap-2" disabled={busy === r.id} onClick={() => save(r, { forward: true, status: 'em_andamento' })}><Send size={14} />{tr('agency.req.forward')}</Button>}
            </div>
          </div>
        );
      })}
      {!list.length && <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">{tr('agency.req.empty')}</div>}
    </div>
  );
};
