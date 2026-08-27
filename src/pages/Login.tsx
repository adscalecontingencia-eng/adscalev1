import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, AlertCircle, Zap } from 'lucide-react';
import AdScaleLogo from '@/components/AdScaleLogo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { useTranslation } from 'react-i18next';
import { getTermsHref } from '@/lib/terms';


const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
);

const Login: React.FC = () => {
  const { login, isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (!loading && isAuthenticated && user) {
      if (next === 'marketplace') return navigate('/marketplace');
      const dest = user.role === 'marketplace_client' ? '/marketplace'
        : user.role === 'client' ? '/client-dashboard'
        : user.role === 'partner' ? '/partner-dashboard'
        : '/dashboard';
      navigate(dest);
    }
  }, [loading, isAuthenticated, user, navigate, next]);

  const signInWithGoogle = async () => {
    setError('');
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin + '/#/completar-cadastro',
    });
    if (result.error) setError((result.error as any).message || 'Erro no Google Sign-In');
  };

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
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-primary/3 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-primary/5" />
      </div>

      <div className="absolute top-4 right-4 z-20"><LanguageSwitcher /></div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10 px-4"
      >
        {/* Brand header — hero */}
        <div className="flex flex-col items-center mb-12">
          <motion.div
            initial={{ scale: 0.85, opacity: 0, filter: 'blur(8px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            transition={{ delay: 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative text-primary"
          >
            {/* radial halo behind the wordmark */}
            <div className="absolute inset-0 -z-10 flex items-center justify-center">
              <div className="w-[420px] h-[180px] bg-primary/15 blur-[80px] rounded-full" />
            </div>
            <div className="absolute inset-0 -z-10 flex items-center justify-center">
              <div className="w-[260px] h-[120px] bg-primary/25 blur-[40px] rounded-full" />
            </div>

            <AdScaleLogo size={typeof window !== 'undefined' && window.innerWidth < 640 ? 44 : 72} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="flex items-center gap-3 mt-7"
          >
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-primary/60" />
            <p className="text-primary/80 text-[10px] uppercase tracking-[0.5em] font-medium">
              Contingency Accounts
            </p>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-primary/60" />
          </motion.div>
        </div>

        {/* Login form */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl p-7 space-y-5 shadow-lg shadow-black/10"
        >
          <div className="text-center mb-2">
            <h2 className="text-lg font-semibold text-foreground">Bem-vindo de volta</h2>
            <p className="text-muted-foreground text-xs mt-1">Faça login para acessar seu painel</p>
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

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">Senha</label>
            <div className="relative group">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-md shadow-primary/20"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Entrando...
              </span>
            ) : (
              'Entrar'
            )}
          </button>

          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            <span className="flex-1 h-px bg-border" /> ou <span className="flex-1 h-px bg-border" />
          </div>

          <button type="button" onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-secondary/60 hover:bg-secondary border border-border rounded-xl py-3 text-sm font-medium transition-all">
            <GoogleIcon /> Continuar com Google
          </button>
        </motion.form>

        <p className="text-center text-muted-foreground text-xs mt-6">
          {t('auth.firstAccess')} <Link to="/signup" className="text-primary hover:underline font-medium">{t('auth.signUpCta')}</Link>
        </p>
        <p className="text-center text-muted-foreground text-xs mt-2">
          {t('auth.forgotQuestion')} <Link to="/forgot-password" className="text-primary hover:underline font-medium">{t('auth.resetCta')}</Link>
        </p>
        <p className="text-center text-muted-foreground text-xs mt-2">
          <Link to="/marketplace" className="text-primary hover:underline font-medium">{t('auth.exploreMarketplace')}</Link>
        </p>
        <p className="text-center text-muted-foreground text-xs mt-2">
          {t('auth.referQuestion')} <Link to="/partner-signup" className="text-primary hover:underline font-medium">{t('auth.becomePartner')}</Link>
        </p>
        <p className="text-center text-muted-foreground text-xs mt-2">
          <a href={getTermsHref(i18n.language)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
            {t('auth.termsOfUse')}
          </a>
        </p>
        <p className="text-center text-muted-foreground/40 text-xs mt-4">
          © {new Date().getFullYear()} AD Scale · {t('auth.rights')}
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
