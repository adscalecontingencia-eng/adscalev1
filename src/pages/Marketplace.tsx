import React, { useEffect, useMemo, useState } from "react";
import { tr } from '@/i18n';
import { getNumberLocale } from '@/i18n/format';
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShoppingCart,
  Info,
  Package,
  Sparkles,
  ShieldCheck,
  LogIn,
  UserPlus,
  Search,
  Zap,
  Clock,
  HeartHandshake,
  Star,
  Quote,
  ChevronDown,
  CheckCircle2,
  Globe2,
  Users,
  TrendingUp,
  MessageCircle,
  ArrowRight,
  Menu,
  X,
  SlidersHorizontal,
  Plus,
  Home,
  Wifi,
  TrendingUp as TrendingUpIcon,
  ChevronDown as ChevronDownIcon,
} from "lucide-react";
import { Music2, MessageSquare, Facebook, Hexagon } from "lucide-react";
import PartnerBannersStrip from "@/components/PartnerBannersStrip";

import AdScaleLogo from "@/components/AdScaleLogo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import AnimatedBackground from "@/components/AnimatedBackground";
import ProductCard from "@/components/marketplace/ProductCard";
import AssetCard, { MarketplaceAsset } from "@/components/marketplace/AssetCard";
import MarketplacePixSection from "@/components/marketplace/MarketplacePixSection";
import MarketplaceFooter from "@/components/marketplace/MarketplaceFooter";
import WalletDepositModal from "@/components/marketplace/WalletDepositModal";
import { useWallet } from "@/hooks/useWallet";
import adLogoUrl from "@/assets/ad-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


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
  new Intl.NumberFormat(getNumberLocale(), { style: "currency", currency: "BRL" }).format(n || 0);

/* --------------------- Static social proof --------------------- */

const STATS = [
  { get label() { return tr('mk.stats.delivered'); }, value: "+12.5k", get hint() { return tr('mk.stats.deliveredHint'); }, icon: Package },
  { get label() { return tr('mk.stats.clients'); }, value: "+2.300", get hint() { return tr('mk.stats.clientsHint'); }, icon: Users },
  { get label() { return tr('mk.stats.countries'); }, value: "18", get hint() { return tr('mk.stats.countriesHint'); }, icon: Globe2 },
  { get label() { return tr('mk.stats.replace'); }, value: "100%", get hint() { return tr('mk.stats.replaceHint'); }, icon: ShieldCheck },
];

const WHATSAPP_URL = "https://wa.me/5531998416336?text=Ol%C3%A1!%20Tenho%20interesse%20no%20marketplace%20da%20AD%20SCALE";

const TESTIMONIALS = [
  {
    name: "Lucas Andrade",
    get role() { return tr('mk.t1.role'); },
    get text() { return tr('mk.t1.text'); },
    rating: 5,
  },
  {
    name: "Mariana Costa",
    get role() { return tr('mk.t2.role'); },
    get text() { return tr('mk.t2.text'); },
    rating: 5,
  },
  {
    name: "Rafael Mendes",
    get role() { return tr('mk.t3.role'); },
    get text() { return tr('mk.t3.text'); },
    rating: 5,
  },
];

const FAQ = [
  {
    get q() { return tr('mk.faq.q1'); },
    get a() { return tr('mk.faq.a1'); },
  },
  {
    get q() { return tr('mk.faq.q2'); },
    get a() { return tr('mk.faq.a2'); },
  },
  {
    get q() { return tr('mk.faq.q3'); },
    get a() { return tr('mk.faq.a3'); },
  },
  {
    get q() { return tr('mk.faq.q4'); },
    get a() { return tr('mk.faq.a4'); },
  },
  {
    get q() { return tr('mk.faq.q5'); },
    get a() { return tr('mk.faq.a5'); },
  },
];

const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};

