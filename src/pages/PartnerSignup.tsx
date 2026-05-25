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
    if (form.password !== form.confirm) return setError("As senhas não coincidem");
    if (form.password.length < 8) return setError("Senha precisa de pelo menos 8 caracteres");
    if (form.name.trim().length < 2) return setError("Informe o seu nome completo");

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

  const inputClass = "w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary";

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4 py-10">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl relative z-10">
        <div className="flex flex-col items-center mb-6 text-primary">
          <AdScaleLogo size={48} />
          <p className="text-primary/70 text-[10px] uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
            <Handshake size={12} /> Programa de Parceiros
          </p>
        </div>

        <form onSubmit={submit} className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl shadow-black/30">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Torne-se um parceiro</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Indique clientes e receba <strong className="text-primary">5% de comissão</strong> sobre cada pagamento gerado.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 p-3 rounded-xl">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nome completo</label>
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required maxLength={120} className={inputClass} placeholder="Seu nome" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">E-mail</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required className={inputClass} placeholder="seu@email.com" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Senha</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required minLength={8} className={inputClass} placeholder="mín. 8 caracteres" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Confirmar senha</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="password" value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))} required minLength={8} className={inputClass} placeholder="repita" />
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">WhatsApp (opcional)</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={form.whatsapp_phone} onChange={e => setForm(p => ({ ...p, whatsapp_phone: e.target.value }))} className={inputClass} placeholder="5511999999999" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Chave Pix (opcional)</label>
              <input value={form.pix_key} onChange={e => setForm(p => ({ ...p, pix_key: e.target.value }))} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" placeholder="CPF, e-mail, telefone…" />
            </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:brightness-110 transition-all disabled:opacity-50">
            {submitting ? "Criando cadastro…" : "Quero ser parceiro"}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Já é parceiro? <Link to="/login" className="text-primary hover:underline">Fazer login</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
};

export default PartnerSignup;
