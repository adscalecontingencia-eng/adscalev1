import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
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
}

const AuthContext = createContext<AuthContextType | null>(null);

const ADMIN_CREDENTIALS = {
  email: 'adscalecontingencia@gmail.com',
  password: '@DSC@LE2026a',
  user: { id: 'admin-1', email: 'adscalecontingencia@gmail.com', name: 'AD Scale Admin', role: 'admin' as UserRole },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('adscale_user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (user) localStorage.setItem('adscale_user', JSON.stringify(user));
    else localStorage.removeItem('adscale_user');
  }, [user]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    // Check admin
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      setUser(ADMIN_CREDENTIALS.user);
      return true;
    }

    // Check support users from Supabase
    const { data: supportUser } = await supabase
      .from('support_users')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .maybeSingle();

    if (supportUser) {
      setUser({
        id: supportUser.id,
        email: supportUser.email,
        name: supportUser.name,
        role: 'support',
        permissions: supportUser.permissions || [],
      });
      return true;
    }

    // Check clients from Supabase
    const { data: clientUser } = await supabase
      .from('clients')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .maybeSingle();

    if (clientUser) {
      setUser({
        id: clientUser.id,
        email: clientUser.email,
        name: clientUser.name,
        role: 'client',
      });
      return true;
    }

    return false;
  }, []);

  const logout = useCallback(() => setUser(null), []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
