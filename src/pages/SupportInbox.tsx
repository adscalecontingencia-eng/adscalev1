import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHero } from '@/components/ui-kit';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MessageSquare, Ticket, Send, Bot, User, Headphones } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Msg = { id: string; client_id: string; role: string; content: string; created_at: string };
type Req = { id: string; client_id: string; request_type: string; description: string | null; quantity: number | null; status: string; created_at: string; client?: { name: string } | null };

const STATUSES = ['pendente', 'em_andamento', 'concluida', 'cancelada'];
const clean = (s: string) => s.replace('[WHATSAPP]', '').trim();

const SupportInbox: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth() as any;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState('pendente');

  const fmt = (d: string) => new Date(d).toLocaleString(i18n.language);

  const load = async () => {
    const [m, r, c] = await Promise.all([
      supabase.from('support_chat_messages').select('id, client_id, role, content, created_at').order('created_at', { ascending: true }).limit(2000),
      supabase.from('support_requests').select('id, client_id, request_type, description, quantity, status, created_at, client:clients(name)').order('created_at', { ascending: false }).limit(500),
      supabase.from('clients').select('id, name'),
    ]);
    setMsgs((m.data as Msg[]) ?? []);
    setReqs((r.data as any) ?? []);
    setClients(Object.fromEntries((c.data ?? []).map((x: any) => [x.id, x.name])));
  };

  useEffect(() => { load(); }, []);

  const conversations = useMemo(() => {
    const map = new Map<string, Msg[]>();
    msgs.forEach(m => { map.set(m.client_id, [...(map.get(m.client_id) ?? []), m]); });
    return [...map.entries()]
      .map(([id, list]) => ({ id, list, last: list[list.length - 1] }))
      .sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
  }, [msgs]);

  const current = conversations.find(c => c.id === selected);

  const sendReply = async () => {
    const text = reply.trim();
    if (!text || !selected || !user) return;
    setSending(true);
    const { error } = await supabase.from('support_chat_messages').insert({ client_id: selected, user_id: user.id, role: 'agent', content: text });
    setSending(false);
    if (error) return toast.error(t('supportInbox.replyError'));
    setReply('');
    toast.success(t('supportInbox.replySent'));
    load();
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('support_requests').update({ status, resolved_at: status === 'concluida' ? new Date().toISOString() : null }).eq('id', id);
    if (error) return toast.error(t('supportInbox.statusError'));
    setReqs(prev => prev.map(r => (r.id === id ? { ...r, status } : r)));
  };

  const shownReqs = filter === 'all' ? reqs : reqs.filter(r => r.status === filter);
  const roleIcon = (r: string) => (r === 'user' ? User : r === 'agent' ? Headphones : Bot);

  return (
    <div className="space-y-6">
      <PageHero title={t('supportInbox.title')} subtitle={t('supportInbox.subtitle')} />
      <Tabs defaultValue="chats">
        <TabsList>
          <TabsTrigger value="chats" className="gap-2"><MessageSquare size={14} /> {t('supportInbox.chats')} ({conversations.length})</TabsTrigger>
          <TabsTrigger value="tickets" className="gap-2"><Ticket size={14} /> {t('supportInbox.tickets')} ({reqs.filter(r => r.status === 'pendente').length})</TabsTrigger>
        </TabsList>

        <TabsContent value="chats">
          <div className="grid md:grid-cols-[280px_1fr] gap-4">
            <div className="bg-card border border-border rounded-xl overflow-y-auto max-h-[600px]">
              {conversations.length === 0 && <p className="text-xs text-muted-foreground p-4">{t('supportInbox.noChats')}</p>}
              {conversations.map(c => (
                <button key={c.id} onClick={() => setSelected(c.id)}
                  className={cn('w-full text-left px-4 py-3 border-b border-border/60 hover:bg-muted/40', selected === c.id && 'bg-primary/10')}>
                  <p className="text-sm font-medium truncate">{clients[c.id] ?? '—'}</p>
                  <p className="text-xs text-muted-foreground truncate">{clean(c.last.content)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{fmt(c.last.created_at)}</p>
                </button>
              ))}
            </div>
            <div className="bg-card border border-border rounded-xl flex flex-col min-h-[400px]">
              {!current ? (
                <p className="text-sm text-muted-foreground m-auto">{t('supportInbox.pickChat')}</p>
              ) : (
                <>
                  <div className="px-5 py-3 border-b border-border/60 font-display text-sm font-semibold">{clients[current.id]}</div>
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 max-h-[460px]">
                    {current.list.map(m => {
                      const Icon = roleIcon(m.role);
                      return (
                        <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-start' : 'justify-end')}>
                          <div className={cn('max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap border',
                            m.role === 'agent' ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60')}>
                            <p className="flex items-center gap-1 text-[10px] opacity-70 mb-1"><Icon size={11} /> {t(`supportInbox.role_${m.role}`)} · {fmt(m.created_at)}</p>
                            {clean(m.content)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 p-3 border-t border-border/60">
                    <input value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendReply()}
                      placeholder={t('supportInbox.replyPlaceholder')}
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                    <button onClick={sendReply} disabled={sending || !reply.trim()}
                      className="flex items-center gap-1 bg-primary text-primary-foreground rounded-lg px-4 text-sm disabled:opacity-50">
                      <Send size={14} /> {t('supportInbox.send')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tickets">
          <div className="flex gap-2 mb-3 flex-wrap">
            {['pendente', 'em_andamento', 'concluida', 'cancelada', 'all'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={cn('text-xs px-3 py-1.5 rounded-lg border', filter === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border')}>
                {t(`supportInbox.status_${s}`)}
              </button>
            ))}
          </div>
          <div className="bg-card border border-border rounded-xl divide-y divide-border/60">
            {shownReqs.length === 0 && <p className="text-xs text-muted-foreground p-4">{t('supportInbox.noTickets')}</p>}
            {shownReqs.map(r => (
              <div key={r.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{r.client?.name ?? clients[r.client_id] ?? '—'} · <span className="text-primary">{r.request_type}</span>{r.quantity ? ` ×${r.quantity}` : ''}</p>
                  {r.description && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{r.description}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">{fmt(r.created_at)}</p>
                </div>
                <select value={r.status} onChange={e => setStatus(r.id, e.target.value)}
                  className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs">
                  {STATUSES.map(s => <option key={s} value={s}>{t(`supportInbox.status_${s}`)}</option>)}
                </select>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SupportInbox;
