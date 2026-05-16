import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Ban, ShieldAlert, AlertTriangle, CheckCircle2, X, Trash2, ExternalLink, Building2, CreditCard, Globe, Settings, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

type Severity = "critical" | "warning" | "info";
type AssetType = "Conta" | "BM" | "Página" | "Perfil" | "Pixel" | "Solicitação";
type EventType = "account_blocked" | "bm_unverified" | "event_detected" | "event_resolved" | "client_request";

interface Notification {
  id: string;
  severity: Severity;
  assetType: AssetType;
  assetName: string;
  assetId?: string;
  eventType: EventType;
  title: string;
  description: string;
  meta: { label: string; value: string }[];
  occurredAt: string;
  actionPath?: string;
}

const fmtAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
};

const SEV_STYLE: Record<Severity, { ring: string; bg: string; text: string; Icon: React.ElementType; label: string }> = {
  critical: { ring: "border-destructive/40", bg: "bg-destructive/15", text: "text-destructive", Icon: Ban, label: "Crítico" },
  warning:  { ring: "border-amber-500/40", bg: "bg-amber-500/15", text: "text-amber-400", Icon: AlertTriangle, label: "Aviso" },
  info:     { ring: "border-primary/40", bg: "bg-primary/15", text: "text-primary", Icon: ShieldAlert, label: "Info" },
};

const ASSET_ICON: Record<AssetType, React.ElementType> = {
  Conta: CreditCard,
  BM: Building2,
  Página: Globe,
  Perfil: ShieldAlert,
  Pixel: ShieldAlert,
};

const ASSET_TYPES: AssetType[] = ["Conta", "BM", "Página", "Perfil", "Pixel"];
const SEVERITIES: Severity[] = ["critical", "warning", "info"];

interface PrefRow {
  channel: "central" | "email" | "whatsapp";
  event_type: string; // event or '*'
  asset_type: string; // type or '*'
  asset_id: string;   // id or ''
  enabled: boolean;
}

const isAllowedByPrefs = (n: Notification, prefs: PrefRow[], channel: "central" | "email" | "whatsapp") => {
  // Default: allowed unless any matching rule disables it.
  // Match precedence (most specific first): asset_id == n.assetId, asset_type == n.assetType, event_type == n.eventType
  const candidates = prefs.filter(p => p.channel === channel);
  if (!candidates.length) return true;

  const matches = candidates.filter(p =>
    (p.event_type === "*" || p.event_type === n.eventType) &&
    (p.asset_type === "*" || p.asset_type === n.assetType) &&
    (p.asset_id === "" || p.asset_id === (n.assetId || ""))
  );
  if (!matches.length) return true;

  const score = (p: PrefRow) =>
    (p.asset_id ? 4 : 0) + (p.asset_type !== "*" ? 2 : 0) + (p.event_type !== "*" ? 1 : 0);
  matches.sort((a, b) => score(b) - score(a));
  return matches[0].enabled;
};

