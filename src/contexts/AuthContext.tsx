import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

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
  login: (email: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEMO_USERS: { email: string; password: string; user: User }[] = [
  {
    email: 'adscalecontingencia@gmail.com',
    password: '@DSC@LE2026a',
    user: { id: 'admin-1', email: 'adscalecontingencia@gmail.com', name: 'AD Scale Admin', role: 'admin' },
  },
  {
    email: 'cliente1@gmail.com',
    password: 'Cliente1',
    user: { id: 'client-1', email: 'cliente1@gmail.com', name: 'Cliente Demo', role: 'client' },
  },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('adscale_user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (user) localStorage.setItem('adscale_user', JSON.stringify(user));
    else localStorage.removeItem('adscale_user');
  }, [user]);

  const login = useCallback((email: string, password: string) => {
    // Check demo users
    const found = DEMO_USERS.find(u => u.email === email && u.password === password);
    if (found) { setUser(found.user); return true; }

    // Check registered support users
    const supportUsers = JSON.parse(localStorage.getItem('adscale_support_users') || '[]');
    const supportUser = supportUsers.find((u: any) => u.email === email && u.password === password);
    if (supportUser) {
      setUser({ id: supportUser.id, email: supportUser.email, name: supportUser.name, role: 'support', permissions: supportUser.permissions });
      return true;
    }

    // Check registered clients
    const clients = JSON.parse(localStorage.getItem('adscale_clients') || '[]');
    const clientUser = clients.find((c: any) => c.email === email && c.password === password);
    if (clientUser) {
      setUser({ id: clientUser.id, email: clientUser.email, name: clientUser.name, role: 'client' });
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
