import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Mail, MessageCircle, Save, Plus, Trash2, ShieldAlert, Building2, CreditCard, Globe } from "lucide-react";
import { PageHero, Panel } from "@/components/ui-kit";
import { toast } from "sonner";

type Channel = "central" | "email" | "whatsapp";
type AssetType = "Conta" | "BM" | "Página" | "Perfil" | "Pixel";
type EventType = "account_blocked" | "bm_unverified" | "event_detected" | "event_resolved";

const CHANNELS: { id: Channel; label: string; Icon: React.ElementType }[] = [
  { id: "central",  label: "Central",  Icon: Bell },
  { id: "email",    label: "E-mail",   Icon: Mail },
  { id: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
];

const EVENTS: { id: EventType; label: string }[] = [
  { id: "account_blocked",  label: "Conta bloqueada" },
  { id: "bm_unverified",    label: "BM não verificada" },
  { id: "event_detected",   label: "Evento detectado" },
  { id: "event_resolved",   label: "Evento resolvido" },
];

const ASSET_TYPES: AssetType[] = ["Conta", "BM", "Página", "Perfil", "Pixel"];

interface Pref {
  id?: string;
  channel: Channel;
  event_type: string; // EventType | '*'
  asset_type: string; // AssetType | '*'
  asset_id: string;   // '' = todos
  enabled: boolean;
}

interface AssetOpt { id: string; label: string; type: AssetType }

const NotificationSettings: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Pref[]>([]);
  const [assets, setAssets] = useState<AssetOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { (async () => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id || null;
    setUserId(uid);
    if (!uid) { setLoading(false); return; }

    const [{ data: p }, { data: accs }, { data: bms }] = await Promise.all([
      supabase.from("notification_preferences").select("*").eq("user_id", uid),
      supabase.from("meta_ad_accounts").select("meta_account_id,name").limit(500),
      supabase.from("meta_business_managers").select("meta_bm_id,name,primary_page").limit(500),
    ]);
    setPrefs((p || []) as Pref[]);
    const opts: AssetOpt[] = [
      ...(accs || []).map((a: any) => ({ id: a.meta_account_id, label: a.name, type: "Conta" as AssetType })),
      ...(bms || []).map((b: any) => ({ id: b.meta_bm_id, label: b.name, type: "BM" as AssetType })),
      ...(bms || []).filter((b: any) => b.primary_page).map((b: any) => ({ id: b.primary_page, label: b.primary_page, type: "Página" as AssetType })),
    ];
    setAssets(opts);
    setLoading(false);
  })(); }, []);

  // Default mode: lookup helper
  const getDefault = (channel: Channel, event: EventType, assetType: AssetType): boolean => {
    const cands = prefs.filter(p =>
      p.channel === channel && p.asset_id === "" &&
      (p.event_type === "*" || p.event_type === event) &&
      (p.asset_type === "*" || p.asset_type === assetType)
    );
    if (!cands.length) return channel === "central"; // default: central on, email/whatsapp off
    const score = (p: Pref) => (p.asset_type !== "*" ? 2 : 0) + (p.event_type !== "*" ? 1 : 0);
    cands.sort((a, b) => score(b) - score(a));
    return cands[0].enabled;
  };

  const setDefault = (channel: Channel, event: EventType, assetType: AssetType, enabled: boolean) => {
    setPrefs(prev => {
      const next = prev.filter(p => !(p.channel === channel && p.event_type === event && p.asset_type === assetType && p.asset_id === ""));
      next.push({ channel, event_type: event, asset_type: assetType, asset_id: "", enabled });
      return next;
    });
  };

  // Per-asset overrides
  const overrides = useMemo(() => prefs.filter(p => p.asset_id !== ""), [prefs]);

  const addOverride = () => {
    setPrefs(prev => [...prev, { channel: "central", event_type: "*", asset_type: "Conta", asset_id: assets[0]?.id || "", enabled: false }]);
  };

  const updateOverride = (idx: number, patch: Partial<Pref>) => {
    setPrefs(prev => {
      const ovIdxs = prev.map((p, i) => p.asset_id !== "" ? i : -1).filter(i => i >= 0);
      const realIdx = ovIdxs[idx];
      if (realIdx == null) return prev;
      const next = [...prev];
      next[realIdx] = { ...next[realIdx], ...patch };
      return next;
    });
  };

  const removeOverride = (idx: number) => {
    setPrefs(prev => {
      const ovIdxs = prev.map((p, i) => p.asset_id !== "" ? i : -1).filter(i => i >= 0);
      const realIdx = ovIdxs[idx];
      if (realIdx == null) return prev;
      return prev.filter((_, i) => i !== realIdx);
    });
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      // Replace strategy: delete user prefs, then insert current
      await supabase.from("notification_preferences").delete().eq("user_id", userId);
      const rows = prefs.map(p => ({ ...p, user_id: userId }));
      if (rows.length) {
        const { error } = await supabase.from("notification_preferences").insert(rows);
        if (error) throw error;
      }
      toast.success("Preferências salvas");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const ASSET_ICON: Record<AssetType, React.ElementType> = {
    Conta: CreditCard, BM: Building2, Página: Globe, Perfil: ShieldAlert, Pixel: ShieldAlert,
  };

  if (loading) return <div className="p-8 text-muted-foreground text-sm">Carregando preferências…</div>;

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Preferências"
        title="Notificações"
        description="Defina quais eventos chegam na Central, no e-mail e no WhatsApp — com granularidade por tipo de ativo e ativo específico."
        actions={
          <button onClick={save} disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-60">
            <Save size={14} /> {saving ? "Salvando…" : "Salvar"}
          </button>
        }
      />

      <Panel title="Padrões por canal e tipo de ativo"
        subtitle="Ative ou desative cada combinação. Específicos abaixo sobrescrevem estes padrões.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground/70 border-b border-border/60">
                <th className="text-left p-2 font-medium">Evento × Ativo</th>
                {CHANNELS.map(c => (
                  <th key={c.id} className="p-2 font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <c.Icon size={11} /> {c.label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EVENTS.flatMap(ev => ASSET_TYPES.map(at => {
                const AIcon = ASSET_ICON[at];
                return (
                  <tr key={`${ev.id}-${at}`} className="border-b border-border/30 hover:bg-secondary/20">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <AIcon size={12} className="text-muted-foreground/60" />
                        <span className="text-foreground/90">{ev.label}</span>
                        <span className="text-[10px] text-muted-foreground/60">/ {at}</span>
                      </div>
                    </td>
                    {CHANNELS.map(c => (
                      <td key={c.id} className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={getDefault(c.id, ev.id, at)}
                          onChange={(e) => setDefault(c.id, ev.id, at, e.target.checked)}
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-3">
          E-mail e WhatsApp: as preferências são salvas, mas a entrega depende da configuração de envio (a habilitar separadamente).
        </p>
      </Panel>

      <Panel title="Regras específicas por ativo"
        subtitle="Sobrescreva o padrão para uma BM, conta, perfil ou página específica."
        actions={
          <button onClick={addOverride}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
            <Plus size={12} /> Adicionar regra
          </button>
        }>
        {overrides.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma regra específica. Use os padrões acima ou adicione uma exceção.</p>
        ) : (
          <div className="space-y-2">
            {overrides.map((o, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-border/50 bg-secondary/30">
                <select value={o.channel} onChange={(e) => updateOverride(i, { channel: e.target.value as Channel })}
                  className="bg-background border border-border/60 rounded-md px-2 py-1 text-xs">
                  {CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <select value={o.event_type} onChange={(e) => updateOverride(i, { event_type: e.target.value })}
                  className="bg-background border border-border/60 rounded-md px-2 py-1 text-xs">
                  <option value="*">Todos eventos</option>
                  {EVENTS.map(ev => <option key={ev.id} value={ev.id}>{ev.label}</option>)}
                </select>
                <select value={o.asset_type} onChange={(e) => updateOverride(i, { asset_type: e.target.value })}
                  className="bg-background border border-border/60 rounded-md px-2 py-1 text-xs">
                  {ASSET_TYPES.map(at => <option key={at} value={at}>{at}</option>)}
                </select>
                <select value={o.asset_id} onChange={(e) => updateOverride(i, { asset_id: e.target.value })}
                  className="bg-background border border-border/60 rounded-md px-2 py-1 text-xs flex-1 min-w-[160px]">
                  {assets.filter(a => a.type === o.asset_type).map(a => (
                    <option key={a.id} value={a.id}>{a.label} ({a.id})</option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={o.enabled} onChange={(e) => updateOverride(i, { enabled: e.target.checked })}
                    className="w-4 h-4 accent-primary" />
                  <span className={o.enabled ? "text-primary" : "text-muted-foreground"}>{o.enabled ? "Receber" : "Silenciar"}</span>
                </label>
                <button onClick={() => removeOverride(i)} className="text-muted-foreground hover:text-destructive p-1">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
};

export default NotificationSettings;
