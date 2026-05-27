import React from "react";
import { motion } from "framer-motion";
import { ShoppingCart, Info, Sparkles, Flame, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MarketplaceProduct {
  id: string;
  name: string;
  category: string;
  subcategory?: string | null;
  country?: string | null;
  description?: string | null;
  tags?: string[] | null;
  sale_price: number;
  discount_price?: number | null;
  is_featured?: boolean;
  is_new?: boolean;
  stock_available?: number;
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

/* —— Traffic source resolution —— */
type Source = "meta" | "tiktok" | "google" | "proxy" | "generic";

const detectSource = (p: MarketplaceProduct): Source => {
  const blob = `${p.category} ${p.subcategory ?? ""} ${p.name} ${(p.tags ?? []).join(" ")}`.toLowerCase();
  if (/(meta|facebook|insta|fb|bm|business manager)/.test(blob)) return "meta";
  if (/(tiktok|tt|bc\b)/.test(blob)) return "tiktok";
  if (/(google|youtube|gads|ads)/.test(blob)) return "google";
  if (/(proxy|ip|multilogin|antidetect)/.test(blob)) return "proxy";
  return "generic";
};

const SOURCE_META: Record<Source, { label: string; tint: string; bg: string; ring: string }> = {
  meta: {
    label: "Meta Ads",
    tint: "text-[#0866FF]",
    bg: "bg-[#0866FF]/10",
    ring: "ring-[#0866FF]/30",
  },
  tiktok: {
    label: "TikTok Ads",
    tint: "text-foreground",
    bg: "bg-foreground/10",
    ring: "ring-foreground/20",
  },
  google: {
    label: "Google Ads",
    tint: "text-[#FBBC04]",
    bg: "bg-[#FBBC04]/10",
    ring: "ring-[#FBBC04]/30",
  },
  proxy: {
    label: "Infra",
    tint: "text-primary",
    bg: "bg-primary/10",
    ring: "ring-primary/30",
  },
  generic: {
    label: "Ativo",
    tint: "text-primary",
    bg: "bg-primary/10",
    ring: "ring-primary/30",
  },
};

const MetaMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 36 36" className={className} fill="none" aria-hidden>
    <path
      d="M5 22.5C5 15 9 9.5 14.8 9.5c3.4 0 5.7 1.7 8.2 5.4 2.8 4.1 4 5.4 5.8 5.4 1.7 0 2.7-1.4 2.7-3.7 0-2.6-1.1-4.4-2.7-4.4-1.3 0-2.3.8-4.3 3.6l-2.1-2.9c2.4-3.2 4.4-4.4 6.6-4.4 4.1 0 6.8 3.5 6.8 8.5 0 4.6-2.6 7.5-6.4 7.5-2.9 0-4.8-1.4-7.6-5.4-2.8-4-3.9-5.1-5.5-5.1-2.1 0-3.6 2-3.6 5.2 0 3.4 1.5 5.4 3.9 5.4 1.4 0 2.6-.6 4.1-2.3l2 2.7C20.5 27.6 18 29 14.9 29 9 29 5 25.6 5 22.5z"
      fill="currentColor"
    />
  </svg>
);

const TikTokMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path
      d="M16.5 3c.3 1.6 1.2 3 2.6 3.8.8.5 1.7.8 2.6.9v3.1c-1.8 0-3.5-.5-5-1.5v6.9c0 3.6-2.9 6.5-6.5 6.5S3.7 19.8 3.7 16.2s2.9-6.5 6.5-6.5c.4 0 .8 0 1.2.1v3.2c-.4-.1-.8-.2-1.2-.2-1.9 0-3.4 1.5-3.4 3.4s1.5 3.4 3.4 3.4 3.4-1.5 3.4-3.4V3h2.9z"
      fill="currentColor"
    />
  </svg>
);

const GoogleMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4c-.2 1.2-.9 2.3-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" fill="#4285F4" />
    <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6C4.7 19.8 8.1 22 12 22z" fill="#34A853" />
    <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1C2.4 8.8 2 10.3 2 12s.4 3.2 1.1 4.6L6.4 14z" fill="#FBBC05" />
    <path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8C17 3 14.7 2 12 2 8.1 2 4.7 4.2 3.1 7.4L6.4 10c.8-2.4 3-4.1 5.6-4.1z" fill="#EA4335" />
  </svg>
);

const SourceMark: React.FC<{ source: Source; className?: string }> = ({ source, className }) => {
  if (source === "meta") return <MetaMark className={className} />;
  if (source === "tiktok") return <TikTokMark className={className} />;
  if (source === "google") return <GoogleMark className={className} />;
  return <Sparkles className={className} />;
};

/* —— Country flag —— */
const COUNTRY_FLAGS: Record<string, string> = {
  BR: "🇧🇷", BRA: "🇧🇷", BRASIL: "🇧🇷",
  US: "🇺🇸", USA: "🇺🇸", EUA: "🇺🇸", "ESTADOS UNIDOS": "🇺🇸",
  PT: "🇵🇹", PORTUGAL: "🇵🇹",
  ES: "🇪🇸", ESPANHA: "🇪🇸",
  MX: "🇲🇽", MEXICO: "🇲🇽", MÉXICO: "🇲🇽",
  AR: "🇦🇷", ARGENTINA: "🇦🇷",
  UK: "🇬🇧", GB: "🇬🇧",
};
const flagFor = (c?: string | null) => (c ? COUNTRY_FLAGS[c.toUpperCase()] ?? "🌍" : "");

