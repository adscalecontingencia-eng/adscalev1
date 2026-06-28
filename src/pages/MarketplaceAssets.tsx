import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Home, ShoppingCart, Wifi, TrendingUp, Wrench, MessageCircle, Plus,
  Filter, Globe, DollarSign, Wallet, Search, Headphones, Users,
  ChevronDown, LogIn, UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import AdScaleLogo from "@/components/AdScaleLogo";
import AnimatedBackground from "@/components/AnimatedBackground";
import AssetCard, { MarketplaceAsset } from "@/components/marketplace/AssetCard";
import WalletDepositModal from "@/components/marketplace/WalletDepositModal";
import adLogoUrl from "@/assets/ad-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const WHATSAPP_URL = "https://wa.me/5531998416336?text=Ol%C3%A1!%20Tenho%20interesse%20nos%20ativos%20com%20gastos%20da%20AD%20SCALE";
const COMMUNITY_URL = "https://chat.whatsapp.com/";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const MarketplaceAssets: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { balance } = useWallet();

  const [assets, setAssets] = useState<MarketplaceAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletOpen, setWalletOpen] = useState(false);

  // Filters
  const [platform, setPlatform] = useState<string>("all");
  const [priceRange, setPriceRange] = useState<string>("all");
  const [currency, setCurrency] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [minGastos, setMinGastos] = useState(0);
  const [minLimite, setMinLimite] = useState(0);
  const [minCiclo, setMinCiclo] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: aRows } = await supabase
        .from("marketplace_assets")
        .select("*")
        .eq("status", "active")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (aRows && aRows.length > 0) {
        const ids = aRows.map((a: any) => a.id);
        const { data: accRows } = await supabase
          .from("marketplace_asset_accounts")
          .select("*")
          .in("asset_id", ids)
          .order("account_number", { ascending: true });
        const accByAsset: Record<string, any[]> = {};
        (accRows ?? []).forEach((r: any) => {
          (accByAsset[r.asset_id] ||= []).push(r);
        });
        setAssets(aRows.map((a: any) => ({ ...a, accounts: accByAsset[a.id] ?? [] })) as MarketplaceAsset[]);
      } else {
        setAssets([]);
      }
      setLoading(false);
    })();
  }, []);

  const maxBounds = useMemo(() => {
    let g = 0, l = 0, c = 0;
    assets.forEach(a => {
      (a.accounts ?? []).forEach((acc: any) => {
        g = Math.max(g, Number(acc.gastos || 0));
        l = Math.max(l, Number(acc.limite_meta || 0));
        c = Math.max(c, Number(acc.ciclo || 0));
      });
    });
    return { g: Math.ceil(g) || 100000, l: Math.ceil(l) || 10000, c: Math.ceil(c) || 10000 };
  }, [assets]);

  const filtered = useMemo(() => {
    return assets.filter(a => {
      if (platform !== "all" && a.platform?.toLowerCase() !== platform.toLowerCase()) return false;
      if (currency !== "all" && a.currency !== currency) return false;
      if (search.trim() && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (priceRange !== "all") {
        const [min, max] = priceRange.split("-").map(Number);
        if (a.price < min || (max && a.price > max)) return false;
      }
      const accs = a.accounts ?? [];
      const sumG = accs.reduce((s, x: any) => s + Number(x.gastos || 0), 0);
      const maxL = accs.reduce((m, x: any) => Math.max(m, Number(x.limite_meta || 0)), 0);
      const sumC = accs.reduce((s, x: any) => s + Number(x.ciclo || 0), 0);
      if (sumG < minGastos) return false;
      if (maxL < minLimite) return false;
      if (sumC < minCiclo) return false;
      return true;
    });
  }, [assets, platform, currency, search, priceRange, minGastos, minLimite, minCiclo]);

  const goPainel = () => {
    const dest = user?.role === "client" ? "/client-dashboard"
      : user?.role === "partner" ? "/partner-dashboard"
      : "/dashboard";
    navigate(dest);
  };

  const navBtn = (active: boolean, extra = "") =>
    `px-3 py-2 rounded-lg text-sm transition-colors inline-flex items-center gap-1.5 ${
      active ? "text-foreground bg-primary/10 border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-primary/5"
    } ${extra}`;

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
            <button onClick={() => navigate("/marketplace")} className={navBtn(false)}>
              <Home size={15} /> Início
            </button>
            <button onClick={() => navigate("/marketplace")} className={navBtn(false)}>
              <ShoppingCart size={15} /> Produtos
            </button>
            <button onClick={() => navigate("/marketplace")} className={navBtn(false)}>
              <Wifi size={15} /> Proxies
            </button>
            <button className={navBtn(true)}>
              <TrendingUp size={15} /> Ativos c/ Gastos
            </button>
            <button onClick={() => navigate("/marketplace")} className={navBtn(false)}>
              <Wrench size={15} /> Ferramentas
            </button>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={navBtn(false)}>
              <MessageCircle size={15} /> Contato
            </a>
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
                        <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">{user?.name || "Usuário"}</span>
                        <span className="text-[10px] text-muted-foreground">Meu perfil</span>
                      </span>
                      <ChevronDown size={14} className="text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => navigate("/perfil")}>Perfil</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/meus-pedidos")}>Meus Pedidos</DropdownMenuItem>
                    <DropdownMenuItem onClick={goPainel}>Ir para o painel</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={async () => { await supabase.auth.signOut(); navigate("/marketplace"); }} className="text-destructive">
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/login?next=marketplace")}>
                  <LogIn size={14} className="mr-1" /> Entrar
                </Button>
                <Button size="sm" onClick={() => navigate("/marketplace-signup")}>
                  <UserPlus size={14} className="mr-1" /> Cadastrar
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <WalletDepositModal open={walletOpen} onOpenChange={setWalletOpen} />

      {/* Hero */}
      <section className="relative max-w-7xl mx-auto px-4 lg:px-6 pt-10 pb-6">
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.4em] text-primary/80 mb-3">Premium</p>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-foreground">
            Ativos com <span className="text-primary">Gastos</span>
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-3 max-w-2xl mx-auto">
            BMs com histórico de gastos, limites elevados e contas prontas para escalar imediatamente.
          </p>
        </div>
      </section>

      {/* Como comprar + Suporte e Comunidade */}
      <section className="relative max-w-7xl mx-auto px-4 lg:px-6 py-10 sm:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Como comprar */}
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-6 sm:p-8">
            <div className="text-center mb-6">
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Como comprar?</h3>
              <p className="text-sm text-muted-foreground mt-2">Adquira seu ativo em apenas 3 etapas simples</p>
            </div>
            <div className="space-y-3">
              <Step n={1} title="Encontre o que te interessa" text="Curtiu algum ativo? Salve o nome ou tire um print para não perder!" />
              <Step n={2} title="Fale com a gente pelo chat" text="Clique no botão ao lado do ativo que se interessou e fale com a gente pelo chat." />
              <Step n={3} title="Conclua a compra na hora" text="Se estiver disponível, você recebe a chave PIX imediatamente e finaliza sua compra com agilidade e segurança." />
            </div>
          </div>

          {/* Suporte */}
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-6 sm:p-8">
            <div className="text-center mb-6">
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Suporte e Comunidade</h3>
              <p className="text-sm text-muted-foreground mt-2">Estamos aqui para te ajudar</p>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-border/40 bg-background/40 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <Headphones size={18} />
                  </div>
                  <div>
                    <p className="font-display font-bold text-foreground">Suporte</p>
                    <p className="text-xs text-muted-foreground">Precisa de ajuda? Nossa equipe está pronta para te atender!</p>
                  </div>
                </div>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                  className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm transition-colors">
                  <MessageCircle size={14} /> Falar com Suporte
                </a>
              </div>

              <div className="rounded-xl border border-border/40 bg-background/40 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center text-primary">
                    <Users size={18} />
                  </div>
                  <div>
                    <p className="font-display font-bold text-foreground">Comunidade</p>
                    <p className="text-xs text-muted-foreground">Seja avisado de promoções e participe de sorteios exclusivos!</p>
                  </div>
                </div>
                <a href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer"
                  className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm transition-colors">
                  <Users size={14} /> Entrar na Comunidade
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filtros */}
      <section className="relative max-w-7xl mx-auto px-4 lg:px-6 py-4">
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
              <Filter size={16} />
            </div>
            <h2 className="font-display text-xl font-bold text-foreground">Filtrar Ativos</h2>
          </div>

          <div className="rounded-xl border border-border/40 bg-background/40 p-4 sm:p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <Globe size={13} /> Plataforma
                </label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <DollarSign size={13} /> Faixa de Preço
                </label>
                <Select value={priceRange} onValueChange={setPriceRange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="0-1000">Até R$ 1.000</SelectItem>
                    <SelectItem value="1000-3000">R$ 1.000 – R$ 3.000</SelectItem>
                    <SelectItem value="3000-7000">R$ 3.000 – R$ 7.000</SelectItem>
                    <SelectItem value="7000-999999">Acima de R$ 7.000</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <Wallet size={13} /> Moeda das Contas
                </label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="BRL">BRL (R$)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <Search size={13} /> Buscar por Nome
                </label>
                <Input placeholder="Ex: BM AdScale" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <SliderField label="Gastos Mínimos" icon={<TrendingUp size={13} />} value={minGastos} onChange={setMinGastos} max={maxBounds.g} />
              <SliderField label="Limite Mínimo" icon={<DollarSign size={13} />} value={minLimite} onChange={setMinLimite} max={maxBounds.l} />
              <SliderField label="Ciclo Mínimo" icon={<TrendingUp size={13} />} value={minCiclo} onChange={setMinCiclo} max={maxBounds.c} />
            </div>

            <p className="text-xs text-muted-foreground pt-1">
              Mostrando <span className="font-bold text-foreground">{filtered.length}</span> de <span className="font-bold text-foreground">{assets.length}</span> BMs
            </p>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="relative max-w-7xl mx-auto px-4 lg:px-6 py-6">
        {loading ? (
          <p className="text-center text-muted-foreground py-12">Carregando ativos…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card/40 p-12 text-center">
            <p className="text-muted-foreground">Nenhum ativo encontrado com os filtros atuais.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filtered.map(a => <AssetCard key={a.id} asset={a} />)}
          </div>
        )}
      </section>


      {/* Footer */}
      <footer className="relative border-t border-border/60 mt-6">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-primary notranslate" translate="no">
            <AdScaleLogo size={22} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} <span className="notranslate" translate="no">AD SCALE</span> — Ativos premium para tráfego pago.
          </p>
        </div>
      </footer>
    </div>
  );
};

const Step: React.FC<{ n: number; title: string; text: string }> = ({ n, title, text }) => (
  <div className="rounded-xl border border-border/40 bg-background/40 p-4 flex items-start gap-4">
    <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center text-primary font-bold text-sm shrink-0">
      {n}
    </div>
    <div>
      <p className="font-display font-bold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{text}</p>
    </div>
  </div>
);

const SliderField: React.FC<{ label: string; icon: React.ReactNode; value: number; onChange: (v: number) => void; max: number }> = ({ label, icon, value, onChange, max }) => (
  <div>
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
      {icon} {label}: <span className="text-foreground font-semibold">{value === 0 ? "Todos" : fmtBRL(value)}</span>
    </label>
    <Slider value={[value]} max={max} step={Math.max(1, Math.round(max / 100))} onValueChange={(v) => onChange(v[0] || 0)} />
  </div>
);

export default MarketplaceAssets;
