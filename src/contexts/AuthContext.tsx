import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'support' | 'client';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

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
  }

  return null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Prevent double init in strict mode
    if (initializedRef.current) return;
    initializedRef.current = true;

    let isMounted = true;

    // Load session once on mount
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          const profile = await fetchUserProfile(session.user.id, session.user.email || '');
          if (isMounted) setUser(profile);
        }
      } catch (e) {
        console.error('Error loading session:', e);
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
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          // Use setTimeout to avoid deadlock from calling Supabase inside the callback
          setTimeout(async () => {
            if (!isMounted) return;
            const profile = await fetchUserProfile(session.user.id, session.user.email || '');
            if (isMounted) {
              setUser(profile);
              setLoading(false);
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

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return false;

    const profile = await fetchUserProfile(data.user.id, email);
    if (!profile) {
      await supabase.auth.signOut();
      return false;
    }

    setUser(profile);
    return true;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
