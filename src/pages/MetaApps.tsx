import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
} from "lucide-react";
import { PageHero } from "@/components/ui-kit";

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
};

type Client = { id: string; name: string; meta_app_id: string | null };

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
}> = ({ label, value, onChange, placeholder }) => {
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
    </div>
  );
};

const maskToken = (v?: string | null) => {
  if (!v) return "—";
  if (v.length <= 8) return "•".repeat(v.length);
  return `${v.slice(0, 4)}••••${v.slice(-4)}`;
};

export default function MetaApps() {
  const [apps, setApps] = useState<MetaApp[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<MetaApp>>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [a, c] = await Promise.all([
      supabase.from("meta_apps").select("*").order("is_default", { ascending: false }).order("label"),
      supabase.from("clients").select("id, name, meta_app_id").order("name"),
    ]);
    if (a.error) toast.error(a.error.message);
    if (c.error) toast.error(c.error.message);
    setApps((a.data as MetaApp[]) || []);
    setClients((c.data as Client[]) || []);
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

  const save = async () => {
    if (!form.label?.trim() || !form.app_id?.trim()) {
      toast.error("Preencha pelo menos o rótulo e o App ID");
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

      // Se marcar este como padrão, desmarca os outros para respeitar o índice único.
      if (payload.is_default) {
        const q = supabase.from("meta_apps").update({ is_default: false }).eq("is_default", true);
        if (editId) await q.neq("id", editId); else await q;
      }

      if (editId) {
        const { error } = await supabase.from("meta_apps").update(payload).eq("id", editId);
        if (error) throw error;
        toast.success("Aplicativo atualizado");
      } else {
        const { error } = await supabase.from("meta_apps").insert(payload);
        if (error) throw error;
        toast.success("Aplicativo criado");
      }
      setOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (app: MetaApp) => {
    const using = clientsByApp.get(app.id) || 0;
    const ok = window.confirm(
      `Excluir o aplicativo "${app.label}"?` +
      (using > 0 ? `\n${using} cliente(s) usam este aplicativo e voltarão a usar o padrão.` : "")
    );
    if (!ok) return;
    const { error } = await supabase.from("meta_apps").delete().eq("id", app.id);
    if (error) return toast.error(error.message);
    toast.success("Aplicativo removido");
    await load();
  };

  const setDefault = async (app: MetaApp) => {
    if (app.is_default) return;
    const { error: e1 } = await supabase.from("meta_apps").update({ is_default: false }).eq("is_default", true);
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await supabase.from("meta_apps").update({ is_default: true }).eq("id", app.id);
    if (e2) return toast.error(e2.message);
    toast.success(`"${app.label}" agora é o aplicativo padrão`);
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
    toast.success("Aplicativo do cliente atualizado");
  };

  const defaultApp = apps.find((a) => a.is_default);

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Conexões Meta"
        title={<><span className="text-primary glow-text">Aplicativos</span> Meta</>}
        description="Gerencie um ou mais aplicativos Meta (App ID, Secret, tokens). Defina um padrão geral e, opcionalmente, associe um aplicativo específico por cliente — útil quando as BMs estão em perfis diferentes."
      />

      {/* Resumo + ação */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary" className="gap-1">
            <AppWindow size={12} /> {apps.length} aplicativo(s)
          </Badge>
          <Badge variant="secondary" className="gap-1 bg-primary/15 text-primary border-primary/30">
            <Star size={12} /> Padrão: {defaultApp?.label || "—"}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <UsersIcon size={12} /> {clients.filter((c) => c.meta_app_id).length}/{clients.length} clientes com app definido
          </Badge>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} size="sm">
              <Plus size={14} className="mr-1" /> Novo aplicativo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editId ? "Editar aplicativo Meta" : "Novo aplicativo Meta"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Rótulo</Label>
                  <Input
                    value={form.label || ""}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="Ex: App Principal · Perfil Matriz"
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
                </div>
              </div>

              <SecretField
                label="App Secret"
                value={form.app_secret || ""}
                onChange={(v) => setForm((f) => ({ ...f, app_secret: v }))}
                placeholder="Cole o App Secret"
              />

              <SecretField
                label="System User Token"
                value={form.system_user_token || ""}
                onChange={(v) => setForm((f) => ({ ...f, system_user_token: v }))}
                placeholder="EAAB..."
              />

              <SecretField
                label="User Access Token (opcional)"
                value={form.user_access_token || ""}
                onChange={(v) => setForm((f) => ({ ...f, user_access_token: v }))}
                placeholder="EAAB... (usado como fallback)"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
                  <Select
                    value={form.status || "active"}
                    onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
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
                    <Label htmlFor="is_default" className="text-sm cursor-pointer">Aplicativo padrão</Label>
                    <p className="text-[11px] text-muted-foreground">Usado para clientes sem app definido.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Observações</Label>
                <Textarea
                  value={form.notes || ""}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Ex: BMs hospedadas no perfil X, expira em DD/MM..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de apps */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[0, 1].map((i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : apps.length === 0 ? (
        <Card className="p-12 text-center">
          <AppWindow className="mx-auto text-muted-foreground mb-3" size={32} />
          <p className="text-sm font-medium">Nenhum aplicativo cadastrado</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Cadastre o primeiro aplicativo Meta para liberar a sincronização sem depender de mudanças no servidor.
          </p>
          <Button onClick={openCreate} size="sm">
            <Plus size={14} className="mr-1" /> Cadastrar aplicativo
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {apps.map((app) => {
            const usingCount = clientsByApp.get(app.id) || 0;
            return (
              <Card key={app.id} className="p-4 space-y-3 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-base font-semibold truncate">{app.label}</h3>
                      {app.is_default && (
                        <Badge className="bg-primary/15 text-primary border-primary/40 gap-1">
                          <Star size={10} /> Padrão
                        </Badge>
                      )}
                      <Badge variant="secondary" className={
                        app.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-muted text-muted-foreground"
                      }>
                        {app.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono mt-1">App ID: {app.app_id}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!app.is_default && (
                      <Button size="icon" variant="ghost" onClick={() => setDefault(app)} title="Tornar padrão">
                        <Star size={14} />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => openEdit(app)} title="Editar">
                      <Pencil size={14} />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(app)} title="Excluir" className="text-destructive hover:text-destructive">
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
          <h3 className="font-display text-base font-semibold">Aplicativo por cliente</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Defina qual aplicativo Meta cada cliente deve usar. Clientes sem definição usam o aplicativo padrão.
        </p>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : clients.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Nenhum cliente cadastrado.</p>
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
                      Padrão ({defaultApp?.label || "—"})
                    </SelectItem>
                    {apps.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label}{a.is_default ? " · padrão" : ""}
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
