import React, { useEffect, useMemo, useState } from "react";
import { tr, localizedMap } from '@/i18n';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, ShieldCheck, ShieldAlert, KeyRound, Search, Mail, CheckCircle2, XCircle } from "lucide-react";

interface ReportRow {
  client_id: string;
  name: string;
  client_email: string;
  client_auth_user_id: string | null;
  auth_user_id: string | null;
  auth_email: string | null;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  created_at_auth: string | null;
  roles: string[];
  status: "ok" | "atencao";
  issues: string[];
}

interface OrphanRow {
  auth_user_id: string;
  auth_email: string | null;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  created_at_auth: string | null;
}

interface AuditData {
  summary: {
    total_clients: number;
    total_auth_users: number;
    ok: number;
    with_issues: number;
    orphan_auth_count: number;
  };
  report: ReportRow[];
  orphan_auth: OrphanRow[];
}

const issueLabels: Record<string, string> = localizedMap('fin.auth.issue', {
  sem_auth_user_id: "Cliente sem auth_user_id",
  usuario_auth_nao_encontrado: "Sem usuário no Auth",
  email_diverge_do_auth: "E-mail diverge do Auth vinculado",
  auth_existe_mas_nao_vinculado: "Auth existe mas não está vinculado",
  email_nao_confirmado: "E-mail não confirmado",
  sem_role_client: "Sem role 'client'",
  email_difere_entre_tabelas: "E-mail difere entre clients e auth",
});

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR") : "—");

