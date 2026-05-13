import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import AdScaleLogo from "@/components/AdScaleLogo";

/**
 * AD SCALE — design-system primitives v2.
 * Use these wrappers to keep every page coherent with the Dashboard hero/panel language.
 */

type PageHeroProps = {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-side content: status pills, CTAs, stats. */
  actions?: React.ReactNode;
  /** Optional small AD SCALE mark in the corner. */
  showMark?: boolean;
  className?: string;
};

export const PageHero: React.FC<PageHeroProps> = ({
  eyebrow,
  title,
  description,
  actions,
  showMark = true,
  className,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: "easeOut" }}
    className={cn(
      "relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card/60 to-background p-6 sm:p-7",
      className,
    )}
  >
    {/* halos */}
    <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/12 blur-[100px] pointer-events-none" />
    <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-primary/[0.04] blur-[100px] pointer-events-none" />
    <div className="absolute inset-0 grid-texture opacity-60 pointer-events-none" />

    <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
      <div className="min-w-0">
        {eyebrow && (
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-primary/80 mb-3">
            <Sparkles size={11} />
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground leading-tight tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {actions}
        {showMark && (
          <div className="hidden md:block text-primary opacity-80">
            <AdScaleLogo size={28} variant="mark" />
          </div>
        )}
      </div>
    </div>
  </motion.div>
);

/* ---------------- Panel ---------------- */

type PanelProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
};

export const Panel: React.FC<PanelProps> = ({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  className,
  bodyClassName,
  noPadding,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, ease: "easeOut" }}
    className={cn(
      "relative rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl hover:border-primary/30 transition-colors",
      noPadding ? "" : "p-5",
      className,
    )}
  >
    {(title || actions) && (
      <div className={cn("flex items-center justify-between gap-3 mb-4", noPadding && "p-5 pb-0")}>
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Icon size={15} />
            </div>
          )}
          <div className="min-w-0">
            {title && (
              <h3 className="font-display text-sm font-semibold text-foreground tracking-wide truncate">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70 mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    )}
    <div className={bodyClassName}>{children}</div>
  </motion.div>
);

/* ---------------- KPI ---------------- */

type Tone = "primary" | "warn" | "danger" | "info" | "muted";

type KpiProps = {
  label: string;
  value: React.ReactNode;
  delta?: string;
  deltaUp?: boolean;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone?: Tone;
  hint?: React.ReactNode;
  className?: string;
};

const toneMap: Record<Tone, { chip: string; ring: string }> = {
  primary: { chip: "bg-primary/10 text-primary", ring: "before:bg-primary/40" },
  warn:    { chip: "bg-amber-500/10 text-amber-400", ring: "before:bg-amber-500/40" },
  danger:  { chip: "bg-destructive/10 text-destructive", ring: "before:bg-destructive/40" },
  info:    { chip: "bg-blue-500/10 text-blue-400", ring: "before:bg-blue-500/40" },
  muted:   { chip: "bg-muted text-muted-foreground", ring: "before:bg-border" },
};

export const Kpi: React.FC<KpiProps> = ({
  label, value, delta, deltaUp, icon: Icon, tone = "primary", hint, className,
}) => {
  const t = toneMap[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 hover:border-primary/40 transition-all",
        "before:content-[''] before:absolute before:-top-px before:left-6 before:right-6 before:h-px",
        t.ring,
        className,
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", t.chip)}>
          <Icon size={18} />
        </div>
        {delta && (
          <div className={cn(
            "text-[11px] font-medium px-2 py-0.5 rounded-full",
            deltaUp ? "text-primary bg-primary/10" : "text-destructive bg-destructive/10",
          )}>
            {delta}
          </div>
        )}
      </div>
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-display font-bold tracking-tight text-foreground">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </motion.div>
  );
};

/* ---------------- Filter pill ---------------- */

export const Pill: React.FC<{
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}> = ({ active, onClick, children, className }) => (
  <button
    onClick={onClick}
    className={cn("pill", active ? "pill-active" : "pill-idle", className)}
  >
    {children}
  </button>
);
