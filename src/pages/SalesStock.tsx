import { useEffect, useMemo, useState } from "react";
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
  { key: 'disponivel', label: 'Disponível', icon: CheckCircle2, tone: 'text-primary' },
  { key: 'reservado', label: 'Reservado', icon: Clock, tone: 'text-yellow-500' },
  { key: 'vendido', label: 'Vendido', icon: XCircle, tone: 'text-muted-foreground' },
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
      supabase.from('meta_business_managers').select('id, meta_bm_id, name, status, verification_status, account_count, page_count, pixel_count, last_synced_at, created_at, meta_app_id').order('created_at', { ascending: false }),
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
      toast.error('Vincule um aplicativo Meta a este estoque antes de sincronizar');
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
        toast.success(`${toInsert.length} nova(s) BM adicionada(s) ao estoque`);
      } else {
        toast.success('Estoque já está atualizado');
      }
      await loadAll();
    } catch (e: any) {
      toast.error('Falha ao sincronizar: ' + (e?.message || 'erro'));
    } finally {
      setSyncing(false);
    }
  }

  async function createStock() {
    if (!newStockName.trim()) { toast.error('Informe o nome do estoque'); return; }
    const { error } = await supabase.from('sales_stocks').insert({
      name: newStockName.trim(), kind: newStockKind, meta_app_id: newStockAppId || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Estoque criado');
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
    toast.success('BM marcada como vendida');
    setSellOpen(false); setSellItem(null); setSellPrice(''); setSellBuyer(''); setSellNotes('');
    await loadAll();
  }

  async function removeItem(item: StockItem) {
    if (!confirm('Remover esta BM do estoque?')) return;
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
    toast.success('Estoque atualizado');
    setManageOpen(false);
    await loadAll();
  }

  async function deleteStock() {
    if (!manageStock) return;
    if (!confirm(`Excluir estoque "${manageStock.name}" e todos os itens?`)) return;
    const { error } = await supabase.from('sales_stocks').delete().eq('id', manageStock.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Estoque removido');
    setManageOpen(false);
    await loadAll();
  }

  const activeItems = items.filter(i => i.stock_id === activeStockId);
  const bmMap = useMemo(() => Object.fromEntries(bms.map(b => [b.id, b])), [bms]);

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Venda"
        title="Estoque de BMs"
        description="Gerencie inventário de Business Managers para venda — separado entre WhatsApp e Site."
      />


      <Tabs value={activeKind} onValueChange={(v) => setActiveKind(v as any)}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="whatsapp" className="gap-2"><MessageSquare size={14} /> WhatsApp</TabsTrigger>
            <TabsTrigger value="site" className="gap-2"><Globe size={14} /> Site</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 flex-wrap">
            {stocksByKind[activeKind].length > 0 && (
              <Select value={activeStockId || ''} onValueChange={setActiveStockId}>
                <SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecione um estoque" /></SelectTrigger>
                <SelectContent>
                  {stocksByKind[activeKind].map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {activeStock && (
              <Button variant="outline" size="sm" onClick={() => { setManageStock(activeStock); setManageOpen(true); }}>
                <Settings2 size={14} className="mr-1" /> Configurar
              </Button>
            )}
            {activeStock && (
              <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                <RefreshCw size={14} className={`mr-1 ${syncing ? 'animate-spin' : ''}`} /> Sincronizar
              </Button>
            )}
            <Button size="sm" onClick={() => { setNewStockKind(activeKind); setNewStockOpen(true); }}>
              <Plus size={14} className="mr-1" /> Novo estoque
            </Button>
          </div>
        </div>

        <TabsContent value={activeKind} className="mt-6">
          {loading ? (
            <Card className="p-8 text-center text-muted-foreground text-sm">Carregando...</Card>
          ) : !activeStock ? (
            <Card className="p-10 text-center">
              <Boxes size={32} className="mx-auto text-muted-foreground mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground mb-4">Nenhum estoque {activeKind === 'whatsapp' ? 'WhatsApp' : 'Site'} criado ainda.</p>
              <Button onClick={() => { setNewStockKind(activeKind); setNewStockOpen(true); }}>
                <Plus size={14} className="mr-1" /> Criar primeiro estoque
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
                              <span>Contas: <b className="text-foreground">{bm.account_count ?? 0}</b></span>
                              <span>Pgs: <b className="text-foreground">{bm.page_count ?? 0}</b></span>
                              <span>Pixels: <b className="text-foreground">{bm.pixel_count ?? 0}</b></span>
                            </div>

                            <div className="text-[10px] text-muted-foreground">
                              Adicionada: {format(new Date(item.added_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </div>

                            {item.status === 'vendido' && (
                              <div className="text-[10px] space-y-0.5 border-t border-border/50 pt-2">
                                {item.sold_price != null && <div>Valor: <b className="text-primary">R$ {Number(item.sold_price).toFixed(2)}</b></div>}
                                {item.buyer && <div>Comprador: <b className="text-foreground">{item.buyer}</b></div>}
                                {item.sold_at && <div className="text-muted-foreground">{format(new Date(item.sold_at), "dd/MM/yy", { locale: ptBR })}</div>}
                              </div>
                            )}

                            <div className="flex items-center gap-1 pt-1">
                              {item.status !== 'disponivel' && (
                                <Button variant="outline" size="sm" className="h-7 text-[10px] flex-1" onClick={() => updateItemStatus(item, 'disponivel')}>
                                  <ArrowRightLeft size={10} className="mr-1" /> Disponível
                                </Button>
                              )}
                              {item.status !== 'reservado' && (
                                <Button variant="outline" size="sm" className="h-7 text-[10px] flex-1" onClick={() => updateItemStatus(item, 'reservado')}>
                                  <Clock size={10} className="mr-1" /> Reservar
                                </Button>
                              )}
                              {item.status !== 'vendido' && (
                                <Button size="sm" className="h-7 text-[10px] flex-1" onClick={() => { setSellItem(item); setSellPrice(''); setSellBuyer(''); setSellNotes(''); setSellOpen(true); }}>
                                  <XCircle size={10} className="mr-1" /> Vender
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
          <DialogHeader><DialogTitle>Novo estoque</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={newStockName} onChange={e => setNewStockName(e.target.value)} placeholder="Ex.: BMs Aquecidas WhatsApp" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={newStockKind} onValueChange={(v) => setNewStockKind(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="site">Site</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Aplicativo Meta (opcional)</Label>
              <Select value={newStockAppId} onValueChange={setNewStockAppId}>
                <SelectTrigger><SelectValue placeholder="Selecione um app" /></SelectTrigger>
                <SelectContent>
                  {apps.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">Todas as BMs deste app entram automaticamente ao sincronizar.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewStockOpen(false)}>Cancelar</Button>
            <Button onClick={createStock}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sell dialog */}
      <Dialog open={sellOpen} onOpenChange={setSellOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar como vendida</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Preço de venda (R$)</Label>
              <Input type="number" step="0.01" value={sellPrice} onChange={e => setSellPrice(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label>Comprador</Label>
              <Input value={sellBuyer} onChange={e => setSellBuyer(e.target.value)} placeholder="Nome / contato" />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={sellNotes} onChange={e => setSellNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellOpen(false)}>Cancelar</Button>
            <Button onClick={confirmSell}>Confirmar venda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage stock dialog */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configurar estoque</DialogTitle></DialogHeader>
          {manageStock && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={manageStock.name} onChange={e => setManageStock({ ...manageStock, name: e.target.value })} />
              </div>
              <div>
                <Label>Aplicativo Meta</Label>
                <Select value={manageStock.meta_app_id || ''} onValueChange={(v) => setManageStock({ ...manageStock, meta_app_id: v || null })}>
                  <SelectTrigger><SelectValue placeholder="Selecione um app" /></SelectTrigger>
                  <SelectContent>
                    {apps.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button variant="destructive" size="sm" onClick={deleteStock}>
              <Trash2 size={14} className="mr-1" /> Excluir
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setManageOpen(false)}>Cancelar</Button>
              <Button onClick={saveStockSettings}>Salvar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
