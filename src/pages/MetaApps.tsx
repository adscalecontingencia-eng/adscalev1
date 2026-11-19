import React, { useEffect, useMemo, useState } from "react";
import { tr, localizedMap } from '@/i18n';
import { getNumberLocale } from '@/i18n/format';
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AppWindow, Plus, Pencil, Trash2, Star, Eye, EyeOff, Users as UsersIcon, ShieldCheck,
  CheckCircle2, XCircle, RefreshCw, KeyRound, Clock, Beaker, Copy, AlertTriangle, Zap, BookOpen,
} from "lucide-react";
import { PageHero } from "@/components/ui-kit";
import { SystemUserTokenGuide } from "@/components/meta/SystemUserTokenGuide";

type MetaApp = {
  id: string;
  label: string;
  app_id: string;
  app_secret: string | null;
  system_user_token: string | null;
  user_access_token: string | null;
  is_default: boolean;
  status: string;
  notes: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
  token_scopes: string[] | null;
  token_expires_at: string | null;
  token_issued_at: string | null;
  token_user_id: string | null;
  token_type: string | null;
  last_validated_at: string | null;
  validation_status: any;
  data_access_expires_at: string | null;
};

type Client = { id: string; name: string; meta_app_id: string | null };

const REQUIRED_SCOPES = ["ads_read", "ads_management", "business_management"];

const SCOPE_WARNINGS: Record<string, string> = localizedMap('meta.apps.scope', {
  ads_read: "Sem ads_read, não será possível ler contas e relatórios de anúncios.",
  ads_management: "Sem ads_management, ações de gerenciamento podem falhar.",
  business_management: "Sem business_management, a integração pode não conseguir relacionar contas às BMs e ativos comerciais.",
});

const emptyForm: Partial<MetaApp> = {
  label: "",
  app_id: "",
  app_secret: "",
  system_user_token: "",
  user_access_token: "",
  is_default: false,
  status: "active",
  notes: "",
};

const SecretField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}> = ({ label, value, onChange, placeholder, hint }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={show ? "ocultar" : "mostrar"}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
};

const maskToken = (v?: string | null) => {
  if (!v) return "—";
  if (v.length <= 8) return "•".repeat(v.length);
  return `${v.slice(0, 4)}••••${v.slice(-4)}`;
};

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(getNumberLocale()); } catch { return "—"; }
};

type SyncResult = {
  total: number; active: number; disabled: number; upserted: number;
  accounts: Array<{ id: string; name: string; account_status?: number; business?: any; currency?: string }>;
};

