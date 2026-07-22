import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, MessageCircle, CheckCircle2, Shield, Building2, FileText, Users, Globe, Lock, ClipboardCheck } from "lucide-react";
import AdScaleLogo from "@/components/AdScaleLogo";

const PAGE_TITLE = "Estrutura Ads — Organização profissional para operações Meta Ads | AD SCALE";
const PAGE_DESC = "Estruture sua operação de Meta Ads com a AD SCALE: avaliação de Business Manager, contas de anúncio, páginas, domínios, permissões e fluxo comercial antes de escalar investimento.";
const PAGE_URL = "https://adscalev1.lovable.app/#/estrutura-ads";
const SITE_NAME = "AD SCALE";
const WHATSAPP_URL = "https://wa.me/553198416336?text=Ol%C3%A1!%20Vim%20do%20site%20da%20AD%20Scale%20e%20tenho%20interesse%20nos%20ativos%20de%20conting%C3%AAncia";

const GADS_ID = "AW-18226021110";
const GADS_CONVERSION_LABEL = "AW-18226021110/U42jCK374rwcEPaF7PJD";

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: any;
    gtag_report_conversion?: (url?: string) => boolean;
  }
}

function loadGoogleAdsPixel() {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function () { window.dataLayer!.push(arguments); };
  }
  const scriptId = `gtag-${GADS_ID}`;
  if (!document.getElementById(scriptId)) {
    const s = document.createElement("script");
    s.id = scriptId;
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GADS_ID}`;
    document.head.appendChild(s);
    window.gtag("js", new Date());
    window.gtag("config", GADS_ID);
  }
  window.gtag_report_conversion = function (url?: string) {
    const callback = function () {
      if (typeof url !== "undefined") {
        window.location.href = url;
      }
    };
    window.gtag!("event", "conversion", {
      send_to: GADS_CONVERSION_LABEL,
      value: 1.0,
      currency: "BRL",
      event_callback: callback,
    });
    return false;
  };
}

function handleWhatsAppClick(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
  if (typeof window !== "undefined" && typeof window.gtag_report_conversion === "function") {
    e.preventDefault();
    window.gtag_report_conversion(WHATSAPP_URL);
  }
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    Object.entries(attrs).forEach(([k, v]) => { if (k !== "content") el!.setAttribute(k, v); });
    document.head.appendChild(el);
  }
  if (attrs.content) el.setAttribute("content", attrs.content);
}
function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) { el = document.createElement("link"); el.setAttribute("rel", rel); document.head.appendChild(el); }
  el.setAttribute("href", href);
}
function upsertJsonLd(payload: Record<string, unknown>) {
  const selector = 'script[type="application/ld+json"]';
  let el = document.head.querySelector(selector) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.setAttribute("type", "application/ld+json");
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(payload);
}

const DEFAULT_TITLE = "AD SCALE";
const DEFAULT_DESC = "Elevamos o nível da sua operação";

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5 },
};

const highlights = [
  "Avaliação de estrutura para Meta Ads",
  "Organização de ativos comerciais",
  "Direcionamento para operações que anunciam de forma profissional",
  "Suporte consultivo para entender o melhor caminho",
];

const publicos = [
  "Agências que gerenciam campanhas no Meta Ads",
  "Gestores de tráfego que atendem múltiplos projetos",
  "Infoprodutores com operação de tráfego direto",
  "E-commerces que dependem de campanhas recorrentes",
  "Empresas que desejam organizar melhor seus ativos de anúncio",
  "Operações que precisam de análise antes de escalar verba",
  "Anunciantes que buscam suporte consultivo",
];

const avaliacoes = [
  { icon: Building2, label: "Business Manager" },
  { icon: FileText, label: "Contas de anúncio" },
  { icon: Globe, label: "Páginas" },
  { icon: Users, label: "Perfis de acesso" },
  { icon: Globe, label: "Domínios" },
  { icon: Lock, label: "Organização de permissões" },
  { icon: ClipboardCheck, label: "Histórico de restrições" },
  { icon: Shield, label: "Qualidade da conta" },
  { icon: Building2, label: "Estrutura de contingência operacional" },
  { icon: Users, label: "Necessidade de suporte estratégico" },
  { icon: ClipboardCheck, label: "Fluxo comercial antes de escalar investimento" },
];

const EstruturaAds: React.FC = () => {
  useEffect(() => {
    const previousTitle = document.title;

    document.title = PAGE_TITLE;
    upsertMeta('meta[name="description"]', { name: "description", content: PAGE_DESC });

    upsertMeta('meta[property="og:title"]', { property: "og:title", content: PAGE_TITLE });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: PAGE_DESC });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: PAGE_URL });
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: SITE_NAME });
    upsertMeta('meta[property="og:locale"]', { property: "og:locale", content: "pt_BR" });

    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: PAGE_TITLE });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: PAGE_DESC });
    upsertMeta('meta[name="twitter:url"]', { name: "twitter:url", content: PAGE_URL });

    upsertLink("canonical", PAGE_URL);

    upsertJsonLd({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: "https://adscalev1.lovable.app/",
      description: PAGE_DESC,
      sameAs: [WHATSAPP_URL],
    });

    return () => {
      document.title = previousTitle || DEFAULT_TITLE;
      upsertMeta('meta[name="description"]', { name: "description", content: DEFAULT_DESC });
      upsertMeta('meta[property="og:title"]', { property: "og:title", content: DEFAULT_TITLE });
      upsertMeta('meta[property="og:description"]', { property: "og:description", content: DEFAULT_DESC });
      upsertMeta('meta[property="og:url"]', { property: "og:url", content: "https://adscalev1.lovable.app/" });
      upsertMeta('meta[property="og:locale"]', { property: "og:locale", content: "pt_BR" });
      upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: DEFAULT_TITLE });
      upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: DEFAULT_DESC });
      upsertMeta('meta[name="twitter:url"]', { name: "twitter:url", content: "https://adscalev1.lovable.app/" });
      upsertLink("canonical", "https://adscalev1.lovable.app/");
    };
  useEffect(() => {
    loadGoogleAdsPixel();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[700px] h-[700px] rounded-full bg-primary/[0.06] blur-3xl" />
      </div>

      {/* NAV */}
      <header className="relative z-20 border-b border-border/60 backdrop-blur-xl bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="text-primary notranslate" translate="no"><AdScaleLogo size={26} /></div>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="hidden sm:inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:brightness-110 transition">
            Falar no WhatsApp <ArrowRight size={14} />
          </a>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-14">
        <motion.div {...fadeUp}>
          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-primary/80 border border-primary/30 bg-primary/5 rounded-full px-3 py-1">
            <Shield size={12} /> <span className="notranslate" translate="no">AD SCALE</span> Contingência
          </span>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold mt-5 leading-[1.05] tracking-tight max-w-4xl">
            Estrutura e organização para operações profissionais de <span className="text-primary">Meta Ads</span>
          </h1>
          <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            A <span className="notranslate" translate="no">AD SCALE</span> apresenta soluções para anunciantes, agências e operações que precisam organizar melhor seus ativos, contas, páginas, domínios e processos antes de escalar campanhas.
          </p>

          <ul className="mt-8 grid sm:grid-cols-2 gap-3 max-w-3xl">
            {highlights.map((h) => (
              <li key={h} className="flex items-start gap-2.5 text-sm text-foreground/90">
                <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
                <span>{h}</span>
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <a href="/#/inicio" className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:brightness-110 shadow-[0_0_30px_-8px_hsl(var(--primary))] transition">
              Conhecer a <span className="notranslate" translate="no">AD SCALE</span> <ArrowRight size={16} />
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 border border-border/60 hover:border-primary/40 font-semibold px-6 py-3 rounded-xl transition">
              <MessageCircle size={16} /> Falar no WhatsApp
            </a>
          </div>

          <p className="mt-6 text-xs text-muted-foreground max-w-2xl">
            A <span className="notranslate" translate="no">AD SCALE</span> é uma empresa independente e não possui afiliação oficial com Meta, Facebook, Instagram, WhatsApp ou Google.
          </p>
        </motion.div>
      </section>

      {/* O QUE É */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <motion.div {...fadeUp} className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-xl p-8">
          <h2 className="font-display text-3xl font-bold tracking-tight">O que é a <span className="notranslate text-primary" translate="no">AD SCALE</span>?</h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            A <span className="notranslate" translate="no">AD SCALE</span> é uma empresa voltada para anunciantes e operações que utilizam Meta Ads e precisam de mais organização estratégica em sua estrutura de mídia. O trabalho envolve análise comercial, orientação sobre ativos, estrutura operacional e direcionamento para quem deseja profissionalizar a base da operação.
          </p>
          <h3 className="font-display text-xl font-semibold mt-8">Por que isso importa?</h3>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Em operações de tráfego pago, o resultado não depende apenas de criativos, públicos e orçamento. A organização da estrutura também influencia a previsibilidade da operação, incluindo contas, permissões, páginas, domínios, acessos, métodos de pagamento e processos internos.
          </p>
        </motion.div>
      </section>

      {/* PARA QUEM */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <motion.div {...fadeUp} className="text-center mb-10">
          <span className="text-[11px] uppercase tracking-[0.32em] text-primary/80">Para quem</span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-3 tracking-tight">Para quem essa solução é indicada?</h2>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {publicos.map((p, i) => (
            <motion.div key={p} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.03 }} className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-xl p-5 flex items-start gap-3 hover:border-primary/40 transition">
              <CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0" />
              <span className="text-sm text-foreground/90">{p}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* O QUE PODE SER AVALIADO */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <motion.div {...fadeUp} className="text-center mb-10">
          <span className="text-[11px] uppercase tracking-[0.32em] text-primary/80">Avaliação</span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-3 tracking-tight">O que pode ser avaliado em uma operação?</h2>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {avaliacoes.map(({ icon: Icon, label }) => (
            <div key={label} className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 text-primary grid place-items-center shrink-0">
                <Icon size={16} />
              </div>
              <span className="text-sm text-foreground/90">{label}</span>
            </div>
          ))}
        </div>
        <motion.p {...fadeUp} className="text-sm text-muted-foreground mt-8 max-w-3xl mx-auto text-center leading-relaxed">
          Cada operação possui um cenário diferente. Por isso, a <span className="notranslate" translate="no">AD SCALE</span> trabalha com uma abordagem consultiva para entender o momento do anunciante antes de indicar qualquer caminho.
        </motion.p>
      </section>

      {/* TRANSPARÊNCIA */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <motion.div {...fadeUp} className="rounded-2xl border border-primary/30 bg-primary/[0.04] backdrop-blur-xl p-8">
          <h2 className="font-display text-3xl font-bold tracking-tight">Transparência importante</h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            A <span className="notranslate" translate="no">AD SCALE</span> não promete aprovação garantida de anúncios, ausência total de restrições ou resultados específicos de campanha. A performance e a aprovação de anúncios dependem de diversos fatores, incluindo política das plataformas, qualidade da oferta, criativos, página de destino, histórico da conta e gestão profissional.
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            A proposta da <span className="notranslate" translate="no">AD SCALE</span> é ajudar anunciantes a entenderem melhor sua estrutura e avaliarem possíveis caminhos para uma operação mais organizada.
          </p>
        </motion.div>
      </section>

      {/* CTA FINAL */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <motion.h2 {...fadeUp} className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
          Quer conhecer as soluções da <span className="text-primary notranslate" translate="no">AD SCALE</span>?
        </motion.h2>
        <motion.p {...fadeUp} className="mt-4 text-muted-foreground max-w-2xl mx-auto">
          Acesse o site oficial para entender melhor as soluções disponíveis para operações de Meta Ads.
        </motion.p>
        <motion.div {...fadeUp} className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <a href="/#/inicio" className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:brightness-110 shadow-[0_0_30px_-8px_hsl(var(--primary))] transition">
            Acessar site oficial <ArrowRight size={16} />
          </a>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 border border-border/60 hover:border-primary/40 font-semibold px-6 py-3 rounded-xl transition">
            <MessageCircle size={16} /> Falar com a <span className="notranslate" translate="no">AD SCALE</span> no WhatsApp
          </a>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-border/60 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="text-primary"><AdScaleLogo size={20} /></div>
            <span>© {new Date().getFullYear()} <span className="notranslate" translate="no">AD SCALE</span></span>
          </div>
          <div className="flex items-center gap-5">
            <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition">Termos de Uso</a>
            <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition">Privacidade</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default EstruturaAds;
