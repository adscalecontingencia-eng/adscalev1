import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCw, Trash2, Activity, Save } from "lucide-react";

type Pixel = {
  id: string;
  provider: "meta" | "google_ads" | "google_analytics";
  pixel_id: string;
  extra: { conversion_label?: string } | null;
  enabled: boolean;
  created_at: string;
};

const PROVIDER_LABEL: Record<Pixel["provider"], string> = {
  meta: "Meta Pixel",
  google_ads: "Google Ads",
  google_analytics: "Google Analytics 4",
};

const PROVIDER_HINT: Record<Pixel["provider"], string> = {
  meta: "ID numérico do Pixel (ex: 1234567890123456)",
  google_ads: "ID de conversão AW-XXXXXXXXX (preencha também o rótulo)",
  google_analytics: "ID de medição G-XXXXXXXXXX",
};

export default function AdminTracking() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Pixel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ provider: Pixel["provider"]; pixel_id: string; conversion_label: string; enabled: boolean }>({
    provider: "meta", pixel_id: "", conversion_label: "", enabled: true,
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tracking_pixels")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Erro ao carregar pixels", description: error.message, variant: "destructive" });
    setRows((data ?? []) as Pixel[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.pixel_id.trim()) {
      toast({ title: "Informe o ID do pixel", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("tracking_pixels").insert({
      provider: form.provider,
      pixel_id: form.pixel_id.trim(),
      extra: form.provider === "google_ads" && form.conversion_label.trim()
        ? { conversion_label: form.conversion_label.trim() } : {},
      enabled: form.enabled,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Pixel cadastrado" });
    setForm({ provider: "meta", pixel_id: "", conversion_label: "", enabled: true });
    load();
  };

  const toggleEnabled = async (id: string, enabled: boolean) => {
    const { error } = await supabase.from("tracking_pixels").update({ enabled }).eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este pixel?")) return;
    const { error } = await supabase.from("tracking_pixels").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  };

  const stats = useMemo(() => ({
    total: rows.length,
    ativos: rows.filter(r => r.enabled).length,
  }), [rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity size={22} /> Tracking & Pixels
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure os pixels do Meta e do Google que carregam no marketplace. A conversão é disparada quando um depósito PIX é confirmado.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={`mr-1.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {/* Form */}
      <div className="rounded-2xl border border-border/60 bg-card/60 p-5 space-y-4">
        <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
          <Plus size={16} /> Adicionar pixel
        </h2>
        <div className="grid md:grid-cols-12 gap-3">
          <div className="md:col-span-3 space-y-1.5">
            <Label className="text-xs">Provedor</Label>
            <Select value={form.provider} onValueChange={(v) => setForm(f => ({ ...f, provider: v as Pixel["provider"] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="meta">Meta Pixel</SelectItem>
                <SelectItem value="google_ads">Google Ads</SelectItem>
                <SelectItem value="google_analytics">Google Analytics 4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-4 space-y-1.5">
            <Label className="text-xs">ID do pixel</Label>
            <Input
              value={form.pixel_id}
              onChange={(e) => setForm(f => ({ ...f, pixel_id: e.target.value }))}
              placeholder={PROVIDER_HINT[form.provider]}
            />
          </div>
          {form.provider === "google_ads" && (
            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs">Rótulo de conversão</Label>
              <Input
                value={form.conversion_label}
                onChange={(e) => setForm(f => ({ ...f, conversion_label: e.target.value }))}
                placeholder="ex: abcDEF123"
              />
            </div>
          )}
          <div className="md:col-span-2 flex items-end gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm(f => ({ ...f, enabled: v }))} />
              <span className="text-xs text-muted-foreground">Ativo</span>
            </div>
          </div>
          <div className="md:col-span-12 flex justify-end">
            <Button onClick={submit} disabled={saving}>
              <Save size={14} className="mr-1.5" /> Salvar pixel
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Dica: para Google Ads, copie o ID (<code>AW-XXXXXXXXX</code>) e o rótulo da ação de conversão criada na conta Google Ads.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label="Total cadastrados" value={stats.total.toString()} />
        <Stat label="Ativos" value={stats.ativos.toString()} />
        <Stat label="Conversão" value="Depósito PIX confirmado" />
      </div>

      {/* List */}
      <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provedor</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Rótulo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(p => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
                      {PROVIDER_LABEL[p.provider]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.pixel_id}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.extra?.conversion_label || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={p.enabled} onCheckedChange={(v) => toggleEnabled(p.id, v)} />
                      <span className="text-xs text-muted-foreground">{p.enabled ? "Ativo" : "Pausado"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => remove(p.id)} className="text-destructive hover:text-destructive">
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && !loading && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">Nenhum pixel cadastrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-border/60 bg-card/60 p-4">
    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    <p className="font-display text-base font-bold text-foreground mt-1">{value}</p>
  </div>
);
