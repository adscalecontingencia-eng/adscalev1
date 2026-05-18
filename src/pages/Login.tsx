import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, AlertCircle, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import shieldLogo from '@/assets/ad-scale-shield.png';

const Login: React.FC = () => {
  const { login, isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (!loading && isAuthenticated && user) {
      navigate(user.role === 'client' ? '/client-dashboard' : '/dashboard');
    }
  }, [loading, isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const success = await login(email, password);
      if (!success) {
        setError('E-mail ou senha incorretos');
        supabase.functions.invoke('record-access', { body: { action: 'login_failed', email } }).catch(() => {});
      } else {
        supabase.functions.invoke('record-access', { body: { action: 'login', email } }).catch(() => {});
      }
    } catch {
      setError('Erro ao fazer login');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <Zap size={32} className="text-primary animate-bounce" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Ambient atmosphere */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsl(var(--primary)/0.05),transparent_70%)]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* Hairlines */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>

      {/* Corner ornaments */}
      <div className="absolute top-8 left-8 hidden md:block">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-muted-foreground/60">
          <span className="w-6 h-px bg-primary/50" />
          <span>Est. 2025</span>
        </div>
      </div>
      <div className="absolute top-8 right-8 hidden md:block">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-muted-foreground/60">
          <span>Private Access</span>
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative z-10 px-6"
      >
        {/* Shield hero */}
        <div className="flex flex-col items-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0, filter: 'blur(12px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            transition={{ delay: 0.1, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            {/* Halos */}
            <div className="absolute inset-0 -z-10 flex items-center justify-center">
              <div className="w-[340px] h-[340px] rounded-full bg-primary/10 blur-[90px]" />
            </div>
            <div className="absolute inset-0 -z-10 flex items-center justify-center">
              <div className="w-[180px] h-[180px] rounded-full bg-primary/20 blur-[50px]" />
            </div>

            <motion.img
              src={shieldLogo}
              alt="AD SCALE"
              className="w-32 h-32 md:w-36 md:h-36 object-contain drop-shadow-[0_0_30px_hsl(var(--primary)/0.35)]"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              translate="no"
            />
          </motion.div>

          {/* Wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="mt-6 flex flex-col items-center"
            translate="no"
          >
            <h1
              className="text-3xl md:text-4xl font-light tracking-[0.35em] text-foreground"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500 }}
            >
              AD <span className="text-primary">·</span> SCALE
            </h1>
            <div className="flex items-center gap-3 mt-4">
              <span className="h-px w-12 bg-gradient-to-r from-transparent to-primary/50" />
              <p className="text-muted-foreground/70 text-[9px] uppercase tracking-[0.6em] font-light">
                Elite Ad Operations
              </p>
              <span className="h-px w-12 bg-gradient-to-l from-transparent to-primary/50" />
            </div>
          </motion.div>
        </div>

        {/* Glass card */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="relative rounded-[20px] p-[1px] bg-gradient-to-b from-primary/40 via-border/40 to-transparent"
        >
          <div className="relative rounded-[19px] bg-card/70 backdrop-blur-2xl p-8 space-y-6 overflow-hidden">
            {/* Inner sheen */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-24 bg-primary/10 blur-3xl" />

            <div className="text-center">
              <h2
                className="text-2xl text-foreground"
                style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500, letterSpacing: '0.02em' }}
              >
                Bem-vindo de volta
              </h2>
              <p className="text-muted-foreground/80 text-xs mt-2 tracking-wide">
                Acesse seu painel exclusivo
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 p-3 rounded-xl"
              >
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </motion.div>
            )}

            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-muted-foreground/80 uppercase tracking-[0.25em]">
                E-mail
              </label>
              <div className="relative group">
                <Mail
                  size={15}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 group-focus-within:text-primary transition-colors"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-background/60 border border-border/60 rounded-xl pl-11 pr-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 focus:bg-background/80 focus:ring-1 focus:ring-primary/20 transition-all"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-muted-foreground/80 uppercase tracking-[0.25em]">
                Senha
              </label>
              <div className="relative group">
                <Lock
                  size={15}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 group-focus-within:text-primary transition-colors"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-background/60 border border-border/60 rounded-xl pl-11 pr-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 focus:bg-background/80 focus:ring-1 focus:ring-primary/20 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="group relative w-full overflow-hidden bg-primary text-primary-foreground font-medium py-3.5 rounded-xl hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.6)]"
            >
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <span className="relative tracking-[0.2em] text-sm uppercase">
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Entrando
                  </span>
                ) : (
                  'Entrar'
                )}
              </span>
            </button>
          </div>
        </motion.form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
        >
          <p className="text-center text-muted-foreground/80 text-xs mt-7 tracking-wide">
            Primeiro acesso?{' '}
            <Link to="/signup" className="text-primary hover:text-primary/80 font-medium transition-colors">
              Solicite seu cadastro
            </Link>
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className="h-px w-8 bg-border" />
            <p className="text-muted-foreground/40 text-[10px] uppercase tracking-[0.4em]">
              © {new Date().getFullYear()} <span translate="no">AD SCALE</span>
            </p>
            <span className="h-px w-8 bg-border" />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Login;
