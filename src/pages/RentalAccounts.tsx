import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, CheckCircle2, Shield, Zap, RefreshCw, HeadphonesIcon, TrendingUp,
  Wallet, Bitcoin, Globe, Calendar, BarChart3, Layers, Sparkles, CreditCard,
  MessageCircle, Users, Ticket, Clock, UserPlus, FileCheck,
} from "lucide-react";
import AdScaleLogo from "@/components/AdScaleLogo";
import dashResumo from "@/assets/landing/dash-resumo.png";
import dashContrato from "@/assets/landing/dash-contrato.png";
import dashCobrancas from "@/assets/landing/dash-cobrancas.png";
import dashSupport from "@/assets/landing/dash-support.jpg";
import dashSupportGroup from "@/assets/landing/dash-support-group.jpg";

const SIGNUP = "/cadastro-agencia";

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5 },
};

const RentalAccounts: React.FC = () => {
  useEffect(() => {
    document.title = "Meta Ad Account Rental — AD SCALE";
    const meta = document.querySelector('meta[name="description"]') || (() => {
      const m = document.createElement("meta");
      m.setAttribute("name", "description");
      document.head.appendChild(m);
      return m;
    })();
    meta.setAttribute(
      "content",
      "Rent verified Meta Business Managers, ad accounts and pages. Live dashboard, weekly billing in USD, dedicated human support. Scale without limits."
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <div className="text-primary notranslate" translate="no">
            <AdScaleLogo size={24} />
          </div>
          <Link
            to={SIGNUP}
            className="inline-flex items-center gap-1.5 sm:gap-2 bg-primary text-primary-foreground text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:brightness-110 transition"
          >
            Get started <ArrowRight size={12} className="sm:hidden" /><ArrowRight size={14} className="hidden sm:inline" />
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 lg:pt-20 pb-12 sm:pb-20 lg:pb-24">
        <motion.div {...fadeUp} className="max-w-3xl">
          <span className="inline-flex items-center gap-2 text-[10px] sm:text-[11px] uppercase tracking-[0.28em] sm:tracking-[0.32em] text-primary/80 border border-primary/30 bg-primary/5 rounded-full px-3 py-1">
            <Sparkles size={12} /> Ad Structure Rental · <span className="notranslate" translate="no">AD SCALE</span>
          </span>
          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold mt-5 leading-[1.1] sm:leading-[1.05] tracking-tight">
            Scale your operation with{" "}
            <span className="text-primary">unlimited ad accounts</span>.
          </h1>
          <p className="mt-4 sm:mt-5 text-sm sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Rent verified agency Business Managers, ad accounts, aged pages and profiles —
            everything you need to run high-volume Meta Ads campaigns without downtime.
          </p>

          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
            <Link
              to={SIGNUP}
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold px-5 sm:px-6 py-3 rounded-xl hover:brightness-110 transition shadow-[0_0_30px_-8px_hsl(var(--primary))] text-sm sm:text-base"
            >
              Create your agency account <ArrowRight size={16} />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 border border-border/60 hover:border-primary/40 text-sm font-medium px-5 py-3 rounded-xl transition"
            >
              How it works
            </a>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Calendar size={13} className="text-primary/80" /> Weekly billing (Friday, USD)</span>
            <span className="inline-flex items-center gap-1.5"><Wallet size={13} className="text-primary/80" /> USDT & Payoneer</span>
            <span className="inline-flex items-center gap-1.5"><HeadphonesIcon size={13} className="text-primary/80" /> Dedicated human support</span>
          </div>
        </motion.div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div {...fadeUp} className="max-w-2xl">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
            How the <span className="text-primary">rental model</span> works
          </h2>
          <p className="mt-3 text-muted-foreground">
            Straightforward and transparent: you get instant access to our ad structure and only
            pay a commission over what you actually spend. No monthly fees, no setup, no lock-in.
          </p>
        </motion.div>

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Layers, title: "1. Request accounts", desc: "Open a ticket from your dashboard to receive the ad accounts, BMs, pages and profiles you need." },
            { icon: Zap, title: "2. Launch campaigns", desc: "We assign the structure to your Business Manager. Start advertising within minutes." },
            { icon: BarChart3, title: "3. Track in real time", desc: "Your ad spend syncs from Meta into our dashboard automatically — no manual reporting." },
            { icon: TrendingUp, title: "4. Weekly settlement", desc: "Every Friday you settle the commission for the previous week (5% of Ad Spend, down to 1%)." },
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

      {/* PRINT 1 — Overview */}
      <DashShowcase
        eyebrow="Client Dashboard"
        title="Track your ad spend, active accounts and commissions in real time"
        desc="Everything that matters in a single screen: active ad accounts, weekly investment, agency commission and account status — all synced directly from the Meta API."
        image={dashResumo}
        align="right"
      />

      {/* WHAT'S INCLUDED */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.h2 {...fadeUp} className="font-display text-3xl sm:text-4xl font-bold tracking-tight max-w-2xl">
          What's <span className="text-primary">included</span>
        </motion.h2>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Shield, t: "Verified BMs", d: "Business Managers ready to scale, with clean history and high spend limits." },
            { icon: CreditCard, t: "Ad accounts", d: "Always-available inventory with fast replacement whenever Meta blocks an account." },
            { icon: Layers, t: "Profiles & pages", d: "Aged profiles and pages ready to publish your creatives without warm-up." },
            { icon: RefreshCw, t: "Automatic replacement", d: "Got blocked? We swap the structure so you never lose traction on your campaigns." },
            { icon: BarChart3, t: "Live dashboard", d: "Your spend, commission and billing visible 24/7 with sync directly from Meta." },
            { icon: HeadphonesIcon, t: "Human support", d: "Dedicated team over WhatsApp and in-app tickets to solve any issue fast." },
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

      {/* PRINT 2 — Contract / Goals */}
      <DashShowcase
        eyebrow="Transparent contract"
        title="Your billing rules and weekly goals always in sight"
        desc="Base commission, progressive weekly goals and billing cycle are always exposed on the dashboard — you know exactly what you'll pay and what to hit to reduce the commission."
        image={dashContrato}
        align="left"
      />

      {/* PRICING */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.h2 {...fadeUp} className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-center">
          Simple <span className="text-primary">pricing</span>
        </motion.h2>
        <motion.p {...fadeUp} className="text-center text-muted-foreground mt-3 max-w-xl mx-auto">
          No monthly fee, no lock-in, no fine print. You only pay a small commission on what you spend.
        </motion.p>

        <motion.div {...fadeUp} className="mt-10 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl overflow-hidden">
          <PricingRow label="Commission" value="5%" hint="On weekly Ad Spend synced from Meta" highlight />
          <PricingRow label="Performance discount" value="down to 1%" hint="Reduces progressively as you hit weekly spend goals" />
          <PricingRow label="Billing cycle" value="Weekly" hint="Week closes Thursday, invoice generated Friday, in USD" />
          <PricingRow label="Payment methods" value="USDT · Payoneer" hint="Crypto (USDT on your preferred network) or international transfer" />
          <PricingRow label="Setup / monthly fee" value="US$ 0" hint="No setup, no monthly fee, no lock-in contract" last />
        </motion.div>
      </section>

      {/* PRINT 3 — Billing */}
      <DashShowcase
        eyebrow="Weekly billing"
        title="Complete billing history — no surprises"
        desc="Overdue balance, current week pending, commissions calculated per account and everything already paid — full auditability inside your dashboard."
        image={dashCobrancas}
        align="right"
      />

      {/* SUPPORT & OPS */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div {...fadeUp} className="max-w-2xl">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
            <span className="text-primary">Support & operations</span> built for scale
          </h2>
          <p className="mt-3 text-muted-foreground">
            Everything happens inside the dashboard — request assets, replace blocked accounts,
            monitor spend and talk to our team without leaving the panel.
          </p>
        </motion.div>

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: HeadphonesIcon, t: "In-app tickets", d: "Open requests for new ad accounts, additional BMs, pages, profiles or proxies directly from your panel." },
            { icon: RefreshCw, t: "Fast replacement", d: "When a Meta block happens, our team replaces the structure without any additional fee." },
            { icon: Shield, t: "Access control", d: "Only you and the users you invite have access — every action is logged for auditability." },
            { icon: Calendar, t: "Billing cycle", d: "Week runs Friday → Thursday. Invoices are generated every Friday for the previous week." },
            { icon: TrendingUp, t: "Progressive commission", d: "The more you spend, the lower your commission — down to 1% for high-volume accounts." },
            { icon: BarChart3, t: "Meta sync engine", d: "We poll the Meta API constantly so spend, blocks and commissions are always up to date." },
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

      {/* SUPPORT — Dedicated group chat */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <motion.div {...fadeUp}>
            <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-primary/80 border border-primary/30 bg-primary/5 rounded-full px-3 py-1">
              <MessageCircle size={12} /> Dedicated group chat
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-4">
              A <span className="text-primary">private group</span> with our team and yours
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              As soon as your operation starts, we create a private group chat with our
              operations squad and the people from your agency who need to be in the loop.
              No shared inbox, no waiting queue — real humans, real-time answers.
            </p>

            <ul className="mt-6 space-y-3">
              {[
                { icon: Users, t: "Multi-member group", d: "Add your media buyers, account managers and ops leads. Everyone stays aligned." },
                { icon: Clock, t: "Fast response times", d: "Business-hours coverage with dedicated agents who already know your account." },
                { icon: UserPlus, t: "Onboarding included", d: "We walk your team through the dashboard, first BM assignment and best practices." },
                { icon: Shield, t: "Escalation channel", d: "Blocked accounts, urgent replacements or Meta issues — escalated the moment they happen." },
              ].map((f) => (
                <li key={f.t} className="flex gap-3">
                  <div className="w-9 h-9 shrink-0 rounded-lg bg-primary/10 border border-primary/30 text-primary grid place-items-center">
                    <f.icon size={16} />
                  </div>
                  <div>
                    <div className="font-display font-semibold text-foreground">{f.t}</div>
                    <div className="text-sm text-muted-foreground">{f.d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div {...fadeUp} className="relative">
            <div className="absolute -inset-4 bg-primary/10 blur-3xl rounded-3xl" />
            <div className="relative rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl overflow-hidden shadow-2xl">
              <img
                src={dashSupportGroup}
                alt="Private group chat between AD SCALE team and client team"
                loading="lazy"
                width={1200}
                height={1008}
                className="w-full h-auto"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* SUPPORT — In-app tickets */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <motion.div {...fadeUp} className="relative order-2 lg:order-1">
            <div className="absolute -inset-4 bg-primary/10 blur-3xl rounded-3xl" />
            <div className="relative rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl overflow-hidden shadow-2xl">
              <img
                src={dashSupport}
                alt="Support tickets dashboard with open requests and conversation thread"
                loading="lazy"
                width={1600}
                height={1008}
                className="w-full h-auto"
              />
            </div>
          </motion.div>

          <motion.div {...fadeUp} className="order-1 lg:order-2">
            <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-primary/80 border border-primary/30 bg-primary/5 rounded-full px-3 py-1">
              <Ticket size={12} /> In-app support tickets
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-4">
              Every request tracked <span className="text-primary">inside the dashboard</span>
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Beyond the group chat, every operational request lives inside your panel — with
              status, priority, history and full audit trail. Nothing gets lost, everything is
              traceable.
            </p>

            <div className="mt-6 grid sm:grid-cols-2 gap-3">
              {[
                { icon: CreditCard, t: "Request Ad Accounts", d: "Ask for new ad accounts assigned to your BM." },
                { icon: Layers, t: "Add Business Manager", d: "Additional BMs whenever your operation grows." },
                { icon: RefreshCw, t: "Replace blocked account", d: "One click to trigger the replacement flow." },
                { icon: FileCheck, t: "Status & history", d: "Open · In progress · Resolved — with timestamps." },
              ].map((f) => (
                <div key={f.t} className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-xl p-4">
                  <f.icon size={18} className="text-primary mb-2" />
                  <div className="font-display font-semibold text-sm">{f.t}</div>
                  <div className="text-xs text-muted-foreground mt-1">{f.d}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
              <MessageCircle size={18} className="text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Every ticket update also pings the private group chat, so your team is
                notified the moment there's progress — no need to refresh anything.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* PAYMENT METHODS */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.h2 {...fadeUp} className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-center">
          Payment <span className="text-primary">methods</span>
        </motion.h2>
        <div className="mt-10 grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {[
            { icon: Bitcoin, t: "Crypto (USDT)", d: "Pay in USDT on your preferred network — instant confirmation, no FX friction." },
            { icon: Globe, t: "Payoneer", d: "International bank transfer via Payoneer for clients worldwide." },
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

      {/* FAQ */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.h2 {...fadeUp} className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-center">
          Frequently asked questions
        </motion.h2>
        <div className="mt-10 space-y-3">
          {[
            { q: "How much does the rental cost?", a: "There is no monthly fee and no setup cost. You only pay a 5% commission over the ad spend of the previous week, which can drop down to 1% based on weekly volume goals." },
            { q: "What happens if Meta blocks an account?", a: "We replace the structure quickly at no extra cost. Your dashboard always shows how many accounts you have available, in use and blocked." },
            { q: "How does the progressive commission work?", a: "The more you spend during the week, the lower your commission rate. Tier thresholds are shown inside the dashboard under 'Weekly discount goals'." },
            { q: "When exactly are you billed?", a: "Weekly cycle: the week closes on Thursday and the invoice is generated on Friday, in USD, for the previous week's spend." },
            { q: "Which payment methods do you accept?", a: "USDT (crypto) on your preferred network and international transfer via Payoneer." },
            { q: "Do I need a long-term contract?", a: "No. There is no lock-in — you run the operation for as long as it makes sense for your business." },
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

      {/* FINAL CTA */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          {...fadeUp}
          className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8 sm:p-12 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.15),transparent_70%)]" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-primary border border-primary/40 bg-primary/10 rounded-full px-3 py-1">
              <CheckCircle2 size={12} /> Start in minutes
            </span>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mt-5 tracking-tight">
              Ready to scale with a{" "}
              <span className="text-primary">real ad structure</span>?
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Create your agency account now and get instant access to verified Meta ad accounts.
            </p>
            <Link
              to={SIGNUP}
              className="mt-8 inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-7 py-3.5 rounded-xl hover:brightness-110 transition shadow-[0_0_40px_-8px_hsl(var(--primary))]"
            >
              Create your agency account <ArrowRight size={16} />
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
            <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition">Terms of Use</a>
            <a href="/advertising-policy.html" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition">Advertising Policy</a>
            <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition">Privacy</a>
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

export default RentalAccounts;
