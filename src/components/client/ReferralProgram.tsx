import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Gift, Copy, Check, Users, DollarSign, Share2, Target, Sparkles, ExternalLink, Link2, TrendingUp,
} from 'lucide-react';

export type ReferralSummary = {
  ok: boolean;
  client_id?: string;
  referral_code?: string;
  totals?: {
    total: number; pending: number; applied: number;
    signup_count: number; milestone_count: number;
  };
  referrals?: Array<{ id: string; name: string; created_at: string; total_paid: number; credits: number }>;
  credits?: Array<{ id: string; type: string; amount: number; status: string; note: string; created_at: string }>;
};

const DICT = {
  pt: {
    eyebrow: 'Programa de indicação',
    title: 'Indique e ganhe créditos',
    subtitle: 'Ganhe US$ 20 por cada agência indicada e mais US$ 50 a cada US$ 1.000 pagos por ela.',
    step1Title: 'US$ 20 por cadastro',
    step1Desc: 'Assim que o indicado finaliza o cadastro pelo seu link, US$ 20 em crédito entram na sua conta.',
    step2Title: 'US$ 50 a cada US$ 1.000',
    step2Desc: 'A cada US$ 1.000 que o indicado pagar à agência, você recebe mais US$ 50 em crédito — sem limite.',
    step3Title: 'Crédito no seu faturamento',
    step3Desc: 'Os créditos são aplicados como desconto nas suas próximas cobranças semanais.',
    linkTitle: 'Seu link de indicação',
    linkHint: 'Compartilhe este link. Quem se cadastrar por ele fica vinculado automaticamente a você.',
    copy: 'Copiar link',
    copied: 'Link copiado!',
    copyCode: 'Copiar código',
    share: 'Compartilhar',
    open: 'Abrir página',
    totalCredits: 'Créditos acumulados',
    pending: 'A aplicar',
    applied: 'Já aplicados',
    referralsCount: 'Indicados',
    yourReferrals: 'Seus indicados',
    noReferrals: 'Você ainda não tem indicados. Compartilhe seu link e comece a acumular créditos.',
    paid: 'Pago à agência',
    credits: 'Créditos gerados',
    nextMilestone: 'Faltam US$ {{v}} para o próximo bônus de US$ 50',
    history: 'Histórico de créditos',
    typeSignup: 'Cadastro',
    typeMilestone: 'Meta US$ 1.000',
    typeManual: 'Ajuste',
    statusPending: 'Pendente',
    statusApplied: 'Aplicado',
    statusCancelled: 'Cancelado',
    loading: 'Carregando programa...',
    unavailable: 'Programa de indicação indisponível no momento.',
    shareText: 'Alugue contas de anúncio com a AD Scale usando meu link:',
  },
  en: {
    eyebrow: 'Referral program',
    title: 'Refer and earn credits',
    subtitle: 'Earn US$ 20 for every agency you refer, plus US$ 50 for each US$ 1,000 they pay.',
    step1Title: 'US$ 20 per signup',
    step1Desc: 'As soon as your referral completes signup through your link, US$ 20 in credit is added to your account.',
    step2Title: 'US$ 50 per US$ 1,000',
    step2Desc: 'For every US$ 1,000 your referral pays the agency, you get another US$ 50 in credit — no cap.',
    step3Title: 'Credit on your invoices',
    step3Desc: 'Credits are applied as a discount on your upcoming weekly invoices.',
    linkTitle: 'Your referral link',
    linkHint: 'Share this link. Anyone who signs up through it is automatically linked to you.',
    copy: 'Copy link',
    copied: 'Link copied!',
    copyCode: 'Copy code',
    share: 'Share',
    open: 'Open page',
    totalCredits: 'Total credits',
    pending: 'To be applied',
    applied: 'Already applied',
    referralsCount: 'Referrals',
    yourReferrals: 'Your referrals',
    noReferrals: 'No referrals yet. Share your link and start earning credits.',
    paid: 'Paid to agency',
    credits: 'Credits earned',
    nextMilestone: 'US$ {{v}} to go until the next US$ 50 bonus',
    history: 'Credit history',
    typeSignup: 'Signup',
    typeMilestone: 'US$ 1,000 milestone',
    typeManual: 'Adjustment',
    statusPending: 'Pending',
    statusApplied: 'Applied',
    statusCancelled: 'Cancelled',
    loading: 'Loading program...',
    unavailable: 'Referral program is unavailable right now.',
    shareText: 'Rent ad accounts with AD Scale using my link:',
  },
  es: {
    eyebrow: 'Programa de referidos',
    title: 'Refiere y gana créditos',
    subtitle: 'Gana US$ 20 por cada agencia referida y US$ 50 por cada US$ 1.000 que ella pague.',
    step1Title: 'US$ 20 por registro',
    step1Desc: 'En cuanto tu referido completa el registro con tu enlace, US$ 20 en crédito entran en tu cuenta.',
    step2Title: 'US$ 50 por cada US$ 1.000',
    step2Desc: 'Por cada US$ 1.000 que tu referido pague a la agencia, recibes US$ 50 más en crédito — sin límite.',
    step3Title: 'Crédito en tu facturación',
    step3Desc: 'Los créditos se aplican como descuento en tus próximas facturas semanales.',
    linkTitle: 'Tu enlace de referido',
    linkHint: 'Comparte este enlace. Quien se registre con él queda vinculado automáticamente a ti.',
    copy: 'Copiar enlace',
    copied: '¡Enlace copiado!',
    copyCode: 'Copiar código',
    share: 'Compartir',
    open: 'Abrir página',
    totalCredits: 'Créditos acumulados',
    pending: 'Por aplicar',
    applied: 'Ya aplicados',
    referralsCount: 'Referidos',
    yourReferrals: 'Tus referidos',
    noReferrals: 'Aún no tienes referidos. Comparte tu enlace y empieza a acumular créditos.',
    paid: 'Pagado a la agencia',
    credits: 'Créditos generados',
    nextMilestone: 'Faltan US$ {{v}} para el próximo bono de US$ 50',
    history: 'Historial de créditos',
    typeSignup: 'Registro',
    typeMilestone: 'Meta US$ 1.000',
    typeManual: 'Ajuste',
    statusPending: 'Pendiente',
    statusApplied: 'Aplicado',
    statusCancelled: 'Cancelado',
    loading: 'Cargando programa...',
    unavailable: 'El programa de referidos no está disponible ahora.',
    shareText: 'Alquila cuentas publicitarias con AD Scale usando mi enlace:',
  },
} as const;

