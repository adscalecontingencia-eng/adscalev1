import React, { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import AdScaleLogo from '@/components/AdScaleLogo';
import {
  LayoutDashboard, Users, DollarSign, HeadphonesIcon, UserCog, LogOut, Menu, ChevronRight, ChevronDown,
  Plug, BarChart3, Network, Ban, Activity, ImageIcon, Shield, Handshake, ShoppingBag, AppWindow, Wallet,
  Boxes, UsersRound, Settings2
} from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';
import ThemeToggle from '@/components/ThemeToggle';

type Link = { path: string; label: string; icon: any; adminOnly?: boolean };
type Group = { id: string; label: string | null; icon?: any; defaultOpen: boolean; links: Link[] };

const groups: Group[] = [
  {
    id: 'geral', label: null, defaultOpen: true, links: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ]
  },
  {
    id: 'aluguel', label: 'Aluguel', icon: Handshake, defaultOpen: true, links: [
      { path: '/clients', label: 'Clientes', icon: Users },
      { path: '/partners', label: 'Parceiros', icon: Handshake },
      { path: '/financial', label: 'Financeiro', icon: DollarSign },
      { path: '/ads-dashboard', label: 'Ads', icon: BarChart3 },
      { path: '/support', label: 'Suporte', icon: HeadphonesIcon },
      { path: '/meta-connections', label: 'Conexões Meta', icon: Plug },
      { path: '/meta-apps', label: 'Aplicativos Meta', icon: AppWindow, adminOnly: true },
      { path: '/pages', label: 'Páginas', icon: ImageIcon },
      { path: '/asset-map', label: 'Mapa de Ativos', icon: Network },
      { path: '/block-log', label: 'Log de Bloqueios', icon: Ban },
    ]
  },
  {
    id: 'venda', label: 'Venda', icon: ShoppingBag, defaultOpen: true, links: [
      { path: '/admin-marketplace', label: 'Marketplace', icon: ShoppingBag },
      { path: '/admin/marketplace-assets', label: 'Ativos c/ Gastos', icon: Boxes },
      { path: '/marketplace-clients', label: 'Clientes Marketplace', icon: UsersRound },
      { path: '/admin-payments', label: 'Pagamentos', icon: Wallet },
      { path: '/admin-audit', label: 'Auditoria Pagamentos', icon: Shield, adminOnly: true },
    ]
  },
  {
    id: 'sistema', label: 'Sistema', icon: Settings2, defaultOpen: false, links: [
      { path: '/access-logs', label: 'Acessos', icon: Activity },
      { path: '/audit-log', label: 'Auditoria', icon: Shield, adminOnly: true },
      { path: '/users', label: 'Usuários', icon: UserCog, adminOnly: true },
    ]
  },
];

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleGroups = useMemo(() => {
    return groups
      .map(g => ({
        ...g,
        links: g.links.filter(l => {
          if (user?.role === 'admin') return true;
          if (user?.role === 'support') return !l.adminOnly && (user.permissions?.includes(l.path.replace(/^\//, '').split('/')[0]) ?? true);
          return false;
        })
      }))
      .filter(g => g.links.length > 0);
  }, [user]);

  // Auto-open the group that contains the active route
  const activeGroupId = useMemo(() => {
    for (const g of visibleGroups) {
      if (g.links.some(l => location.pathname === l.path)) return g.id;
    }
    return null;
  }, [visibleGroups, location.pathname]);

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    groups.forEach(g => { init[g.id] = g.defaultOpen; });
    return init;
  });

  const toggleGroup = (id: string) => setOpenMap(m => ({ ...m, [id]: !m[id] }));

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const allLinks = visibleGroups.flatMap(g => g.links);

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

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleGroups.map(g => {
            const isOpen = openMap[g.id] || activeGroupId === g.id;
            const hasHeader = !!g.label;
            return (
              <div key={g.id} className="space-y-0.5">
                {hasHeader && (
                  <button
                    onClick={() => toggleGroup(g.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 mt-2 mb-0.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground/70 hover:text-primary transition-colors"
                  >
                    {g.icon && <g.icon size={12} className="opacity-70" />}
                    <span className="flex-1 text-left">{g.label}</span>
                    {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                )}
                {isOpen && g.links.map(link => {
                  const active = location.pathname === link.path;
                  return (
                    <button key={link.path} onClick={() => { navigate(link.path); setSidebarOpen(false); }}
                      className={`group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                      }`}>
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 bg-primary rounded-full shadow-[0_0_8px_hsl(var(--primary))]" />
                      )}
                      <link.icon size={16} className={active ? '' : 'opacity-70 group-hover:opacity-100'} />
                      <span className="font-medium">{link.label}</span>
                      {active && <ChevronRight size={13} className="ml-auto" />}
                    </button>
                  );
                })}
              </div>
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
            {allLinks.find(l => l.path === location.pathname)?.label || 'Dashboard'}
          </h1>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary))]" />
              Live
            </div>
            <ThemeToggle />
            <NotificationCenter />
          </div>
        </header>
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
