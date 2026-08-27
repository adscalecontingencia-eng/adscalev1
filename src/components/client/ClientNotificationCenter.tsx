import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, AlertOctagon, ShieldAlert, ImageIcon, CheckCircle2, RefreshCw, X, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR, es as esLocale, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface Event {
  id: string;
  event_type: string;
  entity_type: string;
  entity_meta_id: string;
  entity_name: string | null;
  reason: string | null;
  detected_at: string;
}

interface SyntheticState {
  id: string;
  event_type: 'account_blocked' | 'page_banned' | 'account_recovered';
  entity_type: 'account' | 'page';
  entity_name: string;
  reason: string;
  detected_at: string;
}

interface Props {
  clientId: string;
  authUserId: string;
  ads: any[];      // activeAccounts from ClientDashboard (each has .ad_account)
  pages: any[];    // meta_pages list
}

const EVENT_META: Record<string, { Icon: any; labelKey: string; color: string }> = {
  account_banned:   { Icon: AlertOctagon, labelKey: 'accountBanned',    color: 'text-destructive' },
  account_blocked:  { Icon: AlertOctagon, labelKey: 'accountBlocked',   color: 'text-destructive' },
  account_recovered:{ Icon: CheckCircle2, labelKey: 'accountRecovered', color: 'text-primary' },
  bm_restricted:    { Icon: ShieldAlert,  labelKey: 'bmRestricted',     color: 'text-amber-400' },
  page_banned:      { Icon: ImageIcon,    labelKey: 'pageBanned',       color: 'text-destructive' },
  ad_rejected:      { Icon: ShieldAlert,  labelKey: 'adRejected',       color: 'text-amber-400' },
};

const ClientNotificationCenter: React.FC<Props> = ({ clientId, authUserId, ads, pages }) => {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'pt').slice(0, 2);
  const dateLocale = lang === 'en' ? enUS : lang === 'es' ? esLocale : ptBR;
  const [events, setEvents] = useState<Event[]>([]);
  const [reads, setReads] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const [evRes, rRes] = await Promise.all([
      supabase.from('meta_critical_events').select('*').eq('client_id', clientId).order('detected_at', { ascending: false }).limit(100),
      supabase.from('client_notification_reads').select('event_id').eq('auth_user_id', authUserId),
    ]);
    setEvents((evRes.data || []) as Event[]);
    setReads(new Set((rRes.data || []).map((r: any) => r.event_id)));
  };

  useEffect(() => { if (clientId && authUserId) load(); }, [clientId, authUserId]);

  // Realtime: novos eventos
  useEffect(() => {
    if (!clientId) return;
    const ch = supabase.channel(`client-events-${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_critical_events', filter: `client_id=eq.${clientId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [clientId]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // Eventos sintéticos derivados do estado atual (caso não exista evento crítico registrado)
  const synthetic = useMemo<SyntheticState[]>(() => {
    const out: SyntheticState[] = [];
    ads.forEach((a: any) => {
      const acc = a.ad_account;
      if (!acc) return;
      const isBlocked = acc.status === 'blocked' || (acc.disable_reason ?? 0) > 0;
      if (isBlocked) {
        out.push({
          id: `synth-acc-${acc.id}`,
          event_type: 'account_blocked',
          entity_type: 'account',
          entity_name: acc.name,
          reason: acc.disable_reason_label || t('clientDash.notifications.accountBlockedReason'),
          detected_at: acc.updated_at || acc.last_synced_at || new Date().toISOString(),
        });
      }
    });
    pages.forEach((p: any) => {
      if (p.is_restricted || p.status === 'banned' || p.status === 'restricted') {
        out.push({
          id: `synth-pg-${p.id}`,
          event_type: 'page_banned',
          entity_type: 'page',
          entity_name: p.name,
          reason: t('clientDash.notifications.pageRestrictedReason'),
          detected_at: p.updated_at || new Date().toISOString(),
        });
      }
    });
    return out;
  }, [ads, pages, t]);

  // Mesclar e deduplicar por entity (evento crítico recente prevalece sobre sintético)
  const merged = useMemo(() => {
    const byKey = new Map<string, Event | SyntheticState>();
    events.forEach(e => {
      const key = `${e.entity_type}-${e.entity_meta_id}-${e.event_type}`;
      const prev = byKey.get(key) as Event | undefined;
      if (!prev || new Date(e.detected_at) > new Date(prev.detected_at)) byKey.set(key, e);
    });
    synthetic.forEach(s => {
      const key = `${s.entity_type}-${s.entity_name}-${s.event_type}`;
      if (!byKey.has(key)) byKey.set(key, s);
    });
    return Array.from(byKey.values()).sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime());
  }, [events, synthetic]);

  const unreadCount = merged.filter(e => !('id' in e && reads.has(e.id)) && !e.id.startsWith('synth-')).length
    + merged.filter(e => e.id.startsWith('synth-')).length; // sintéticos sempre contam

  const markRead = async (eventId: string) => {
    if (eventId.startsWith('synth-')) return;
    if (reads.has(eventId)) return;
    setReads(p => new Set(p).add(eventId));
    await supabase.from('client_notification_reads').insert({ auth_user_id: authUserId, event_id: eventId });
  };

  const markAllRead = async () => {
    const toMark = merged.filter(e => !e.id.startsWith('synth-') && !reads.has(e.id));
    if (toMark.length === 0) return;
    const rows = toMark.map(e => ({ auth_user_id: authUserId, event_id: e.id }));
    setReads(p => { const n = new Set(p); rows.forEach(r => n.add(r.event_id)); return n; });
    await supabase.from('client_notification_reads').insert(rows);
  };

  return (
    <div className="relative" ref={popRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
        aria-label={t('clientDash.notifications.title')}
        title={t('clientDash.notifications.title')}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-destructive text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(380px,calc(100vw-2rem))] bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-primary" />
              <span className="text-sm font-semibold">{t('clientDash.notifications.title')}</span>
              {unreadCount > 0 && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">{unreadCount}</span>}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={load} className="p-1 text-muted-foreground hover:text-foreground" title={t('clientDash.notifications.refresh')}><RefreshCw size={12} /></button>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-primary hover:underline px-2">{t('clientDash.notifications.markAll')}</button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 text-muted-foreground hover:text-foreground"><X size={12} /></button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-auto">
            {merged.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 size={28} className="mx-auto text-primary/60 mb-2" />
                <p className="text-xs text-muted-foreground">{t('clientDash.notifications.empty')}</p>
              </div>
            ) : (
              merged.map(e => {
                const meta = EVENT_META[e.event_type] || { Icon: ShieldAlert, labelKey: '', color: 'text-muted-foreground' };
                const label = meta.labelKey ? t(`clientDash.notifications.${meta.labelKey}`) : e.event_type;
                const isUnread = e.id.startsWith('synth-') || !reads.has(e.id);
                return (
                  <button
                    key={e.id}
                    onClick={() => markRead(e.id)}
                    className={cn(
                      "w-full text-left p-3 border-b border-border/50 hover:bg-secondary/40 transition-colors flex items-start gap-3",
                      isUnread && "bg-primary/[0.04]"
                    )}
                  >
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-secondary", meta.color)}>
                      <meta.Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("text-xs font-semibold", meta.color)}>{label}</span>
                        {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </div>
                      <p className="text-xs text-foreground/90 truncate mt-0.5">{e.entity_name || e.entity_type}</p>
                      {e.reason && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{e.reason}</p>}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(e.detected_at), { addSuffix: true, locale: dateLocale })}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientNotificationCenter;
