import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, CheckCircle2, Shield, Zap, RefreshCw, HeadphonesIcon, TrendingUp,
  CreditCard, Wallet, Bitcoin, Globe, Calendar, BarChart3, Layers, Sparkles,
} from "lucide-react";
import AdScaleLogo from "@/components/AdScaleLogo";
import LeadFormModal from "@/components/landing/LeadFormModal";
import dashResumo from "@/assets/landing/dash-resumo.png";
import dashCredito from "@/assets/landing/dash-credito.png";
import dashContrato from "@/assets/landing/dash-contrato.png";
import dashCobrancas from "@/assets/landing/dash-cobrancas.png";

const CTA = "/cadastro-agencia";

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5 },
};

const AluguelDeContas: React.FC = () => {
  useEffect(() => {
    document.title = "Aluguel de contas Meta — AD SCALE";
    const meta = document.querySelector('meta[name="description"]') || (() => {
      const m = document.createElement("meta");
      m.setAttribute("name", "description");
      document.head.appendChild(m);
      return m;
    })();
    meta.setAttribute(
      "content",
      "Aluguel de BMs, contas de anúncio e perfis para gestores de tráfego. Comece com US$ 240 em créditos, cobrança semanal, PIX, cripto e Payoneer."
    );
  }, []);

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
          <Link
            to={CTA}
            className="hidden sm:inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:brightness-110 transition"
          >
            Começar agora <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-20 pb-16 sm:pb-24">
        <motion.div {...fadeUp} className="max-w-3xl">
          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-primary/80 border border-primary/30 bg-primary/5 rounded-full px-3 py-1">
            <Sparkles size={12} /> Aluguel de Estrutura · AD SCALE
          </span>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold mt-5 leading-[1.05] tracking-tight">
            Escale sua operação com{" "}
            <span className="text-primary">estrutura própria</span> de mídia paga.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Aluguel de Business Managers, contas de anúncio, perfis e páginas verificadas para
            gestores de tráfego e agências. Comece com{" "}
            <strong className="text-foreground">US$ 240 em créditos</strong> e só pague comissão
            depois que o crédito for consumido.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to={CTA}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:brightness-110 transition shadow-[0_0_30px_-8px_hsl(var(--primary))]"
            >
              Criar conta de aluguel <ArrowRight size={16} />
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex items-center gap-2 border border-border/60 hover:border-primary/40 text-sm font-medium px-5 py-3 rounded-xl transition"
            >
              Como funciona
            </a>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Calendar size={13} className="text-primary/80" /> Cobrança semanal (sexta)</span>
            <span className="inline-flex items-center gap-1.5"><Wallet size={13} className="text-primary/80" /> PIX, Cripto e Payoneer</span>
            <span className="inline-flex items-center gap-1.5"><HeadphonesIcon size={13} className="text-primary/80" /> Suporte humano dedicado</span>
          </div>
        </motion.div>
      </section>

      {/* CRÉDITO US$ 240 */}
      <section id="como-funciona" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div {...fadeUp} className="max-w-2xl">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
            Como funciona o <span className="text-primary">crédito de US$ 240</span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            Modelo simples e transparente: você paga uma vez no início, vira crédito, e só passa
            a pagar comissão depois que o crédito for totalmente consumido pelo seu próprio gasto.
          </p>
        </motion.div>

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: CreditCard, title: "Setup de US$ 240", desc: "Você paga US$ 240 ao começar — esse valor vira crédito de mídia 1:1." },
            { icon: BarChart3, title: "Crédito é consumido", desc: "Conforme você anuncia, abatemos a comissão semanal do crédito até zerar." },
            { icon: TrendingUp, title: "5% sobre o Ad Spend", desc: "Quando o crédito acaba, passamos a cobrar 5% do gasto da semana." },
            { icon: Zap, title: "Pode cair até 1%", desc: "Bateu metas semanais de spend? A comissão reduz progressivamente." },
          ].map((c, i) => (
            <motion.div
              key={c.title}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.05 }}
              className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 hover:border-primary/40 transition"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 text-primary flex items-center justify-center mb-3">
                <c.icon size={18} />
              </div>
              <h3 className="font-display font-semibold text-foreground">{c.title}</h3>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{c.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* PRINT 1 — Resumo */}
      <DashShowcase
        eyebrow="Painel do cliente"
        title="Acompanhe seu spend, contas ativas e comissões em tempo real"
        desc="Tudo o que importa para a operação em uma única tela: contas ativas, investido na semana, comissão da agência e crédito disponível — sincronizado direto da Meta."
        image={dashResumo}
        align="right"
      />

      {/* O QUE ESTÁ INCLUSO */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.h2 {...fadeUp} className="font-display text-3xl sm:text-4xl font-bold tracking-tight max-w-2xl">
          O que está incluso no <span className="text-primary">aluguel</span>
        </motion.h2>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Shield, t: "BMs verificadas", d: "Business Managers prontos para escalar, com histórico e limites elevados." },
            { icon: CreditCard, t: "Contas de anúncio", d: "Estoque sempre disponível com troca rápida se a Meta bloquear." },
            { icon: Layers, t: "Perfis e páginas", d: "Perfis aquecidos e páginas para vincular seus criativos." },
            { icon: RefreshCw, t: "Reposição automática", d: "Bloqueou? Trocamos a estrutura para você não perder tração." },
            { icon: BarChart3, t: "Dashboard ao vivo", d: "Seu gasto, comissão e cobranças visíveis 24/7 no painel." },
            { icon: HeadphonesIcon, t: "Suporte humano", d: "Time dedicado por WhatsApp para resolver qualquer ocorrência." },
          ].map((f, i) => (
            <motion.div
              key={f.t}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.04 }}
              className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xl p-5 hover:border-primary/40 transition"
            >
              <f.icon size={20} className="text-primary mb-3" />
              <h3 className="font-display font-semibold">{f.t}</h3>
              <p className="text-sm text-muted-foreground mt-1.5">{f.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* PRINT 2 — Crédito */}
      <DashShowcase
        eyebrow="Plano de Crédito"
        title="Veja semana a semana quanto do seu crédito já foi abatido"
        desc="Cada semana mostra o gasto sincronizado, a comissão gerada, quanto foi abatido do crédito e o saldo restante — sem caixa preta."
        image={dashCredito}
        align="left"
      />

      {/* MODELO DE COBRANÇA */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.h2 {...fadeUp} className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-center">
          Modelo de <span className="text-primary">cobrança</span>
        </motion.h2>
        <motion.p {...fadeUp} className="text-center text-muted-foreground mt-3 max-w-xl mx-auto">
          Sem mensalidade, sem fidelidade, sem letras miúdas. Você só paga conforme anuncia.
        </motion.p>

        <motion.div {...fadeUp} className="mt-10 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl overflow-hidden">
          <PricingRow label="Setup inicial" value="US$ 240" hint="Vira crédito de mídia 1:1" highlight />
          <PricingRow label="Após o crédito" value="5%" hint="Sobre o Ad Spend semanal" />
          <PricingRow label="Performance" value="até 1%" hint="Reduz progressivamente conforme metas semanais batidas" />
          <PricingRow label="Ciclo de cobrança" value="Semanal" hint="Toda sexta-feira, em USD" />
          <PricingRow label="Pagamento" value="PIX · Cripto · Payoneer" hint="Você escolhe a forma" last />
        </motion.div>
      </section>

      {/* PRINT 3 — Contrato/Metas */}
      <DashShowcase
        eyebrow="Contrato transparente"
        title="Suas regras de cobrança e metas semanais sempre à vista"
        desc="Percentual base, metas progressivas e ciclo de cobrança ficam expostos no painel — você sempre sabe quanto vai pagar e o que precisa fazer para reduzir a comissão."
        image={dashContrato}
        align="right"
      />

      {/* FORMAS DE PAGAMENTO */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.h2 {...fadeUp} className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-center">
          Formas de <span className="text-primary">pagamento</span>
        </motion.h2>
        <div className="mt-10 grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            { icon: Wallet, t: "PIX", d: "Confirmação instantânea, convertido para USD na hora." },
            { icon: Bitcoin, t: "Cripto (USDT)", d: "Pagamentos em USDT na rede de sua preferência." },
            { icon: Globe, t: "Payoneer", d: "Transferência internacional para clientes fora do Brasil." },
          ].map((p, i) => (
            <motion.div
              key={p.t}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.05 }}
              className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-6 text-center hover:border-primary/40 transition"
            >
              <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 border border-primary/30 text-primary grid place-items-center mb-3">
                <p.icon size={22} />
              </div>
              <h3 className="font-display font-semibold text-foreground">{p.t}</h3>
              <p className="text-sm text-muted-foreground mt-2">{p.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* PRINT 4 — Cobranças */}
      <DashShowcase
        eyebrow="Financeiro semanal"
        title="Histórico completo de cobranças, sem surpresas"
        desc="Saldo atrasado, pendente da semana, comissões calculadas, crédito aplicado e tudo o que já foi pago — auditoria total no seu painel."
        image={dashCobrancas}
        align="left"
      />

      {/* FAQ */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.h2 {...fadeUp} className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-center">
          Perguntas frequentes
        </motion.h2>
        <div className="mt-10 space-y-3">
          {[
            { q: "Como funciona o crédito de US$ 240?", a: "Você paga US$ 240 ao começar e esse valor vira crédito 1:1 dentro da AD SCALE. Conforme você anuncia, a comissão semanal é abatida do crédito até zerar — só depois disso começa a cobrança em dinheiro." },
            { q: "O que acontece se a Meta bloquear uma conta?", a: "Repomos a estrutura rapidamente sem custo adicional. O painel mostra quantas contas você tem disponíveis, em uso e bloqueadas." },
            { q: "Como funciona a meta semanal que reduz para 1%?", a: "Quanto mais você gasta na semana, menor o percentual cobrado. Os patamares ficam visíveis no painel em 'Metas semanais de desconto', podendo chegar a 1% em volumes altos." },
            { q: "Quando exatamente vocês cobram?", a: "Ciclo semanal: a semana fecha na quinta-feira e o pagamento é gerado na sexta seguinte, em USD." },
            { q: "Quais formas de pagamento aceitam?", a: "PIX (conversão automática para USD), cripto (USDT) e transferência internacional via Payoneer." },
            { q: "Preciso de contrato longo?", a: "Não. Não há fidelidade — você opera enquanto fizer sentido para a sua operação." },
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

      {/* CTA FINAL */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          {...fadeUp}
          className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8 sm:p-12 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.15),transparent_70%)]" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-primary border border-primary/40 bg-primary/10 rounded-full px-3 py-1">
              <CheckCircle2 size={12} /> Comece em minutos
            </span>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mt-5 tracking-tight">
              Pronto para escalar com{" "}
              <span className="text-primary">estrutura própria</span>?
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Crie sua conta de aluguel agora e ative seus US$ 240 em créditos de mídia.
            </p>
            <Link
              to={CTA}
              className="mt-8 inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-7 py-3.5 rounded-xl hover:brightness-110 transition shadow-[0_0_40px_-8px_hsl(var(--primary))]"
            >
              Criar conta de aluguel <ArrowRight size={16} />
            </Link>
          </div>
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
            <a href="/advertising-policy.html" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition">Política de Publicidade</a>
            <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition">Privacidade</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

const PricingRow: React.FC<{ label: string; value: string; hint?: string; highlight?: boolean; last?: boolean }> = ({ label, value, hint, highlight, last }) => (
  <div className={`flex items-center justify-between gap-4 px-6 py-5 ${last ? "" : "border-b border-border/60"} ${highlight ? "bg-primary/5" : ""}`}>
    <div>
      <p className="font-display font-semibold text-foreground text-sm sm:text-base">{label}</p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
    <p className={`font-display font-bold text-lg sm:text-xl tabular-nums ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
  </div>
);

const DashShowcase: React.FC<{ eyebrow: string; title: string; desc: string; image: string; align: "left" | "right" }> = ({ eyebrow, title, desc, image, align }) => (
  <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
    <div className={`grid lg:grid-cols-2 gap-8 lg:gap-12 items-center ${align === "left" ? "lg:[&>*:first-child]:order-2" : ""}`}>
      <motion.div {...fadeUp}>
        <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-primary/80">
          <span className="w-6 h-px bg-primary/60" /> {eyebrow}
        </span>
        <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold mt-3 tracking-tight">
          {title}
        </h2>
        <p className="mt-4 text-muted-foreground leading-relaxed">{desc}</p>
      </motion.div>
      <motion.div {...fadeUp} className="relative">
        <div className="absolute -inset-4 bg-primary/10 blur-3xl rounded-full" />
        <div className="relative rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-2 shadow-2xl shadow-black/40 overflow-hidden">
          <img src={image} alt={title} loading="lazy" className="w-full h-auto rounded-xl" />
        </div>
      </motion.div>
    </div>
  </section>
);

export default AluguelDeContas;
