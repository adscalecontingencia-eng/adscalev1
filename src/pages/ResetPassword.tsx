import React, { useEffect, useState } from 'react';
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
    // Supabase v2 puts recovery tokens in the URL hash and auto-creates a recovery session.
    // Listen for PASSWORD_RECOVERY event or check existing session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message || 'Erro ao atualizar senha');
      } else {
        setSuccess(true);
        await supabase.auth.signOut();
        setTimeout(() => navigate('/login'), 2500);
      }
    } catch {
      setError('Erro ao atualizar senha');
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
            <h2 className="text-lg font-semibold text-foreground">Redefinir senha</h2>
            <p className="text-muted-foreground text-xs mt-1">Crie uma nova senha para sua conta</p>
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 size={40} className="text-primary" />
              <p className="text-sm text-foreground">Senha atualizada!</p>
              <p className="text-xs text-muted-foreground">Redirecionando para o login...</p>
            </div>
          ) : !ready ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              Validando link de recuperação...
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
                <label className="block text-xs font-medium text-muted-foreground">Nova senha</label>
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
                <label className="block text-xs font-medium text-muted-foreground">Confirmar senha</label>
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
                {submitting ? 'Salvando...' : 'Redefinir senha'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
