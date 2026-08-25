import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, X, GraduationCap, Sparkles } from 'lucide-react';

export type TourTab = 'resumo' | 'contrato' | 'cobrancas' | 'estrutura' | 'suporte' | 'indicacao';

type Step = {
  target: string;
  tab?: TourTab;
  title: string;
  body: string;
};

type Dict = {
  title: string;
  subtitle: string;
  start: string;
  skip: string;
  next: string;
  prev: string;
  finish: string;
  stepOf: (a: number, b: number) => string;
  restart: string;
  steps: Step[];
};

const DICTS: Record<'pt' | 'en' | 'es', Dict> = {
  pt: {
    title: 'Tour da plataforma',
    subtitle: 'Um passo a passo rápido para você entender cada número e onde pedir ajuda.',
    start: 'Começar tour',
    skip: 'Agora não',
    next: 'Próximo',
    prev: 'Voltar',
    finish: 'Concluir',
    stepOf: (a, b) => `Passo ${a} de ${b}`,
    restart: 'Tutorial',
    steps: [
      { target: '[data-tour="hero"]', tab: 'resumo', title: 'Seu painel', body: 'Aqui ficam suas boas-vindas e o status geral da sua operação. Tudo é atualizado automaticamente com os dados das contas de anúncio.' },
      { target: '[data-tour="tabs"]', tab: 'resumo', title: 'Navegação', body: 'Cada aba mostra uma parte da operação: Resumo, Contrato, Estrutura, Suporte, Cobranças e Indicação.' },
      { target: '[data-tour="kpis"]', tab: 'resumo', title: 'Métricas do período', body: 'Gasto em anúncios e comissão calculados no período escolhido. A semana de faturamento vai de sexta a quinta.' },
      { target: '[data-tour="tab-estrutura"]', tab: 'estrutura', title: 'Sua estrutura', body: 'Lista das contas de anúncio e páginas atribuídas a você, com o gasto de cada uma. Contas sem acesso aparecem separadas.' },
      { target: '[data-tour="tab-cobrancas"]', tab: 'cobrancas', title: 'Cobranças', body: 'Comissões por semana fechada, o que já foi pago e o que está pendente ou atrasado. O vencimento é sempre na sexta seguinte ao fechamento.' },
      { target: '[data-tour="tab-suporte"]', tab: 'suporte', title: 'Suporte', body: 'Peça novas contas de anúncio, páginas ou BM por aqui. Você acompanha o status de cada solicitação em tempo real.' },
      { target: '[data-tour="tab-indicacao"]', tab: 'indicacao', title: 'Programa de indicação', body: 'Gere seu link, indique parceiros e ganhe US$ 20 por cadastro e US$ 50 a cada US$ 1.000 pagos pelo indicado.' },
      { target: '[data-tour="lang"]', title: 'Idioma e tema', body: 'Troque entre português, inglês e espanhol e alterne entre tema claro e escuro quando quiser.' },
      { target: '[data-tour="tour-btn"]', title: 'Tudo pronto!', body: 'Você pode reabrir este tutorial a qualquer momento por este botão.' },
    ],
  },
  en: {
    title: 'Platform tour',
    subtitle: 'A quick walkthrough so you understand every number and where to ask for help.',
    start: 'Start tour',
    skip: 'Not now',
    next: 'Next',
    prev: 'Back',
    finish: 'Finish',
    stepOf: (a, b) => `Step ${a} of ${b}`,
    restart: 'Tutorial',
    steps: [
      { target: '[data-tour="hero"]', tab: 'resumo', title: 'Your dashboard', body: 'Your welcome area and overall account status. Everything updates automatically from your ad accounts.' },
      { target: '[data-tour="tabs"]', tab: 'resumo', title: 'Navigation', body: 'Each tab covers one part of the operation: Overview, Contract, Structure, Support, Billing and Referrals.' },
      { target: '[data-tour="kpis"]', tab: 'resumo', title: 'Period metrics', body: 'Ad spend and commission for the selected period. The billing week runs Friday through Thursday.' },
      { target: '[data-tour="tab-estrutura"]', tab: 'estrutura', title: 'Your structure', body: 'All ad accounts and pages assigned to you, with spend per account. Accounts that lost access are listed separately.' },
      { target: '[data-tour="tab-cobrancas"]', tab: 'cobrancas', title: 'Billing', body: 'Commissions per closed week, what has been paid and what is pending or overdue. Payment is due the Friday after the week closes.' },
      { target: '[data-tour="tab-suporte"]', tab: 'suporte', title: 'Support', body: 'Request new ad accounts, pages or BMs here and track the status of each request in real time.' },
      { target: '[data-tour="tab-indicacao"]', tab: 'indicacao', title: 'Referral program', body: 'Generate your link, refer partners and earn US$ 20 per signup plus US$ 50 for every US$ 1,000 they pay.' },
      { target: '[data-tour="lang"]', title: 'Language and theme', body: 'Switch between Portuguese, English and Spanish, and toggle light or dark mode anytime.' },
      { target: '[data-tour="tour-btn"]', title: "You're all set!", body: 'You can reopen this tutorial anytime from this button.' },
    ],
  },
  es: {
    title: 'Tour de la plataforma',
    subtitle: 'Un recorrido rápido para entender cada número y dónde pedir ayuda.',
    start: 'Comenzar tour',
    skip: 'Ahora no',
    next: 'Siguiente',
    prev: 'Atrás',
    finish: 'Finalizar',
    stepOf: (a, b) => `Paso ${a} de ${b}`,
    restart: 'Tutorial',
    steps: [
      { target: '[data-tour="hero"]', tab: 'resumo', title: 'Tu panel', body: 'Tu bienvenida y el estado general de la operación. Todo se actualiza automáticamente con los datos de las cuentas publicitarias.' },
      { target: '[data-tour="tabs"]', tab: 'resumo', title: 'Navegación', body: 'Cada pestaña cubre una parte: Resumen, Contrato, Estructura, Soporte, Cobros e Referidos.' },
      { target: '[data-tour="kpis"]', tab: 'resumo', title: 'Métricas del período', body: 'Gasto en anuncios y comisión del período elegido. La semana de facturación va de viernes a jueves.' },
      { target: '[data-tour="tab-estrutura"]', tab: 'estrutura', title: 'Tu estructura', body: 'Cuentas publicitarias y páginas asignadas a ti, con el gasto de cada una. Las cuentas sin acceso aparecen aparte.' },
      { target: '[data-tour="tab-cobrancas"]', tab: 'cobrancas', title: 'Cobros', body: 'Comisiones por semana cerrada, lo pagado y lo pendiente o atrasado. El vencimiento es el viernes siguiente al cierre.' },
      { target: '[data-tour="tab-suporte"]', tab: 'suporte', title: 'Soporte', body: 'Solicita nuevas cuentas publicitarias, páginas o BM y sigue el estado de cada solicitud en tiempo real.' },
      { target: '[data-tour="tab-indicacao"]', tab: 'indicacao', title: 'Programa de referidos', body: 'Genera tu enlace, refiere socios y gana US$ 20 por registro y US$ 50 por cada US$ 1.000 pagados por el referido.' },
      { target: '[data-tour="lang"]', title: 'Idioma y tema', body: 'Cambia entre portugués, inglés y español, y alterna entre tema claro y oscuro cuando quieras.' },
      { target: '[data-tour="tour-btn"]', title: '¡Todo listo!', body: 'Puedes reabrir este tutorial cuando quieras desde este botón.' },
    ],
  },
};

