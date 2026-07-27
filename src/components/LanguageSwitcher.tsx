import React, { useState, useRef, useEffect } from 'react';
import { Languages, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import type { SupportedLanguage } from '@/i18n';
import { cn } from '@/lib/utils';

const FLAGS: Record<SupportedLanguage, string> = { pt: '🇧🇷', en: '🇺🇸', es: '🇪🇸' };
const SHORT: Record<SupportedLanguage, string> = { pt: 'PT', en: 'EN', es: 'ES' };

interface Props {
  variant?: 'ghost' | 'solid';
  className?: string;
  align?: 'left' | 'right';
}

const LanguageSwitcher: React.FC<Props> = ({ variant = 'ghost', className, align = 'right' }) => {
  const { language, setLanguage, supported } = useLanguage();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        aria-label={t('language.label')}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
          variant === 'solid'
            ? 'bg-secondary/70 border border-border/60 text-foreground hover:border-primary/40'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
        )}
      >
        <Languages size={14} />
        <span className="hidden sm:inline">{FLAGS[language]}</span>
        <span>{SHORT[language]}</span>
      </button>
      {open && (
        <div
          className={cn(
            'absolute z-50 mt-1 min-w-[160px] rounded-lg border border-border/60 bg-card/95 backdrop-blur-xl shadow-lg py-1',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {supported.map(lng => (
            <button
              key={lng}
              onClick={() => { setLanguage(lng); setOpen(false); }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors',
                language === lng ? 'text-primary bg-primary/10' : 'text-foreground hover:bg-secondary/60'
              )}
            >
              <span>{FLAGS[lng]}</span>
              <span className="flex-1">{t(`language.${lng}`)}</span>
              {language === lng && <Check size={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
