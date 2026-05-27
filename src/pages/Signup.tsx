import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, AlertCircle, CheckCircle2, ScrollText, ShieldCheck, Phone, User } from "lucide-react";
import AdScaleLogo from "@/components/AdScaleLogo";
import { TERMS_OF_USE_TEXT, TERMS_VERSION } from "@/lib/terms";
import { lovable } from "@/integrations/lovable";

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
);

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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

  const signInWithGoogle = async () => {
    setError("");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/#/completar-cadastro",
    });
    if (result.error) setError((result.error as any).message || "Erro no Google Sign-In");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("As senhas não coincidem");
    if (password.length < 8) return setError("Senha precisa de pelo menos 8 caracteres");
    if (phone.replace(/\D+/g, "").length < 10) return setError("Telefone (WhatsApp) é obrigatório com DDD");
    if (!accepted) return setError("Você precisa aceitar o Termo de Uso");

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
          accept_terms: true,
          terms_version: TERMS_VERSION,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) throw new Error(data?.error || `Erro no cadastro (HTTP ${res.status})`);
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (e: any) {
      setError(e.message || "Erro no cadastro");
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
          <h2 className="font-display text-xl font-bold text-foreground mb-2">Cadastro concluído</h2>
          <p className="text-sm text-muted-foreground">Redirecionando para o login…</p>
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

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl relative z-10">
        <div className="flex flex-col items-center mb-6 text-primary">
          <AdScaleLogo size={48} />
          <p className="text-primary/70 text-[10px] uppercase tracking-[0.4em] mt-3">Cadastro do Cliente</p>
        </div>

        <div className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl shadow-black/30">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Crie sua conta</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Cadastre-se com Google ou com email/senha. O número de WhatsApp é obrigatório para suporte.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 p-3 rounded-xl">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-secondary/60 hover:bg-secondary border border-border rounded-xl py-3 text-sm font-medium transition-all"
          >
            <GoogleIcon /> Continuar com Google
          </button>

          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            <span className="flex-1 h-px bg-border" /> ou com email <span className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Nome</label>
                <div className="relative group">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" />
                  <input value={name} onChange={(e) => setName(e.target.value)} required
                    className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                    placeholder="Seu nome" maxLength={120} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">E-mail</label>
                <div className="relative group">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                    placeholder="seu@email.com" maxLength={255} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">WhatsApp (com DDD) *</label>
                <div className="relative group">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} required
                    className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                    placeholder="11999998888" maxLength={20} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Senha</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                    className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                    placeholder="mín. 8 caracteres" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Confirmar senha</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8}
                    className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                    placeholder="repita a senha" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground/80">
                <ScrollText size={12} className="text-primary" /> Termo de Uso · {TERMS_VERSION}
              </div>
              <div onScroll={handleScroll}
                className="h-44 overflow-y-auto bg-background/40 border border-border/60 rounded-xl p-4 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap font-mono scrollbar-neon">
                {TERMS_OF_USE_TEXT}
              </div>
              {!scrolledTerms && <p className="text-[10px] text-amber-400/80">Role o termo até o final para habilitar o aceite.</p>}

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                accepted ? "bg-primary/10 border-primary/40" : "bg-secondary/40 border-border"
              } ${!scrolledTerms ? "opacity-50 pointer-events-none" : ""}`}>
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-primary" disabled={!scrolledTerms} />
                <div className="text-xs text-foreground/90">
                  <strong className="flex items-center gap-1.5">
                    <ShieldCheck size={12} className="text-primary" /> Aceito o Termo de Uso
                  </strong>
                  <span className="text-muted-foreground">
                    Declaro ter lido e concordo com a isenção de responsabilidade da agência e com a coleta de IP, dados de conexão e logs de acesso.
                  </span>
                </div>
              </label>
            </div>

            <button type="submit" disabled={submitting || !accepted}
              className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 disabled:pointer-events-none">
              {submitting ? "Criando cadastro…" : "Finalizar Cadastro"}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Já tem conta? <Link to="/login" className="text-primary hover:underline">Fazer login</Link>
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;