export const NotificationCenter: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [prefs, setPrefs] = useState<PrefRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [sevFilter, setSevFilter] = useState<Set<Severity>>(new Set());
  const [assetFilter, setAssetFilter] = useState<Set<AssetType>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Auth + initial load of states + prefs
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id || null;
      setUserId(uid);
      if (!uid) return;

      const [{ data: states }, { data: prefRows }] = await Promise.all([
        supabase.from("notification_states").select("notification_id,state").eq("user_id", uid),
        supabase.from("notification_preferences").select("channel,event_type,asset_type,asset_id,enabled").eq("user_id", uid),
      ]);
      const s = new Set<string>(), d = new Set<string>();
      (states || []).forEach((r: any) => {
        if (r.state === "seen") s.add(r.notification_id);
        if (r.state === "dismissed") d.add(r.notification_id);
      });
      setSeen(s); setDismissed(d);
      setPrefs((prefRows || []) as PrefRow[]);
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [accRes, bmRes, logRes] = await Promise.all([
        supabase
          .from("meta_ad_accounts")
          .select("id, name, meta_account_id, status, disable_reason, disable_reason_label, owner_business_name, updated_at, bm:meta_business_managers(name, primary_page)")
          .or("status.eq.blocked,disable_reason.gt.0")
          .order("updated_at", { ascending: false })
          .limit(40),
        supabase
          .from("meta_business_managers")
          .select("id, name, meta_bm_id, verification_status, primary_page, updated_at")
          .neq("verification_status", "verified")
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("meta_blocked_accounts_log")
          .select("id, event_type, reason, detected_at, resolved_at, ad_account:meta_ad_accounts(name, meta_account_id, owner_business_name, bm:meta_business_managers(name, primary_page))")
          .order("detected_at", { ascending: false })
          .limit(30),
      ]);

      const acc = (accRes.data || []).map<Notification>((a: any) => ({
        id: `acc-${a.id}`,
        severity: "critical",
        assetType: "Conta",
        assetName: a.name,
        assetId: a.meta_account_id,
        eventType: "account_blocked",
        title: `Conta "${a.name}" bloqueada`,
        description: a.disable_reason_label || "Conta de anúncios suspensa pelo Meta.",
        meta: [
          { label: "Conta ID", value: a.meta_account_id },
          { label: "BM", value: a.bm?.name || "—" },
          { label: "Perfil", value: a.owner_business_name || "—" },
          { label: "Página", value: a.bm?.primary_page || "—" },
        ],
        occurredAt: a.updated_at,
        actionPath: "/block-log",
      }));

      const bm = (bmRes.data || []).map<Notification>((b: any) => ({
        id: `bm-${b.id}`,
        severity: "warning",
        assetType: "BM",
        assetName: b.name,
        assetId: b.meta_bm_id,
        eventType: "bm_unverified",
        title: `BM "${b.name}" não verificada`,
        description: "Business Manager precisa concluir verificação comercial.",
        meta: [
          { label: "BM ID", value: b.meta_bm_id },
          { label: "Página", value: b.primary_page || "—" },
          { label: "Status", value: b.verification_status || "not_verified" },
        ],
        occurredAt: b.updated_at,
        actionPath: "/meta-connections",
      }));

      const log = (logRes.data || []).map<Notification>((l: any) => ({
        id: `log-${l.id}`,
        severity: l.resolved_at ? "info" : "critical",
        assetType: "Conta",
        assetName: l.ad_account?.name || "Conta desconhecida",
        assetId: l.ad_account?.meta_account_id,
        eventType: l.resolved_at ? "event_resolved" : "event_detected",
        title: l.resolved_at
          ? `Evento resolvido em "${l.ad_account?.name || "—"}"`
          : `Evento "${l.event_type}" detectado`,
        description: l.reason || "Mudança detectada na conta.",
        meta: [
          { label: "Conta ID", value: l.ad_account?.meta_account_id || "—" },
          { label: "BM", value: l.ad_account?.bm?.name || "—" },
          { label: "Perfil", value: l.ad_account?.owner_business_name || "—" },
          { label: "Página", value: l.ad_account?.bm?.primary_page || "—" },
        ],
        occurredAt: l.detected_at,
        actionPath: "/block-log",
      }));

      const all = [...acc, ...bm, ...log]
        .filter(n => !dismissed.has(n.id))
        .filter(n => isAllowedByPrefs(n, prefs, "central"))
        .sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));
      setItems(all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (userId !== undefined) load(); /* eslint-disable-next-line */ }, [userId, prefs, dismissed]);
  useEffect(() => {
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, [prefs, dismissed]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const filtered = useMemo(() => {
    return items.filter(n =>
      (sevFilter.size === 0 || sevFilter.has(n.severity)) &&
      (assetFilter.size === 0 || assetFilter.has(n.assetType))
    );
  }, [items, sevFilter, assetFilter]);

  const unreadCount = useMemo(
    () => items.filter(i => !seen.has(i.id)).length,
    [items, seen],
  );

  const persistStates = async (ids: string[], state: "seen" | "dismissed") => {
    if (!userId || !ids.length) return;
    const rows = ids.map(notification_id => ({ user_id: userId, notification_id, state }));
    await supabase.from("notification_states").upsert(rows, { onConflict: "user_id,notification_id,state" });
  };

  const markAllSeen = async () => {
    const next = new Set(seen);
    const toAdd: string[] = [];
    items.forEach(i => { if (!next.has(i.id)) { next.add(i.id); toAdd.push(i.id); } });
    setSeen(next);
    await persistStates(toAdd, "seen");
  };

  const dismiss = async (id: string) => {
    const next = new Set(dismissed); next.add(id); setDismissed(next);
    setItems(prev => prev.filter(i => i.id !== id));
    await persistStates([id], "dismissed");
  };

  const clearAll = async () => {
    const ids = items.map(i => i.id);
    const next = new Set(dismissed); ids.forEach(i => next.add(i)); setDismissed(next);
    setItems([]);
    await persistStates(ids, "dismissed");
  };

  const handleOpen = () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) setTimeout(markAllSeen, 800);
  };

  const toggleInSet = <T,>(s: Set<T>, v: T): Set<T> => {
    const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n;
  };

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors border border-transparent hover:border-border/60"
        aria-label="Notificações"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center shadow-[0_0_8px_hsl(var(--destructive)/0.6)]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-[calc(100%+8px)] w-[min(440px,calc(100vw-2rem))] max-h-[75vh] flex flex-col rounded-2xl border border-border/60 bg-card/95 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgb(0_0_0/0.6)] z-50 overflow-hidden"
          >
            <div className="relative px-4 py-3 border-b border-border/60">
              <div className="absolute inset-0 grid-texture opacity-40 pointer-events-none" />
              <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-primary/10 blur-[60px] pointer-events-none" />
              <div className="relative flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Bell size={14} className="text-primary" />
                    <h3 className="font-display font-semibold text-foreground text-sm">Central de Notificações</h3>
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70 mt-1">
                    Eventos de tráfego pago · ao vivo
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setOpen(false); navigate("/notification-settings"); }}
                    className="text-muted-foreground hover:text-primary p-1.5 rounded-md hover:bg-primary/10 transition-colors"
                    title="Configurações de notificação">
                    <Settings size={13} />
                  </button>
                  {items.length > 0 && (
                    <button onClick={clearAll}
                      className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-destructive flex items-center gap-1 px-2 py-1 rounded-md hover:bg-destructive/10 transition-colors"
                      title="Limpar todas">
                      <Trash2 size={11} /> Limpar
                    </button>
                  )}
                  <button onClick={() => setOpen(false)}
                    className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary/60">
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="px-3 py-2 border-b border-border/60 bg-background/30 space-y-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Filter size={10} className="text-muted-foreground/60" />
                {SEVERITIES.map(s => {
                  const active = sevFilter.has(s);
                  const st = SEV_STYLE[s];
                  return (
                    <button key={s} onClick={() => setSevFilter(toggleInSet(sevFilter, s))}
                      className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-md border transition-all ${
                        active ? `${st.ring} ${st.bg} ${st.text}` : "border-border/40 text-muted-foreground/70 hover:text-foreground"
                      }`}>
                      {st.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {ASSET_TYPES.map(a => {
                  const active = assetFilter.has(a);
                  const AIcon = ASSET_ICON[a];
                  return (
                    <button key={a} onClick={() => setAssetFilter(toggleInSet(assetFilter, a))}
                      className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-md border transition-all flex items-center gap-1 ${
                        active ? "border-primary/40 bg-primary/15 text-primary" : "border-border/40 text-muted-foreground/70 hover:text-foreground"
                      }`}>
                      <AIcon size={9} /> {a}
                    </button>
                  );
                })}
                {(sevFilter.size > 0 || assetFilter.size > 0) && (
                  <button onClick={() => { setSevFilter(new Set()); setAssetFilter(new Set()); }}
                    className="text-[9px] uppercase tracking-wider text-muted-foreground hover:text-destructive ml-auto">
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-neon">
              {loading && items.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">Carregando eventos…</div>
              ) : filtered.length === 0 ? (
                <div className="p-10 text-center">
                  <CheckCircle2 className="mx-auto text-primary mb-3" size={28} />
                  <p className="text-sm font-medium text-foreground">
                    {items.length === 0 ? "Tudo tranquilo por aqui" : "Nenhum evento com esses filtros"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {items.length === 0 ? "Nenhum evento crítico nos seus ativos." : "Ajuste ou limpe os filtros para ver mais."}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {filtered.map((n) => {
                    const sev = SEV_STYLE[n.severity];
                    const AIcon = ASSET_ICON[n.assetType] || ShieldAlert;
                    return (
                      <li key={n.id} className="group relative px-4 py-3 hover:bg-secondary/30 transition-colors">
                        <div className="flex gap-3">
                          <div className={`shrink-0 w-9 h-9 rounded-xl border ${sev.ring} ${sev.bg} ${sev.text} flex items-center justify-center`}>
                            <sev.Icon size={15} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2">
                              <p className="font-medium text-sm text-foreground leading-snug flex-1 min-w-0">{n.title}</p>
                              <button onClick={() => dismiss(n.id)}
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5"
                                title="Dispensar">
                                <X size={12} />
                              </button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.description}</p>

                            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider border ${sev.ring} ${sev.bg} ${sev.text}`}>
                                <AIcon size={9} /> {n.assetType}
                              </span>
                              {n.meta.filter(m => m.value && m.value !== "—").slice(0, 4).map((m, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-secondary/60 border border-border/50 text-muted-foreground">
                                  <span className="text-[9px] uppercase tracking-wider opacity-70">{m.label}</span>
                                  <span className="text-foreground/90 font-mono truncate max-w-[120px]">{m.value}</span>
                                </span>
                              ))}
                            </div>

                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground/70">{fmtAgo(n.occurredAt)}</span>
                              {n.actionPath && (
                                <button onClick={() => { setOpen(false); navigate(n.actionPath!); }}
                                  className="text-[10px] uppercase tracking-wider text-primary hover:text-primary/80 flex items-center gap-1">
                                  Investigar <ExternalLink size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="px-4 py-2 border-t border-border/60 bg-background/40 flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary))]" />
                Atualiza a cada 60s
              </span>
              <span>{filtered.length}/{items.length} evento{items.length === 1 ? "" : "s"}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationCenter;
