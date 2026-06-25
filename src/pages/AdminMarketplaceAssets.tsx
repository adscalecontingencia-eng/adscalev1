import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Boxes, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Asset {
  id: string;
  name: string;
  platform: string;
  currency: string;
  year: number | null;
  price: number;
  verified: boolean;
  notes: string | null;
  status: string;
  sort_order: number;
}

interface Account {
  id?: string;
  account_number: number;
  status: string;
  is_prepaid: boolean;
  gastos: number;
  limite_meta: number;
  ciclo: number;
  divida: number;
  saldo: number;
  extensao_limite: number | null;
}

const emptyAsset: Partial<Asset> = {
  name: "", platform: "Facebook", currency: "BRL", year: new Date().getFullYear(),
  price: 0, verified: false, notes: "", status: "active", sort_order: 0,
};

const emptyAccount = (n: number): Account => ({
  account_number: n, status: "Ativa", is_prepaid: false, gastos: 0, limite_meta: 0,
  ciclo: 0, divida: 0, saldo: 0, extensao_limite: null,
});

const fmt = (n: number, currency = "BRL") => {
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "R$";
  return `${symbol} ${Math.round(n || 0).toLocaleString("pt-BR")}`;
};

export default function AdminMarketplaceAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [accountsMap, setAccountsMap] = useState<Record<string, Account[]>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Asset> | null>(null);
  const [editingAccounts, setEditingAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: a }, { data: ac }] = await Promise.all([
      supabase.from("marketplace_assets").select("*").order("created_at", { ascending: false }),
      supabase.from("marketplace_asset_accounts").select("*").order("account_number", { ascending: true }),
    ]);
    setAssets((a ?? []) as Asset[]);
    const m: Record<string, Account[]> = {};
    (ac ?? []).forEach((row: any) => {
      m[row.asset_id] = m[row.asset_id] || [];
      m[row.asset_id].push(row);
    });
    setAccountsMap(m);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing({ ...emptyAsset });
    setEditingAccounts([emptyAccount(1)]);
  };

  const openEdit = (a: Asset) => {
    setEditing({ ...a });
    setEditingAccounts((accountsMap[a.id] ?? []).map(x => ({ ...x })));
  };

  const addAccount = () => {
    setEditingAccounts(arr => [...arr, emptyAccount(arr.length + 1)]);
  };

  const updateAccount = (idx: number, patch: Partial<Account>) => {
    setEditingAccounts(arr => arr.map((a, i) => i === idx ? { ...a, ...patch } : a));
  };

  const removeAccount = (idx: number) => {
    setEditingAccounts(arr => arr.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!editing?.name) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    try {
      let assetId = (editing as Asset).id;
      const payload = {
        name: editing.name,
        platform: editing.platform || "Facebook",
        currency: editing.currency || "BRL",
        year: editing.year ?? null,
        price: Number(editing.price ?? 0),
        verified: !!editing.verified,
        notes: editing.notes ?? null,
        status: editing.status || "active",
        sort_order: editing.sort_order ?? 0,
      };
      if (assetId) {
        const { error } = await supabase.from("marketplace_assets").update(payload).eq("id", assetId);
        if (error) throw error;
        await supabase.from("marketplace_asset_accounts").delete().eq("asset_id", assetId);
      } else {
        const { data, error } = await supabase.from("marketplace_assets").insert(payload).select("id").single();
        if (error) throw error;
        assetId = data.id;
      }
      if (editingAccounts.length > 0) {
        const rows = editingAccounts.map(a => ({
          asset_id: assetId,
          account_number: a.account_number,
          status: a.status,
          is_prepaid: a.is_prepaid,
          gastos: Number(a.gastos || 0),
          limite_meta: Number(a.limite_meta || 0),
          ciclo: Number(a.ciclo || 0),
          divida: Number(a.divida || 0),
          saldo: Number(a.saldo || 0),
          extensao_limite: a.extensao_limite,
        }));
        const { error } = await supabase.from("marketplace_asset_accounts").insert(rows);
        if (error) throw error;
      }
      toast.success("Ativo salvo");
      setEditing(null);
      setEditingAccounts([]);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Asset) => {
    if (!confirm(`Excluir ${a.name}?`)) return;
    const { error } = await supabase.from("marketplace_assets").delete().eq("id", a.id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); await load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Boxes size={22} /> Ativos c/ Gastos
          </h1>
          <p className="text-sm text-muted-foreground">Cadastre BMs com suas contas de anúncio, gastos, limites e dívidas para exibir no marketplace.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={`mr-1.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button size="sm" onClick={openNew}><Plus size={14} className="mr-1.5" /> Novo ativo</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Moeda</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-center">Contas</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    {a.name}
                    {a.verified && <Badge variant="outline" className="ml-2 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">Verificada</Badge>}
                  </TableCell>
                  <TableCell>{a.platform}</TableCell>
                  <TableCell>{a.currency}</TableCell>
                  <TableCell>{a.year ?? "—"}</TableCell>
                  <TableCell className="text-right">{fmt(a.price, "BRL")}</TableCell>
                  <TableCell className="text-center">{(accountsMap[a.id] ?? []).length}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={a.status === "active" ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-border text-muted-foreground"}>
                      {a.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(a)}><Pencil size={14} /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(a)}><Trash2 size={14} className="text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {assets.length === 0 && !loading && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum ativo cadastrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{(editing as Asset)?.id ? "Editar ativo" : "Novo ativo"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-5 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Nome do BM</Label>
                  <Input value={editing.name || ""} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Ex: BM MaxScale MS360" />
                </div>
                <div>
                  <Label>Preço (R$)</Label>
                  <Input type="number" value={editing.price ?? 0} onChange={e => setEditing({ ...editing, price: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Plataforma</Label>
                  <Select value={editing.platform || "Facebook"} onValueChange={v => setEditing({ ...editing, platform: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Facebook">Facebook</SelectItem>
                      <SelectItem value="Google">Google</SelectItem>
                      <SelectItem value="TikTok">TikTok</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Moeda das contas</Label>
                  <Select value={editing.currency || "BRL"} onValueChange={v => setEditing({ ...editing, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">BRL (R$)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ano de criação</Label>
                  <Input type="number" value={editing.year ?? ""} onChange={e => setEditing({ ...editing, year: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={editing.status || "active"} onValueChange={v => setEditing({ ...editing, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo (visível no marketplace)</SelectItem>
                      <SelectItem value="hidden">Oculto</SelectItem>
                      <SelectItem value="sold">Vendido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={!!editing.verified} onCheckedChange={v => setEditing({ ...editing, verified: v })} />
                  <Label>Verificada</Label>
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={editing.notes || ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} rows={3} />
              </div>

              <div className="border-t border-border/60 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-foreground text-sm">Contas de anúncio</p>
                  <Button size="sm" variant="outline" onClick={addAccount}><Plus size={12} className="mr-1" /> Adicionar conta</Button>
                </div>
                <div className="space-y-2">
                  {editingAccounts.map((a, idx) => (
                    <div key={idx} className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Input className="w-16" type="number" value={a.account_number} onChange={e => updateAccount(idx, { account_number: Number(e.target.value) })} />
                        <Select value={a.status} onValueChange={v => updateAccount(idx, { status: v })}>
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Ativa">Ativa</SelectItem>
                            <SelectItem value="Inativa">Inativa</SelectItem>
                            <SelectItem value="Bloqueada">Bloqueada</SelectItem>
                          </SelectContent>
                        </Select>
                        <label className="flex items-center gap-1.5 text-xs">
                          <Switch checked={a.is_prepaid} onCheckedChange={v => updateAccount(idx, { is_prepaid: v })} /> Pré-paga
                        </label>
                        <Button size="icon" variant="ghost" className="ml-auto" onClick={() => removeAccount(idx)}>
                          <Trash2 size={14} className="text-destructive" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        <Field label="Gastos" value={a.gastos} onChange={v => updateAccount(idx, { gastos: v })} />
                        <Field label="Limite Meta" value={a.limite_meta} onChange={v => updateAccount(idx, { limite_meta: v })} />
                        <Field label="Ciclo" value={a.ciclo} onChange={v => updateAccount(idx, { ciclo: v })} />
                        <Field label="Dívida" value={a.divida} onChange={v => updateAccount(idx, { divida: v })} />
                        <Field label="Saldo" value={a.saldo} onChange={v => updateAccount(idx, { saldo: v })} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Field: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <div>
    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
    <Input type="number" value={value} onChange={e => onChange(Number(e.target.value))} />
  </div>
);
