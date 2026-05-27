import React, { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import AdScaleLogo from "@/components/AdScaleLogo";
import AnimatedBackground from "@/components/AnimatedBackground";
import ProductCard from "@/components/marketplace/ProductCard";
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

/* --------------------- Static social proof --------------------- */

const STATS = [
  { label: "Contas entregues", value: "+12.5k", hint: "Operação 24/7", icon: Package },
  { label: "Clientes ativos", value: "+2.300", hint: "Gestores escalando", icon: Users },
  { label: "Países atendidos", value: "18", hint: "Cobertura global", icon: Globe2 },
  { label: "Reposição em até 24h", value: "100%", hint: "Garantia AD SCALE", icon: ShieldCheck },
];

const WHATSAPP_URL = "https://wa.me/5531998416336?text=Ol%C3%A1!%20Tenho%20interesse%20no%20marketplace%20da%20AD%20SCALE";

const TESTIMONIALS = [
  {
    name: "Lucas Andrade",
    role: "Gestor de Tráfego",
    text:
      "A AD SCALE virou nossa base de operação. Compro de madrugada e em minutos a conta já está rodando campanha. Sem dor de cabeça.",
    rating: 5,
  },
  {
    name: "Mariana Costa",
    role: "Afiliada Black",
    text:
      "Já testei vários fornecedores e nenhum chega perto da qualidade das BMs daqui. Suporte responde no WhatsApp em segundos.",
    rating: 5,
  },
  {
    name: "Rafael Mendes",
    role: "Agência Performance",
    text:
      "Estrutura completa: BM, perfis, proxy, multilogin. Conseguimos escalar 3x sem precisar gastar horas montando ativo.",
    rating: 5,
  },
];

const FAQ = [
  {
    q: "Como funciona a entrega das contas?",
    a: "A maioria dos produtos é entregue automaticamente após a confirmação do Pix — o acesso aparece na sua área de pedidos em segundos. Itens marcados como manuais são liberados por um especialista em até alguns minutos no horário comercial.",
  },
  {
    q: "Qual é a garantia oferecida?",
    a: "Todos os ativos têm garantia de 24 horas para falhas de acesso, bloqueio no primeiro login ou divergência de descrição. Basta abrir um chamado no WhatsApp com print do erro que substituímos a unidade.",
  },
  {
    q: "Vocês emitem nota fiscal?",
    a: "Sim. Após o pagamento, basta solicitar a NF-e para o nosso suporte com seus dados de CNPJ ou CPF. Emitimos em até 1 dia útil.",
  },
  {
    q: "Posso pagar com cartão ou boleto?",
    a: "No momento trabalhamos exclusivamente com Pix instantâneo — é mais rápido, seguro e permite que a entrega automática aconteça em segundos.",
  },
  {
    q: "Como entro na comunidade no WhatsApp?",
    a: "Assim que você finaliza o cadastro com seu número, recebe o convite do grupo automaticamente. Lá compartilhamos novidades, lotes premium e suporte direto com o time.",
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
    { id: "all", label: "Todos" },
    { id: "meta", label: "Meta" },
    { id: "tiktok", label: "TikTok" },
    { id: "google", label: "Google" },
  ] as const;

  const META_SUBS = [
    { id: "all", label: "Todas" },
    { id: "bm-ads", label: "BM para Ads" },
    { id: "bm-api", label: "BM para disparo via API" },
    { id: "perfil", label: "Perfil" },
  ] as const;

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
    if (tab === "destaque") list = list.filter((p) => p.is_featured);
    if (tab === "novidades") list = list.filter((p) => p.is_new);
    return list;
  }, [products, activeSource, activeMetaSub, search, tab]);

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
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 ">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center gap-3 sm:gap-6">
          <Link to="/" className="text-primary flex items-center gap-2 notranslate shrink-0" translate="no">
            <AdScaleLogo size={22} />
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
            <Link to="/marketplace" className="px-3 py-1.5 rounded-md text-foreground bg-primary/10">
              <ShoppingCart size={14} className="inline mr-1" /> Marketplace
            </Link>
            <button type="button" onClick={() => scrollToId("catalogo")} className="px-3 py-1.5 rounded-md hover:text-foreground transition-colors">Catálogo</button>
            <button type="button" onClick={() => scrollToId("beneficios")} className="px-3 py-1.5 rounded-md hover:text-foreground transition-colors">Benefícios</button>
            <button type="button" onClick={() => scrollToId("depoimentos")} className="px-3 py-1.5 rounded-md hover:text-foreground transition-colors">Depoimentos</button>
            <button type="button" onClick={() => scrollToId("faq")} className="px-3 py-1.5 rounded-md hover:text-foreground transition-colors">FAQ</button>
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {isAuthenticated ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/meus-pedidos")} className="px-2 sm:px-3">
                  <Package size={14} className="sm:mr-1" />
                  <span className="hidden sm:inline">Meus pedidos</span>
                </Button>
                <Button size="sm" onClick={goPainel}>Painel</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/login?next=marketplace")} className="px-2 sm:px-3">
                  <LogIn size={14} className="sm:mr-1" />
                  <span className="hidden sm:inline">Entrar</span>
                </Button>
                <Button size="sm" onClick={() => navigate("/signup")} className="px-2.5 sm:px-3">
                  <UserPlus size={14} className="sm:mr-1" />
                  <span>Cadastrar</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

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

          <h1 className="font-display text-[2rem] leading-[1.05] sm:text-5xl md:text-7xl font-bold tracking-tight">
            <span className="bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
              Escale suas campanhas
            </span>
            <br />
            <span className="relative inline-block text-primary drop-shadow-[0_0_40px_hsl(var(--primary)/0.5)]">
              sem travar na contingência.
              <span className="absolute -inset-x-4 -bottom-2 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
            </span>
          </h1>
          <p className="text-muted-foreground mt-5 sm:mt-7 max-w-2xl mx-auto text-sm sm:text-base md:text-lg leading-relaxed px-2">
            Contas <span className="text-foreground font-semibold">Meta</span>,{" "}
            <span className="text-foreground font-semibold">TikTok</span> e{" "}
            <span className="text-foreground font-semibold">Google Ads</span> de qualidade,
            com o melhor custo benefício do mercado.
          </p>


          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3">
            <Button size="lg" onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}>
              <ShoppingCart size={16} className="mr-2" /> Conferir produtos <ArrowRight size={16} className="ml-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer")}
            >
              <MessageCircle size={16} className="mr-2" /> Entrar em contato
            </Button>
          </div>

          {/* Trust row */}
          <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-8 gap-y-2 sm:gap-y-3 text-[11px] sm:text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 sm:gap-2"><Zap size={13} className="text-primary" /> Entrega via Pix</span>
            <span className="flex items-center gap-1.5 sm:gap-2"><ShieldCheck size={13} className="text-primary" /> Garantia de 24h</span>
            <span className="flex items-center gap-1.5 sm:gap-2"><Clock size={13} className="text-primary" /> Suporte 7 dias</span>
            <span className="flex items-center gap-1.5 sm:gap-2"><HeartHandshake size={13} className="text-primary" /> +2.300 clientes</span>
          </div>
        </motion.div>


        {/* Stat strip — premium AD SCALE */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
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
              <div className="relative h-full rounded-[15px] bg-gradient-to-br from-card/90 via-card/70 to-background/80  px-5 py-5 overflow-hidden">
                {/* Corner glow */}
                <div className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full bg-primary/20 blur-3xl opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
                {/* Grid texture */}
                <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(hsl(var(--primary))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary))_1px,transparent_1px)] [background-size:22px_22px]" />
                {/* Top hairline */}
                <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
                {/* Diagonal sheen on hover */}
                <div className="pointer-events-none absolute -inset-x-10 -top-10 h-32 rotate-12 bg-gradient-to-r from-transparent via-primary/15 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative flex items-start justify-between mb-3">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-xl bg-primary/30 blur-xl opacity-70 group-hover:opacity-100 transition-opacity" />
                    <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 border border-primary/40 flex items-center justify-center shadow-[inset_0_1px_0_hsl(var(--primary)/0.3)]">
                      <s.icon size={18} className="text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.7)]" />
                    </div>
                  </div>
                  <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-primary/70 px-1.5 py-0.5 rounded border border-primary/30 bg-primary/5">
                    Live
                  </span>
                </div>

                <p className="relative font-display text-3xl md:text-[2rem] font-extrabold leading-none bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {s.value}
                </p>
                <p className="relative text-[11px] uppercase tracking-[0.22em] text-muted-foreground mt-2 font-medium">
                  {s.label}
                </p>
                <div className="relative mt-3 pt-2 border-t border-border/40 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary))]" />
                  <span className="text-[10px] text-primary/80 font-medium">{s.hint}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Benefícios */}
      <section id="beneficios" className="relative max-w-7xl mx-auto px-4 lg:px-6 py-14">
        <div className="text-center mb-10">
          <p className="text-[10px] uppercase tracking-[0.4em] text-primary/80 mb-3">Por que AD SCALE</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            Infraestrutura completa para quem vive de tráfego
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: Zap,
              title: "Entrega em segundos",
              text: "Confirmou o Pix, recebeu o acesso. Tudo automatizado e disponível no painel imediatamente.",
            },
            {
              icon: ShieldCheck,
              title: "Garantia real de 24h",
              text: "Conta bloqueada ou divergente? Substituímos sem burocracia. Você não fica na mão.",
            },
            {
              icon: HeartHandshake,
              title: "Suporte humano no WhatsApp",
              text: "Time de especialistas em ads disponível 7 dias por semana para destravar sua operação.",
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

      {/* Catálogo */}
      <section id="catalogo" className="relative max-w-7xl mx-auto px-4 lg:px-6 py-14">
        <div className="text-center mb-8">
          <p className="text-[10px] uppercase tracking-[0.4em] text-primary/80 mb-3">Catálogo</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">Produtos em Destaque</h2>
          <p className="text-muted-foreground text-sm mt-2 max-w-xl mx-auto">
            Os ativos mais vendidos e com melhores avaliações dos nossos clientes.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex justify-center mb-6">
          <TabsList>
            <TabsTrigger value="destaque">Em Destaque</TabsTrigger>
            <TabsTrigger value="novidades">Novidades</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search */}
        <div className="max-w-xl mx-auto mb-5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full bg-secondary/50 border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Source categories */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
          {SOURCES.map((s) => {
            const active = activeSource === s.id;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setActiveSource(s.id as typeof activeSource);
                  if (s.id !== "meta") setActiveMetaSub("all");
                }}
                className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider border transition-all ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
                    : "bg-card/40 border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Meta subcategories */}
        {activeSource === "meta" && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 mb-6">
            {META_SUBS.map((s) => {
              const active = activeMetaSub === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveMetaSub(s.id as typeof activeMetaSub)}
                  className={`px-3 py-1 rounded-md text-[11px] font-medium border transition-all ${
                    active
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <p className="text-center text-muted-foreground text-sm py-12">Carregando produtos…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-12">
            Nenhum produto encontrado nesta categoria.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} onBuy={handleBuy} onDetails={(prod) => setSelected(prod)} />
            ))}
          </div>
        )}
      </section>

      {/* Depoimentos */}
      <section id="depoimentos" className="relative max-w-7xl mx-auto px-4 lg:px-6 py-16">
        <div className="text-center mb-10">
          <p className="text-[10px] uppercase tracking-[0.4em] text-primary/80 mb-3">Provas sociais</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            Quem escala com a <span className="text-primary notranslate" translate="no">AD SCALE</span> não volta atrás
          </h2>
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={16} className="fill-primary text-primary" />
              ))}
            </div>
            <span>4,9/5 — avaliação média dos clientes</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t) => (
            <motion.div
              key={t.name}
              whileHover={{ y: -3 }}
              className="relative rounded-2xl border border-border/60 bg-card/60  p-6 flex flex-col gap-4"
            >
              <Quote size={28} className="text-primary/60" />
              <p className="text-sm text-foreground leading-relaxed">"{t.text}"</p>
              <div className="flex">
                {[...Array(t.rating)].map((_, i) => (
                  <Star key={i} size={13} className="fill-primary text-primary" />
                ))}
              </div>
              <div className="mt-auto pt-3 border-t border-border/60">
                <p className="font-display font-semibold text-foreground text-sm">{t.name}</p>
                <p className="text-[11px] text-muted-foreground">{t.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative max-w-3xl mx-auto px-4 lg:px-6 py-16">
        <div className="text-center mb-10">
          <p className="text-[10px] uppercase tracking-[0.4em] text-primary/80 mb-3">FAQ</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
            Perguntas frequentes
          </h2>
          <p className="text-muted-foreground text-sm mt-2">
            Tudo o que você precisa saber antes de comprar.
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
      <section className="relative max-w-7xl mx-auto px-4 lg:px-6 py-16">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-background p-10 md:p-14 text-center">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/40 bg-primary/15 text-primary text-[10px] uppercase tracking-[0.3em] mb-5">
              <MessageCircle size={12} /> Comunidade exclusiva
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">
              Pronto para escalar com a <span className="text-primary notranslate" translate="no">AD SCALE</span>?
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
              Crie sua conta em menos de 1 minuto, finalize sua primeira compra via Pix e entre na nossa
              comunidade de tráfego no WhatsApp.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              {!isAuthenticated ? (
                <>
                  <Button size="lg" onClick={() => navigate("/signup")}>
                    <UserPlus size={16} className="mr-2" /> Criar conta grátis
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate("/login?next=marketplace")}>
                    Já tenho conta
                  </Button>
                </>
              ) : (
                <Button size="lg" onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}>
                  <ShoppingCart size={16} className="mr-2" /> Ver catálogo
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-border/60 mt-10">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-primary notranslate" translate="no">
            <AdScaleLogo size={22} />
          </div>
          <p className="text-[11px] text-muted-foreground text-center md:text-right">
            © {new Date().getFullYear()} <span className="notranslate" translate="no">AD SCALE</span> — Marketplace de ativos para tráfego pago.
            Todos os direitos reservados.
          </p>
        </div>
      </footer>

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
                      <p className="text-xs text-primary">
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
