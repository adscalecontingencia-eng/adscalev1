import React, { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdScaleLogo from '@/components/AdScaleLogo';
import {
  LayoutDashboard, Users, DollarSign, HeadphonesIcon, UserCog, LogOut, Menu, ChevronRight, ChevronDown,
  Plug, BarChart3, Network, Ban, Activity, ImageIcon, Shield, Handshake, ShoppingBag, AppWindow, Wallet,
  Boxes, UsersRound, Settings2
} from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSwitcher from '@/components/LanguageSwitcher';

type Link = { path: string; labelKey: string; icon: any; adminOnly?: boolean };
type Group = { id: string; labelKey: string | null; icon?: any; defaultOpen: boolean; links: Link[] };

const groups: Group[] = [
  {
    id: 'geral', labelKey: null, defaultOpen: true, links: [
      { path: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
    ]
  },
  {
    id: 'aluguel', labelKey: 'navGroups.rental', icon: Handshake, defaultOpen: true, links: [
      { path: '/clients', labelKey: 'nav.clients', icon: Users },
      { path: '/partners', labelKey: 'nav.partners', icon: Handshake },
      { path: '/financial', labelKey: 'nav.financial', icon: DollarSign },
      { path: '/ads-dashboard', labelKey: 'nav.ads', icon: BarChart3 },
      { path: '/support', labelKey: 'nav.support', icon: HeadphonesIcon },
      { path: '/meta-connections', labelKey: 'nav.metaConnections', icon: Plug },
      { path: '/meta-apps', labelKey: 'nav.metaApps', icon: AppWindow, adminOnly: true },
      { path: '/pages', labelKey: 'nav.pages', icon: ImageIcon },
      { path: '/asset-map', labelKey: 'nav.assetMap', icon: Network },
      { path: '/block-log', labelKey: 'nav.blockLog', icon: Ban },
    ]
  },
  {
    id: 'venda', labelKey: 'navGroups.sales', icon: ShoppingBag, defaultOpen: true, links: [
      { path: '/admin-marketplace', labelKey: 'nav.marketplace', icon: ShoppingBag },
      { path: '/vendas-ads', labelKey: 'nav.salesAds', icon: BarChart3 },
      { path: '/estoque-vendas', labelKey: 'nav.bmStock', icon: Boxes },
      { path: '/admin/marketplace-assets', labelKey: 'nav.assetsWithSpend', icon: Boxes },
      { path: '/marketplace-clients', labelKey: 'nav.marketplaceClients', icon: UsersRound },
      { path: '/admin-payments', labelKey: 'nav.payments', icon: Wallet },
      { path: '/admin-audit', labelKey: 'nav.paymentsAudit', icon: Shield, adminOnly: true },
      { path: '/admin-webhook-logs', labelKey: 'nav.mpLogs', icon: Activity, adminOnly: true },
      { path: '/admin-tracking', labelKey: 'nav.tracking', icon: Activity },
    ]
  },
  {
    id: 'sistema', labelKey: 'navGroups.system', icon: Settings2, defaultOpen: false, links: [
      { path: '/access-logs', labelKey: 'nav.access', icon: Activity },
      { path: '/audit-log', labelKey: 'nav.audit', icon: Shield, adminOnly: true },
      { path: '/manual-adjustments', labelKey: 'nav.manualAdjustments', icon: Shield },
      { path: '/users', labelKey: 'nav.users', icon: UserCog, adminOnly: true },
    ]
  },
];

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
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
            const hasHeader = !!g.labelKey;
            return (
              <div key={g.id} className="space-y-0.5">
                {hasHeader && (
                  <button
                    onClick={() => toggleGroup(g.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 mt-2 mb-0.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground/70 hover:text-primary transition-colors"
                  >
                    {g.icon && <g.icon size={12} className="opacity-70" />}
                    <span className="flex-1 text-left">{t(g.labelKey as string)}</span>
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
                      <span className="font-medium">{t(link.labelKey)}</span>
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
            <span>{t('common.logout')}</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-h-screen">
        <header className="sticky top-0 z-30 h-14 border-b border-border/60 bg-background/70 backdrop-blur-xl flex items-center px-4 lg:px-6 gap-4">
          <button className="lg:hidden text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <h1 className="font-display text-sm font-semibold text-foreground tracking-wide">
            {(() => {
              const l = allLinks.find(l => l.path === location.pathname);
              return l ? t(l.labelKey) : t('nav.dashboard');
            })()}
          </h1>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary))]" />
              {t('common.live')}
            </div>
            <LanguageSwitcher />
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
