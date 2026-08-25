import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Gift, X, Sparkles, Target, Copy, Check, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { buildReferralLink, useReferralDict, useReferralSummary } from './ReferralProgram';

const STORAGE_PREFIX = 'adscale.referralPopup.';

const dayKey = () => new Date().toISOString().slice(0, 10);

type Props = {
  clientId?: string | null;
  /** Quando true, ignora o "já vi hoje" (usado na demonstração do admin) */
  forceOpen?: boolean;
  onOpenProgram?: () => void;
};

const Confetti: React.FC = () => {
  const pieces = useMemo(
    () => Array.from({ length: 28 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.9,
      duration: 2.4 + Math.random() * 1.8,
      size: 4 + Math.random() * 6,
      rotate: Math.random() * 360,
    })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: -40, opacity: 0, rotate: 0 }}
          animate={{ y: 520, opacity: [0, 1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' }}
          className="absolute bg-primary/70 rounded-sm"
          style={{ left: `${p.left}%`, width: p.size, height: p.size * 1.6 }}
        />
      ))}
    </div>
  );
};

const ReferralPopup: React.FC<Props> = ({ clientId, forceOpen, onOpenProgram }) => {
  const d = useReferralDict();
  const { data, loading } = useReferralSummary(clientId);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const storageKey = `${STORAGE_PREFIX}${clientId || 'self'}`;

  useEffect(() => {
    if (loading || !data?.ok) return;
    if (forceOpen) { setOpen(true); return; }
    try {
      if (localStorage.getItem(storageKey) === dayKey()) return;
    } catch { /* ignore */ }
    const timer = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(timer);
  }, [loading, data?.ok, forceOpen, storageKey]);

  const close = () => {
    setOpen(false);
    try { localStorage.setItem(storageKey, dayKey()); } catch { /* ignore */ }
  };

  const link = data?.referral_code ? buildReferralLink(data.referral_code) : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success(d.copied);
      setTimeout(() => setCopied(false), 2200);
    } catch { /* ignore */ }
  };

  return (
    <AnimatePresence>
      {open && data?.ok && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={close}
          />

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="relative w-full max-w-lg rounded-3xl border border-primary/40 bg-card/95 backdrop-blur-xl p-7 shadow-[0_0_60px_-12px_hsl(var(--primary)/0.55)] overflow-hidden"
          >
            <Confetti />

            {/* halo pulsante */}
            <motion.div
              className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-primary/25 blur-3xl"
              animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.95, 1.08, 0.95] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
            />

            <button onClick={close} aria-label="Fechar"
              className="absolute top-4 right-4 z-10 text-muted-foreground hover:text-foreground transition-colors">
              <X size={18} />
            </button>

            <div className="relative text-center">
              <motion.div
                animate={{ rotate: [-8, 8, -8], y: [0, -4, 0] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                className="mx-auto w-16 h-16 rounded-2xl bg-primary/15 border border-primary/40 flex items-center justify-center text-primary"
              >
                <Gift size={30} />
              </motion.div>

              <p className="mt-4 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.35em] text-primary/80">
                <Sparkles size={11} /> {d.eyebrow}
              </p>
              <h2 className="font-display text-2xl font-bold text-foreground mt-2">{d.title}</h2>
              <p className="text-sm text-muted-foreground mt-2">{d.subtitle}</p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <motion.div
                  animate={{ boxShadow: ['0 0 0 0 hsl(var(--primary)/0)', '0 0 22px -4px hsl(var(--primary)/0.6)', '0 0 0 0 hsl(var(--primary)/0)'] }}
                  transition={{ duration: 2.4, repeat: Infinity }}
                  className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-left"
                >
                  <Gift size={16} className="text-primary" />
                  <div className="text-xl font-extrabold text-primary mt-2">US$ 20</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{d.step1Title}</div>
                </motion.div>
                <motion.div
                  animate={{ boxShadow: ['0 0 0 0 hsl(var(--primary)/0)', '0 0 22px -4px hsl(var(--primary)/0.6)', '0 0 0 0 hsl(var(--primary)/0)'] }}
                  transition={{ duration: 2.4, repeat: Infinity, delay: 1.2 }}
                  className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-left"
                >
                  <Target size={16} className="text-primary" />
                  <div className="text-xl font-extrabold text-primary mt-2">US$ 50</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{d.step2Title}</div>
                </motion.div>
              </div>

              {link && (
                <div className="mt-5 flex items-center gap-2 rounded-xl bg-secondary/50 border border-border px-3 py-2">
                  <span className="flex-1 min-w-0 truncate text-[11px] font-mono text-foreground/80 text-left">{link}</span>
                  <button onClick={copy} className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-primary hover:brightness-125">
                    {copied ? <Check size={13} /> : <Copy size={13} />} {d.copy}
                  </button>
                </div>
              )}

              <div className="mt-5 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => { onOpenProgram?.(); close(); }}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:brightness-110 active:scale-[0.98] transition-all"
                >
                  {d.eyebrow} <ArrowRight size={15} />
                </button>
                <button onClick={close}
                  className="sm:w-32 bg-secondary/60 border border-border text-sm font-medium py-3 rounded-xl hover:bg-secondary transition-all">
                  {d.statusPending === 'Pendente' ? 'Depois' : d.statusPending === 'Pendiente' ? 'Después' : 'Later'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReferralPopup;
