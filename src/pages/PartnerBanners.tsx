import React, { useEffect, useState } from 'react';
import { tr } from '@/i18n';
import { supabase } from '@/integrations/supabase/client';
import { PageHero, Panel } from '@/components/ui-kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Image as ImageIcon, Trash2, Plus, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type Banner = {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  link_url: string | null;
  cta_label: string | null;
  placement: 'client_dashboard' | 'marketplace' | 'both';
  active: boolean;
  sort_order: number;
  created_at: string;
};

const empty = {
  title: '',
  description: '',
  image_url: '',
  link_url: '',
  cta_label: '',
  placement: 'both' as Banner['placement'],
  active: true,
  sort_order: 0,
};

const PartnerBanners: React.FC = () => {
  const { user } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...empty });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('partner_banners')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) toast({ title: tr('fin.banner.error'), description: error.message, variant: 'destructive' });
    setBanners((data as Banner[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const reset = () => { setForm({ ...empty }); setEditingId(null); };

  const save = async () => {
    if (!form.title.trim() || !form.image_url.trim()) {
      toast({ title: tr('fin.banner.fill'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url.trim(),
      link_url: form.link_url.trim() || null,
      cta_label: form.cta_label.trim() || null,
      placement: form.placement,
      active: form.active,
      sort_order: Number(form.sort_order) || 0,
    };
    const q = editingId
      ? supabase.from('partner_banners').update(payload).eq('id', editingId)
      : supabase.from('partner_banners').insert({ ...payload, created_by: user?.id });
    const { error } = await q;
    setSaving(false);
    if (error) return toast({ title: tr('fin.banner.saveError'), description: error.message, variant: 'destructive' });
    toast({ title: editingId ? tr('fin.banner.updated') : tr('fin.banner.created') });
    reset();
    load();
  };

  const edit = (b: Banner) => {
    setEditingId(b.id);
    setForm({
      title: b.title,
      description: b.description || '',
      image_url: b.image_url,
      link_url: b.link_url || '',
      cta_label: (b as any).cta_label || '',
      placement: b.placement,
      active: b.active,
      sort_order: b.sort_order,
    });
  };

  const remove = async (id: string) => {
    if (!confirm(tr('fin.banner.confirmRemove'))) return;
    const { error } = await supabase.from('partner_banners').delete().eq('id', id);
    if (error) return toast({ title: tr('fin.banner.error'), description: error.message, variant: 'destructive' });
    toast({ title: tr('fin.banner.removed') });
    load();
  };

  const toggleActive = async (b: Banner) => {
    const { error } = await supabase.from('partner_banners').update({ active: !b.active }).eq('id', b.id);
    if (error) return toast({ title: tr('fin.banner.error'), description: error.message, variant: 'destructive' });
    load();
  };

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow={tr('fin.banner.eyebrow')}
        title={tr('fin.banner.title')}
        description={tr('fin.banner.desc')}
      />

      <Panel title={editingId ? tr('fin.banner.edit') : tr('fin.banner.new')} icon={Plus as any}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>{tr('fin.banner.titleLbl')}</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={tr('fin.banner.titlePh')} />
          </div>
          <div className="md:col-span-2">
            <Label>{tr('fin.banner.descLbl')}</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder={tr('fin.banner.descPh')} />
          </div>
          <div className="md:col-span-2">
            <Label>{tr('fin.banner.img')}</Label>
            <Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
            {form.image_url && (
              <div className="mt-2 aspect-[16/6] w-full overflow-hidden rounded-lg border border-border/60 bg-muted/30">
                <img src={form.image_url} alt="preview" className="h-full w-full object-cover" />
              </div>
            )}
          </div>
          <div>
            <Label>{tr('fin.banner.link')}</Label>
            <Input value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))} placeholder="https://..." />
          </div>
          <div className="md:col-span-2">
            <Label>{tr('fin.banner.btn')}</Label>
            <Input value={form.cta_label} onChange={e => setForm(f => ({ ...f, cta_label: e.target.value }))} placeholder={tr('fin.banner.btnPh')} />
            <p className="mt-1 text-[11px] text-muted-foreground">{tr('fin.banner.btnHint')}</p>
          </div>
          <div>
            <Label>{tr('fin.banner.showIn')}</Label>
            <Select value={form.placement} onValueChange={(v: any) => setForm(f => ({ ...f, placement: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="both">{tr('fin.banner.both')}</SelectItem>
                <SelectItem value="client_dashboard">{tr('fin.banner.dash')}</SelectItem>
                <SelectItem value="marketplace">Marketplace</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{tr('fin.banner.order')}</Label>
            <Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
            <Label>{tr('fin.banner.active')}</Label>
          </div>
        </div>
        <div className="mt-4 flex gap-2 justify-end">
          {editingId && <Button variant="outline" onClick={reset}>{tr('fin.banner.cancel')}</Button>}
          <Button onClick={save} disabled={saving}>{editingId ? tr('fin.banner.saveChanges') : tr('fin.banner.add')}</Button>
        </div>
      </Panel>

      <Panel title={tr('fin.banner.list', { n: banners.length })} icon={ImageIcon as any}>
        {loading ? (
          <p className="text-sm text-muted-foreground">{tr('fin.banner.loading')}</p>
        ) : banners.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tr('fin.banner.none')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {banners.map(b => (
              <div key={b.id} className="rounded-2xl border border-border/60 overflow-hidden bg-card/40">
                <div className="aspect-[16/6] w-full bg-muted/30">
                  <img src={b.image_url} alt={b.title} className="h-full w-full object-cover" />
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{b.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{b.description || '—'}</p>
                    </div>
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${b.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {b.active ? 'ativo' : 'inativo'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="px-2 py-0.5 rounded-full bg-muted">{b.placement}</span>
                    <span>{tr('fin.banner.orderLbl')} {b.sort_order}</span>
                    {b.link_url && (
                      <a href={b.link_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        <ExternalLink size={12} /> link
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => edit(b)}>{tr('fin.banner.editBtn')}</Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(b)}>{b.active ? tr('fin.banner.deactivate') : tr('fin.banner.activate')}</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(b.id)} className="text-destructive"><Trash2 size={14} /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
};

export default PartnerBanners;