const ClientsAuthAudit: React.FC = () => {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "ok" | "atencao">("atencao");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchAudit = async () => {
    setLoading(true);
    const { data: res, error } = await supabase.functions.invoke("clients-auth-audit");
    setLoading(false);
    if (error || (res as any)?.error) {
      toast.error((res as any)?.error || error?.message || tr('fin.auth.loadError'));
      return;
    }
    setData(res as AuditData);
  };

  useEffect(() => {
    fetchAudit();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return data.report.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!term) return true;
      return (
        r.name?.toLowerCase().includes(term) ||
        r.client_email?.toLowerCase().includes(term) ||
        r.auth_email?.toLowerCase().includes(term)
      );
    });
  }, [data, filter, search]);

  const handleReset = async (row: ReportRow) => {
    const newPwd = window.prompt(tr('fin.auth.pwPrompt', { name: row.name, email: row.client_email }));
    if (!newPwd) return;
    if (newPwd.length < 6) { toast.error(tr('admin.clients.pw6')); return; }
    setBusyId(row.client_id);
    const { data: res, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "reset_password", client_id: row.client_id, new_password: newPwd },
    });
    setBusyId(null);
    if (error || (res as any)?.error) {
      toast.error((res as any)?.error || error?.message || tr('admin.clients.resetPwError'));
      return;
    }
    toast.success(tr('fin.auth.pwReset'));
  };

  const handleResetLogin = async (row: ReportRow) => {
    const currentEmail = row.auth_email || row.client_email || "";
    const newEmail = window.prompt(
      tr('fin.auth.loginPrompt', { name: row.name }),
      currentEmail
    );
    if (newEmail === null) return;
    const emailTrim = newEmail.trim();
    if (!emailTrim || !emailTrim.includes("@")) { toast.error(tr('admin.clients.invalidEmail')); return; }

    const newPwd = window.prompt(
      tr('fin.auth.pwOptPrompt', { name: row.name })
    );
    if (newPwd === null) return;
    const pwd = newPwd.trim();
    if (pwd && pwd.length < 6) { toast.error(tr('admin.clients.pw6')); return; }

    const emailChanged = emailTrim.toLowerCase() !== currentEmail.toLowerCase();
    if (!emailChanged && !pwd) { toast.info(tr('admin.clients.nothing')); return; }

    setBusyId(row.client_id);
    const { data: res, error } = await supabase.functions.invoke("manage-users", {
      body: {
        action: "reset_login",
        client_id: row.client_id,
        ...(emailChanged ? { new_email: emailTrim } : {}),
        ...(pwd ? { new_password: pwd } : {}),
      },
    });
    setBusyId(null);
    if (error || (res as any)?.error) {
      toast.error((res as any)?.error || error?.message || tr('admin.clients.resetLoginError'));
      return;
    }
    toast.success(tr('fin.auth.loginReset'));
    fetchAudit();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{tr('fin.auth.title')}</h1>
          <p className="text-sm text-muted-foreground">{tr('fin.auth.desc')}</p>
        </div>
        <button
          onClick={fetchAudit}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-sm"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {tr('fin.auth.rerun')}
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label={tr('fin.auth.clients')} value={data.summary.total_clients} />
          <Stat label={tr('fin.auth.authUsers')} value={data.summary.total_auth_users} />
          <Stat label="OK" value={data.summary.ok} tone="success" icon={<ShieldCheck size={14} />} />
          <Stat label={tr('fin.auth.withIssues')} value={data.summary.with_issues} tone="warning" icon={<ShieldAlert size={14} />} />
          <Stat label={tr('fin.auth.orphans')} value={data.summary.orphan_auth_count} tone="warning" />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {(["atencao", "ok", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs border ${
              filter === f
                ? "bg-primary/15 text-primary border-primary/40"
                : "bg-secondary text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {f === "atencao" ? tr('fin.auth.withIssues') : f === "ok" ? "OK" : tr('fin.auth.all')}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('fin.auth.search')}
            className="pl-8 pr-3 py-2 text-sm bg-secondary border border-border rounded-lg focus:outline-none focus:border-primary w-64"
          />
        </div>
      </div>

      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">{tr('fin.auth.client')}</th>
              <th className="text-left px-3 py-2">E-mail</th>
              <th className="text-left px-3 py-2">Auth</th>
              <th className="text-left px-3 py-2">{tr('fin.auth.confirmed')}</th>
              <th className="text-left px-3 py-2">{tr('fin.auth.lastLogin')}</th>
              <th className="text-left px-3 py-2">{tr('fin.auth.issues')}</th>
              <th className="text-right px-3 py-2">{tr('fin.auth.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.client_id} className="border-t border-border/60">
                <td className="px-3 py-2 font-medium text-foreground">{r.name}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  <div>{r.client_email}</div>
                  {r.auth_email && r.auth_email.toLowerCase() !== (r.client_email || "").toLowerCase() && (
                    <div className="text-[11px] text-warning">auth: {r.auth_email}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {r.auth_user_id ? (
                    <span className="inline-flex items-center gap-1 text-success text-xs"><CheckCircle2 size={12}/> existe</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-destructive text-xs"><XCircle size={12}/> ausente</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {r.email_confirmed_at ? (
                    <span className="text-success inline-flex items-center gap-1"><Mail size={12}/> {fmtDate(r.email_confirmed_at)}</span>
                  ) : r.auth_user_id ? (
                    <span className="text-warning">pendente</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(r.last_sign_in_at)}</td>
                <td className="px-3 py-2">
                  {r.issues.length === 0 ? (
                    <span className="text-success text-xs">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {r.issues.map((i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-warning/15 text-warning border border-warning/30">
                          {issueLabels[i] || i}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      disabled={!r.auth_user_id || busyId === r.client_id}
                      onClick={() => handleReset(r)}
                      title={tr('fin.auth.pwOnly')}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border border-border hover:border-primary hover:text-primary disabled:opacity-40"
                    >
                      <KeyRound size={12} /> {tr('fin.auth.password')}
                    </button>
                    <button
                      disabled={!r.auth_user_id || busyId === r.client_id}
                      onClick={() => handleResetLogin(r)}
                      title={tr('fin.auth.emailPw')}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40"
                    >
                      <Mail size={12} /> {tr('fin.auth.resetLogin')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground text-sm">{tr('fin.auth.none')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.orphan_auth.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">{tr('fin.auth.orphanTitle', { n: data.orphan_auth.length })}</h2>
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">{tr('fin.auth.authEmail')}</th>
                  <th className="text-left px-3 py-2">{tr('fin.auth.confirmed')}</th>
                  <th className="text-left px-3 py-2">{tr('fin.auth.lastLogin')}</th>
                  <th className="text-left px-3 py-2">{tr('fin.auth.createdAt')}</th>
                </tr>
              </thead>
              <tbody>
                {data.orphan_auth.map((o) => (
                  <tr key={o.auth_user_id} className="border-t border-border/60">
                    <td className="px-3 py-2 text-foreground">{o.auth_email || "—"}</td>
                    <td className="px-3 py-2 text-xs">{fmtDate(o.email_confirmed_at)}</td>
                    <td className="px-3 py-2 text-xs">{fmtDate(o.last_sign_in_at)}</td>
                    <td className="px-3 py-2 text-xs">{fmtDate(o.created_at_auth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number; tone?: "success" | "warning"; icon?: React.ReactNode }> = ({ label, value, tone, icon }) => (
  <div className="rounded-lg border border-border bg-card p-3">
    <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon} {label}</div>
    <div className={`text-2xl font-semibold mt-1 ${tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground"}`}>{value}</div>
  </div>
);

export default ClientsAuthAudit;
