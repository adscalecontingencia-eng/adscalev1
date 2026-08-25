import React, { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  AlertCircle,
  CheckCircle2,
  ScrollText,
  ShieldCheck,
  Phone,
  User,
  Briefcase,
  Rocket,
  TrendingUp,
  Users,
  Gift,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import AdScaleLogo from "@/components/AdScaleLogo";
import { TERMS_OF_USE_TEXT, TERMS_VERSION } from "@/lib/terms";
import { useAuth } from "@/contexts/AuthContext";
import { setLanguage, SUPPORTED_LANGUAGES, SupportedLanguage } from "@/i18n";

const AgencySignup: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const [referralCode, setReferralCode] = useState<string>("");
  const [referrerName, setReferrerName] = useState<string>("");

  // Captura do código de indicação (?ref= ou utm_content) e persistência local
  useEffect(() => {
    const raw =
      searchParams.get("ref") ||
      searchParams.get("referral") ||
      searchParams.get("utm_content") ||
      "";
    const code = raw.trim().toUpperCase().slice(0, 32);
    if (code) {
      setReferralCode(code);
      try {
        localStorage.setItem("adscale.referralCode", code);
        localStorage.setItem("adscale.referralSource", searchParams.get("utm_source") || "link");
      } catch {
        /* ignore */
      }
    } else {
      try {
        const stored = localStorage.getItem("adscale.referralCode");
        if (stored) setReferralCode(stored);
      } catch {
        /* ignore */
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!referralCode) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({ action: "check_referral", referral_code: referralCode }),
        });
        const data = await res.json().catch(() => ({}));
        if (active && data?.referrer_name) setReferrerName(data.referrer_name);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, [referralCode]);

  useEffect(() => {
    const lang = searchParams.get("lang");
    if (lang && (SUPPORTED_LANGUAGES as readonly string[]).includes(lang)) {
      setLanguage(lang as SupportedLanguage);
    }
  }, [searchParams]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [niche, setNiche] = useState("");
  const [monthlyInvestment, setMonthlyInvestment] = useState("");
  const [howFoundUs, setHowFoundUs] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [scrolledTerms, setScrolledTerms] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) setScrolledTerms(true);
  };

  const formatCnpj = (raw: string) => {
    const d = raw.replace(/\D+/g, "").slice(0, 14);
    return d
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError(t("agencySignup.errors.passwordMismatch"));
    if (password.length < 8) return setError(t("agencySignup.errors.passwordShort"));
    if (phone.replace(/\D+/g, "").length < 10) return setError(t("agencySignup.errors.phoneRequired"));
    if (companyName.trim().length < 2)
      return setError(t("agencySignup.errors.companyRequired", { defaultValue: "Informe o nome da empresa" }));
    if (cnpj.replace(/\D+/g, "").length !== 14)
      return setError(t("agencySignup.errors.cnpjInvalid", { defaultValue: "CNPJ inválido (14 dígitos)" }));
    if (!niche) return setError(t("agencySignup.errors.nicheRequired", { defaultValue: "Selecione o nicho" }));
    if (!monthlyInvestment)
      return setError(t("agencySignup.errors.investmentRequired", { defaultValue: "Informe o investimento mensal" }));
    if (!howFoundUs.trim())
      return setError(t("agencySignup.errors.howFoundRequired", { defaultValue: "Informe onde conheceu a agência" }));
    if (!accepted) return setError(t("agencySignup.errors.acceptTerms"));

    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          email,
          password,
          name,
          phone: phone.replace(/\D+/g, ""),
          company_name: companyName.trim(),
          cnpj: cnpj.replace(/\D+/g, ""),
          niche,
          monthly_investment: monthlyInvestment,
          how_found_us: howFoundUs.trim(),
          accept_terms: true,
          terms_version: TERMS_VERSION,
          referral_code: referralCode || undefined,
          utm_source: searchParams.get("utm_source") || undefined,
          utm_medium: searchParams.get("utm_medium") || undefined,
          utm_campaign: searchParams.get("utm_campaign") || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) throw new Error(data?.error || t("agencySignup.errors.signupHttp", { status: res.status }));
      setDone(true);
      try { localStorage.removeItem("adscale.referralCode"); } catch { /* ignore */ }
    } catch (e: any) {
      setError(e.message || t("agencySignup.errors.generic"));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center mb-4">
            <CheckCircle2 size={32} className="text-primary" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground mb-2">
            {t("agencySignup.done.pendingTitle", { defaultValue: "Cadastro enviado para aprovação" })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("agencySignup.done.pendingSubtitle", {
              defaultValue:
                "Um administrador vai analisar as suas informações. Você receberá o acesso ao painel assim que o cadastro for aprovado.",
            })}
          </p>
          <Link to="/login" className="inline-block mt-5 text-primary text-sm hover:underline">
            {t("agencySignup.form.doLogin")}
          </Link>
        </motion.div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4 py-10">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-5xl relative z-10 grid lg:grid-cols-[1.1fr_1.4fr] gap-6">
        {/* Side pitch */}
        <div className="hidden lg:flex flex-col justify-between bg-card/60 backdrop-blur-xl border border-border/60 rounded-2xl p-7 shadow-2xl shadow-black/30">
          <div>
            <div className="text-primary"><AdScaleLogo size={42} /></div>
            <p className="text-primary/70 text-[10px] uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
              <Briefcase size={12} /> {t("agencySignup.pitch.eyebrow")}
            </p>
            <h1 className="font-display text-2xl font-bold text-foreground mt-5 leading-tight">
              {t("agencySignup.pitch.titleLead")} <span className="text-primary">{t("agencySignup.pitch.titleHighlight")}</span>.
            </h1>
            <p className="text-sm text-muted-foreground mt-3">
              {t("agencySignup.pitch.subtitle")}
            </p>
          </div>

          <ul className="space-y-3 mt-6 text-sm">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 w-7 h-7 rounded-lg bg-primary/15 border border-primary/40 flex items-center justify-center shrink-0">
                <Rocket size={14} className="text-primary" />
              </span>
              <span className="text-foreground/90" dangerouslySetInnerHTML={{ __html: t("agencySignup.pitch.bullet1") }} />
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 w-7 h-7 rounded-lg bg-primary/15 border border-primary/40 flex items-center justify-center shrink-0">
                <TrendingUp size={14} className="text-primary" />
              </span>
              <span className="text-foreground/90" dangerouslySetInnerHTML={{ __html: t("agencySignup.pitch.bullet2") }} />
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 w-7 h-7 rounded-lg bg-primary/15 border border-primary/40 flex items-center justify-center shrink-0">
                <Users size={14} className="text-primary" />
              </span>
              <span className="text-foreground/90" dangerouslySetInnerHTML={{ __html: t("agencySignup.pitch.bullet3") }} />
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 w-7 h-7 rounded-lg bg-primary/15 border border-primary/40 flex items-center justify-center shrink-0">
                <ShieldCheck size={14} className="text-primary" />
              </span>
              <span className="text-foreground/90" dangerouslySetInnerHTML={{ __html: t("agencySignup.pitch.bullet4") }} />
            </li>
          </ul>

          <div className="mt-6 pt-5 border-t border-border/50 text-[11px] text-muted-foreground">
            <span dangerouslySetInnerHTML={{ __html: t("agencySignup.pitch.marketplaceHintPrefix") }} />{" "}
            <Link to="/marketplace-signup" className="text-primary hover:underline">
              {t("agencySignup.pitch.marketplaceLink")}
            </Link>
            .
          </div>
        </div>

        {/* Form */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl shadow-black/30">
          <div className="lg:hidden flex flex-col items-center text-primary">
            <AdScaleLogo size={typeof window !== "undefined" && window.innerWidth < 640 ? 32 : 42} />
            <p className="text-primary/70 text-[10px] uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
              <Briefcase size={12} /> {t("agencySignup.form.mobileEyebrow")}
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">{t("agencySignup.form.title")}</h2>
            <p className="text-xs text-muted-foreground mt-1">{t("agencySignup.form.subtitle")}</p>
          </div>

          {referralCode && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/10 p-3"
            >
              <Gift size={16} className="text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-foreground/90">
                <strong className="block">
                  {referrerName
                    ? t("agencySignup.referral.invitedBy", { name: referrerName, defaultValue: `Indicado por ${referrerName}` })
                    : t("agencySignup.referral.invited", { defaultValue: "Você chegou por uma indicação" })}
                </strong>
                <span className="text-muted-foreground">
                  {t("agencySignup.referral.code", { defaultValue: "Código" })}:{" "}
                  <span className="font-mono text-primary">{referralCode}</span>
                </span>
              </div>
            </motion.div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 p-3 rounded-xl">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">{t("agencySignup.form.fullName")}</label>
                <div className="relative group">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" />
                  <input value={name} onChange={(e) => setName(e.target.value)} required
                    className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                    placeholder={t("agencySignup.form.fullNamePlaceholder")} maxLength={120} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t("agencySignup.form.email")}</label>
                <div className="relative group">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                    placeholder="your@email.com" maxLength={255} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t("agencySignup.form.whatsapp")}</label>
                <div className="relative group">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} required
                    className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                    placeholder="+1 555 000 0000" maxLength={20} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t("agencySignup.form.password")}</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                    className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                    placeholder={t("agencySignup.form.passwordPlaceholder")} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t("agencySignup.form.confirmPassword")}</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8}
                    className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                    placeholder={t("agencySignup.form.confirmPasswordPlaceholder")} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground/80">
                <ScrollText size={12} className="text-primary" /> {t("agencySignup.terms.heading")} · {TERMS_VERSION}
              </div>
              <div onScroll={handleScroll}
                className="h-44 overflow-y-auto bg-background/40 border border-border/60 rounded-xl p-4 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap font-mono scrollbar-neon">
                {TERMS_OF_USE_TEXT}
              </div>
              {!scrolledTerms && <p className="text-[10px] text-amber-400/80">{t("agencySignup.terms.scrollHint")}</p>}

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                accepted ? "bg-primary/10 border-primary/40" : "bg-secondary/40 border-border"
              } ${!scrolledTerms ? "opacity-50 pointer-events-none" : ""}`}>
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-primary" disabled={!scrolledTerms} />
                <div className="text-xs text-foreground/90">
                  <strong className="flex items-center gap-1.5">
                    <ShieldCheck size={12} className="text-primary" /> {t("agencySignup.terms.acceptTitle")}
                  </strong>
                  <span className="text-muted-foreground">{t("agencySignup.terms.acceptDesc")}</span>
                </div>
              </label>
            </div>

            <button type="submit" disabled={submitting || !accepted}
              className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 disabled:pointer-events-none">
              {submitting ? t("agencySignup.form.submitting") : t("agencySignup.form.submit")}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              {t("agencySignup.form.haveAccount")} <Link to="/login" className="text-primary hover:underline">{t("agencySignup.form.doLogin")}</Link>
            </p>
            <p className="text-center text-[10px] text-muted-foreground/70 lg:hidden">
              {t("agencySignup.form.marketplaceHint")}{" "}
              <Link to="/marketplace-signup" className="text-primary hover:underline">{t("agencySignup.form.marketplaceLink")}</Link>
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default AgencySignup;
