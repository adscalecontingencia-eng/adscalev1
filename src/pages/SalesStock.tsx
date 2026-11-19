import { useEffect, useMemo, useState } from "react";
import { tr } from '@/i18n';
import { getDateLocale } from '@/i18n/format';
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHero } from "@/components/ui-kit";
import { toast } from "sonner";
import { RefreshCw, Plus, Boxes, CheckCircle2, Clock, XCircle, ShieldCheck, MessageSquare, Globe, Settings2, Trash2, ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type MetaApp = { id: string; label: string; status: string | null; is_default: boolean | null };
type BM = {
  id: string; meta_bm_id: string; name: string; status: string | null;
  verification_status: string | null; account_count: number | null; page_count: number | null;
  pixel_count: number | null; last_synced_at: string | null; created_at: string; meta_app_id: string | null;
};
type Stock = { id: string; name: string; kind: 'whatsapp' | 'site'; meta_app_id: string | null };
type StockItem = {
  id: string; stock_id: string; bm_id: string; status: 'disponivel' | 'reservado' | 'vendido';
  sold_price: number | null; buyer: string | null; notes: string | null; sold_at: string | null; added_at: string;
};

const STATUS_COLS: Array<{ key: StockItem['status']; label: string; icon: any; tone: string }> = [
  { key: 'disponivel', get label() { return tr('sales.stock.st.disponivel'); }, icon: CheckCircle2, tone: 'text-primary' },
  { key: 'reservado', get label() { return tr('sales.stock.st.reservado'); }, icon: Clock, tone: 'text-yellow-500' },
  { key: 'vendido', get label() { return tr('sales.stock.st.vendido'); }, icon: XCircle, tone: 'text-muted-foreground' },
];

export default function SalesStock() {
  const [apps, setApps] = useState<MetaApp[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [bms, setBms] = useState<BM[]>([]);
  const [activeKind, setActiveKind] = useState<'whatsapp' | 'site'>('whatsapp');
  const [activeStockId, setActiveStockId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Dialogs
  const [newStockOpen, setNewStockOpen] = useState(false);
  const [newStockKind, setNewStockKind] = useState<'whatsapp' | 'site'>('whatsapp');
  const [newStockName, setNewStockName] = useState('');
  const [newStockAppId, setNewStockAppId] = useState<string>('');

  const [sellOpen, setSellOpen] = useState(false);
  const [sellItem, setSellItem] = useState<StockItem | null>(null);
  const [sellPrice, setSellPrice] = useState('');
  const [sellBuyer, setSellBuyer] = useState('');
  const [sellNotes, setSellNotes] = useState('');

  const [manageOpen, setManageOpen] = useState(false);
  const [manageStock, setManageStock] = useState<Stock | null>(null);

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: appsData }, { data: stocksData }, { data: itemsData }, { data: bmsData }] = await Promise.all([
      supabase.from('meta_apps').select('id, label, status, is_default').order('is_default', { ascending: false }),
      supabase.from('sales_stocks').select('*').order('created_at', { ascending: true }),
      supabase.from('sales_bm_stock').select('*').order('added_at', { ascending: false }),
      supabase.from('meta_business_managers').select('id, meta_bm_id, name, status, verification_status, account_count, page_count, pixel_count, last_synced_at, created_at, meta_app_id').neq("status", "removed").order("created_at", { ascending: false }),
    ]);
    setApps((appsData || []) as MetaApp[]);
    setStocks((stocksData || []) as Stock[]);
    setItems((itemsData || []) as StockItem[]);
    setBms((bmsData || []) as BM[]);
    setLoading(false);
  }

  const stocksByKind = useMemo(() => {
    return { whatsapp: stocks.filter(s => s.kind === 'whatsapp'), site: stocks.filter(s => s.kind === 'site') };
  }, [stocks]);

  // Auto-select first stock of active kind
  useEffect(() => {
    const list = stocksByKind[activeKind];
    if (list.length && !list.find(s => s.id === activeStockId)) setActiveStockId(list[0].id);
    if (!list.length) setActiveStockId(null);
  }, [activeKind, stocksByKind, activeStockId]);

  const activeStock = stocks.find(s => s.id === activeStockId) || null;

  // Sync: for the app tied to the active stock, upsert its BMs into the stock as 'disponivel' if not present.
  async function handleSync() {
    if (!activeStock || !activeStock.meta_app_id) {
      toast.error(tr('sales.stock.needApp'));
      return;
    }
    setSyncing(true);
    try {
      const { error: syncErr } = await supabase.functions.invoke('meta-sync', {
        body: { app_ids: [activeStock.meta_app_id], scope: 'bms' },
      });
      if (syncErr) console.warn('meta-sync warning:', syncErr);

      const { data: appBms } = await supabase
        .from('meta_business_managers')
        .select('id')
        .eq('meta_app_id', activeStock.meta_app_id);

      const existing = new Set(items.filter(i => i.stock_id === activeStock.id).map(i => i.bm_id));
      const toInsert = (appBms || []).filter(b => !existing.has(b.id)).map(b => ({
        stock_id: activeStock.id, bm_id: b.id, status: 'disponivel' as const,
      }));
      if (toInsert.length) {
        const { error } = await supabase.from('sales_bm_stock').insert(toInsert);
        if (error) throw error;
        toast.success(tr('sales.stock.added', { n: toInsert.length }));
      } else {
        toast.success(tr('sales.stock.upToDate'));
      }
      await loadAll();
    } catch (e: any) {
      toast.error(tr('sales.stock.syncFail') + ' ' + (e?.message || ''));
    } finally {
      setSyncing(false);
    }
  }

  async function createStock() {
    if (!newStockName.trim()) { toast.error(tr('sales.stock.needName')); return; }
    const { error } = await supabase.from('sales_stocks').insert({
      name: newStockName.trim(), kind: newStockKind, meta_app_id: newStockAppId || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(tr('sales.stock.created'));
    setNewStockOpen(false); setNewStockName(''); setNewStockAppId('');
    await loadAll();
  }

  async function updateItemStatus(item: StockItem, status: StockItem['status']) {
    const patch: any = { status };
    if (status !== 'vendido') { patch.sold_at = null; patch.sold_price = null; patch.buyer = null; }
    const { error } = await supabase.from('sales_bm_stock').update(patch).eq('id', item.id);
    if (error) { toast.error(error.message); return; }
    await loadAll();
  }

  async function confirmSell() {
    if (!sellItem) return;
    const { error } = await supabase.from('sales_bm_stock').update({
      status: 'vendido',
      sold_at: new Date().toISOString(),
      sold_price: sellPrice ? Number(sellPrice) : null,
      buyer: sellBuyer || null,
      notes: sellNotes || null,
    }).eq('id', sellItem.id);
    if (error) { toast.error(error.message); return; }
    toast.success(tr('sales.stock.soldOk'));
    setSellOpen(false); setSellItem(null); setSellPrice(''); setSellBuyer(''); setSellNotes('');
    await loadAll();
  }

  async function removeItem(item: StockItem) {
    if (!confirm(tr('sales.stock.confirmRemove'))) return;
    const { error } = await supabase.from('sales_bm_stock').delete().eq('id', item.id);
    if (error) { toast.error(error.message); return; }
    await loadAll();
  }

  async function saveStockSettings() {
    if (!manageStock) return;
    const { error } = await supabase.from('sales_stocks').update({
      name: manageStock.name, meta_app_id: manageStock.meta_app_id,
    }).eq('id', manageStock.id);
    if (error) { toast.error(error.message); return; }
    toast.success(tr('sales.stock.updated'));
    setManageOpen(false);
    await loadAll();
  }

  async function deleteStock() {
    if (!manageStock) return;
    if (!confirm(tr('sales.stock.confirmDel', { name: manageStock.name }))) return;
    const { error } = await supabase.from('sales_stocks').delete().eq('id', manageStock.id);
    if (error) { toast.error(error.message); return; }
    toast.success(tr('sales.stock.removed'));
    setManageOpen(false);
    await loadAll();
  }

  const activeItems = items.filter(i => i.stock_id === activeStockId);
  const bmMap = useMemo(() => Object.fromEntries(bms.map(b => [b.id, b])), [bms]);

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow={tr('sales.stock.eyebrow')}
        title={tr('sales.stock.title')}
        description={tr('sales.stock.desc')}
      />


      <Tabs value={activeKind} onValueChange={(v) => setActiveKind(v as any)}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="whatsapp" className="gap-2"><MessageSquare size={14} /> WhatsApp</TabsTrigger>
            <TabsTrigger value="site" className="gap-2"><Globe size={14} /> {tr('sales.stock.site')}</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 flex-wrap">
            {stocksByKind[activeKind].length > 0 && (
              <Select value={activeStockId || ''} onValueChange={setActiveStockId}>
                <SelectTrigger className="w-[220px]"><SelectValue placeholder={tr('sales.stock.pickStock')} /></SelectTrigger>
                <SelectContent>
                  {stocksByKind[activeKind].map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {activeStock && (
              <Button variant="outline" size="sm" onClick={() => { setManageStock(activeStock); setManageOpen(true); }}>
                <Settings2 size={14} className="mr-1" /> {tr('sales.stock.configure')}
              </Button>
            )}
            {activeStock && (
              <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                <RefreshCw size={14} className={`mr-1 ${syncing ? 'animate-spin' : ''}`} /> {tr('sales.stock.sync')}
              </Button>
            )}
            <Button size="sm" onClick={() => { setNewStockKind(activeKind); setNewStockOpen(true); }}>
              <Plus size={14} className="mr-1" /> {tr('sales.stock.newStock')}
            </Button>
          </div>
        </div>

        <TabsContent value={activeKind} className="mt-6">
          {loading ? (
            <Card className="p-8 text-center text-muted-foreground text-sm">{tr('sales.stock.loading')}</Card>
          ) : !activeStock ? (
            <Card className="p-10 text-center">
              <Boxes size={32} className="mx-auto text-muted-foreground mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground mb-4">{tr('sales.stock.noneYet', { kind: activeKind === 'whatsapp' ? 'WhatsApp' : tr('sales.stock.site') })}</p>
              <Button onClick={() => { setNewStockKind(activeKind); setNewStockOpen(true); }}>
                <Plus size={14} className="mr-1" /> {tr('sales.stock.createFirst')}
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {STATUS_COLS.map(col => {
                const colItems = activeItems.filter(i => i.status === col.key);
                const Icon = col.icon;
                return (
                  <div key={col.key} className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <div className={`flex items-center gap-2 text-xs uppercase tracking-wider font-semibold ${col.tone}`}>
                        <Icon size={14} /> {col.label}
                      </div>
                      <Badge variant="outline" className="text-[10px]">{colItems.length}</Badge>
                    </div>
                    <div className="space-y-2 min-h-[100px]">
                      {colItems.length === 0 && (
                        <div className="text-xs text-muted-foreground/60 text-center py-6 border border-dashed border-border/50 rounded-lg">
                          vazio
                        </div>
                      )}
                      {colItems.map(item => {
                        const bm = bmMap[item.bm_id];
                        if (!bm) return null;
                        return (
                          <Card key={item.id} className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-sm truncate" title={bm.name}>{bm.name}</div>
                                <div className="text-[10px] text-muted-foreground font-mono">{bm.meta_bm_id}</div>
                              </div>
                              {bm.verification_status && (
                                <Badge variant="outline" className="text-[9px] gap-1">
                                  <ShieldCheck size={9} /> {bm.verification_status}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span>{tr('sales.stock.accounts')} <b className="text-foreground">{bm.account_count ?? 0}</b></span>
                              <span>{tr('sales.stock.pages')} <b className="text-foreground">{bm.page_count ?? 0}</b></span>
                              <span>Pixels: <b className="text-foreground">{bm.pixel_count ?? 0}</b></span>
                            </div>

                            <div className="text-[10px] text-muted-foreground">
                              {tr('sales.stock.addedAt')} {format(new Date(item.added_at), "P HH:mm", { locale: getDateLocale() })}
                            </div>

                            {item.status === 'vendido' && (
                              <div className="text-[10px] space-y-0.5 border-t border-border/50 pt-2">
                                {item.sold_price != null && <div>{tr('sales.stock.value')} <b className="text-primary">R$ {Number(item.sold_price).toFixed(2)}</b></div>}
                                {item.buyer && <div>{tr('sales.stock.buyerLbl')} <b className="text-foreground">{item.buyer}</b></div>}
                                {item.sold_at && <div className="text-muted-foreground">{format(new Date(item.sold_at), "P", { locale: getDateLocale() })}</div>}
                              </div>
                            )}

                            <div className="flex items-center gap-1 pt-1">
                              {item.status !== 'disponivel' && (
                                <Button variant="outline" size="sm" className="h-7 text-[10px] flex-1" onClick={() => updateItemStatus(item, 'disponivel')}>
                                  <ArrowRightLeft size={10} className="mr-1" /> {tr('sales.stock.st.disponivel')}
                                </Button>
                              )}
                              {item.status !== 'reservado' && (
                                <Button variant="outline" size="sm" className="h-7 text-[10px] flex-1" onClick={() => updateItemStatus(item, 'reservado')}>
                                  <Clock size={10} className="mr-1" /> {tr('sales.stock.reserve')}
                                </Button>
                              )}
                              {item.status !== 'vendido' && (
                                <Button size="sm" className="h-7 text-[10px] flex-1" onClick={() => { setSellItem(item); setSellPrice(''); setSellBuyer(''); setSellNotes(''); setSellOpen(true); }}>
                                  <XCircle size={10} className="mr-1" /> {tr('sales.stock.sell')}
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item)}>
                                <Trash2 size={12} />
                              </Button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* New stock dialog */}
      <Dialog open={newStockOpen} onOpenChange={setNewStockOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tr('sales.stock.newStock')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tr('sales.stock.name')}</Label>
              <Input value={newStockName} onChange={e => setNewStockName(e.target.value)} placeholder={tr('sales.stock.namePh')} />
            </div>
            <div>
              <Label>{tr('sales.stock.type')}</Label>
              <Select value={newStockKind} onValueChange={(v) => setNewStockKind(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="site">{tr('sales.stock.site')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tr('sales.stock.appOpt')}</Label>
              <Select value={newStockAppId} onValueChange={setNewStockAppId}>
                <SelectTrigger><SelectValue placeholder={tr('sales.stock.pickApp')} /></SelectTrigger>
                <SelectContent>
                  {apps.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">{tr('sales.stock.autoHint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewStockOpen(false)}>{tr('sales.stock.cancel')}</Button>
            <Button onClick={createStock}>{tr('sales.stock.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sell dialog */}
      <Dialog open={sellOpen} onOpenChange={setSellOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tr('sales.stock.markSold')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tr('sales.stock.price')}</Label>
              <Input type="number" step="0.01" value={sellPrice} onChange={e => setSellPrice(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label>{tr('sales.stock.buyer')}</Label>
              <Input value={sellBuyer} onChange={e => setSellBuyer(e.target.value)} placeholder={tr('sales.stock.buyerPh')} />
            </div>
            <div>
              <Label>{tr('sales.stock.notes')}</Label>
              <Textarea value={sellNotes} onChange={e => setSellNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellOpen(false)}>{tr('sales.stock.cancel')}</Button>
            <Button onClick={confirmSell}>{tr('sales.stock.confirmSale')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage stock dialog */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tr('sales.stock.configTitle')}</DialogTitle></DialogHeader>
          {manageStock && (
            <div className="space-y-3">
              <div>
                <Label>{tr('sales.stock.name')}</Label>
                <Input value={manageStock.name} onChange={e => setManageStock({ ...manageStock, name: e.target.value })} />
              </div>
              <div>
                <Label>{tr('sales.stock.app')}</Label>
                <Select value={manageStock.meta_app_id || ''} onValueChange={(v) => setManageStock({ ...manageStock, meta_app_id: v || null })}>
                  <SelectTrigger><SelectValue placeholder={tr('sales.stock.pickApp')} /></SelectTrigger>
                  <SelectContent>
                    {apps.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button variant="destructive" size="sm" onClick={deleteStock}>
              <Trash2 size={14} className="mr-1" /> {tr('sales.stock.delete')}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setManageOpen(false)}>{tr('sales.stock.cancel')}</Button>
              <Button onClick={saveStockSettings}>{tr('sales.stock.save')}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
