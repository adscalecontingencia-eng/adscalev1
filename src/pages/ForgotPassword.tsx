import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/?reset=1`,
      });
      if (error) {
        const msg = error.message || 'Erro ao enviar e-mail';
        setError(msg);
        toast.error('Não foi possível enviar o e-mail', { description: msg });
      } else {
        setSent(true);
        toast.success('E-mail enviado!', {
          description: `Enviamos o link de recuperação para ${email}`,
        });
      }
    } catch {
      setError('Erro ao enviar e-mail');
      toast.error('Erro ao enviar e-mail');
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
            <h2 className="text-lg font-semibold text-foreground">Recuperar senha</h2>
            <p className="text-muted-foreground text-xs mt-1">
              Digite seu e-mail e enviaremos um link para redefinir sua senha
            </p>
          </div>

          {sent ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 size={40} className="text-primary" />
              <p className="text-sm text-foreground">E-mail enviado!</p>
              <p className="text-xs text-muted-foreground">
                Verifique sua caixa de entrada (e o spam) e clique no link para redefinir sua senha.
              </p>
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
                {submitting ? 'Enviando...' : 'Enviar link de recuperação'}
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
