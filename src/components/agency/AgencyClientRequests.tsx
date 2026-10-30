import React, { useCallback, useEffect, useState } from 'react';
import { format, addHours } from 'date-fns';
import { Send, Save, Inbox, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const TYPE_LABEL: Record<string, string> = { add_ad_account: 'Adicionar conta de anúncio', add_page: 'Adicionar página', add_bm: 'Adicionar BM', other: 'Outro' };
const STATUSES = [{ v: 'pendente', l: 'Pendente' }, { v: 'em_andamento', l: 'Em andamento' }, { v: 'concluida', l: 'Concluída' }, { v: 'cancelada', l: 'Cancelada' }];

const demoRequests = (subs: any[]) => subs.slice(0, 2).map((s, i) => ({
  id: `demo-req-${i}`, client_id: s.id, request_type: i === 0 ? 'add_ad_account' : 'add_page', quantity: i === 0 ? 3 : 2,
  bm_meta_id: i === 0 ? '104857392018475' : null, page_names: i === 1 ? ['Loja Oficial', 'Loja Promo'] : null,
  description: i === 0 ? 'Preciso de 3 contas novas para escalar a campanha.' : null, status: 'pendente',
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

  const nameOf = (r: any) => subs.find(s => s.client_id === r.client_id || s.id === r.client_id)?.name ?? 'Cliente';
  const d = (r: any) => draft[r.id] ?? { bm: r.agency_bm_id || '', notes: r.agency_notes || '' };
  const setD = (id: string, v: Partial<{ bm: string; notes: string }>) => setDraft(p => ({ ...p, [id]: { ...d(reqs.find(r => r.id === id)), ...v } }));

  const save = async (r: any, opts: { status?: string; forward?: boolean }) => {
    const v = d(r);
    if (opts.forward && !v.bm.trim()) return void toast.error('Informe o ID da BM da agência antes de enviar.');
    setBusy(r.id);
    if (isDemo) {
      setReqs(p => p.map(x => x.id === r.id ? { ...x, agency_bm_id: v.bm, agency_notes: v.notes, status: opts.status ?? x.status, forwarded_to_adscale_at: opts.forward ? new Date().toISOString() : x.forwarded_to_adscale_at } : x));
      setBusy(null); toast.success(opts.forward ? 'Pedido enviado para a AD SCALE (demonstração).' : 'Salvo (demonstração).'); return;
    }
    const { error } = await supabase.rpc('agency_handle_support_request', { _id: r.id, _agency_bm_id: v.bm, _agency_notes: v.notes, _status: opts.status ?? null, _forward: !!opts.forward });
    setBusy(null);
    if (error) return void toast.error('Não foi possível salvar o pedido.');
    toast.success(opts.forward ? 'Pedido enviado para a AD SCALE.' : 'Pedido atualizado.');
    setDraft(p => { const n = { ...p }; delete n[r.id]; return n; });
    load();
  };

  const list = reqs.filter(r => filter === 'todos' ? true : filter === 'enviados' ? !!r.forwarded_to_adscale_at : !r.forwarded_to_adscale_at);
  const open = reqs.filter(r => !r.forwarded_to_adscale_at).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Inbox size={18} className="text-primary" />Pedidos dos clientes</h3>
        {open > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">{open} aguardando envio</span>}
        <div className="ml-auto flex gap-2 text-xs">
          {([['abertos', 'Aguardando envio'], ['enviados', 'Enviados à AD SCALE'], ['todos', 'Todos']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} className={`px-3 py-1.5 rounded-full border transition-colors ${filter === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 text-muted-foreground hover:text-foreground'}`}>{l}</button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Seus clientes pedem pelo painel deles. Complete com o ID da BM da agência e os nomes das contas, e envie para a AD SCALE adicionar as contas nas duas BMs.</p>

      {list.map(r => {
        const v = d(r); const sent = !!r.forwarded_to_adscale_at;
        return (
          <div key={r.id} className={`rounded-xl border p-4 space-y-3 bg-card/60 ${sent ? 'border-border/60' : 'border-primary/40'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{TYPE_LABEL[r.request_type] ?? r.request_type}{r.quantity ? ` ×${r.quantity}` : ''}</p>
              <span className="text-xs text-primary">{nameOf(r)}</span>
              <span className="text-[11px] text-muted-foreground">· {format(new Date(r.created_at), 'dd/MM/yyyy HH:mm')}</span>
              {sent && <span className="ml-auto inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary"><CheckCircle2 size={12} />Enviado à AD SCALE em {format(new Date(r.forwarded_to_adscale_at), 'dd/MM HH:mm')}</span>}
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-secondary/40 px-3 py-2">BM do cliente: <b className="font-mono">{r.bm_meta_id || '—'}</b></div>
              {Array.isArray(r.page_names) && r.page_names.length > 0 && <div className="rounded-md bg-secondary/40 px-3 py-2">Páginas: <b>{r.page_names.join(', ')}</b></div>}
            </div>
            {r.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">Pedido do cliente: {r.description}</p>}
            <div className="grid sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">ID da BM da agência</label>
                <Input placeholder="Ex.: 1234567890" maxLength={40} value={v.bm} onChange={e => setD(r.id, { bm: e.target.value.replace(/[^\d]/g, '') })} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</label>
                <Select value={r.status} onValueChange={st => save(r, { status: st })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Nome das contas de anúncio e observações</label>
                <Textarea rows={3} maxLength={2000} placeholder={'Ex.:\nLOJA-CA-01, LOJA-CA-02, LOJA-CA-03\nFuso: São Paulo · Moeda: USD'} value={v.notes} onChange={e => setD(r.id, { notes: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" className="gap-2" disabled={busy === r.id} onClick={() => save(r, {})}><Save size={14} />Salvar</Button>
              {!sent && <Button size="sm" className="gap-2" disabled={busy === r.id} onClick={() => save(r, { forward: true, status: 'em_andamento' })}><Send size={14} />Enviar pedido para AD SCALE</Button>}
            </div>
          </div>
        );
      })}
      {!list.length && <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">Nenhum pedido aqui.</div>}
    </div>
  );
};
