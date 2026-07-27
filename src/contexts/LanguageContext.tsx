import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n, { SUPPORTED_LANGUAGES, SupportedLanguage, normalizeLanguage, setLanguage as setI18nLang } from '@/i18n';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lng: SupportedLanguage) => Promise<void>;
  supported: readonly SupportedLanguage[];
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

async function loadFromProfile(userId: string, role: string): Promise<SupportedLanguage | null> {
  try {
    // Role-specific tables first
    if (role === 'client') {
      const { data } = await supabase.from('clients').select('preferred_language').eq('auth_user_id', userId).maybeSingle();
      if (data?.preferred_language) return normalizeLanguage(data.preferred_language);
    } else if (role === 'partner') {
      const { data } = await supabase.from('partners').select('preferred_language').eq('auth_user_id', userId).maybeSingle();
      if (data?.preferred_language) return normalizeLanguage(data.preferred_language);
    } else if (role === 'support') {
      const { data } = await supabase.from('support_users').select('preferred_language').eq('auth_user_id', userId).maybeSingle();
      if (data?.preferred_language) return normalizeLanguage(data.preferred_language);
    }
    // Fallback per-auth-user preference (admin, marketplace_client, etc.)
    const { data: pref } = await supabase.from('user_preferences').select('preferred_language').eq('user_id', userId).maybeSingle();
    if (pref?.preferred_language) return normalizeLanguage(pref.preferred_language);
  } catch (e) {
    console.warn('language: could not load profile preference', e);
  }
  return null;
}

async function saveToProfile(userId: string, role: string, lng: SupportedLanguage) {
  try {
    if (role === 'client') {
      await supabase.from('clients').update({ preferred_language: lng }).eq('auth_user_id', userId);
    } else if (role === 'partner') {
      await supabase.from('partners').update({ preferred_language: lng }).eq('auth_user_id', userId);
    } else if (role === 'support') {
      await supabase.from('support_users').update({ preferred_language: lng }).eq('auth_user_id', userId);
    }
    // Always mirror in user_preferences as canonical fallback
    await supabase.from('user_preferences').upsert({ user_id: userId, preferred_language: lng }, { onConflict: 'user_id' });
  } catch (e) {
    console.warn('language: could not save profile preference', e);
  }
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useTranslation(); // ensures i18n is initialized
  const { user } = useAuth();
  const [language, setLanguageState] = useState<SupportedLanguage>(() => normalizeLanguage(i18n.language));

  // Sync from auth profile whenever the user changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // No user: keep whatever detector picked (localStorage or browser).
      if (!user) return;
      // If user already saved a preference, prefer it. Otherwise persist current (auto-detected).
      const authUserId = await getAuthUserId();
      if (!authUserId) return;
      const stored = await loadFromProfile(authUserId, user.role);
      if (cancelled) return;
      if (stored) {
        setI18nLang(stored);
        setLanguageState(stored);
      } else {
        // Persist the auto-detected language into the profile so it follows the user across devices.
        const current = normalizeLanguage(i18n.language);
        await saveToProfile(authUserId, user.role, current);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const setLanguage = useCallback(async (lng: SupportedLanguage) => {
    setI18nLang(lng);
    setLanguageState(lng);
    document.documentElement.lang = lng;
    if (user) {
      const authUserId = await getAuthUserId();
      if (authUserId) await saveToProfile(authUserId, user.role, lng);
    }
  }, [user]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, supported: SUPPORTED_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
};

async function getAuthUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch { return null; }
}

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