const Marketplace: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeSource, setActiveSource] = useState<"all" | "meta" | "tiktok" | "google">("all");
  const [activeMetaSub, setActiveMetaSub] = useState<"all" | "bm-ads" | "bm-api" | "perfil">("all");
  const [tab, setTab] = useState<"destaque" | "novidades">("destaque");
  const [selected, setSelected] = useState<Product | null>(null);
  const [buyingQty, setBuyingQty] = useState(1);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [navOpen, setNavOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [priceMax, setPriceMax] = useState<number>(0);
  const [walletOpen, setWalletOpen] = useState(false);
  const { balance } = useWallet();
  const [assets, setAssets] = useState<MarketplaceAsset[]>([]);




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

      const { data: stockRows } = await supabase
        .from("product_stock")
        .select("product_id, status");

      const stockMap: Record<string, number> = {};
      (stockRows || []).forEach((r: any) => {
        if (r.status === "disponivel") stockMap[r.product_id] = (stockMap[r.product_id] || 0) + 1;
      });

      setProducts(
        ((prods as any[]) || [])
          .filter((p) => !/proxy/i.test(`${p.category} ${p.subcategory ?? ""} ${p.name}`))
          .map((p) => ({ ...p, stock_available: stockMap[p.id] ?? 0 } as Product)),
      );

      // Load marketplace assets (BMs com gastos)
      const { data: aRows } = await supabase
        .from("marketplace_assets")
        .select("*")
        .eq("status", "active")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (aRows && aRows.length > 0) {
        const ids = aRows.map((a: any) => a.id);
        const { data: accRows } = await supabase
          .from("marketplace_asset_accounts_public" as any)
          .select("*")
          .in("asset_id", ids)
          .order("account_number", { ascending: true });
        const accByAsset: Record<string, any[]> = {};
        (accRows ?? []).forEach((r: any) => {
          (accByAsset[r.asset_id] ||= []).push(r);
        });
        setAssets(aRows.map((a: any) => ({ ...a, accounts: accByAsset[a.id] ?? [] })) as MarketplaceAsset[]);
      }
      setLoading(false);
    })();
  }, []);

  // Detect traffic source from category/subcategory/tags/name
  const detectSource = (p: Product): "meta" | "tiktok" | "google" | "other" => {
    const blob = `${p.category} ${p.subcategory ?? ""} ${p.name} ${(p.tags ?? []).join(" ")}`.toLowerCase();
    if (/(meta|facebook|insta|fb|bm|business manager|perfil)/.test(blob)) return "meta";
    if (/(tiktok|tt\b)/.test(blob)) return "tiktok";
    if (/(google|youtube|gads|google ads)/.test(blob)) return "google";
    return "other";
  };

  // Detect Meta subcategory
  const detectMetaSub = (p: Product): "bm-ads" | "bm-api" | "perfil" | "other" => {
    const blob = `${p.subcategory ?? ""} ${p.category} ${p.name} ${(p.tags ?? []).join(" ")}`.toLowerCase();
    if (/perfil/.test(blob)) return "perfil";
    if (/(api|disparo|whats|cloud api)/.test(blob)) return "bm-api";
    if (/(bm|business manager|ads|an[úu]ncio)/.test(blob)) return "bm-ads";
    return "other";
  };

  const SOURCES = [
    { id: "all", label: tr('mk.src.all') },
    { id: "meta", label: "Meta" },
    { id: "tiktok", label: "TikTok" },
    { id: "google", label: "Google" },
  ] as const;

  const META_SUBS = [
    { id: "all", label: tr('mk.sub.all') },
    { id: "bm-ads", label: tr('mk.sub.bmAds') },
    { id: "bm-api", label: tr('mk.sub.bmApi') },
    { id: "perfil", label: tr('mk.sub.profile') },
  ] as const;

  // Price boundaries derived from products
  const priceBounds = useMemo(() => {
    if (!products.length) return { min: 0, max: 1000 };
    const prices = products.map((p) => p.discount_price ?? p.sale_price);
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [products]);

  useEffect(() => {
    if (priceBounds.max && priceMax === 0) setPriceMax(priceBounds.max);
  }, [priceBounds.max]);

  const filtered = useMemo(() => {
    let list = products;
    if (activeSource !== "all") list = list.filter((p) => detectSource(p) === activeSource);
    if (activeSource === "meta" && activeMetaSub !== "all") {
      list = list.filter((p) => detectMetaSub(p) === activeMetaSub);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.subcategory || "").toLowerCase().includes(q),
      );
    }
    if (priceMax > 0 && priceMax < priceBounds.max) {
      list = list.filter((p) => (p.discount_price ?? p.sale_price) <= priceMax);
    }
    if (tab === "destaque") list = list.filter((p) => p.is_featured);
    if (tab === "novidades") list = list.filter((p) => p.is_new);
    return list;
  }, [products, activeSource, activeMetaSub, search, tab, priceMax, priceBounds.max]);

  const activeFiltersCount =
    (activeSource !== "all" ? 1 : 0) +
    (activeMetaSub !== "all" && activeSource === "meta" ? 1 : 0) +
    (search.trim() ? 1 : 0) +
    (priceMax > 0 && priceMax < priceBounds.max ? 1 : 0) +
    (tab !== "destaque" ? 1 : 0);

  const clearFilters = () => {
    setActiveSource("all");
    setActiveMetaSub("all");
    setSearch("");
    setPriceMax(priceBounds.max);
    setTab("destaque");
  };



  const handleBuy = (product: Product) => {
    if (!isAuthenticated) {
      navigate("/login?next=marketplace");
      return;
    }
    navigate(`/meus-pedidos?solicitar=${product.id}&qty=${buyingQty}`);
  };

  const goPainel = () => {
    const dest =
      user?.role === "client"
        ? "/client-dashboard"
        : user?.role === "partner"
          ? "/partner-dashboard"
          : "/dashboard";
    navigate(dest);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated AD SCALE background */}
      <AnimatedBackground className="fixed" />


      {/* Header público */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 h-16 sm:h-20 flex items-center gap-3 sm:gap-6">
          {/* Logo: AD symbol + SCALE wordmark, fully transparent */}
          <Link
            to="/marketplace"
            className="flex items-center gap-1 sm:gap-1.5 notranslate shrink-0 leading-none"
            translate="no"
            aria-label="AD SCALE"
          >
            <img
              src={adLogoUrl}
              alt=""
              aria-hidden="true"
              className="h-7 sm:h-9 md:h-10 w-auto object-contain select-none"
              draggable={false}
            />
            <span className="font-display font-black tracking-tight text-foreground text-xl sm:text-2xl md:text-3xl leading-none translate-y-[6px] sm:translate-y-[8px]">
              SCALE
            </span>
          </Link>




          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1 text-sm text-muted-foreground mx-auto">
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="px-3 py-2 rounded-lg hover:text-foreground hover:bg-primary/5 transition-colors inline-flex items-center gap-1.5">
              <Home size={15} /> {tr('mk.home')}
            </button>
            <button type="button" onClick={() => navigate("/marketplace/produtos")} className="px-3 py-2 rounded-lg hover:text-foreground hover:bg-primary/5 transition-colors inline-flex items-center gap-1.5">
              <ShoppingCart size={15} /> {tr('mk.products')}
            </button>
            <button type="button" onClick={() => navigate("/marketplace/ativos")} className="px-3 py-2 rounded-lg hover:text-foreground hover:bg-primary/5 transition-colors inline-flex items-center gap-1.5">
              <TrendingUpIcon size={15} /> {tr('mk.withSpend')}
            </button>
            <button type="button" onClick={() => scrollToId("beneficios")} className="px-3 py-2 rounded-lg hover:text-foreground hover:bg-primary/5 transition-colors inline-flex items-center gap-1.5">
              <Sparkles size={15} /> {tr('mk.benefits')}
            </button>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg hover:text-foreground hover:bg-primary/5 transition-colors inline-flex items-center gap-1.5">
              <MessageCircle size={15} /> {tr('mk.contact')}
            </a>
          </nav>

          {/* Right cluster: balance + add deposit + profile */}
          <div className="ml-auto md:ml-0 flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {/* Wallet balance pill with deposit button */}
                <button
                  type="button"
                  onClick={() => setWalletOpen(true)}
                  className="group flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors pl-1 pr-3 sm:pr-4 py-1"
                  aria-label={tr('mk.addBalance')}
                >
                  <span className="grid place-items-center h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/30 group-hover:scale-105 transition-transform">
                    <Plus size={16} strokeWidth={3} />
                  </span>
                  <span className="font-semibold text-foreground text-xs sm:text-sm tabular-nums">
                    {new Intl.NumberFormat(getNumberLocale(), { style: "currency", currency: "BRL" }).format(balance || 0)}
                  </span>
                </button>

                {/* Profile pill */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="hidden sm:flex items-center gap-2 rounded-full border border-border/70 bg-secondary/40 hover:bg-secondary/70 transition-colors pl-1 pr-3 py-1"
                    >
                      <span className="grid place-items-center h-8 w-8 rounded-full bg-primary/15 text-primary text-xs font-bold uppercase">
                        {(user?.name || "U")
                          .split(" ")
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <span className="flex flex-col items-start leading-tight">
                        <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">
                          {user?.name || tr('mk.user')}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{tr('mk.myProfile')}</span>
                      </span>
                      <ChevronDownIcon size={14} className="text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 p-0">
                    <div className="p-3 flex items-center gap-3 border-b border-border/60">
                      <span className="grid place-items-center h-10 w-10 rounded-full bg-primary/15 text-primary text-sm font-bold uppercase">
                        {(user?.name || "U").split(" ").map(w => w[0]).slice(0, 2).join("")}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{user?.name || tr('mk.user')}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
                      </div>
                    </div>
                    <div className="p-1">
                      <DropdownMenuItem onClick={() => navigate("/perfil")}>
                        <UserPlus size={14} className="mr-2" /> {tr('mk.profile')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/meus-pedidos")}>
                        <Package size={14} className="mr-2" /> {tr('mk.myOrders')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/partner-signup")}>
                        <HeartHandshake size={14} className="mr-2" /> {tr('mk.affiliate')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={async () => { await supabase.auth.signOut(); navigate("/marketplace"); }}
                        className="text-destructive focus:text-destructive"
                      >
                        <X size={14} className="mr-2" /> {tr('mk.logout')}
                      </DropdownMenuItem>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/login?next=marketplace")} className="px-2 sm:px-3">
                  <LogIn size={14} className="sm:mr-1" />
                  <span className="hidden sm:inline">{tr('mk.login')}</span>
                </Button>
                <Button size="sm" onClick={() => navigate("/marketplace-signup")} className="px-2.5 sm:px-3">
                  <UserPlus size={14} className="sm:mr-1" />
                  <span>{tr('mk.signup')}</span>
                </Button>
              </>
            )}
            <LanguageSwitcher />
            {/* Hamburger — mobile only */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9 ml-0.5"
              onClick={() => setNavOpen(true)}
              aria-label={tr('mk.openMenu')}
            >
              <Menu size={18} />
            </Button>
          </div>
        </div>
      </header>

      {/* Wallet deposit modal */}
      <WalletDepositModal open={walletOpen} onOpenChange={setWalletOpen} />


      {/* Mobile nav drawer */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="right" className="w-[78vw] sm:max-w-sm bg-background border-l border-border/60 p-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60">
            <SheetTitle className="flex items-center gap-2 text-primary notranslate" translate="no">
              <AdScaleLogo size={20} /> <span className="font-display">{tr('mk.menu')}</span>
            </SheetTitle>
          </SheetHeader>
          <nav className="p-3 flex flex-col gap-1 text-sm">
            {[
              { id: "catalogo", label: tr('mk.nav.catalog'), icon: ShoppingCart },
              { id: "beneficios", label: tr('mk.benefits'), icon: Sparkles },
              { id: "depoimentos", label: tr('mk.nav.testimonials'), icon: Star },
              { id: "faq", label: "FAQ", icon: Info },
            ].map((it) => (
              <button
                key={it.id}
                onClick={() => { setNavOpen(false); setTimeout(() => scrollToId(it.id), 80); }}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-foreground/90 hover:bg-primary/10 hover:text-primary transition-colors text-left"
              >
                <it.icon size={16} className="text-primary/80" />
                <span className="font-medium">{it.label}</span>
              </button>
            ))}
            <div className="h-px bg-border/60 my-2" />
            <button
              onClick={() => { setNavOpen(false); window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer"); }}
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-foreground/90 hover:bg-primary/10 hover:text-primary transition-colors text-left"
            >
              <MessageCircle size={16} className="text-primary/80" />
              <span className="font-medium">{tr('mk.whatsapp')}</span>
            </button>
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => { setNavOpen(false); navigate("/meus-pedidos"); }}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg text-foreground/90 hover:bg-primary/10 hover:text-primary transition-colors text-left"
                >
                  <Package size={16} className="text-primary/80" /> <span className="font-medium">{tr('mk.myOrdersLower')}</span>
                </button>
                <Button className="mt-3 mx-3" onClick={() => { setNavOpen(false); goPainel(); }}>{tr('mk.goPanel')}</Button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2 mt-3 px-3">
                <Button variant="outline" onClick={() => { setNavOpen(false); navigate("/login?next=marketplace"); }}>
                  <LogIn size={14} className="mr-1" /> {tr('mk.login')}
                </Button>
                <Button onClick={() => { setNavOpen(false); navigate("/signup"); }}>
                  <UserPlus size={14} className="mr-1" /> {tr('mk.signup')}
                </Button>
              </div>
            )}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Mobile filters drawer */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="bg-background border-t border-primary/30 rounded-t-2xl p-0 max-h-[88vh]">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60">
            <SheetTitle className="flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-primary" />
              <span className="font-display">{tr('mk.filter')}</span>
            </SheetTitle>
          </SheetHeader>

          <div className="overflow-y-auto px-5 py-4 space-y-5">
            {/* Tab */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">{tr('mk.show')}</p>
              <div className="grid grid-cols-2 gap-2">
                {(["destaque", "novidades"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider border transition-all ${
                      tab === t
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "bg-secondary/40 border-border text-muted-foreground"
                    }`}
                  >
                    {t === "destaque" ? tr('mk.featured') : tr('mk.new')}
                  </button>
                ))}
              </div>
            </div>

            {/* Source */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">{tr('mk.category')}</p>
              <div className="grid grid-cols-2 gap-2">
                {SOURCES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveSource(s.id as typeof activeSource);
                      if (s.id !== "meta") setActiveMetaSub("all");
                    }}
                    className={`py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider border transition-all ${
                      activeSource === s.id
                        ? "bg-primary text-primary-foreground border-primary shadow-[0_0_18px_hsl(var(--primary)/0.4)]"
                        : "bg-secondary/40 border-border text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Meta sub */}
            {activeSource === "meta" && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">{tr('mk.metaSub')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {META_SUBS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setActiveMetaSub(s.id as typeof activeMetaSub)}
                      className={`py-2 rounded-lg text-[11px] font-medium border transition-all ${
                        activeMetaSub === s.id
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : "bg-secondary/40 border-border text-muted-foreground"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Price */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{tr('mk.maxPrice')}</p>
                <p className="text-xs font-semibold text-primary">{fmtBRL(priceMax || priceBounds.max)}</p>
              </div>
              <input
                type="range"
                min={priceBounds.min}
                max={priceBounds.max}
                step={Math.max(1, Math.round((priceBounds.max - priceBounds.min) / 50))}
                value={priceMax || priceBounds.max}
                onChange={(e) => setPriceMax(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                <span>{fmtBRL(priceBounds.min)}</span>
                <span>{fmtBRL(priceBounds.max)}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-border/60 px-5 py-3 flex items-center gap-2 bg-background">
            <Button variant="outline" className="flex-1" onClick={clearFilters}>
              {tr('mk.clear')}
            </Button>
            <SheetClose asChild>
              <Button className="flex-1">
                {tr('mk.seeN', { count: filtered.length })}
              </Button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>



      {/* Hero AD SCALE */}
      <section className="relative max-w-7xl mx-auto px-4 lg:px-6 pt-10 sm:pt-16 md:pt-20 pb-10 sm:pb-14 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-[10px] sm:text-[11px] uppercase tracking-[0.25em] sm:tracking-[0.3em] mb-5 sm:mb-8">
            <Sparkles size={12} />
            <span className="notranslate" translate="no">AD SCALE</span> Marketplace
          </div>

          <h1 className="font-display text-[1.75rem] leading-[1.1] sm:text-5xl md:text-7xl font-bold tracking-tight">
            <span className="bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
              {tr('mk.heroA')}
            </span>
            <br />
            <span className="relative inline-block text-primary drop-shadow-[0_0_40px_hsl(var(--primary)/0.5)]">
              {tr('mk.heroB')}
              <span className="absolute -inset-x-4 -bottom-2 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
            </span>
          </h1>
          <p className="text-muted-foreground mt-5 sm:mt-7 max-w-2xl mx-auto text-sm sm:text-base md:text-lg leading-relaxed px-2" dangerouslySetInnerHTML={{ __html: tr('mk.heroSub') }} />


          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3">
            <Button size="lg" onClick={() => navigate("/marketplace/produtos")}>

              <ShoppingCart size={16} className="mr-2" /> {tr('mk.seeProducts')} <ArrowRight size={16} className="ml-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer")}
            >
              <MessageCircle size={16} className="mr-2" /> {tr('mk.getInTouch')}
            </Button>
          </div>

          {/* Trust row */}
          <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-8 gap-y-2 sm:gap-y-3 text-[11px] sm:text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 sm:gap-2"><Zap size={13} className="text-primary" /> {tr('mk.pix')}</span>
            <span className="flex items-center gap-1.5 sm:gap-2"><ShieldCheck size={13} className="text-primary" /> {tr('mk.warranty24')}</span>
            <span className="flex items-center gap-1.5 sm:gap-2"><Clock size={13} className="text-primary" /> {tr('mk.support7')}</span>
            <span className="flex items-center gap-1.5 sm:gap-2"><HeartHandshake size={13} className="text-primary" /> {tr('mk.clients2300')}</span>
          </div>
        </motion.div>


        {/* Stat strip — premium AD SCALE */}
        <div className="mt-10 sm:mt-14 grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 max-w-5xl mx-auto">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -3 }}
              className="group relative rounded-2xl p-[1px] bg-gradient-to-b from-primary/40 via-border/40 to-transparent overflow-hidden"
            >
              {/* Inner card */}
              <div className="relative h-full rounded-[15px] bg-gradient-to-br from-card/90 via-card/70 to-background/80  px-3 sm:px-5 py-3.5 sm:py-5 overflow-hidden">
                <div className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full bg-primary/20 blur-3xl opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(hsl(var(--primary))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary))_1px,transparent_1px)] [background-size:22px_22px]" />
                <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
                <div className="pointer-events-none absolute -inset-x-10 -top-10 h-32 rotate-12 bg-gradient-to-r from-transparent via-primary/15 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative flex items-start justify-between mb-2 sm:mb-3">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-xl bg-primary/30 blur-xl opacity-70 group-hover:opacity-100 transition-opacity" />
                    <div className="relative h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 border border-primary/40 flex items-center justify-center shadow-[inset_0_1px_0_hsl(var(--primary)/0.3)]">
                      <s.icon size={15} className="sm:hidden text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.7)]" />
                      <s.icon size={18} className="hidden sm:block text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.7)]" />
                    </div>
                  </div>
                  <span className="hidden sm:inline-block text-[8px] font-bold uppercase tracking-[0.2em] text-primary/70 px-1.5 py-0.5 rounded border border-primary/30 bg-primary/5">
                    {tr('mk.live')}
                  </span>
                </div>

                <p className="relative font-display text-xl sm:text-3xl md:text-[2rem] font-extrabold leading-none bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {s.value}
                </p>
                <p className="relative text-[9px] sm:text-[11px] uppercase tracking-[0.18em] sm:tracking-[0.22em] text-muted-foreground mt-1.5 sm:mt-2 font-medium">
                  {s.label}
                </p>
                <div className="relative mt-2 sm:mt-3 pt-1.5 sm:pt-2 border-t border-border/40 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary))]" />
                  <span className="text-[9px] sm:text-[10px] text-primary/80 font-medium truncate">{s.hint}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="relative max-w-7xl mx-auto px-4 lg:px-6 py-4 sm:py-6">
        <PartnerBannersStrip placement="marketplace" />
      </section>

      {/* Benefícios */}
      <section id="beneficios" className="relative max-w-7xl mx-auto px-4 lg:px-6 py-10 sm:py-14">
        <div className="text-center mb-8 sm:mb-10">
          <p className="text-[10px] uppercase tracking-[0.4em] text-primary/80 mb-3">{tr('mk.why')}</p>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
            {tr('mk.infra')}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: Zap,
              get title() { return tr('mk.b1.title'); },
              get text() { return tr('mk.b1.text'); },
            },
            {
              icon: ShieldCheck,
              get title() { return tr('mk.b2.title'); },
              get text() { return tr('mk.b2.text'); },
            },
            {
              icon: HeartHandshake,
              get title() { return tr('mk.b3.title'); },
              get text() { return tr('mk.b3.text'); },
            },
          ].map((b) => (
            <motion.div
              key={b.title}
              whileHover={{ y: -3 }}
              className="rounded-2xl border border-border/60 bg-card/60  p-6"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/30 text-primary flex items-center justify-center mb-4">
                <b.icon size={18} />
              </div>
              <h3 className="font-display font-semibold text-foreground text-lg">{b.title}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{b.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Categorias */}
      <section id="categorias" className="relative max-w-7xl mx-auto px-4 lg:px-6 py-10 sm:py-14">
        <div className="text-center mb-8 sm:mb-10">
          <p className="text-[10px] uppercase tracking-[0.4em] text-primary/80 mb-3">{tr('mk.categories')}</p>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
            {tr('mk.explore')}
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base mt-3 max-w-xl mx-auto px-2">
            {tr('mk.findAsset')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: "TikTok Ads", desc: tr('mk.cat.tiktok'), icon: <Music2 className="w-7 h-7 text-foreground" /> },
            { label: tr('mk.cat.bmMsg'), desc: tr('mk.cat.bmMsgDesc'), icon: <MessageSquare className="w-7 h-7 text-emerald-400" /> },
            { label: tr('mk.cat.fbProfiles'), desc: tr('mk.cat.fbProfilesDesc'), icon: <Facebook className="w-7 h-7 text-[#0866FF]" /> },
            { label: tr('mk.cat.fbBms'), desc: tr('mk.cat.fbBmsDesc'), icon: <Hexagon className="w-7 h-7 text-[#0866FF]" /> },
          ].map((c) => (
            <button
              key={c.label}
              onClick={() => navigate("/marketplace/produtos")}
              className="group rounded-2xl border border-border/60 bg-card/60 hover:bg-card/80 hover:border-primary/40 transition-all p-5 flex items-center gap-4 text-left"
            >
              <div className="w-14 h-14 rounded-xl bg-background/60 border border-border/40 flex items-center justify-center shrink-0">
                {c.icon}
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


      {/* Ativos c/ Gastos */}
      {assets.length > 0 && (
        <section id="ativos-gastos" className="relative max-w-7xl mx-auto px-4 lg:px-6 py-10 sm:py-14">
          <div className="text-center mb-6 sm:mb-8">
            <p className="text-[10px] uppercase tracking-[0.4em] text-primary/80 mb-3">{tr('mk.premium')}</p>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">{tr('mk.withSpendTitle')}</h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-xl mx-auto px-2">
              {tr('mk.withSpendDesc')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((a) => <AssetCard key={a.id} asset={a} />)}
          </div>
        </section>
      )}

      {/* Digital products via Pix */}
      <MarketplacePixSection />


      {/* FAQ */}
      <section id="faq" className="relative max-w-3xl mx-auto px-4 lg:px-6 py-12 sm:py-16">
        <div className="text-center mb-8 sm:mb-10">
          <p className="text-[10px] uppercase tracking-[0.4em] text-primary/80 mb-3">FAQ</p>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
            {tr('mk.faqTitle')}
          </h2>
          <p className="text-muted-foreground text-sm mt-2">
            {tr('mk.faqSub')}
          </p>
        </div>

        <div className="space-y-2">
          {FAQ.map((item, i) => {
            const isOpen = openFaq === i;
            return (
              <div
                key={item.q}
                className={`rounded-2xl border bg-card/60  overflow-hidden transition-colors ${
                  isOpen ? "border-primary/40" : "border-border/60"
                }`}
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="font-display font-semibold text-foreground text-sm md:text-base flex items-center gap-3">
                    <CheckCircle2 size={16} className={isOpen ? "text-primary" : "text-muted-foreground"} />
                    {item.q}
                  </span>
                  <ChevronDown
                    size={18}
                    className={`text-muted-foreground transition-transform shrink-0 ${isOpen ? "rotate-180 text-primary" : ""}`}
                  />
                </button>
                <motion.div
                  initial={false}
                  animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-5 pl-12 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                </motion.div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA final */}
      <section className="relative max-w-7xl mx-auto px-4 lg:px-6 py-12 sm:py-16">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-background p-6 sm:p-10 md:p-14 text-center">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/40 bg-primary/15 text-primary text-[10px] uppercase tracking-[0.3em] mb-5">
              <MessageCircle size={12} /> {tr('mk.community')}
            </div>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
              {tr('mk.ready')} <span className="text-primary notranslate" translate="no">AD SCALE</span>?
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto text-sm sm:text-base">
              {tr('mk.ctaDesc')}
            </p>
            <div className="mt-7 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3">
              {!isAuthenticated ? (
                <>
                  <Button size="lg" onClick={() => navigate("/signup")}>
                    <UserPlus size={16} className="mr-2" /> {tr('mk.freeAccount')}
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate("/login?next=marketplace")}>
                    {tr('mk.haveAccount')}
                  </Button>
                </>
              ) : (
                <Button size="lg" onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}>
                  <ShoppingCart size={16} className="mr-2" /> {tr('mk.seeCatalog')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <MarketplaceFooter />

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
                  <TabsTrigger value="produto" className="flex-1">{tr('mk.product')}</TabsTrigger>
                  <TabsTrigger value="garantia" className="flex-1">
                    <ShieldCheck size={14} className="mr-1.5" /> {tr('mk.warranty')}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="produto" className="space-y-3">
                  <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                        <Package size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-display text-sm font-semibold text-foreground mb-2">{tr('mk.about')}</h4>
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                          {selected.description || tr('mk.noDesc')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-secondary/40 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                        <Sparkles size={15} />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{tr('mk.qty')}</p>
                        <p className="text-xs text-primary mt-0.5">
                          {selected.stock_available && selected.stock_available > 0
                            ? tr('mk.available', { n: selected.stock_available })
                            : tr('mk.onRequest')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => setBuyingQty(Math.max(1, buyingQty - 1))}>-</Button>
                      <span className="w-8 text-center font-semibold">{buyingQty}</span>
                      <Button variant="outline" size="icon" onClick={() => setBuyingQty(buyingQty + 1)}>+</Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/[0.03] p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{tr('mk.total')}</p>
                      <p className="text-2xl font-bold text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.4)]">
                        {fmtBRL((selected.discount_price ?? selected.sale_price) * buyingQty)}
                      </p>
                    </div>
                    <Button onClick={() => handleBuy(selected)} className="shadow-[0_0_24px_-6px_hsl(var(--primary)/0.6)]">
                      <ShoppingCart size={14} className="mr-1.5" /> {tr('mk.buy')}
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="garantia" className="space-y-3">
                  <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                        <ShieldCheck size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-display text-sm font-semibold text-foreground mb-2">{tr('mk.warrantyTerms')}</h4>
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                          {selected.warranty_terms || tr('mk.defaultWarranty')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-secondary/40 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground shrink-0">
                        <Info size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-display text-sm font-semibold text-foreground mb-1">{tr('mk.important')}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {tr('mk.agree')}
                        </p>
                      </div>
                    </div>
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
