import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { isBelowFloor } from '@/lib/agency-tiers';

const usd = (n: any) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
interface Row { name: string; min: string; pct: string; subsidy: boolean }

interface Props {
  sub: any | null;
  agencyId: string;
  tiers: any[];            // all agency tiers (default + per client)
  platformPcts: number[];  // AD SCALE cost per platform level
  onClose: () => void;
  onSaved: () => void;
}

/** Per-client weekly goals for the agency, like the custom goals AD SCALE sets per client. */
export const AgencyClientGoalsDialog: React.FC<Props> = ({ sub, agencyId, tiers, platformPcts, onClose, onSaved }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const defaults = tiers.filter(t => !t.sub_client_id).sort((a, b) => a.min_weekly_spend - b.min_weekly_spend);

  useEffect(() => {
    if (!sub) return;
    setRows(tiers.filter(t => t.sub_client_id === sub.id).sort((a, b) => a.min_weekly_spend - b.min_weekly_spend)
      .map(t => ({ name: t.name, min: String(t.min_weekly_spend), pct: String(t.total_pct), subsidy: !!t.allow_subsidy })));
  }, [sub, tiers]);

  const upd = (i: number, patch: Partial<Row>) => setRows(r => r.map((x, j) => j === i ? { ...x, ...patch } : x));
  const num = (v: string) => Number(String(v).replace(',', '.'));

  const save = async () => {
    for (const r of rows) {
      if (!r.name.trim() || isNaN(num(r.min)) || isNaN(num(r.pct)) || num(r.pct) <= 0) return toast.error('Preencha nome, meta e taxa de todas as linhas.');
      if (isBelowFloor(num(r.pct), platformPcts, r.subsidy)) return toast.error(`A taxa ${r.pct}% fica abaixo do seu custo. Marque "vou subsidiar" para confirmar.`);
    }
    setSaving(true);
    const { error: delErr } = await supabase.from('agency_tiers').delete().eq('agency_client_id', agencyId).eq('sub_client_id', sub.id);
    if (delErr) { setSaving(false); return toast.error('Não foi possível salvar as metas.'); }
    if (rows.length) {
      const { error } = await supabase.from('agency_tiers').insert(rows.map(r => ({
        agency_client_id: agencyId, sub_client_id: sub.id, name: r.name.trim().slice(0, 60),
        min_weekly_spend: num(r.min), total_pct: num(r.pct), allow_subsidy: r.subsidy,
      })));
      if (error) { setSaving(false); return toast.error('Não foi possível salvar as metas.'); }
    }
    setSaving(false);
    toast.success(rows.length ? 'Metas do cliente salvas.' : 'Cliente voltou a usar as metas padrão.');
    onSaved(); onClose();
  };

  return (
    <Dialog open={!!sub} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Metas semanais · {sub?.name}</DialogTitle>
          <DialogDescription className="text-xs">
            Defina a taxa que este cliente paga conforme o gasto da semana (sexta a quinta). Se não houver metas próprias, ele usa as metas padrão da agência.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {rows.map((r, i) => {
            const below = isBelowFloor(num(r.pct), platformPcts, false);
            return (
              <div key={i} className="rounded-lg border border-border/60 bg-secondary/30 p-2 space-y-1.5">
                <div className="flex items-end gap-2">
                  <div className="flex-1"><label className="text-[10px] text-muted-foreground">Nome</label><Input value={r.name} placeholder="Ex.: Prata" onChange={e => upd(i, { name: e.target.value })} /></div>
                  <div className="w-36"><label className="text-[10px] text-muted-foreground">Gasto semanal a partir de (US$)</label><Input type="number" value={r.min} onChange={e => upd(i, { min: e.target.value })} /></div>
                  <div className="w-20"><label className="text-[10px] text-muted-foreground">Taxa %</label><Input value={r.pct} onChange={e => upd(i, { pct: e.target.value })} /></div>
                  <Button size="icon" variant="ghost" onClick={() => setRows(x => x.filter((_, j) => j !== i))}><Trash2 size={14} /></Button>
                </div>
                {below && <label className="flex items-center gap-2 text-[11px] text-destructive"><Checkbox checked={r.subsidy} onCheckedChange={v => upd(i, { subsidy: !!v })} />Taxa abaixo do seu custo. Vou subsidiar a diferença.</label>}
              </div>
            );
          })}
          {!rows.length && (
            <div className="rounded-lg border border-dashed border-border/60 p-4 text-xs text-muted-foreground space-y-1">
              <p>Este cliente usa as metas padrão:</p>
              {defaults.length ? defaults.map(d => <p key={d.id}>• {d.name}: a partir de {usd(d.min_weekly_spend)} → <b className="text-primary">{d.total_pct}%</b></p>)
                : <p>• Taxa sugerida (seu custo + margem sugerida).</p>}
            </div>
          )}
        </div>

        <Button variant="outline" className="gap-2 w-full" onClick={() => setRows(r => [...r, { name: r.length ? `Meta ${r.length + 1}` : 'Base', min: r.length ? String(num(r[r.length - 1].min) + 10000) : '0', pct: '5', subsidy: false }])}>
          <Plus size={14} />Adicionar meta
        </Button>
        <DialogFooter className="gap-2">
          {rows.length > 0 && <Button variant="ghost" onClick={() => setRows([])}>Usar metas padrão</Button>}
          <Button disabled={saving} onClick={save}>{saving ? 'Salvando…' : 'Salvar metas'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
