import LanguageSwitcher from "@/components/LanguageSwitcher";
import { tr } from '@/i18n';
import { trHtml } from "@/i18n";
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, User, Phone, AlertCircle, CheckCircle2, Handshake } from "lucide-react";
import AdScaleLogo from "@/components/AdScaleLogo";

const PartnerSignup: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", whatsapp_phone: "", pix_key: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) return setError(tr('ptn.pwMismatch'));
    if (form.password.length < 8) return setError(tr('ptn.pwMin'));
    if (form.name.trim().length < 2) return setError(tr('ptn.nameReq'));

    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partner-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          whatsapp_phone: form.whatsapp_phone || null,
          pix_key: form.pix_key || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) throw new Error(data?.error || tr('ptn.httpErr', { status: res.status }));
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (e: any) {
      setError(e.message || tr('ptn.signupErr'));
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
          <h2 className="font-display text-xl font-bold text-foreground mb-2">{tr('ptn.done')}</h2>
          <p className="text-sm text-muted-foreground">{tr('ptn.redirecting')}</p>
        </motion.div>
      </div>
    );
  }

  const inputClass = "w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary";

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4 py-10">
      <LanguageSwitcher variant="solid" className="absolute top-4 right-4 z-20" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl relative z-10">
        <div className="flex flex-col items-center mb-6 text-primary">
          <AdScaleLogo size={48} />
          <p className="text-primary/70 text-[10px] uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
            <Handshake size={12} /> {tr('ptn.program')}
          </p>
        </div>

        <form onSubmit={submit} className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl shadow-black/30">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">{tr('ptn.become')}</h2>
            <p className="text-xs text-muted-foreground mt-1" dangerouslySetInnerHTML={{ __html: trHtml('ptn.pitch') }} />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 p-3 rounded-xl">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{tr('ptn.fullName')}</label>
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required maxLength={120} className={inputClass} placeholder={tr('ptn.namePh')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">E-mail</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required className={inputClass} placeholder={tr('auth.emailPh')} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{tr('ptn.password')}</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required minLength={8} className={inputClass} placeholder={tr('ptn.pwPh')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{tr('ptn.confirmPw')}</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="password" value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} required minLength={8} className={inputClass} placeholder={tr('auth.repeatPh')} />
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{tr('ptn.wa')}</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={form.whatsapp_phone} onChange={e => setForm(p => ({ ...p, whatsapp_phone: e.target.value }))} className={inputClass} placeholder="5511999999999" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{tr('ptn.pix')}</label>
              <input value={form.pix_key} onChange={e => setForm(p => ({ ...p, pix_key: e.target.value }))} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" placeholder={tr('ptn.pixPh')} />
            </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:brightness-110 transition-all disabled:opacity-50">
            {submitting ? tr('ptn.creating') : tr('ptn.want')}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            {tr('ptn.already')} <Link to="/login" className="text-primary hover:underline">{tr('ptn.login')}</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
};

export default PartnerSignup;
