import { tr, trHtml, getLanguage } from "@/i18n";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Home, ShoppingCart, TrendingUp, MessageCircle, Plus,
  ChevronDown, LogIn, UserPlus, ArrowRight, Search,
} from "lucide-react";
import { Music2, Facebook, MessageSquare, Hexagon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import AdScaleLogo from "@/components/AdScaleLogo";
import AnimatedBackground from "@/components/AnimatedBackground";
import ProductCard from "@/components/marketplace/ProductCard";
import WalletDepositModal from "@/components/marketplace/WalletDepositModal";
import MarketplaceFooter from "@/components/marketplace/MarketplaceFooter";
import adLogoUrl from "@/assets/ad-logo.png";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const WHATSAPP_URL = "https://wa.me/5531998416336?text=Ol%C3%A1!%20Tenho%20interesse%20nos%20produtos%20da%20AD%20SCALE";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

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
  sort_order?: number;
}

const MarketplaceProducts: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { balance } = useWallet();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"destaque" | "novidades">("destaque");
  const [search, setSearch] = useState("");
  const [walletOpen, setWalletOpen] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: prods } = await supabase
        .from("products")
        .select("id,name,slug,category,subcategory,country,description,warranty_terms,tags,sale_price,discount_price,is_featured,is_new,active,image_url,sort_order,created_at,updated_at")
        .eq("active", true)
        .order("is_featured", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      const { data: stockRows } = await supabase.from("product_stock").select("product_id, status");
      const stockMap: Record<string, number> = {};
      (stockRows || []).forEach((r: any) => {
        if (r.status === "disponivel") stockMap[r.product_id] = (stockMap[r.product_id] || 0) + 1;
      });
      setProducts(
        ((prods as any[]) || [])
          .filter((p) => !/proxy/i.test(`${p.category} ${p.subcategory ?? ""} ${p.name}`))
          .map((p) => ({ ...p, stock_available: stockMap[p.id] ?? 0 } as Product))
      );
      setLoading(false);
    })();
  }, []);

  const featured = useMemo(() => {
    const list = products.filter(p => tab === "destaque" ? p.is_featured : p.is_new);
    if (!search.trim()) return list.slice(0, 8);
    const q = search.toLowerCase();
    return list.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)).slice(0, 8);
  }, [products, tab, search]);

  const topSelling = useMemo(() => {
    return [...products].sort((a, b) => (b.stock_available ?? 0) - (a.stock_available ?? 0)).slice(0, 4);
  }, [products, getLanguage()]);

  const categories = useMemo(() => {
    const map = new Map<string, { key: string; label: string; desc: string; icon: string; count: number }>();
    products.forEach(p => {
      const blob = `${p.category} ${p.subcategory ?? ""} ${p.name}`.toLowerCase();
      let key = "outros", label = tr('mk.cat.other'), desc = tr('mk.cat.otherDesc'), icon = "📦";
      if (/tiktok|tt\b|bc\b/.test(blob)) { key = "tiktok"; label = "TikTok Ads"; desc = tr('mk.cat.tiktok'); icon = "tiktok"; }
      else if (/disparo|whats|cloud api|api/.test(blob)) { key = "bms-disparo"; label = tr('mk.cat.bmMsg'); desc = tr('mk.cat.bmMsgDesc'); icon = "whats"; }
      else if (/perfil/.test(blob)) { key = "perfis"; label = tr('mk.cat.fbProfiles'); desc = tr('mk.cat.fbProfilesDesc'); icon = "fb"; }
      else if (/bm|business manager|meta|facebook/.test(blob)) { key = "bms-fb"; label = tr('mk.cat.fbBms'); desc = tr('mk.cat.fbBmsDesc'); icon = "meta"; }
      const cur = map.get(key);
      if (cur) cur.count++;
      else map.set(key, { key, label, desc, icon, count: 1 });
    });
    return Array.from(map.values());
  }, [products, getLanguage()]);

  const goPainel = () => {
    const dest = user?.role === "client" ? "/client-dashboard"
      : user?.role === "partner" ? "/partner-dashboard"
      : "/dashboard";
    navigate(dest);
  };

  const handleBuy = (product: Product) => {
    if (!isAuthenticated) { navigate("/login?next=marketplace"); return; }
    navigate(`/meus-pedidos?solicitar=${product.id}&qty=1`);
  };

  const navBtn = (active: boolean) =>
    `px-3 py-2 rounded-lg text-sm transition-colors inline-flex items-center gap-1.5 ${
      active ? "text-foreground bg-primary/10 border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-primary/5"
    }`;

  const CategoryIcon: React.FC<{ name: string }> = ({ name }) => {
    const cls = "w-7 h-7";
    if (name === "tiktok") return <Music2 className={cls + " text-foreground"} />;
    if (name === "meta") return <Hexagon className={cls + " text-[#0866FF]"} />;
    if (name === "fb") return <Facebook className={cls + " text-[#0866FF]"} />;
    if (name === "whats") return <MessageSquare className={cls + " text-emerald-400"} />;
    return <span className="text-xl">📦</span>;
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatedBackground className="fixed" />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 h-16 sm:h-20 flex items-center gap-3 sm:gap-6">
          <Link to="/marketplace" className="flex items-center gap-1 sm:gap-1.5 notranslate shrink-0 leading-none" translate="no" aria-label="AD SCALE">
            <img src={adLogoUrl} alt="" aria-hidden="true" className="h-7 sm:h-9 md:h-10 w-auto object-contain select-none" draggable={false} />
            <span className="font-display font-black tracking-tight text-foreground text-xl sm:text-2xl md:text-3xl leading-none translate-y-[6px] sm:translate-y-[8px]">SCALE</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 mx-auto">
            <button onClick={() => navigate("/marketplace")} className={navBtn(false)}><Home size={15} /> {tr('mk.home')}</button>
            <button className={navBtn(true)}><ShoppingCart size={15} /> {tr('mk.products')}</button>
            <button onClick={() => navigate("/marketplace/ativos")} className={navBtn(false)}><TrendingUp size={15} /> {tr('mk.withSpend')}</button>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={navBtn(false)}><MessageCircle size={15} /> {tr('mk.contact')}</a>
          </nav>

          <div className="ml-auto md:ml-0 flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <button onClick={() => setWalletOpen(true)} className="group flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors pl-1 pr-3 sm:pr-4 py-1">
                  <span className="grid place-items-center h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/30 group-hover:scale-105 transition-transform">
                    <Plus size={16} strokeWidth={3} />
                  </span>
                  <span className="font-semibold text-foreground text-xs sm:text-sm tabular-nums">{fmtBRL(balance || 0)}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="hidden sm:flex items-center gap-2 rounded-full border border-border/70 bg-secondary/40 hover:bg-secondary/70 transition-colors pl-1 pr-3 py-1">
                      <span className="grid place-items-center h-8 w-8 rounded-full bg-primary/15 text-primary text-xs font-bold uppercase">
                        {(user?.name || "U").split(" ").map(w => w[0]).slice(0, 2).join("")}
                      </span>
                      <span className="flex flex-col items-start leading-tight">
                        <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">{user?.name || tr('mk.user')}</span>
                        <span className="text-[10px] text-muted-foreground">{tr('mk.myProfile')}</span>
                      </span>
                      <ChevronDown size={14} className="text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => navigate("/perfil")}>{tr('mk.profile')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/meus-pedidos")}>{tr('mk.myOrders')}</DropdownMenuItem>
                    <DropdownMenuItem onClick={goPainel}>{tr('mk.goPanel')}</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={async () => { await supabase.auth.signOut(); navigate("/marketplace"); }} className="text-destructive">
                      {tr('mk.logout')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/login?next=marketplace")}>
                  <LogIn size={14} className="mr-1" /> {tr('mk.login')}
                </Button>
                <Button size="sm" onClick={() => navigate("/marketplace-signup")}>
                  <UserPlus size={14} className="mr-1" /> {tr('mk.signup')}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <WalletDepositModal open={walletOpen} onOpenChange={setWalletOpen} />

      {/* Hero / Produtos em Destaque */}
      <section className="relative max-w-7xl mx-auto px-4 lg:px-6 pt-12 sm:pt-16 pb-6">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-foreground">{tr('mk.prod.featuredTitle')}</h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-3 max-w-2xl mx-auto">
            {tr('mk.prod.featuredDesc')}
          </p>
          <div className="flex justify-center mt-6">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList>
                <TabsTrigger value="destaque">{tr('mk.featured')}</TabsTrigger>
                <TabsTrigger value="novidades">{tr('mk.new')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="max-w-xl mx-auto mb-6">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr('mk.prod.search')}
              className="w-full bg-secondary/50 border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-12">{tr('mk.prod.loading')}</p>
        ) : featured.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">{tr('mk.prod.none')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {featured.map(p => (
              <ProductCard key={p.id} product={p as any} onBuy={() => handleBuy(p)} onDetails={(prod: any) => setSelected(prod)} />
            ))}
          </div>
        )}
      </section>

      {/* Categorias */}
      <section className="relative max-w-7xl mx-auto px-4 lg:px-6 py-12 sm:py-16">
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">{tr('mk.categories')}</h2>
          <p className="text-muted-foreground text-sm sm:text-base mt-3 max-w-xl mx-auto">
            {tr('mk.prod.catDesc')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map(c => (
            <button
              key={c.key}
              onClick={() => { setSearch(c.label.split(" ")[0]); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="group rounded-2xl border border-border/60 bg-card/60 hover:bg-card/80 hover:border-primary/40 transition-all p-5 flex items-center gap-4 text-left"
            >
              <div className="w-14 h-14 rounded-xl bg-background/60 border border-border/40 flex items-center justify-center shrink-0">
                <CategoryIcon name={c.icon} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-foreground text-lg">{c.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.desc}</p>
              </div>
              <ArrowRight size={18} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </button>
          ))}
        </div>
      </section>

      {/* Mais Vendidos */}
      <section className="relative max-w-7xl mx-auto px-4 lg:px-6 py-12 sm:py-16">
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">{tr('mk.prod.top')}</h2>
          <p className="text-muted-foreground text-sm sm:text-base mt-3 max-w-xl mx-auto">
            {tr('mk.prod.topDesc')}
          </p>
        </div>

        {topSelling.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">{tr('mk.prod.soon')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {topSelling.map((p, i) => (
              <div key={p.id} className="relative">
                <span className="absolute -top-2 -left-2 z-10 inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-display font-bold text-xs shadow-lg shadow-primary/40">
                  #{i + 1}
                </span>
                <ProductCard product={p as any} onBuy={() => handleBuy(p)} onDetails={(prod: any) => setSelected(prod)} />
              </div>
            ))}
          </div>
        )}
      </section>

      <MarketplaceFooter />

      {/* Modal detalhes simples */}
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
              <div className="space-y-3 mt-2">
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {selected.description || tr('mk.prod.noDesc')}
                </p>
                <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/[0.03] p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{tr('mk.total')}</p>
                    <p className="text-2xl font-bold text-primary">
                      {fmtBRL(selected.discount_price ?? selected.sale_price)}
                    </p>
                  </div>
                  <Button onClick={() => handleBuy(selected)}>
                    <ShoppingCart size={14} className="mr-1.5" /> {tr('mk.buy')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketplaceProducts;
