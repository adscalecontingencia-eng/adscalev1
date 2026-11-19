import React, { useState } from "react";
import { tr } from '@/i18n';
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, AlertCircle, CheckCircle2, Phone, User, ShoppingBag } from "lucide-react";
import AdScaleLogo from "@/components/AdScaleLogo";

const MarketplaceSignup: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError(tr('auth.signup.mismatch'));
    if (password.length < 8) return setError(tr('auth.signup.min8'));
    if (phone.replace(/\D+/g, "").length < 10) return setError(tr('auth.signup.mpPhone'));
    if (!acceptedTerms) return setError(tr('auth.signup.mpTerms'));

    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketplace-signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          email, password, name, phone: phone.replace(/\D+/g, ""),
          terms_accepted: true, terms_version: "marketplace.v1",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) throw new Error(data?.error || tr('auth.signup.httpErr', { s: res.status }));
      setDone(true);
      setTimeout(() => navigate("/login?next=marketplace"), 2500);
    } catch (e: any) {
      setError(e.message || tr('auth.signup.err'));
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
          <h2 className="font-display text-xl font-bold text-foreground mb-2">{tr('auth.signup.done')}</h2>
          <p className="text-sm text-muted-foreground">{tr('auth.signup.redirect')}</p>
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

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl relative z-10">
        <div className="flex flex-col items-center mb-6 text-primary">
          <AdScaleLogo size={typeof window !== "undefined" && window.innerWidth < 640 ? 32 : 48} />
          <p className="text-primary/70 text-[10px] uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
            <ShoppingBag size={12} /> {tr('auth.signup.mpTitle')}
          </p>
        </div>

        <div className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl shadow-black/30">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">{tr('auth.signup.mpCreate')}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {tr('auth.signup.mpDesc')}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 p-3 rounded-xl">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('auth.signup.name')}</label>
                <div className="relative group">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" />
                  <input value={name} onChange={(e) => setName(e.target.value)} required
                    className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                    placeholder={tr('auth.signup.namePh')} maxLength={120} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">E-mail</label>
                <div className="relative group">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                    placeholder={tr('auth.emailPh')} maxLength={255} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{tr('auth.signup.mpWa')}</label>
                <div className="relative group">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} required
                    className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                    placeholder="11999998888" maxLength={20} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{tr('auth.signup.pw')}</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                    className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                    placeholder={tr('auth.signup.pwPh')} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{tr('auth.signup.confirm')}</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8}
                    className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                    placeholder={tr('auth.signup.confirmPh')} />
                </div>
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-primary cursor-pointer shrink-0"
                required
              />
              <span>
                {tr('auth.signup.readAccept')}{" "}
                <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {tr('auth.signup.termsLink')}
                </a>{" "}
                {tr('auth.signup.andThe')}{" "}
                <a href="/advertising-policy.html" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {tr('auth.signup.adPolicy')}
                </a>
                {tr('auth.signup.mpDeclare')}
              </span>
            </label>

            <button type="submit" disabled={submitting || !acceptedTerms}
              className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 disabled:pointer-events-none">
              {submitting ? tr('auth.signup.creating') : tr('auth.signup.mpCreateBtn')}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              {tr('auth.signup.have')} <Link to="/login?next=marketplace" className="text-primary hover:underline">{tr('auth.signup.login')}</Link>
            </p>
            <p className="text-center text-[10px] text-muted-foreground/70">
              {tr('auth.signup.isClient')} <Link to="/signup" className="text-primary hover:underline">{tr('auth.signup.full')}</Link>
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default MarketplaceSignup;