export default function MetaApps() {
  const [apps, setApps] = useState<MetaApp[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<MetaApp>>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<Record<string, string | null>>({});
  const [syncResults, setSyncResults] = useState<Record<string, SyncResult | null>>({});
  const [accountCounts, setAccountCounts] = useState<Map<string, number>>(new Map());

  const setAppBusy = (id: string, key: string | null) =>
    setBusy((b) => ({ ...b, [id]: key }));

  const load = async () => {
    setLoading(true);
    const [a, c, ac] = await Promise.all([
      supabase.from("meta_apps").select("*").order("is_default", { ascending: false }).order("label"),
      supabase.from("clients").select("id, name, meta_app_id").order("name"),
      fetchAllRows((f, t) => supabase.from("meta_ad_accounts").select("meta_app_id").order("id").range(f, t)),
    ]);
    if (a.error) toast.error(a.error.message);
    if (c.error) toast.error(c.error.message);
    setApps((a.data as MetaApp[]) || []);
    setClients((c.data as Client[]) || []);
    const map = new Map<string, number>();
    ((ac.data as any[]) || []).forEach((r) => {
      if (r.meta_app_id) map.set(r.meta_app_id, (map.get(r.meta_app_id) || 0) + 1);
    });
    setAccountCounts(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const clientsByApp = useMemo(() => {
    const m = new Map<string, number>();
    clients.forEach((c) => {
      if (c.meta_app_id) m.set(c.meta_app_id, (m.get(c.meta_app_id) || 0) + 1);
    });
    return m;
  }, [clients]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm, is_default: apps.length === 0 });
    setOpen(true);
  };

  const openEdit = (app: MetaApp) => {
    setEditId(app.id);
    setForm({ ...app });
    setOpen(true);
  };

  // Form validation
  const appIdIsEmail = !!form.app_id && /@/.test(form.app_id);
  const appIdIsNumeric = !!form.app_id && /^\d+$/.test(form.app_id.trim());
  const userTokenPrefixOdd = !!form.user_access_token && !/^EAA/i.test(form.user_access_token);

  const save = async () => {
    if (!form.label?.trim() || !form.app_id?.trim()) {
      toast.error(tr('meta.apps.fillMin'));
      return;
    }
    if (appIdIsEmail) {
      toast.error(tr('meta.apps.notEmail'));
      return;
    }
    if (!appIdIsNumeric) {
      toast.error(tr('meta.apps.digits'));
      return;
    }
    if (!form.app_secret?.trim()) {
      toast.error(tr('meta.apps.secretReq'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        label: form.label!.trim(),
        app_id: form.app_id!.trim(),
        app_secret: form.app_secret || null,
        system_user_token: form.system_user_token || null,
        user_access_token: form.user_access_token || null,
        is_default: !!form.is_default,
        status: form.status || "active",
        notes: form.notes || null,
      };

      if (payload.is_default) {
        const q = supabase.from("meta_apps").update({ is_default: false }).eq("is_default", true);
        if (editId) await q.neq("id", editId); else await q;
      }

      if (editId) {
        const { error } = await supabase.from("meta_apps").update(payload).eq("id", editId);
        if (error) throw error;
        toast.success(tr('meta.apps.updated'));
      } else {
        const { error } = await supabase.from("meta_apps").insert(payload);
        if (error) throw error;
        toast.success(tr('meta.apps.created'));
      }
      setOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message || tr('meta.apps.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (app: MetaApp) => {
    const using = clientsByApp.get(app.id) || 0;
    const ok = window.confirm(
      tr('meta.apps.confirmDel', { name: app.label }) +
      (using > 0 ? `\n${tr('meta.apps.confirmDelUsing', { n: using })}` : "")
    );
    if (!ok) return;
    const { error } = await supabase.from("meta_apps").delete().eq("id", app.id);
    if (error) return toast.error(error.message);
    toast.success(tr('meta.apps.removed'));
    await load();
  };

  const setDefault = async (app: MetaApp) => {
    if (app.is_default) return;
    const { error: e1 } = await supabase.from("meta_apps").update({ is_default: false }).eq("is_default", true);
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await supabase.from("meta_apps").update({ is_default: true }).eq("id", app.id);
    if (e2) return toast.error(e2.message);
    toast.success(tr('meta.apps.nowDefault', { name: app.label }));
    await load();
  };

  const updateClientApp = async (clientId: string, metaAppId: string | null) => {
    const { error } = await supabase
      .from("clients")
      .update({ meta_app_id: metaAppId })
      .eq("id", clientId);
    if (error) return toast.error(error.message);
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, meta_app_id: metaAppId } : c))
    );
    toast.success(tr('meta.apps.clientUpdated'));
  };

  // === Edge function actions ===
  const validateToken = async (app: MetaApp, token_type: "user" | "system" = "user") => {
    setAppBusy(app.id, "validate");
    try {
      const { data, error } = await supabase.functions.invoke("meta-validate-token", {
        body: { meta_app_id: app.id, token_type },
      });
      if (error) throw error;
      console.groupCollapsed("[meta-validate-token] diagnóstico");
      console.log("valid:", data?.valid, "user_id:", data?.user_id, "app_id:", data?.app_id);
      console.log("flat_scopes:", data?.flat_scopes);
      console.log("granular_scopes:", data?.granular_scopes);
      console.log("permissions_granted:", data?.permissions_granted);
      console.log("permissions_declined:", data?.permissions_declined);
      console.log("permissions_error:", data?.permissions_error);
      console.log("effective scopes:", data?.scopes);
      console.log("missing_scopes:", data?.missing_scopes);
      console.log("debug_raw:", data?.debug_raw);
      console.log("logs backend:", data?.logs);
      console.groupEnd();
      if (data?.valid) {
        const missing = (data.missing_scopes || []) as string[];
        const declined = (data.permissions_declined || []) as string[];
        if (missing.length) {
          const declinedMsg = declined.length ? ` | ${tr('meta.apps.declined', { list: declined.join(", ") })}` : "";
          toast.warning(tr('meta.apps.missingPerms', { list: missing.join(", "), declined: declinedMsg }));
        } else {
          toast.success(tr('meta.apps.allOk'));
        }
      } else {
        toast.error(data?.error || tr('meta.apps.invalid'));
      }

      await load();
    } catch (e: any) {
      toast.error(e.message || tr('meta.apps.validateFail'));
    } finally {
      setAppBusy(app.id, null);
    }
  };

  const exchangeLongLived = async (app: MetaApp) => {
    setAppBusy(app.id, "exchange");
    try {
      const { data, error } = await supabase.functions.invoke("meta-exchange-long-lived-token", {
        body: { meta_app_id: app.id },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success(tr('meta.apps.longOk'));
      } else {
        toast.error(data?.error || tr('meta.apps.exchangeFail'));
      }
      await load();
    } catch (e: any) {
      toast.error(e.message || tr('meta.apps.exchangeFail'));
    } finally {
      setAppBusy(app.id, null);
    }
  };

  const syncAdAccounts = async (app: MetaApp, dry_run = false) => {
    setAppBusy(app.id, dry_run ? "test" : "sync");
    try {
      const { data, error } = await supabase.functions.invoke("meta-sync-user-adaccounts", {
        body: { meta_app_id: app.id, dry_run },
      });
      if (error) throw error;
      console.groupCollapsed("[meta-sync-user-adaccounts] diagnóstico");
      console.log("total:", data?.total, "sources:", data?.sources);
      console.log("businesses_count:", data?.businesses_count);
      console.log("endpointErrors:", data?.endpointErrors);
      console.log("hint:", data?.hint);
      console.log("logs:", data?.logs);
      console.groupEnd();
      if (data?.ok) {
        setSyncResults((s) => ({ ...s, [app.id]: data as SyncResult }));
        if (data.total === 0) {
          toast.warning(data?.hint || tr('meta.apps.noAccounts'), { duration: 10000 });
        } else {
          toast.success(tr('meta.apps.syncResult', { total: data.total, active: data.active, disabled: data.disabled, test: dry_run ? " " + tr('meta.apps.testSuffix') : "" }));
        }
        if (!dry_run) await load();
      } else {
        toast.error(data?.error || tr('meta.apps.syncFail'));
      }

    } catch (e: any) {
      toast.error(e.message || tr('meta.apps.syncFail'));
    } finally {
      setAppBusy(app.id, null);
    }
  };

  const copyTestEndpoint = (app: MetaApp) => {
    const url = `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,account_status,business&access_token={USER_ACCESS_TOKEN}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success(tr('meta.apps.endpointCopied')),
      () => toast.error(tr('meta.apps.copyFail'))
    );
  };

  const defaultApp = apps.find((a) => a.is_default);

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow={tr('meta.apps.eyebrow')}
        title={<><span className="text-primary glow-text">{tr('meta.apps.titleA')}</span> {tr('meta.apps.titleB')}</>}
        description={tr('meta.apps.desc')}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary" className="gap-1">
            <AppWindow size={12} /> {apps.length} aplicativo(s)
          </Badge>
          <Badge variant="secondary" className="gap-1 bg-primary/15 text-primary border-primary/30">
            <Star size={12} /> {tr('meta.apps.defaultLbl')} {defaultApp?.label || "—"}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <UsersIcon size={12} /> {tr('meta.apps.withApp', { n: clients.filter((c) => c.meta_app_id).length, total: clients.length })}
          </Badge>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} size="sm">
              <Plus size={14} className="mr-1" /> {tr('meta.apps.newApp')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2">
                <DialogTitle>{editId ? tr('meta.apps.editTitle') : tr('meta.apps.newTitle')}</DialogTitle>
                <SystemUserTokenGuide />
              </div>
            </DialogHeader>

            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="text-primary font-semibold">{tr('meta.apps.before')}</span>
                <span dangerouslySetInnerHTML={{ __html: tr('meta.apps.beforeBody') }} />
              </div>
            </div>


            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">{tr('meta.apps.label')}</Label>
                  <Input
                    value={form.label || ""}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder={tr('meta.apps.labelPh')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">App ID</Label>
                  <Input
                    value={form.app_id || ""}
                    onChange={(e) => setForm((f) => ({ ...f, app_id: e.target.value }))}
                    placeholder="1234567890"
                    className="font-mono text-xs"
                  />
                  {appIdIsEmail && (
                    <p className="text-[10px] text-destructive flex items-center gap-1">
                      <AlertTriangle size={10} /> {tr('meta.apps.appIdNotEmail')}
                    </p>
                  )}
                  {!!form.app_id && !appIdIsEmail && !appIdIsNumeric && (
                    <p className="text-[10px] text-destructive flex items-center gap-1">
                      <AlertTriangle size={10} /> {tr('meta.apps.digits')}
                    </p>
                  )}
                </div>
              </div>

              <SecretField
                label="App Secret *"
                value={form.app_secret || ""}
                onChange={(v) => setForm((f) => ({ ...f, app_secret: v }))}
                placeholder={tr('meta.apps.secretPh')}
              />

              <SecretField
                label="User Access Token"
                value={form.user_access_token || ""}
                onChange={(v) => setForm((f) => ({ ...f, user_access_token: v }))}
                placeholder={tr('meta.apps.uatPh')}
                hint={userTokenPrefixOdd ? tr('meta.apps.prefixWarn') : undefined}
              />

              <SecretField
                label={tr('meta.apps.sutLbl')}
                value={form.system_user_token || ""}
                onChange={(v) => setForm((f) => ({ ...f, system_user_token: v }))}
                placeholder={tr('meta.apps.sutPh')}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">{tr('meta.apps.status')}</Label>
                  <Select
                    value={form.status || "active"}
                    onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{tr('meta.apps.active')}</SelectItem>
                      <SelectItem value="inactive">{tr('meta.apps.inactive')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2">
                  <Switch
                    checked={!!form.is_default}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, is_default: v }))}
                    id="is_default"
                  />
                  <div className="flex-1">
                    <Label htmlFor="is_default" className="text-sm cursor-pointer">{tr('meta.apps.defaultApp')}</Label>
                    <p className="text-[11px] text-muted-foreground">{tr('meta.apps.defaultHint')}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{tr('meta.apps.notes')}</Label>
                <Textarea
                  value={form.notes || ""}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder={tr('meta.apps.notesPh')}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>{tr('meta.apps.cancel')}</Button>
              <Button onClick={save} disabled={saving}>{saving ? tr('meta.apps.saving') : tr('meta.apps.save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[0, 1].map((i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : apps.length === 0 ? (
        <Card className="p-12 text-center">
          <AppWindow className="mx-auto text-muted-foreground mb-3" size={32} />
          <p className="text-sm font-medium">{tr('meta.apps.none')}</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            {tr('meta.apps.noneHint')}
          </p>
          <Button onClick={openCreate} size="sm">
            <Plus size={14} className="mr-1" /> {tr('meta.apps.register')}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {apps.map((app) => {
            const usingCount = clientsByApp.get(app.id) || 0;
            const accountsSynced = accountCounts.get(app.id) || 0;
            const scopes = app.token_scopes || [];
            const missing = REQUIRED_SCOPES.filter((s) => !scopes.includes(s));
            const vs = app.validation_status || {};
            const isValid = !!vs.is_valid || (scopes.length > 0 && !!app.last_validated_at);
            const expired = app.token_expires_at && new Date(app.token_expires_at).getTime() < Date.now();
            const currentBusy = busy[app.id];
            const result = syncResults[app.id];

            return (
              <Card key={app.id} className="p-4 space-y-3 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-base font-semibold truncate">{app.label}</h3>
                      {app.is_default && (
                        <Badge className="bg-primary/15 text-primary border-primary/40 gap-1">
                          <Star size={10} /> {tr('meta.apps.default')}
                        </Badge>
                      )}
                      <Badge variant="secondary" className={
                        app.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-muted text-muted-foreground"
                      }>
                        {app.status === "active" ? tr('meta.apps.active') : tr('meta.apps.inactive')}
                      </Badge>
                      {app.last_validated_at && (
                        <Badge variant="secondary" className={
                          isValid && !expired
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1"
                            : "bg-destructive/10 text-destructive border-destructive/30 gap-1"
                        }>
                          {isValid && !expired ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                          {isValid && !expired ? tr('meta.apps.tokValid') : expired ? tr('meta.apps.tokExpired') : tr('meta.apps.tokInvalid')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono mt-1">App ID: {app.app_id}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!app.is_default && (
                      <Button size="icon" variant="ghost" onClick={() => setDefault(app)} title={tr('meta.apps.makeDefault')}>
                        <Star size={14} />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => openEdit(app)} title={tr('meta.apps.editToken')}>
                      <Pencil size={14} />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(app)} title={tr('meta.apps.delete')} className="text-destructive hover:text-destructive">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-md bg-secondary/40 border border-border px-2 py-1.5">
                    <div className="text-muted-foreground uppercase tracking-wider text-[9px]">App Secret</div>
                    <div className="font-mono">{maskToken(app.app_secret)}</div>
                  </div>
                  <div className="rounded-md bg-secondary/40 border border-border px-2 py-1.5">
                    <div className="text-muted-foreground uppercase tracking-wider text-[9px]">System User</div>
                    <div className="font-mono">{maskToken(app.system_user_token)}</div>
                  </div>
                  <div className="rounded-md bg-secondary/40 border border-border px-2 py-1.5 col-span-2">
                    <div className="text-muted-foreground uppercase tracking-wider text-[9px]">User Access Token</div>
                    <div className="font-mono">{maskToken(app.user_access_token)}</div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Button
                    size="sm" variant="outline"
                    disabled={!app.user_access_token || !!currentBusy}
                    onClick={() => validateToken(app, "user")}
                  >
                    {currentBusy === "validate" ? <RefreshCw size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                    {tr('meta.apps.validate')}
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    disabled={!app.user_access_token || !!currentBusy}
                    onClick={() => syncAdAccounts(app, false)}
                  >
                    {currentBusy === "sync" ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    {tr('meta.apps.sync')}
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    disabled={!app.user_access_token || !!currentBusy}
                    onClick={() => syncAdAccounts(app, true)}
                    title={tr('meta.apps.testTitle')}
                  >
                    <Beaker size={12} /> {tr('meta.apps.testBtn')}
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    disabled={!app.user_access_token || !!currentBusy}
                    onClick={() => exchangeLongLived(app)}
                  >
                    {currentBusy === "exchange" ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                    {tr('meta.apps.long')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => copyTestEndpoint(app)}>
                    <Copy size={12} /> Endpoint
                  </Button>
                </div>

                {/* Diagnóstico */}
                <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <KeyRound size={12} className="text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider">{tr('meta.apps.diag')}</span>
                  </div>

                  {!app.user_access_token && (
                    <p className="text-[11px] text-amber-400 flex items-center gap-1">
                      <AlertTriangle size={11} /> {tr('meta.apps.addUat')}
                    </p>
                  )}

                  {app.last_validated_at ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <div className="text-muted-foreground">{tr('meta.apps.tokUser')}</div>
                          <div className="font-mono">{app.token_user_id || "—"}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground flex items-center gap-1"><Clock size={10} /> {tr('meta.apps.expires')}</div>
                          <div className={expired ? "text-destructive" : ""}>{fmtDate(app.token_expires_at)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">{tr('meta.apps.lastVal')}</div>
                          <div>{fmtDate(app.last_validated_at)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">{tr('meta.apps.syncedAccts')}</div>
                          <div>{accountsSynced}</div>
                        </div>
                      </div>

                      {scopes.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[10px] uppercase text-muted-foreground">{tr('meta.apps.perms')}</div>
                          <div className="flex flex-wrap gap-1">
                            {scopes.map((s) => (
                              <Badge key={s} variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {missing.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[10px] uppercase text-destructive flex items-center gap-1">
                            <AlertTriangle size={10} /> {tr('meta.apps.missing')}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {missing.map((s) => (
                              <Badge key={s} variant="secondary" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                                {s}
                              </Badge>
                            ))}
                          </div>
                          <ul className="text-[10px] text-muted-foreground list-disc list-inside space-y-0.5">
                            {missing.map((s) => <li key={s}>{SCOPE_WARNINGS[s]}</li>)}
                          </ul>
                          <SystemUserTokenGuide
                            trigger={
                              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 mt-1">
                                <BookOpen size={12} /> {tr('meta.apps.guide')}
                              </Button>
                            }
                          />

                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      {tr('meta.apps.clickValidate')}
                    </p>
                  )}
                </div>

                {/* Resultado do teste/sync */}
                {result && (
                  <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        {tr('meta.apps.found', { n: result.total })}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {tr('meta.apps.activeInactive', { a: result.active, d: result.disabled })}
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-border/40">
                      {result.accounts.slice(0, 50).map((acc) => (
                        <div key={acc.id} className="flex items-center justify-between py-1.5 text-[11px]">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{acc.name || acc.id}</div>
                            <div className="font-mono text-[10px] text-muted-foreground truncate">
                              {acc.id} {acc.business?.name ? `· BM: ${acc.business.name}` : ""}
                            </div>
                          </div>
                          <Badge variant="secondary" className={
                            acc.account_status === 1
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]"
                              : "bg-muted text-muted-foreground text-[10px]"
                          }>
                            {acc.account_status === 1 ? "ativa" : `status ${acc.account_status ?? "?"}`}
                          </Badge>
                        </div>
                      ))}
                      {result.accounts.length > 50 && (
                        <p className="text-[10px] text-muted-foreground pt-1">+ {result.accounts.length - 50} contas…</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border">
                  <span className="inline-flex items-center gap-1">
                    <UsersIcon size={11} /> {usingCount} cliente(s)
                  </span>
                  {app.notes && <span className="truncate max-w-[60%]" title={app.notes}>{app.notes}</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Associação cliente x aplicativo */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-primary" size={16} />
          <h3 className="font-display text-base font-semibold">{tr('meta.apps.perClient')}</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          {tr('meta.apps.perClientHint')}
        </p>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : clients.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">{tr('meta.apps.noClients')}</p>
        ) : (
          <div className="divide-y divide-border">
            {clients.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm truncate">{c.name}</span>
                <Select
                  value={c.meta_app_id || "__default__"}
                  onValueChange={(v) => updateClientApp(c.id, v === "__default__" ? null : v)}
                >
                  <SelectTrigger className="w-[260px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">
                      {tr('meta.apps.default')} ({defaultApp?.label || "—"})
                    </SelectItem>
                    {apps.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label}{a.is_default ? ` · ${tr('meta.apps.defaultLower')}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
