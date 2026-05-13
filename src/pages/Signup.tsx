import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, AlertCircle, CheckCircle2, ScrollText, ShieldCheck } from "lucide-react";
import AdScaleLogo from "@/components/AdScaleLogo";
import { supabase } from "@/integrations/supabase/client";
import { TERMS_OF_USE_TEXT, TERMS_VERSION } from "@/lib/terms";

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("As senhas não coincidem");
    if (password.length < 8) return setError("Senha precisa de pelo menos 8 caracteres");
    if (!accepted) return setError("Você precisa aceitar o Termo de Uso");

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("client-signup", {
        body: { email, password, accept_terms: true, terms_version: TERMS_VERSION },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
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
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md">
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

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl relative z-10">
        <div className="flex flex-col items-center mb-6 text-primary">
          <AdScaleLogo size={48} />
          <p className="text-primary/70 text-[10px] uppercase tracking-[0.4em] mt-3">Cadastro do Cliente</p>
        </div>

        <form onSubmit={submit}
          className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl shadow-black/30">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Crie sua conta</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Use o e-mail cadastrado pela agência. Caso não tenha um cadastro, fale com seu gerente.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 p-3 rounded-xl">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">E-mail</label>
              <div className="relative group">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                  placeholder="seu@email.com" maxLength={255} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Senha</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                  className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                  placeholder="mín. 8 caracteres" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Confirmar senha</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8}
                  className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                  placeholder="repita a senha" />
              </div>
            </div>
          </div>

          {/* Terms */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground/80">
              <ScrollText size={12} className="text-primary" /> Termo de Uso · {TERMS_VERSION}
            </div>
            <div onScroll={handleScroll}
              className="h-56 overflow-y-auto bg-background/40 border border-border/60 rounded-xl p-4 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap font-mono scrollbar-neon">
              {TERMS_OF_USE_TEXT}
            </div>
            {!scrolledTerms && (
              <p className="text-[10px] text-amber-400/80">Role o termo até o final para habilitar o aceite.</p>
            )}

            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              accepted ? "bg-primary/10 border-primary/40" : "bg-secondary/40 border-border"
            } ${!scrolledTerms ? "opacity-50 pointer-events-none" : ""}`}>
              <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-primary" disabled={!scrolledTerms} />
              <div className="text-xs text-foreground/90">
                <strong className="flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-primary" /> Aceito o Termo de Uso
                </strong>
                <span className="text-muted-foreground">
                  Declaro ter lido e concordo com a isenção de responsabilidade da agência por fraudes e com a coleta de IP, dados de conexão e logs de acesso descritos no item 4.
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
      </motion.div>
    </div>
  );
};

export default Signup;
