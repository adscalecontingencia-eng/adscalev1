import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '@/assets/logo.png';
import {
  LayoutDashboard, Users, DollarSign, HeadphonesIcon, UserCog, LogOut, Menu, X, ChevronRight
} from 'lucide-react';

const adminLinks = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/clients', label: 'Clientes', icon: Users },
  { path: '/financial', label: 'Financeiro', icon: DollarSign },
  { path: '/support', label: 'Suporte', icon: HeadphonesIcon },
  { path: '/users', label: 'Usuários', icon: UserCog },
];

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const links = user?.role === 'admin' ? adminLinks :
    user?.role === 'support' ? adminLinks.filter(l => 
      user.permissions?.includes(l.path.replace('/', ''))
    ) : [];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-background/80 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-4 border-b border-border flex items-center gap-3">
          <img src={logo} alt="AD Scale" className="w-10 h-10 rounded-lg" />
          <div>
            <h2 className="font-display text-sm font-bold text-primary glow-text">AD SCALE</h2>
            <p className="text-xs text-muted-foreground">Contingência</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {links.map(link => {
            const active = location.pathname === link.path;
            return (
              <button key={link.path} onClick={() => { navigate(link.path); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active ? 'bg-primary/10 text-primary border-glow' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}>
                <link.icon size={18} />
                <span>{link.label}</span>
                {active && <ChevronRight size={14} className="ml-auto" />}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="px-3 py-2 text-xs text-muted-foreground mb-2 truncate">{user?.email}</div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-all">
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-h-screen">
        <header className="h-14 border-b border-border flex items-center px-4 lg:px-6 gap-4">
          <button className="lg:hidden text-muted-foreground" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <h1 className="font-display text-sm font-semibold text-foreground">
            {links.find(l => l.path === location.pathname)?.label || 'Dashboard'}
          </h1>
        </header>
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
