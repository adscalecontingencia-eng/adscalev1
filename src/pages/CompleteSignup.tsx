import React, { useEffect, useState } from "react";
import { tr } from '@/i18n';
import { useNavigate } from "react-router-dom";
import { Phone, CheckCircle2, AlertCircle } from "lucide-react";
import AdScaleLogo from "@/components/AdScaleLogo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const CompleteSignup: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading, needsSignupCompletion } = useAuth();
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (user) { navigate("/login"); return; }
    if (!needsSignupCompletion) navigate("/login");
  }, [loading, user, needsSignupCompletion, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const digits = phone.replace(/\D+/g, "");
    if (digits.length < 10) return setError(tr('auth.complete.invalidPhone'));
    setSubmitting(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oauth-complete-signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${sess.session?.access_token || ""}`,
        },
        body: JSON.stringify({ phone: digits }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) throw new Error(data?.error || tr('auth.complete.httpErr', { s: res.status }));
      // Refresh page so AuthContext re-fetches profile with the new role
      window.location.hash = "#/marketplace";
      window.location.reload();
    } catch (e: any) {
      setError(e.message || tr('auth.complete.saveErr'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6 text-primary">
          <AdScaleLogo size={48} />
          <p className="text-primary/70 text-[10px] uppercase tracking-[0.4em] mt-3">{tr('auth.complete.title')}</p>
        </div>

        <form onSubmit={submit} className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-2xl p-6 space-y-4 shadow-2xl">
          <div>
            <h2 className="font-display text-lg font-semibold">{tr('auth.complete.onlyWa')}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {tr('auth.complete.why')}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 p-3 rounded-xl">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{tr('auth.complete.wa')}</label>
            <div className="relative">
              <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="11999998888"
                className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:brightness-110 disabled:opacity-50">
            {submitting ? tr('auth.complete.saving') : tr('auth.complete.finish')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CompleteSignup;
