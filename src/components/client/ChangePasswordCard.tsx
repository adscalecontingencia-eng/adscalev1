import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ChangePasswordCard: React.FC = () => {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (password.length < 6) {
      setError(t('account.passwordTooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('account.passwordMismatch'));
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
        current_password: current,
      });
      if (error) {
        const msg = /current password|senha atual/i.test(error.message)
          ? t('account.wrongCurrentPassword')
          : (error.message || t('account.changeError'));
        setError(msg);
        toast.error(t('account.changeError'), { description: msg });
      } else {
        setSuccess(true);
        setCurrent('');
        setPassword('');
        setConfirm('');
        toast.success(t('account.changeSuccess'));
      }
    } catch {
      setError(t('account.changeError'));
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all';

  return (
    <div className="rounded-xl bg-card border border-border p-5 max-w-lg">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={18} className="text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{t('account.changePasswordTitle')}</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">{t('account.changePasswordDesc')}</p>

      {success && (
        <div className="flex items-center gap-2 text-primary text-sm bg-primary/10 border border-primary/20 p-3 rounded-xl mb-4">
          <CheckCircle2 size={16} className="shrink-0" />
          {t('account.changeSuccess')}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 p-3 rounded-xl">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-muted-foreground">{t('account.currentPassword')}</label>
          <div className="relative group">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="password"
              value={current}
              onChange={e => setCurrent(e.target.value)}
              className={inputCls}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-muted-foreground">{t('account.newPassword')}</label>
          <div className="relative group">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={inputCls}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-muted-foreground">{t('account.confirmPassword')}</label>
          <div className="relative group">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className={inputCls}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none text-sm shadow-md shadow-primary/20"
        >
          {submitting ? t('account.saving') : t('account.savePassword')}
        </button>
      </form>
    </div>
  );
};

export default ChangePasswordCard;
