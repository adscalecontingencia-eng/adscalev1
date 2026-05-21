import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Trash2 } from 'lucide-react';
import type { CommissionTier } from '@/lib/commission-tiers';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tiersToShow: CommissionTier[];
  tierDraft: CommissionTier[] | null;
  commissionTiers: CommissionTier[];
  updateTierDraft: (idx: number, field: 'min_spend' | 'pct', value: number) => void;
  addTier: () => void;
  removeTier: (idx: number) => void;
  saveTiers: () => void;
  cancelDraft: () => void;
  savingTiers: boolean;
}

const inputClass =
  'w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors';

export const TiersDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  tiersToShow,
  tierDraft,
  commissionTiers,
  updateTierDraft,
  addTier,
  removeTier,
  saveTiers,
  cancelDraft,
  savingTiers,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Metas semanais de desconto</DialogTitle>
          <DialogDescription className="text-xs">
            Configuração <strong className="text-foreground">global</strong>. Define o percentual aplicado conforme o
            gasto semanal acumulado de cada cliente de aluguel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={addTier}
              className="text-[11px] px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
            >
              + Adicionar meta
            </button>
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {[...tiersToShow]
              .sort((a, b) => a.min_spend - b.min_spend)
              .map((t, idx) => {
                const baseArr = tierDraft ?? commissionTiers;
                const realIdx = baseArr.findIndex((x) => x === t);
                const i = realIdx >= 0 ? realIdx : idx;
                return (
                  <div
                    key={i}
                    className="flex items-end gap-2 bg-secondary/40 border border-border rounded-lg p-2"
                  >
                    <div className="flex-1">
                      <label className="block text-[10px] text-muted-foreground mb-1">Gasto acima de (USD)</label>
                      <input
                        type="number"
                        value={t.min_spend}
                        onChange={(e) => updateTierDraft(i, 'min_spend', parseFloat(e.target.value) || 0)}
                        className={inputClass}
                      />
                    </div>
                    <div className="w-24">
                      <label className="block text-[10px] text-muted-foreground mb-1">%</label>
                      <input
                        type="number"
                        step="0.1"
                        value={t.pct}
                        onChange={(e) => updateTierDraft(i, 'pct', parseFloat(e.target.value) || 0)}
                        className={inputClass}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTier(i)}
                      className="p-2 rounded hover:bg-destructive/10 text-destructive"
                      title="Remover meta"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            {tiersToShow.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhuma meta configurada. Será usado o percentual base de cada cliente.
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={saveTiers}
              disabled={savingTiers || !tierDraft}
              className="flex-1 bg-primary text-primary-foreground text-sm font-semibold py-2.5 rounded-lg hover:opacity-90 disabled:opacity-40"
            >
              {savingTiers ? 'Salvando...' : tierDraft ? 'Salvar metas' : 'Sem alterações'}
            </button>
            <button
              type="button"
              onClick={tierDraft ? cancelDraft : () => onOpenChange(false)}
              className="px-4 text-sm text-muted-foreground border border-border rounded-lg hover:bg-secondary"
            >
              {tierDraft ? 'Descartar' : 'Fechar'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TiersDialog;
