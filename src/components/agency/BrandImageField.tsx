import React, { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { fileToBrandDataUrl, isSquareImage } from '@/lib/image-resize';

interface Props {
  label: string;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  mode: 'square' | 'fit';
  size: number;
  hint?: React.ReactNode;
  placeholder?: string;
}

/** Brand image picker: direct upload (resized and stored with the settings) or a pasted link. */
export const BrandImageField: React.FC<Props> = ({ label, value, onChange, mode, size, hint, placeholder }) => {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const uploaded = !!value && value.startsWith('data:image/');

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      if (mode === 'square' && !(await isSquareImage(file))) toast.info('A imagem não é quadrada: ajustamos com bordas transparentes. O ideal é 1:1.');
      onChange(await fileToBrandDataUrl(file, mode, size));
      toast.success('Imagem carregada. Clique em Salvar para manter.');
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível carregar a imagem.');
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        <div className={`shrink-0 rounded-md border border-border bg-secondary/40 flex items-center justify-center overflow-hidden ${mode === 'square' ? 'w-10 h-10' : 'w-20 h-10'}`}>
          {value ? <img src={value} alt="" className="max-w-full max-h-full object-contain" onError={e => ((e.currentTarget.style.visibility = 'hidden'))} /> : <span className="text-[9px] text-muted-foreground">sem imagem</span>}
        </div>
        {uploaded
          ? <div className="flex-1 h-10 rounded-md border border-border px-3 flex items-center text-xs text-primary">Imagem enviada</div>
          : <Input className="flex-1" placeholder={placeholder || 'ou cole o link da imagem'} value={value || ''} onChange={e => onChange(e.target.value.trim() || null)} />}
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="hidden" onChange={e => pick(e.target.files?.[0])} />
        <Button type="button" variant="outline" size="sm" className="gap-1.5 h-10" disabled={busy} onClick={() => ref.current?.click()}>
          <Upload size={14} />{busy ? 'Enviando…' : 'Enviar'}
        </Button>
        {value && <Button type="button" variant="ghost" size="icon" className="h-10 w-10" title="Remover" onClick={() => onChange(null)}><X size={14} /></Button>}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
};
