import { useEffect, useState, useCallback } from 'react';

export type Theme = 'dark' | 'light';
const KEY = 'adscale_theme';

const apply = (t: Theme) => {
  const root = document.documentElement;
  if (t === 'light') root.classList.add('light');
  else root.classList.remove('light');
};

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem(KEY) as Theme) || 'dark';
  });

  useEffect(() => { apply(theme); }, [theme]);

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch {}
      return next;
    });
  }, []);

  return { theme, toggle, setTheme };
};

// Apply saved theme as early as possible (before React mounts)
export const initThemeEarly = () => {
  try {
    const t = (localStorage.getItem(KEY) as Theme) || 'dark';
    apply(t);
  } catch {}
};
