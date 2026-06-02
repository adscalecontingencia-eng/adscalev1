import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import AdScaleLogo from '@/components/AdScaleLogo';
import {
  LayoutDashboard, Users, DollarSign, HeadphonesIcon, UserCog, LogOut, Menu, ChevronRight, Plug, BarChart3, Network, Ban, Activity, ImageIcon, Shield, Handshake, ShoppingBag, AppWindow
} from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';

const adminLinks = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
  { path: '/ads-dashboard', label: 'Ads', icon: BarChart3, adminOnly: false },
  { path: '/clients', label: 'Clientes', icon: Users, adminOnly: false },
  { path: '/partners', label: 'Parceiros', icon: Handshake, adminOnly: false },
  { path: '/financial', label: 'Financeiro', icon: DollarSign, adminOnly: false },
  { path: '/admin-marketplace', label: 'Marketplace', icon: ShoppingBag, adminOnly: false },
  { path: '/support', label: 'Suporte', icon: HeadphonesIcon, adminOnly: false },
  { path: '/meta-connections', label: 'Conexões Meta', icon: Plug, adminOnly: false },
  { path: '/pages', label: 'Páginas', icon: ImageIcon, adminOnly: false },
  { path: '/asset-map', label: 'Mapa de Ativos', icon: Network, adminOnly: false },
  { path: '/block-log', label: 'Log de Bloqueios', icon: Ban, adminOnly: false },
  { path: '/access-logs', label: 'Acessos', icon: Activity, adminOnly: false },
  { path: '/audit-log', label: 'Auditoria', icon: Shield, adminOnly: true },
  { path: '/users', label: 'Usuários', icon: UserCog, adminOnly: true },
];

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const links = user?.role === 'admin' ? adminLinks :
    user?.role === 'support' ? adminLinks.filter(l =>
      !l.adminOnly && user.permissions?.includes(l.path.replace('/', ''))
    ) : [];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card/60 backdrop-blur-xl border-r border-border/60 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 py-5 border-b border-border/60">
          <div className="text-primary">
            <AdScaleLogo size={26} />
          </div>
          <p className="text-[9px] uppercase tracking-[0.42em] text-muted-foreground/70 mt-2 ml-0.5">
            Contingency · OS
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {links.map(link => {
            const active = location.pathname === link.path;
            return (
              <button key={link.path} onClick={() => { navigate(link.path); setSidebarOpen(false); }}
                className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}>
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 bg-primary rounded-full shadow-[0_0_8px_hsl(var(--primary))]" />
                )}
                <link.icon size={17} className={active ? '' : 'opacity-70 group-hover:opacity-100'} />
                <span className="font-medium">{link.label}</span>
                {active && <ChevronRight size={14} className="ml-auto" />}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border/60">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/40 mb-2">
            <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary text-xs font-bold">
              {user?.email?.[0]?.toUpperCase() || '·'}
            </div>
            <div className="text-[11px] text-muted-foreground truncate flex-1">{user?.email}</div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-h-screen">
        <header className="sticky top-0 z-30 h-14 border-b border-border/60 bg-background/70 backdrop-blur-xl flex items-center px-4 lg:px-6 gap-4">
          <button className="lg:hidden text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <h1 className="font-display text-sm font-semibold text-foreground tracking-wide">
            {links.find(l => l.path === location.pathname)?.label || 'Dashboard'}
          </h1>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary))]" />
              Live
            </div>
            <NotificationCenter />
          </div>
        </header>
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