export const useReferralDict = () => {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('en') ? 'en' : i18n.language?.startsWith('es') ? 'es' : 'pt';
  return DICT[lang as keyof typeof DICT];
};

export const buildReferralLink = (code: string) =>
  `${window.location.origin}/#/cadastro-agencia?ref=${encodeURIComponent(code)}&utm_source=referral&utm_medium=affiliate&utm_campaign=indicacao&utm_content=${encodeURIComponent(code)}`;

export const useReferralSummary = (clientId?: string | null) => {
  const [data, setData] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.rpc('get_referral_summary' as any, {
        _client_id: clientId ?? null,
      } as any);
      if (error) throw error;
      setData(res as unknown as ReferralSummary);
    } catch (e) {
      console.warn('[referral] falha ao carregar', e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, reload: load };
};

const money = (v: number, locale: string) =>
  `US$ ${Number(v || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ReferralProgram: React.FC<{ clientId?: string | null }> = ({ clientId }) => {
  const d = useReferralDict();
  const { i18n } = useTranslation();
  const locale = i18n.language?.startsWith('en') ? 'en-US' : i18n.language?.startsWith('es') ? 'es-ES' : 'pt-BR';
  const { data, loading } = useReferralSummary(clientId);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);

  const link = useMemo(() => (data?.referral_code ? buildReferralLink(data.referral_code) : ''), [data?.referral_code]);

  const copy = async (value: string, kind: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      toast.success(d.copied);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('Clipboard');
    }
  };

  const share = async () => {
    const text = `${d.shareText} ${link}`;
    if (navigator.share) {
      try { await navigator.share({ text, url: link }); return; } catch { /* cancelled */ }
    }
    copy(link, 'link');
  };

  if (loading) {
    return <div className="rounded-2xl border border-border/60 bg-card/60 p-8 text-center text-sm text-muted-foreground">{d.loading}</div>;
  }
  if (!data?.ok) {
    return <div className="rounded-2xl border border-border/60 bg-card/60 p-8 text-center text-sm text-muted-foreground">{d.unavailable}</div>;
  }

  const totals = data.totals || { total: 0, pending: 0, applied: 0, signup_count: 0, milestone_count: 0 };
  const referrals = data.referrals || [];
  const credits = data.credits || [];

  const steps = [
    { icon: Gift, title: d.step1Title, desc: d.step1Desc, badge: 'US$ 20' },
    { icon: Target, title: d.step2Title, desc: d.step2Desc, badge: 'US$ 50' },
    { icon: TrendingUp, title: d.step3Title, desc: d.step3Desc, badge: '∞' },
  ];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/12 via-card/70 to-card/60 p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-primary/80">
            <Sparkles size={12} /> {d.eyebrow}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mt-3">{d.title}</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{d.subtitle}</p>
        </div>
      </motion.div>

      {/* How it works */}
      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i }}
            className="rounded-2xl border border-border/60 bg-card/60 p-5 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
                <s.icon size={18} />
              </span>
              <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/25 rounded-full px-2.5 py-1">{s.badge}</span>
            </div>
            <h3 className="text-sm font-semibold text-foreground mt-4">{s.title}</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{s.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Link */}
      <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Link2 size={15} className="text-primary" /> {d.linkTitle}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{d.linkHint}</p>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <div className="flex-1 min-w-0 bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-xs text-foreground/90 font-mono truncate">
            {link}
          </div>
          <div className="flex gap-2">
            <button onClick={() => copy(link, 'link')}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl px-4 py-2.5 hover:brightness-110 transition-all">
              {copied === 'link' ? <Check size={14} /> : <Copy size={14} />} {d.copy}
            </button>
            <button onClick={share}
              className="flex items-center gap-2 bg-secondary/70 border border-border text-xs font-medium rounded-xl px-4 py-2.5 hover:bg-secondary transition-all">
              <Share2 size={14} /> {d.share}
            </button>
            <a href={link} target="_blank" rel="noreferrer"
              className="hidden sm:flex items-center gap-2 bg-secondary/70 border border-border text-xs font-medium rounded-xl px-4 py-2.5 hover:bg-secondary transition-all">
              <ExternalLink size={14} /> {d.open}
            </a>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="uppercase tracking-widest">code</span>
          <button onClick={() => copy(data.referral_code || '', 'code')}
            className="font-mono font-bold text-primary bg-primary/10 border border-primary/25 rounded-lg px-2.5 py-1 hover:bg-primary/15">
            {data.referral_code} {copied === 'code' ? '✓' : ''}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: d.totalCredits, value: money(totals.total, locale), icon: DollarSign },
          { label: d.pending, value: money(totals.pending, locale), icon: Gift },
          { label: d.applied, value: money(totals.applied, locale), icon: Check },
          { label: d.referralsCount, value: String(referrals.length), icon: Users },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-border/60 bg-card/60 p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <k.icon size={12} className="text-primary" /> {k.label}
            </div>
            <div className="text-lg sm:text-xl font-bold text-foreground mt-2">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Referrals list */}
      <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <Users size={15} className="text-primary" /> {d.yourReferrals}
        </div>
        {referrals.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">{d.noReferrals}</p>
        ) : (
          <div className="space-y-2">
            {referrals.map((r) => {
              const remaining = 1000 - (Number(r.total_paid || 0) % 1000);
              const pct = ((Number(r.total_paid || 0) % 1000) / 1000) * 100;
              return (
                <div key={r.id} className="rounded-xl border border-border/50 bg-secondary/30 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{r.name}</span>
                    <span className="text-xs text-primary font-semibold">{money(r.credits, locale)} · {d.credits}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{d.paid}: <strong className="text-foreground/90">{money(r.total_paid, locale)}</strong></span>
                    <span>{d.nextMilestone.replace('{{v}}', remaining.toFixed(2))}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-border/60 overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Credit history */}
      {credits.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
            <DollarSign size={15} className="text-primary" /> {d.history}
          </div>
          <div className="space-y-1.5">
            {credits.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 bg-secondary/20 px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground">
                    {c.type === 'signup' ? d.typeSignup : c.type === 'milestone' ? d.typeMilestone : d.typeManual}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{c.note}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 border ${
                    c.status === 'applied' ? 'text-primary border-primary/30 bg-primary/10'
                      : c.status === 'cancelled' ? 'text-muted-foreground border-border bg-secondary/40'
                      : 'text-warning border-warning/30 bg-warning/10'
                  }`}>
                    {c.status === 'applied' ? d.statusApplied : c.status === 'cancelled' ? d.statusCancelled : d.statusPending}
                  </span>
                  <span className="text-sm font-bold text-foreground">{money(c.amount, locale)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferralProgram;
