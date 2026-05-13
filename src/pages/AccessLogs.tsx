import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHero, Panel } from "@/components/ui-kit";
import { Activity, Globe, Shield, AlertTriangle, LogIn, LogOut, UserPlus, Filter } from "lucide-react";
import { format } from "date-fns";

interface AccessLog {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  role: string | null;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  country: string | null;
  city: string | null;
  metadata: any;
  created_at: string;
}

const ACTION_META: Record<string, { label: string; Icon: React.ElementType; cls: string }> = {
  signup:       { label: "Cadastro",      Icon: UserPlus,       cls: "text-primary border-primary/30 bg-primary/10" },
  login:        { label: "Login",         Icon: LogIn,          cls: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  logout:       { label: "Logout",        Icon: LogOut,         cls: "text-muted-foreground border-border bg-secondary/50" },
  login_failed: { label: "Falha login",   Icon: AlertTriangle,  cls: "text-destructive border-destructive/30 bg-destructive/10" },
};

const AccessLogs: React.FC = () => {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("access_logs").select("*").order("created_at", { ascending: false }).limit(500);
    setLogs((data || []) as AccessLog[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => logs.filter(l => {
    if (actionFilter !== "all" && l.action !== actionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (l.email || "").toLowerCase().includes(q) || (l.ip_address || "").includes(q);
    }
    return true;
  }), [logs, actionFilter, search]);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayLogs = logs.filter(l => new Date(l.created_at) >= today);
    return {
      total: logs.length,
      today: todayLogs.length,
      uniqueIps: new Set(logs.map(l => l.ip_address).filter(Boolean)).size,
      failed: logs.filter(l => l.action === "login_failed").length,
    };
  }, [logs]);

  return (
    <div className="space-y-6">
      <PageHero eyebrow="Segurança" title="Acessos"
        description="Histórico completo de cadastros, logins, logouts e falhas com IP, dispositivo e localização."
        actions={
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Total</div>
            <div className="text-2xl font-bold text-primary font-display">{stats.total}</div>
          </div>
        } />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Hoje", value: stats.today, Icon: Activity, color: "text-primary" },
          { label: "IPs únicos", value: stats.uniqueIps, Icon: Globe, color: "text-sky-400" },
          { label: "Falhas", value: stats.failed, Icon: AlertTriangle, color: "text-destructive" },
          { label: "Total", value: stats.total, Icon: Shield, color: "text-emerald-400" },
        ].map(s => (
          <div key={s.label}
            className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-4 hover:border-primary/30 transition-colors">
            <s.Icon size={16} className={s.color} />
            <div className="text-2xl font-bold text-foreground mt-2 font-display">{s.value}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <Panel title="Histórico de acessos" subtitle="Últimos 500 registros">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Filter size={12} className="text-muted-foreground" />
          {(["all", "login", "signup", "logout", "login_failed"] as const).map(a => (
            <button key={a} onClick={() => setActionFilter(a)}
              className={`text-[10px] uppercase tracking-wider px-3 py-1 rounded-md border transition-all ${
                actionFilter === a ? "border-primary/40 bg-primary/15 text-primary" : "border-border/40 text-muted-foreground hover:text-foreground"
              }`}>
              {a === "all" ? "Todos" : ACTION_META[a]?.label || a}
            </button>
          ))}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar por e-mail ou IP…"
            className="ml-auto bg-background border border-border/60 rounded-md px-3 py-1 text-xs w-56 focus:outline-none focus:border-primary" />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum registro encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground/70 border-b border-border/60">
                  <th className="text-left p-2 font-medium">Quando</th>
                  <th className="text-left p-2 font-medium">Ação</th>
                  <th className="text-left p-2 font-medium">Usuário</th>
                  <th className="text-left p-2 font-medium">IP</th>
                  <th className="text-left p-2 font-medium">Local</th>
                  <th className="text-left p-2 font-medium">Dispositivo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const meta = ACTION_META[l.action] || { label: l.action, Icon: Activity, cls: "text-muted-foreground border-border bg-secondary/50" };
                  return (
                    <tr key={l.id} className="border-b border-border/30 hover:bg-secondary/20">
                      <td className="p-2 text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {format(new Date(l.created_at), "dd/MM HH:mm:ss")}
                      </td>
                      <td className="p-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider border ${meta.cls}`}>
                          <meta.Icon size={10} /> {meta.label}
                        </span>
                      </td>
                      <td className="p-2">
                        <div className="text-xs text-foreground">{l.email || "—"}</div>
                        {l.role && <div className="text-[10px] text-muted-foreground/70 uppercase">{l.role}</div>}
                      </td>
                      <td className="p-2 text-xs font-mono text-foreground/80">{l.ip_address || "—"}</td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {[l.city, l.country].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="p-2 text-[11px] text-muted-foreground truncate max-w-[280px]" title={l.user_agent || ""}>
                        {l.user_agent || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
};

export default AccessLogs;
