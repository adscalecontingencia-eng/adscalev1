import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Plus, Boxes, ShoppingBag, Package, ImageIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  slug: string;
  category: string;
  subcategory: string | null;
  country: string | null;
  description: string | null;
  warranty_terms: string | null;
  tags: string[] | null;
  cost_price: number;
  sale_price: number;
  discount_price: number | null;
  is_featured: boolean;
  is_new: boolean;
  active: boolean;
  image_url: string | null;
  sort_order: number;
}

interface Stock {
  id: string;
  product_id: string;
  payload: any;
  status: string;
  created_at: string;
  notes: string | null;
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const emptyProduct: Partial<Product> = {
  name: "",
  slug: "",
  category: "BM Facebook",
  subcategory: "",
  country: "BR",
  description: "",
  warranty_terms: "",
  tags: [],
  cost_price: 0,
  sale_price: 0,
  discount_price: null,
  is_featured: false,
  is_new: true,
  active: true,
  image_url: "",
  sort_order: 0,
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const AdminMarketplace: React.FC = () => {
  const [tab, setTab] = useState<"products" | "stock" | "orders">("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, { disp: number; res: number; ent: number }>>({});
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [stockFor, setStockFor] = useState<Product | null>(null);
  const [stockItems, setStockItems] = useState<Stock[]>([]);
  const [bulkText, setBulkText] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshProducts = async () => {
    const { data } = await supabase.from("products").select("*").order("sort_order").order("created_at", { ascending: false });
    setProducts((data as Product[]) || []);

    const { data: stocks } = await supabase.from("product_stock").select("product_id, status");
    const m: Record<string, { disp: number; res: number; ent: number }> = {};
    (stocks || []).forEach((s: any) => {
      m[s.product_id] = m[s.product_id] || { disp: 0, res: 0, ent: 0 };
      if (s.status === "disponivel") m[s.product_id].disp++;
      else if (s.status === "reservado") m[s.product_id].res++;
      else if (s.status === "entregue") m[s.product_id].ent++;
    });
    setStockMap(m);
  };

  const refreshStockFor = async (productId: string) => {
    const { data } = await supabase
      .from("product_stock")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    setStockItems((data as Stock[]) || []);
  };

  const refreshOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, clients(name, email), order_items(*, products(name)), payments(*)")
      .order("created_at", { ascending: false })
      .limit(200);
    setOrders(data || []);
  };

  useEffect(() => {
    refreshProducts();
    refreshOrders();
  }, []);

  useEffect(() => {
    if (stockFor) refreshStockFor(stockFor.id);
  }, [stockFor]);

  const saveProduct = async () => {
    if (!editing?.name || !editing?.category) {
      toast.error("Nome e categoria são obrigatórios");
      return;
    }
    setLoading(true);
    const payload = {
      name: editing.name,
      slug: editing.slug || slugify(editing.name),
      category: editing.category,
      subcategory: editing.subcategory || null,
      country: editing.country || null,
      description: editing.description || null,
      warranty_terms: editing.warranty_terms || null,
      tags: editing.tags || [],
      cost_price: Number(editing.cost_price) || 0,
      sale_price: Number(editing.sale_price) || 0,
      discount_price: editing.discount_price ? Number(editing.discount_price) : null,
      is_featured: !!editing.is_featured,
      is_new: !!editing.is_new,
      active: editing.active ?? true,
      image_url: editing.image_url || null,
      sort_order: Number(editing.sort_order) || 0,
    };
    const { error } = editing.id
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success(editing.id ? "Produto atualizado" : "Produto criado");
      setEditing(null);
      refreshProducts();
    }
  };

  const deleteProduct = async (p: Product) => {
    if (!confirm(`Excluir "${p.name}"? Estoque vinculado também será removido.`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Produto excluído");
      refreshProducts();
    }
  };

  const uploadImage = async (file: File) => {
    if (!editing) return;
    const ext = file.name.split(".").pop();
    const path = `${(editing.slug || slugify(editing.name || "img"))}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (upErr) {
      toast.error("Erro ao enviar imagem: " + upErr.message);
      return;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setEditing({ ...editing, image_url: data.publicUrl });
    toast.success("Imagem enviada");
  };

  const addBulkStock = async () => {
    if (!stockFor) return;
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const rows = lines.map((line) => {
      let payload: any;
      try {
        payload = JSON.parse(line);
      } catch {
        // Fallback: parse "email|password|extra"
        const parts = line.split("|").map((p) => p.trim());
        payload = { email: parts[0], password: parts[1] || "", extra: parts.slice(2).join(" | ") || undefined };
      }
      return { product_id: stockFor.id, payload, status: "disponivel" };
    });
    const { error } = await supabase.from("product_stock").insert(rows);
    if (error) toast.error(error.message);
    else {
      toast.success(`${rows.length} unidades adicionadas`);
      setBulkText("");
      refreshStockFor(stockFor.id);
      refreshProducts();
    }
  };

  const deleteStockItem = async (id: string) => {
    if (!confirm("Remover esta unidade do estoque?")) return;
    const { error } = await supabase.from("product_stock").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      if (stockFor) refreshStockFor(stockFor.id);
      refreshProducts();
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="products">
            <Boxes size={14} className="mr-1.5" /> Produtos
          </TabsTrigger>
          <TabsTrigger value="stock">
            <Package size={14} className="mr-1.5" /> Estoque
          </TabsTrigger>
          <TabsTrigger value="orders">
            <ShoppingBag size={14} className="mr-1.5" /> Pedidos
          </TabsTrigger>
        </TabsList>

        {/* PRODUTOS */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-semibold">Catálogo</h2>
            <Button onClick={() => setEditing({ ...emptyProduct })}>
              <Plus size={14} className="mr-1.5" /> Novo produto
            </Button>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Venda</TableHead>
                  <TableHead>Margem</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => {
                  const final = p.discount_price ?? p.sale_price;
                  const margin = final - p.cost_price;
                  const marginPct = p.cost_price ? Math.round((margin / final) * 100) : 0;
                  const s = stockMap[p.id] || { disp: 0, res: 0, ent: 0 };
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.category}</TableCell>
                      <TableCell>{p.country || "—"}</TableCell>
                      <TableCell>{fmtBRL(p.cost_price)}</TableCell>
                      <TableCell>{fmtBRL(final)}</TableCell>
                      <TableCell>
                        <span className="text-emerald-400">{fmtBRL(margin)} ({marginPct}%)</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">
                          <span className="text-emerald-400">{s.disp}</span> /{" "}
                          <span className="text-amber-400">{s.res}</span> /{" "}
                          <span className="text-muted-foreground">{s.ent}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {p.active ? <Badge variant="secondary">ativo</Badge> : <Badge variant="outline">inativo</Badge>}
                          {p.is_featured && <Badge>destaque</Badge>}
                          {p.is_new && <Badge variant="outline">novo</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEditing(p)}>
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setStockFor(p); setTab("stock"); }}>
                            <Package size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteProduct(p)}>
                            <Trash2 size={14} className="text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {products.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground text-sm py-8">
                      Nenhum produto cadastrado. Clique em "Novo produto".
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Estoque: <span className="text-emerald-400">disponível</span> / <span className="text-amber-400">reservado</span> / <span className="text-muted-foreground">entregue</span>
          </p>
        </TabsContent>

        {/* ESTOQUE */}
        <TabsContent value="stock" className="space-y-4">
          <div className="flex items-center gap-3">
            <Label className="text-sm">Produto:</Label>
            <Select value={stockFor?.id || ""} onValueChange={(id) => setStockFor(products.find((p) => p.id === id) || null)}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Selecione um produto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {stockFor && (
            <>
              <div className="bg-card/60 border border-border/60 rounded-xl p-4 space-y-2">
                <Label className="text-sm">Adicionar unidades em lote</Label>
                <p className="text-[11px] text-muted-foreground">
                  Uma unidade por linha. Aceita JSON (<code>{"{\"email\":\"x\",\"password\":\"y\"}"}</code>) ou formato <code>email|senha|extra</code>.
                </p>
                <Textarea
                  rows={5}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={'usuario@gmail.com|senha123|cookies aqui\n{"email":"a@b.com","password":"x","cookies":"..."}'}
                />
                <Button onClick={addBulkStock} size="sm">
                  <Plus size={14} className="mr-1.5" /> Adicionar
                </Button>
              </div>

              <div className="rounded-xl border border-border/60 bg-card/60 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Payload</TableHead>
                      <TableHead>Criado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockItems.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Badge variant={s.status === "disponivel" ? "secondary" : "outline"}>{s.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-[11px] text-muted-foreground line-clamp-1 max-w-md inline-block">
                            {JSON.stringify(s.payload)}
                          </code>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(s.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => deleteStockItem(s.id)}>
                            <Trash2 size={14} className="text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {stockItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-6">
                          Nenhuma unidade no estoque deste produto.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>

        {/* PEDIDOS */}
        <TabsContent value="orders" className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entrega</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="text-xs">{new Date(o.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{o.clients?.name || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {(o.order_items || []).map((it: any) => `${it.quantity}× ${it.products?.name || ""}`).join(" • ")}
                    </TableCell>
                    <TableCell className="font-semibold text-primary">{fmtBRL(o.total)}</TableCell>
                    <TableCell><Badge variant="outline">{o.status}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{o.delivery_mode}</Badge></TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">
                      Nenhum pedido ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal Produto */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome *</Label>
                  <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value, slug: editing.slug || slugify(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Slug</Label>
                  <Input value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Categoria *</Label>
                  <Input value={editing.category || ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="BM Facebook, TikTok Ads, Perfil Facebook, Proxy, Google Ads" />
                </div>
                <div>
                  <Label className="text-xs">Subcategoria</Label>
                  <Input value={editing.subcategory || ""} onChange={(e) => setEditing({ ...editing, subcategory: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">País</Label>
                  <Input value={editing.country || ""} onChange={(e) => setEditing({ ...editing, country: e.target.value })} placeholder="BR / US / LATAM" />
                </div>
                <div>
                  <Label className="text-xs">Tags (separadas por vírgula)</Label>
                  <Input
                    value={(editing.tags || []).join(", ")}
                    onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Custo (R$)</Label>
                  <Input type="number" step="0.01" value={editing.cost_price ?? 0} onChange={(e) => setEditing({ ...editing, cost_price: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Preço de venda (R$) *</Label>
                  <Input type="number" step="0.01" value={editing.sale_price ?? 0} onChange={(e) => setEditing({ ...editing, sale_price: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Preço com desconto (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.discount_price ?? ""}
                    onChange={(e) => setEditing({ ...editing, discount_price: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Ordem (sort)</Label>
                  <Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
                </div>
              </div>

              <div>
                <Label className="text-xs">Descrição (uma observação por linha começando com "• ")</Label>
                <Textarea rows={4} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="• Possui 100 contas de anúncio&#10;• Segmenta BR + Latam&#10;• Pronto para anunciar" />
              </div>

              <div>
                <Label className="text-xs">Termos de garantia</Label>
                <Textarea rows={4} value={editing.warranty_terms || ""} onChange={(e) => setEditing({ ...editing, warranty_terms: e.target.value })}
                  placeholder="Garantia de 24 horas válida para erros no acesso..." />
              </div>

              <div>
                <Label className="text-xs flex items-center gap-2"><ImageIcon size={12} /> Imagem do produto</Label>
                <div className="flex items-center gap-3 mt-1">
                  <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
                  {editing.image_url && <img src={editing.image_url} alt="" className="w-12 h-12 rounded object-cover border border-border" />}
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2"><Switch checked={!!editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /> <span className="text-xs">Ativo</span></label>
                <label className="flex items-center gap-2"><Switch checked={!!editing.is_featured} onCheckedChange={(v) => setEditing({ ...editing, is_featured: v })} /> <span className="text-xs">Em destaque</span></label>
                <label className="flex items-center gap-2"><Switch checked={!!editing.is_new} onCheckedChange={(v) => setEditing({ ...editing, is_new: v })} /> <span className="text-xs">Novidade</span></label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveProduct} disabled={loading}>{loading ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMarketplace;