export function useTourDict(): Dict {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'pt').slice(0, 2) as 'pt' | 'en' | 'es';
  return DICTS[lang] || DICTS.pt;
}

const PAD = 8;

type Rect = { top: number; left: number; width: number; height: number };

interface Props {
  storageKey: string;
  open: boolean;
  onClose: () => void;
  onTabChange: (tab: TourTab) => void;
}

const DashboardTour: React.FC<Props> = ({ storageKey, open, onClose, onTabChange }) => {
  const dict = useTourDict();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const steps = dict.steps;
  const step = steps[index];

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  // Troca de aba ao entrar no passo
  useEffect(() => {
    if (!open || !step?.tab) return;
    onTabChange(step.tab);
  }, [open, index]); // eslint-disable-line react-hooks/exhaustive-deps

  const measure = useCallback(() => {
    if (!open || !step) return;
    const el = document.querySelector(step.target) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > window.innerHeight - 80) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [open, step]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const id = window.setInterval(measure, 250);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, measure]);

  const finish = useCallback(() => {
    try { localStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
    onClose();
  }, [storageKey, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, steps.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, finish, steps.length]);

  if (!open || !step) return null;

  const hole = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;

  const cardWidth = Math.min(360, window.innerWidth - 24);
  let cardTop = window.innerHeight / 2 - 120;
  let cardLeft = window.innerWidth / 2 - cardWidth / 2;
  if (hole) {
    const below = hole.top + hole.height + 14;
    const fitsBelow = below + 240 < window.innerHeight;
    cardTop = fitsBelow ? below : Math.max(12, hole.top - 240);
    cardLeft = Math.min(
      Math.max(12, hole.left + hole.width / 2 - cardWidth / 2),
      window.innerWidth - cardWidth - 12,
    );
  }

  const isLast = index === steps.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[120]">
      {/* Overlay com recorte */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px] transition-all" onClick={finish}
        style={hole ? {
          clipPath: `polygon(0% 0%, 0% 100%, ${hole.left}px 100%, ${hole.left}px ${hole.top}px, ${hole.left + hole.width}px ${hole.top}px, ${hole.left + hole.width}px ${hole.top + hole.height}px, ${hole.left}px ${hole.top + hole.height}px, ${hole.left}px 100%, 100% 100%, 100% 0%)`,
        } : undefined}
      />
      {hole && (
        <div
          className="absolute rounded-xl border-2 border-primary pointer-events-none animate-pulse"
          style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height, boxShadow: '0 0 0 9999px rgba(0,0,0,0.02), 0 0 30px hsl(var(--primary) / 0.5)' }}
        />
      )}

      <div
        className="absolute rounded-2xl border border-primary/40 bg-card shadow-2xl p-5"
        style={{ top: cardTop, left: cardLeft, width: cardWidth }}
      >
        <button onClick={finish} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground" aria-label="Fechar">
          <X size={16} />
        </button>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary mb-2">
          <Sparkles size={11} /> {dict.stepOf(index + 1, steps.length)}
        </div>
        <h3 className="font-display text-lg font-bold text-foreground mb-1.5">{step.title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{step.body}</p>

        <div className="mt-4 flex items-center gap-1.5">
          {steps.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-primary' : 'w-1.5 bg-border'}`} />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button onClick={finish} className="text-xs text-muted-foreground hover:text-foreground">{dict.skip}</button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-lg border border-border text-foreground hover:bg-secondary"
              >
                <ChevronLeft size={14} /> {dict.prev}
              </button>
            )}
            <button
              onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
            >
              {isLast ? dict.finish : dict.next} {!isLast && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export const TourButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const dict = useTourDict();
  return (
    <button
      data-tour="tour-btn"
      onClick={onClick}
      title={dict.restart}
      className="inline-flex items-center gap-1.5 p-2 sm:px-2.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary"
    >
      <GraduationCap size={16} />
      <span className="hidden lg:inline text-xs font-medium">{dict.restart}</span>
    </button>
  );
};

export default DashboardTour;
