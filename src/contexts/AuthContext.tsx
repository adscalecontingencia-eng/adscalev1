import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'support' | 'client' | 'partner' | 'marketplace_client';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions?: string[];
  /** Collaborator of a partner agency (no own client account; uses the Agency Panel only). */
  agencyMember?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
  /** Signed in (e.g. via Google) but no AD SCALE profile yet — must finish signup. */
  needsSignupCompletion: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} demorou demais para responder`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
};

async function fetchUserProfile(authUserId: string, email: string): Promise<User | null> {
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', authUserId);

  if (!roles || roles.length === 0) return null;

  const role = roles[0].role as UserRole;

  if (role === 'admin') {
    return { id: authUserId, email, name: 'AD Scale Admin', role: 'admin' };
  }

  if (role === 'support') {
    const { data: supportUser } = await supabase
      .from('support_users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (supportUser) {
      return {
        id: supportUser.id,
        email: supportUser.email,
        name: supportUser.name,
        role: 'support',
        permissions: supportUser.permissions || [],
      };
    }
  }

  if (role === 'client') {
    const { data: clientUser } = await supabase
      .from('clients')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (clientUser) {
      return {
        id: clientUser.id,
        email: clientUser.email,
        name: clientUser.name,
        role: 'client',
      };
    }
    const { data: member } = await supabase
      .from('agency_members')
      .select('name, email, permissions, active')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (member?.active) {
      return { id: authUserId, email: member.email || email, name: member.name, role: 'client', permissions: member.permissions || [], agencyMember: true };
    }
  }

  if (role === 'partner') {
    const { data: partnerUser } = await supabase
      .from('partners')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (partnerUser) {
      return { id: partnerUser.id, email: partnerUser.email, name: partnerUser.name, role: 'partner' };
    }
  }

  if (role === 'marketplace_client') {
    const { data: authData } = await supabase.auth.getUser();
    const meta = (authData?.user?.user_metadata || {}) as any;
    return {
      id: authUserId,
      email,
      name: meta.name || email.split('@')[0],
      role: 'marketplace_client',
    };
  }

  return null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSignupCompletion, setNeedsSignupCompletion] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Prevent double init in strict mode
    if (initializedRef.current) return;
    initializedRef.current = true;

    let isMounted = true;

    // Load session once on mount
    const initSession = async () => {
      try {
        const { data: { session } } = await withTimeout(supabase.auth.getSession(), 8000, 'Sessão');
        if (session?.user && isMounted) {
          const profile = await withTimeout(fetchUserProfile(session.user.id, session.user.email || ''), 8000, 'Perfil');
          if (isMounted) { setUser(profile); setNeedsSignupCompletion(!profile); }
        }
      } catch (e) {
        console.error('Error loading session:', e);
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initSession();

    // Listen for future auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setNeedsSignupCompletion(false);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          // Use setTimeout to avoid deadlock from calling Supabase inside the callback
          setTimeout(async () => {
            if (!isMounted) return;
            try {
              const profile = await withTimeout(fetchUserProfile(session.user.id, session.user.email || ''), 8000, 'Perfil');
              if (isMounted) { setUser(profile); setNeedsSignupCompletion(!profile); }
            } catch (e) {
              console.error('Error refreshing profile:', e);
              if (isMounted) setUser(null);
            } finally {
              if (isMounted) setLoading(false);
            }
          }, 0);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (rawEmail: string, password: string): Promise<boolean> => {
    // Celulares costumam colocar espaço no fim ou letra maiúscula no e-mail;
    // o cadastro sempre grava o e-mail em minúsculas e sem espaços.
    const email = rawEmail.trim().toLowerCase();
    let { data, error } = await supabase.auth.signInWithPassword({ email, password });
    // Teclados/autopreenchimento às vezes adicionam espaço no fim da senha.
    if ((error || !data.user) && password !== password.trim()) {
      ({ data, error } = await supabase.auth.signInWithPassword({ email, password: password.trim() }));
    }
    if (error || !data.user) return false;

    const profile = await fetchUserProfile(data.user.id, email);
    if (!profile) {
      await supabase.auth.signOut();
      return false;
    }

    setUser(profile);
    setNeedsSignupCompletion(false);
    return true;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  // Google sign-in returns to the site root; send new Google users to finish signup.
  useEffect(() => {
    if (!loading && needsSignupCompletion && !window.location.hash.includes('completar-cadastro')) {
      window.location.hash = '#/completar-cadastro';
    }
  }, [loading, needsSignupCompletion]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading, needsSignupCompletion }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