/* —— Card —— */
interface Props {
  product: MarketplaceProduct;
  onBuy: (p: MarketplaceProduct) => void;
  onDetails: (p: MarketplaceProduct) => void;
}

const ProductCard: React.FC<Props> = ({ product: p, onBuy, onDetails }) => {
  const source = detectSource(p);
  const meta = SOURCE_META[source];
  const hasDiscount = !!p.discount_price && p.discount_price < p.sale_price;
  const finalPrice = hasDiscount ? p.discount_price! : p.sale_price;
  const discountPct = hasDiscount ? Math.round(((p.sale_price - p.discount_price!) / p.sale_price) * 100) : 0;
  const stock = p.stock_available ?? 0;
  const inStock = stock > 0;
  const lowStock = inStock && stock <= 3;

  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-card/90 to-card/40 backdrop-blur-xl shadow-[0_10px_30px_-15px_rgb(0_0_0/0.7)] hover:border-primary/40 hover:shadow-[0_20px_50px_-20px_hsl(var(--primary)/0.35)] transition-all"
    >
      {/* Top neon hairline */}
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

      {/* Animated sheen on hover */}
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute -inset-x-10 -top-10 h-32 rotate-12 bg-gradient-to-r from-transparent via-primary/10 to-transparent blur-2xl" />
      </div>

      {/* Source corner mark */}
      <div
        className={`absolute top-3 right-3 flex items-center gap-1.5 rounded-full px-2 py-1 ring-1 ${meta.bg} ${meta.ring} backdrop-blur`}
        title={meta.label}
      >
        <SourceMark source={source} className={`h-3.5 w-3.5 ${meta.tint}`} />
        <span className={`text-[9px] font-semibold uppercase tracking-wider ${meta.tint}`}>{meta.label}</span>
      </div>

      <div className="relative p-5 flex flex-col flex-1 gap-3">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 pr-28">
          {p.is_featured && (
            <span className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
              <Flame size={9} /> Top
            </span>
          )}
          {p.is_new && (
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/15 border border-blue-400/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-300">
              <Sparkles size={9} /> Novo
            </span>
          )}
        </div>

        {/* Title with flag */}
        <h3 className="font-display font-semibold text-foreground leading-tight text-[15px] flex items-start gap-1.5">
          <span className="flex-1">{p.name}</span>
          {p.country && <span className="text-base shrink-0">{flagFor(p.country)}</span>}
        </h3>

        {/* Category chips */}
        <div className="flex flex-wrap gap-1">
          <span className="rounded-md bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80 border border-border/60">
            {p.category}
          </span>
          {p.country && (
            <span className="rounded-md bg-secondary/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/60">
              {p.country}
            </span>
          )}
        </div>

        {p.description && (
          <p className="text-xs text-muted-foreground/90 line-clamp-2 leading-relaxed">{p.description}</p>
        )}

        {/* Spec micro-row */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/80 mt-1">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck size={11} className="text-primary/80" /> Garantia 24h
          </span>
          <span className="inline-flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${inStock ? "bg-primary shadow-[0_0_8px_hsl(var(--primary))]" : "bg-muted-foreground/40"}`} />
            {inStock ? (lowStock ? `Últimas ${stock}` : `${stock} disponíveis`) : "Sob consulta"}
          </span>
        </div>

        {/* Pricing block */}
        <div className="mt-auto pt-3 border-t border-border/40 space-y-2">
          {hasDiscount && (
            <div className="flex items-center gap-2 text-xs">
              <span className="line-through text-muted-foreground">{fmtBRL(p.sale_price)}</span>
              <span className="rounded-md bg-gradient-to-r from-orange-500 to-rose-500 text-white px-1.5 py-0.5 text-[10px] font-bold shadow-[0_0_12px_rgb(249_115_22/0.4)]">
                -{discountPct}%
              </span>
            </div>
          )}
          <div className="flex items-end justify-between">
            <div className="flex flex-col leading-none">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">À vista no Pix</span>
              <span className="text-2xl font-bold text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.4)]">
                {fmtBRL(finalPrice)}
              </span>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1 relative overflow-hidden font-semibold shadow-[0_0_24px_-6px_hsl(var(--primary)/0.6)]"
              size="sm"
              onClick={() => onBuy(p)}
              disabled={!inStock}
            >
              <ShoppingCart size={14} className="mr-1.5" />
              {inStock ? "Comprar" : "Indisponível"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onDetails(p)}
              className="border-border/60 hover:border-primary/40 hover:text-primary"
              title="Detalhes"
            >
              <Info size={14} />
            </Button>
          </div>
        </div>
      </div>
    </motion.article>
  );
};

export default ProductCard;
