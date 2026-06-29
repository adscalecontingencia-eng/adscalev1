import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, ShoppingBag, Infinity as InfinityIcon, Sparkles, CheckCircle2, Check, Minus,
} from "lucide-react";
import AdScaleLogo from "@/components/AdScaleLogo";

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5 },
};

const PAGE_URL = "https://adscalev1.lovable.app/escolha-seu-modelo";
const PAGE_TITLE = "Escolha seu modelo — Marketplace ou Aluguel de Contas | AD SCALE";
const PAGE_DESC =
  "Compare Marketplace (compra avulsa via PIX) e Aluguel de Contas (US$ 240 em créditos, reposição automática) e escolha o modelo ideal para escalar seus anúncios.";

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    Object.entries(attrs).forEach(([k, v]) => {
      if (k !== "content") el!.setAttribute(k, v);
    });
    document.head.appendChild(el);
  }
  el.setAttribute("content", attrs.content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

const EscolhaSeuModelo: React.FC = () => {
  const [utmQuery, setUtmQuery] = useState<string>("");

  useEffect(() => {
    // SEO meta tags
    document.title = PAGE_TITLE;
    upsertMeta('meta[name="description"]', { name: "description", content: PAGE_DESC });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: PAGE_TITLE });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: PAGE_DESC });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: PAGE_URL });
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: PAGE_TITLE });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: PAGE_DESC });
    upsertLink("canonical", PAGE_URL);

    // JSON-LD FAQ + WebPage
    const ldId = "ld-escolha-seu-modelo";
    document.getElementById(ldId)?.remove();
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.id = ldId;
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        { "@type": "Question", name: "Qual modelo é melhor para mim?", acceptedAnswer: { "@type": "Answer", text: "Marketplace para reposição pontual; Aluguel para escalar terceirizando a estrutura." } },
        { "@type": "Question", name: "Posso usar os dois ao mesmo tempo?", acceptedAnswer: { "@type": "Answer", text: "Sim. Os dois modelos convivem na mesma conta." } },
        { "@type": "Question", name: "Como funciona o pagamento?", acceptedAnswer: { "@type": "Answer", text: "Marketplace: PIX único. Aluguel: setup US$ 240 (vira crédito) + cobrança semanal em USD." } },
        { "@type": "Question", name: "Tem fidelidade?", acceptedAnswer: { "@type": "Answer", text: "Não. Você opera enquanto fizer sentido." } },
      ],
    });
    document.head.appendChild(ld);

    // UTM capture (Instagram tracking) — works with HashRouter
    const rawSearch = window.location.search || (window.location.hash.includes("?") ? "?" + window.location.hash.split("?")[1] : "");
    const params = new URLSearchParams(rawSearch);
    const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
    const collected: Record<string, string> = {};
    utmKeys.forEach((k) => {
      const v = params.get(k);
      if (v) collected[k] = v;
    });
    // Default attribution when none provided (page is linked from Instagram bio)
    if (Object.keys(collected).length === 0) {
      try {
        const stored = sessionStorage.getItem("adscale_utm");
        if (stored) Object.assign(collected, JSON.parse(stored));
      } catch { /* ignore */ }
    } else {
      try { sessionStorage.setItem("adscale_utm", JSON.stringify(collected)); } catch { /* ignore */ }
    }
    const qs = new URLSearchParams(collected).toString();
    setUtmQuery(qs ? `?${qs}` : "");

    // Fire view event on Meta Pixel / GA if loaded
    const source = (collected.utm_source || "").toLowerCase();
    try {
      (window as any).fbq?.("trackCustom", "ChoiceModelView", { source: source || "direct", ...collected });
      (window as any).gtag?.("event", "choice_model_view", { source: source || "direct", ...collected });
    } catch { /* ignore */ }
  }, []);

  const withUtm = (path: string) => `${path}${utmQuery}`;

  const trackChoice = (choice: "marketplace" | "aluguel") => {
    try {
      (window as any).fbq?.("trackCustom", "ChoiceModelClick", { choice });
      (window as any).gtag?.("event", "choice_model_click", { choice });
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[700px] h-[700px] rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-primary/[0.05] blur-3xl" />
      </div>

      {/* NAV */}
      <header className="relative z-20 border-b border-border/60 backdrop-blur-xl bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="text-primary notranslate" translate="no">
            <AdScaleLogo size={26} />
          </div>
          <a
            href="#opcoes"
            className="hidden sm:inline-flex items-center gap-2 border border-border/60 hover:border-primary/40 text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            Ver opções <ArrowRight size={14} />
          </a>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-10 text-center">
        <motion.div {...fadeUp}>
          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-primary/80 border border-primary/30 bg-primary/5 rounded-full px-3 py-1">
            <Sparkles size={12} /> Bem-vindo · <span className="notranslate" translate="no">AD SCALE</span>
          </span>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold mt-5 leading-[1.05] tracking-tight">
            Escolha o <span className="text-primary">modelo ideal</span> para a sua operação.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Existem dois caminhos para escalar com a AD SCALE: comprar ativos avulsos no
            Marketplace ou alugar uma estrutura completa de contas. Veja qual faz mais sentido
            para o seu momento.
          </p>
        </motion.div>
      </section>

      {/* DOIS CARDS */}
      <section id="opcoes" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-2 gap-5 lg:gap-6">
          {/* Marketplace */}
          <ChoiceCard
            icon={ShoppingBag}
            eyebrow="Compra avulsa"
            title="Marketplace"
            subtitle="Compre ativos avulsos quando precisar"
            bullets={[
              "Compra única, sem comissão recorrente",
              "BMs, contas, perfis e páginas vendidas individualmente",
              "Pagamento via PIX com entrega imediata",
              "Ideal para quem já tem operação e precisa repor ativos",
            ]}
            forWho="Gestor que precisa de reposição pontual"
            ctaLabel="Ver Marketplace"
            ctaTo={withUtm("/marketplace")}
            onCta={() => trackChoice("marketplace")}
          />

          {/* Aluguel */}
          <ChoiceCard
            icon={InfinityIcon}
            eyebrow="Estrutura completa"
            title="Aluguel de Contas"
            subtitle="Contas infinitas com créditos de US$ 240"
            bullets={[
              "US$ 240 viram crédito para pagar a AD SCALE",
              "Reposição automática quando a Meta bloquear",
              "Comissão semanal de 5% (pode cair até 1%)",
              "Painel ao vivo e suporte humano dedicado",
            ]}
            forWho="Operação em escala que quer terceirizar a estrutura"
            ctaLabel="Conhecer o Aluguel"
            ctaTo={withUtm("/aluguel-de-contas")}
            onCta={() => trackChoice("aluguel")}
            highlight
          />
        </div>
      </section>

      {/* TABELA COMPARATIVA */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div {...fadeUp} className="text-center mb-10">
          <span className="text-[11px] uppercase tracking-[0.32em] text-primary/80">Comparativo</span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mt-3 tracking-tight">
            Marketplace <span className="text-muted-foreground font-normal">vs</span> Aluguel de Contas
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            Critério a critério, veja qual modelo encaixa melhor no momento da sua operação.
          </p>
        </motion.div>

        <motion.div {...fadeUp} className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-background/40">
                  <th className="text-left font-semibold px-5 py-4 w-[34%]">Critério</th>
                  <th className="text-left font-semibold px-5 py-4">
                    <div className="flex items-center gap-2"><ShoppingBag size={16} className="text-primary" /> Marketplace</div>
                  </th>
                  <th className="text-left font-semibold px-5 py-4">
                    <div className="flex items-center gap-2"><InfinityIcon size={16} className="text-primary" /> Aluguel</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { c: "Custo inicial", m: "Valor do ativo (avulso, via PIX)", a: "US$ 240 — vira crédito de mídia" },
                  { c: "Periodicidade de pagamento", m: "Pagamento único por compra", a: "Semanal (sexta a quinta), em USD" },
                  { c: "Comissão recorrente", m: <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Minus size={14} /> Não há</span>, a: "5% sobre o ad spend (cai até 1%)" },
                  { c: "Reposição em caso de bloqueio", m: <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Minus size={14} /> Nova compra</span>, a: <span className="inline-flex items-center gap-1.5"><Check size={14} className="text-primary" /> Automática e ilimitada</span> },
                  { c: "Painel ao vivo + suporte dedicado", m: <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Minus size={14} /> Self-service</span>, a: <span className="inline-flex items-center gap-1.5"><Check size={14} className="text-primary" /> Incluso</span> },
                  { c: "Entrega", m: "Imediata após o PIX", a: "Setup guiado em até 24h úteis" },
                  { c: "Fidelidade", m: "Nenhuma", a: "Nenhuma" },
                  { c: "Melhor cenário", m: "Operação madura que só precisa repor ativos pontualmente", a: "Quem está escalando e quer terceirizar bloqueios, reposições e gestão de estrutura" },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-background/30 transition">
                    <td className="px-5 py-4 font-medium text-foreground/90 align-top">{row.c}</td>
                    <td className="px-5 py-4 text-foreground/80 align-top">{row.m}</td>
                    <td className="px-5 py-4 text-foreground/80 align-top">{row.a}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.h2 {...fadeUp} className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-center">
          Perguntas frequentes
        </motion.h2>
        <div className="mt-10 space-y-3">
          {[
            {
              q: "Qual modelo é melhor para mim?",
              a: "Se você já tem operação rodando e só precisa repor uma conta ou BM bloqueada, o Marketplace resolve em minutos. Se quer terceirizar toda a estrutura, ter reposição automática e escalar sem se preocupar com bloqueios, o Aluguel é o caminho.",
            },
            {
              q: "Posso usar os dois ao mesmo tempo?",
              a: "Sim. Muitos clientes do Aluguel também compram ativos avulsos no Marketplace para necessidades específicas — os dois modelos convivem na mesma conta.",
            },
            {
              q: "Como funciona o pagamento?",
              a: "Marketplace: pagamento único via PIX. Aluguel: setup inicial de US$ 240 (vira crédito) e cobrança semanal em USD via PIX, cripto ou Payoneer.",
            },
            {
              q: "Tem fidelidade?",
              a: "Nenhum dos dois modelos tem fidelidade. Você opera enquanto fizer sentido para o seu negócio.",
            },
          ].map((item, i) => (
            <motion.details
              key={i}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.03 }}
              className="group rounded-xl border border-border/60 bg-card/40 backdrop-blur-xl p-5 open:bg-card/70 transition"
            >
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-semibold">
                {item.q}
                <span className="text-primary text-xl leading-none group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{item.a}</p>
            </motion.details>
          ))}
        </div>
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
            <a href="/advertising-policy.html" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition">Política de Publicidade</a>
            <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition">Privacidade</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

const ChoiceCard: React.FC<{
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  subtitle: string;
  bullets: string[];
  forWho: string;
  ctaLabel: string;
  ctaTo: string;
  highlight?: boolean;
  onCta?: () => void;
}> = ({ icon: Icon, eyebrow, title, subtitle, bullets, forWho, ctaLabel, ctaTo, highlight, onCta }) => (
  <motion.div
    {...fadeUp}
    className={`relative rounded-2xl border ${highlight ? "border-primary/40" : "border-border/60"} bg-card/60 backdrop-blur-xl p-6 sm:p-8 flex flex-col hover:border-primary/50 transition overflow-hidden`}
  >
    {highlight && (
      <>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <span className="absolute top-4 right-4 text-[10px] uppercase tracking-[0.28em] text-primary border border-primary/40 bg-primary/10 rounded-full px-2.5 py-1">
          Mais escolhido
        </span>
      </>
    )}
    <div className="relative">
      <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 text-primary grid place-items-center mb-4">
        <Icon size={22} aria-hidden />
      </div>
      <span className="text-[10px] uppercase tracking-[0.32em] text-primary/80">{eyebrow}</span>
      <h2 className="font-display text-2xl sm:text-3xl font-bold mt-2 tracking-tight">{title}</h2>
      <p className="text-muted-foreground mt-2">{subtitle}</p>

      <ul className="mt-6 space-y-2.5">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-sm text-foreground/90">
            <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" aria-hidden />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-lg border border-border/60 bg-background/40 px-3.5 py-2.5 text-xs text-muted-foreground">
        <span className="text-foreground/70 font-semibold">Para quem é: </span>
        {forWho}
      </div>

      <Link
        to={ctaTo}
        onClick={onCta}
        className={`mt-7 inline-flex items-center justify-center gap-2 font-semibold px-5 py-3 rounded-xl transition ${
          highlight
            ? "bg-primary text-primary-foreground hover:brightness-110 shadow-[0_0_30px_-8px_hsl(var(--primary))]"
            : "border border-border/60 hover:border-primary/40 text-foreground"
        }`}
      >
        {ctaLabel} <ArrowRight size={16} />
      </Link>
    </div>
  </motion.div>
);

export default EscolhaSeuModelo;
