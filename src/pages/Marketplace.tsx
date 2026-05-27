import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShoppingCart, Info, Package, Sparkles, ShieldCheck, LogIn, UserPlus, Search } from "lucide-react";
import AdScaleLogo from "@/components/AdScaleLogo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  stock_available?: number;
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const Marketplace: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [tab, setTab] = useState<"destaque" | "novidades">("destaque");
  const [selected, setSelected] = useState<Product | null>(null);
  const [buyingQty, setBuyingQty] = useState(1);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: prods } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("is_featured", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      // Fetch available stock counts (best effort — admin only, otherwise this returns 0 rows due to RLS)
      const { data: stockRows } = await supabase
        .from("product_stock")
        .select("product_id, status");

      const stockMap: Record<string, number> = {};
      (stockRows || []).forEach((r: any) => {
        if (r.status === "disponivel") stockMap[r.product_id] = (stockMap[r.product_id] || 0) + 1;
      });

      setProducts(
        ((prods as any[]) || []).map((p) => ({ ...p, stock_available: stockMap[p.id] ?? 0 } as Product)),
      );
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => set.add(p.category));
    return ["all", ...Array.from(set).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (activeCat !== "all") list = list.filter((p) => p.category === activeCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.subcategory || "").toLowerCase().includes(q),
      );
    }
    if (tab === "destaque") list = list.filter((p) => p.is_featured);
    if (tab === "novidades") list = list.filter((p) => p.is_new);
    return list;
  }, [products, activeCat, search, tab]);

  const handleBuy = (product: Product) => {
    if (!isAuthenticated) {
      navigate("/login?next=marketplace");
      return;
    }
    // Pix checkout coming soon — for now create a pending order so support can deliver
    navigate(`/meus-pedidos?solicitar=${product.id}&qty=${buyingQty}`);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Decorative blurs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] rounded-full bg-primary/[0.03] blur-3xl" />
      </div>

      {/* Header público */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center gap-6">
          <Link to="/" className="text-primary flex items-center gap-2">
            <AdScaleLogo size={26} />
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
            <Link to="/marketplace" className="px-3 py-1.5 rounded-md text-foreground bg-primary/10">
              <ShoppingCart size={14} className="inline mr-1" /> Marketplace
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/meus-pedidos")}>
                  <Package size={14} className="mr-1" /> Meus pedidos
                </Button>
                <Button size="sm" onClick={() => {
                  const dest = user?.role === 'client' ? '/client-dashboard'
                    : user?.role === 'partner' ? '/partner-dashboard'
                    : '/dashboard';
                  navigate(dest);
                }}>Painel</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/login?next=marketplace")}>
                  <LogIn size={14} className="mr-1" /> Entrar
                </Button>
                <Button size="sm" onClick={() => navigate("/signup")}>
                  <UserPlus size={14} className="mr-1" /> Cadastrar
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative max-w-7xl mx-auto px-4 lg:px-6 pt-16 pb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-[11px] uppercase tracking-[0.3em] mb-6">
            <Sparkles size={12} /> Novo
            <span className="text-muted-foreground normal-case tracking-normal">
              Participe da nossa comunidade no WhatsApp
            </span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-bold text-foreground leading-tight">
            Tudo que sua operação precisa
            <br />
            <span className="text-primary">em um só lugar</span>
          </h1>
          <p className="text-muted-foreground mt-6 max-w-2xl mx-auto">
            Contas <span className="text-foreground font-semibold">Meta</span>,{" "}
            <span className="text-foreground font-semibold">TikTok</span> e{" "}
            <span className="text-foreground font-semibold">Google Ads</span> de qualidade, com melhores preços.
          </p>

          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-2"><Sparkles size={14} className="text-primary" /> Entrega automática</span>
            <span className="flex items-center gap-2"><ShieldCheck size={14} className="text-primary" /> Contas testadas</span>
            <span className="flex items-center gap-2"><Package size={14} className="text-primary" /> Garantia 24h</span>
          </div>
        </motion.div>
      </section>

      {/* Catálogo */}
      <section className="relative max-w-7xl mx-auto px-4 lg:px-6 pb-20">
        <div className="text-center mb-6">
          <h2 className="font-display text-2xl font-bold text-foreground">Produtos em Destaque</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Confira os produtos mais vendidos e com melhores avaliações dos clientes.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex justify-center mb-6">
          <TabsList>
            <TabsTrigger value="destaque">Em Destaque</TabsTrigger>
            <TabsTrigger value="novidades">Novidades</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col md:flex-row gap-3 mb-6 max-w-3xl mx-auto">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full bg-secondary/50 border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCat(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  activeCat === c
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {c === "all" ? "Todas" : c}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground text-sm py-12">Carregando produtos…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-12">
            Nenhum produto encontrado nesta categoria.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filtered.map((p) => {
              const hasDiscount = p.discount_price && p.discount_price < p.sale_price;
              const finalPrice = hasDiscount ? p.discount_price! : p.sale_price;
              const discountPct = hasDiscount
                ? Math.round(((p.sale_price - p.discount_price!) / p.sale_price) * 100)
                : 0;

              return (
                <motion.div
                  key={p.id}
                  whileHover={{ y: -3 }}
                  className="bg-card/80 backdrop-blur border border-border/60 rounded-xl p-4 flex flex-col gap-3"
                >
                  <div>
                    <h3 className="font-display font-semibold text-foreground leading-tight">{p.name}</h3>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {p.category}
                      </Badge>
                      {p.country && (
                        <Badge variant="outline" className="text-[10px]">
                          {p.country}
                        </Badge>
                      )}
                      {(p.tags || []).slice(0, 2).map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {p.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                  )}

                  <div className="mt-auto space-y-2">
                    {hasDiscount && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="line-through text-muted-foreground">{fmtBRL(p.sale_price)}</span>
                        <span className="bg-orange-500/15 text-orange-400 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                          -{discountPct}%
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold text-primary">{fmtBRL(finalPrice)}</span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                        {p.stock_available != null && p.stock_available > 0
                          ? `${p.stock_available} unidades`
                          : "sob consulta"}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Button className="flex-1" size="sm" onClick={() => handleBuy(p)}>
                        <ShoppingCart size={14} className="mr-1.5" /> Comprar
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setSelected(p)}>
                        <Info size={14} />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal de detalhes */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg bg-card border-border">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{selected.name}</DialogTitle>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Badge variant="secondary">{selected.category}</Badge>
                  {selected.country && <Badge variant="outline">{selected.country}</Badge>}
                </div>
              </DialogHeader>

              <Tabs defaultValue="produto" className="mt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="produto" className="flex-1">Produto</TabsTrigger>
                  <TabsTrigger value="garantia" className="flex-1">
                    <ShieldCheck size={14} className="mr-1.5" /> Garantia
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="produto" className="space-y-4">
                  <div className="bg-secondary/40 border border-border rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Descrição</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{selected.description || "—"}</p>
                  </div>

                  <div className="bg-secondary/40 border border-border rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Quantidade</p>
                      <p className="text-xs text-emerald-400">
                        {selected.stock_available && selected.stock_available > 0
                          ? `${selected.stock_available} disponíveis`
                          : "Sob consulta"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => setBuyingQty(Math.max(1, buyingQty - 1))}>-</Button>
                      <span className="w-8 text-center font-semibold">{buyingQty}</span>
                      <Button variant="outline" size="icon" onClick={() => setBuyingQty(buyingQty + 1)}>+</Button>
                    </div>
                  </div>

                  <div className="bg-secondary/40 border border-border rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold text-primary">
                        {fmtBRL((selected.discount_price ?? selected.sale_price) * buyingQty)}
                      </p>
                    </div>
                    <Button onClick={() => handleBuy(selected)}>
                      <ShoppingCart size={14} className="mr-1.5" /> Comprar Agora
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="garantia">
                  <div className="bg-secondary/40 border border-border rounded-xl p-4 text-sm text-foreground whitespace-pre-wrap">
                    {selected.warranty_terms || "Garantia de 24 horas válida para erros no acesso, contas bloqueadas ao fazer login ou dados diferentes da descrição informada. Verifique todos os itens dentro de 24 horas após a compra."}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Marketplace;
