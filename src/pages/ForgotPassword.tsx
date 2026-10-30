import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import AdScaleLogo from '@/components/AdScaleLogo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/?reset=1`,
    });
    if (error) throw error;
    setCooldown(60);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await sendCode();
      setSent(true);
      toast.success('Código enviado!', { description: `Enviamos um código para ${email}` });
    } catch (err: any) {
      const msg = /rate|seconds/i.test(err?.message || '') ? 'Aguarde um minuto antes de pedir outro código.' : (err?.message || 'Erro ao enviar e-mail');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');
    if (password !== confirm) return setError('As senhas não conferem.');
    setSubmitting(true);
    try {
      const { error: vErr } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'recovery' });
      if (vErr) throw new Error('Código inválido ou expirado. Peça um novo código.');
      const { error: uErr } = await supabase.auth.updateUser({ password });
      if (uErr) {
        const m = uErr.message || '';
        throw new Error(/pwned|leak|weak|known/i.test(m) ? 'Essa senha é fraca ou já apareceu em vazamentos. Escolha outra, misturando letras, números e símbolos.' : m);
      }
      await supabase.auth.signOut();
      toast.success('Senha alterada! Entre com a nova senha.');
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Erro ao redefinir senha');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-primary/3 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10 px-4"
      >
        <div className="flex flex-col items-center mb-10 text-primary">
          <AdScaleLogo size={typeof window !== 'undefined' && window.innerWidth < 640 ? 44 : 64} />
        </div>

        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl p-7 space-y-5 shadow-lg shadow-black/10">
          <div className="text-center mb-2">
            <h2 className="text-lg font-semibold text-foreground">Recuperar senha</h2>
            <p className="text-muted-foreground text-xs mt-1">
              {sent ? 'Digite o código recebido no e-mail e sua nova senha' : 'Digite seu e-mail e enviaremos um código para redefinir sua senha'}
            </p>
          </div>

          {sent ? (
            <form onSubmit={handleReset} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 p-3 rounded-xl">
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 size={14} className="text-primary" /> Código enviado para {email}. Veja também o spam.
              </div>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="Código do e-mail" className={inputCls + ' tracking-[0.4em] text-center font-mono'} required />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Nova senha" className={inputCls} required />
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirmar nova senha" className={inputCls} required />
              <button type="submit" disabled={submitting} className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 shadow-md shadow-primary/20">
                {submitting ? 'Salvando...' : 'Salvar nova senha'}
              </button>
              <button type="button" disabled={cooldown > 0 || submitting} onClick={async () => { setError(''); try { await sendCode(); toast.success('Novo código enviado'); } catch (err: any) { setError(err.message); } }} className="w-full text-xs text-muted-foreground hover:text-primary disabled:opacity-50">
                {cooldown > 0 ? `Reenviar código em ${cooldown}s` : 'Reenviar código'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 p-3 rounded-xl">
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground">E-mail</label>
                <div className="relative group">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-md shadow-primary/20"
              >
                {submitting ? 'Enviando...' : 'Enviar código'}
              </button>
            </form>
          )}

          <Link to="/login" className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft size={14} /> Voltar para o login
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
