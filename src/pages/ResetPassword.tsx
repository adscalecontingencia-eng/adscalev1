import React, { useEffect, useState } from 'react';
import { tr } from '@/i18n';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import AdScaleLogo from '@/components/AdScaleLogo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // PKCE flow: Supabase appends ?code=xxx to the redirect URL.
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        // Clean the code from the URL so refreshes don't retry it.
        url.searchParams.delete('code');
        url.searchParams.delete('reset');
        window.history.replaceState(null, '', url.pathname + url.search + '#/reset-password');
        if (!cancelled) {
          if (error) {
            setError(tr('auth.reset.invalidLink'));
            toast.error(tr('auth.reset.invalidShort'));
          } else {
            setReady(true);
          }
        }
        return;
      }

      // Legacy hash-token flow fallback.
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled && session) setReady(true);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
      }
    });

    init();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      const msg = tr('auth.reset.min6');
      setError(msg);
      toast.error(msg);
      return;
    }
    if (password !== confirm) {
      const msg = tr('auth.reset.mismatch');
      setError(msg);
      toast.error(msg);
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        const msg = error.message || tr('auth.reset.updateErr');
        setError(msg);
        toast.error(tr('auth.reset.cantUpdate'), { description: msg });
      } else {
        setSuccess(true);
        toast.success(tr('auth.reset.updated'), {
          description: tr('auth.reset.redirect'),
        });
        await supabase.auth.signOut();
        setTimeout(() => navigate('/login'), 2500);
      }
    } catch {
      setError(tr('auth.reset.updateErr'));
      toast.error(tr('auth.reset.updateErr'));
    } finally {
      setSubmitting(false);
    }
  };

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
            <h2 className="text-lg font-semibold text-foreground">{tr('auth.reset.title')}</h2>
            <p className="text-muted-foreground text-xs mt-1">{tr('auth.reset.sub')}</p>
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 size={40} className="text-primary" />
              <p className="text-sm text-foreground">{tr('auth.reset.done')}</p>
              <p className="text-xs text-muted-foreground">{tr('auth.reset.redirecting')}</p>
            </div>
          ) : !ready ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              {tr('auth.reset.validating')}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 p-3 rounded-xl">
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground">{tr('auth.reset.newPw')}</label>
                <div className="relative group">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground">{tr('auth.reset.confirm')}</label>
                <div className="relative group">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-md shadow-primary/20"
              >
                {submitting ? tr('auth.reset.saving') : tr('auth.reset.title')}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
