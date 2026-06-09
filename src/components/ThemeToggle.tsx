import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

interface Props { className?: string }

const ThemeToggle: React.FC<Props> = ({ className }) => {
  const { theme, toggle } = useTheme();
  const isLight = theme === 'light';
  return (
    <button
      onClick={toggle}
      title={isLight ? 'Mudar para modo escuro' : 'Mudar para modo claro'}
      aria-label="Alternar tema"
      className={cn(
        "p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary transition-colors",
        className
      )}
    >
      {isLight ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
};

export default ThemeToggle;
