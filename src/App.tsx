import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Financial from "./pages/Financial";
import Support from "./pages/Support";
import UsersPage from "./pages/UsersPage";
import MetaConnections from "./pages/MetaConnections";
import MetaApps from "./pages/MetaApps";
import AdsDashboard from "./pages/AdsDashboard";
import AssetMap from "./pages/AssetMap";
import PagesAdmin from "./pages/Pages";
import BlockLog from "./pages/BlockLog";
import ClientDashboard from "./pages/ClientDashboard";
import DashboardLayout from "./components/DashboardLayout";
import NotFound from "./pages/NotFound";
import NotificationSettings from "./pages/NotificationSettings";
import Signup from "./pages/Signup";
import AccessLogs from "./pages/AccessLogs";
import AuditLog from "./pages/AuditLog";
import ClientsAuthAudit from "./pages/ClientsAuthAudit";
import Partners from "./pages/Partners";
import PartnerSignup from "./pages/PartnerSignup";
import PartnerDashboard from "./pages/PartnerDashboard";
import Marketplace from "./pages/Marketplace";
import AdminMarketplace from "./pages/AdminMarketplace";
import MyOrders from "./pages/MyOrders";
import CompleteSignup from "./pages/CompleteSignup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import CheckoutPixTest from "./pages/CheckoutPixTest";
import MyPixOrders from "./pages/MyPixOrders";
import MyWallet from "./pages/MyWallet";
import AdminPayments from "./pages/AdminPayments";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({ children, roles }) => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground text-sm">Carregando...</p></div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/login" />;
  return <>{children}</>;
};

const AdminRoutes = () => (
  <ProtectedRoute roles={['admin', 'support']}>
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/financial" element={<Financial />} />
        <Route path="/support" element={<Support />} />
        <Route path="/users" element={<UsersPage />} />
      </Routes>
    </DashboardLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ErrorBoundary>
        <AuthProvider>
          <HashRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/completar-cadastro" element={<CompleteSignup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/checkout-pix-test" element={<CheckoutPixTest />} />
              <Route path="/minhas-compras-pix" element={<MyPixOrders />} />
              <Route path="/minha-carteira" element={<ProtectedRoute><MyWallet /></ProtectedRoute>} />
              <Route path="/admin-payments" element={<ProtectedRoute roles={['admin','support']}><DashboardLayout><AdminPayments /></DashboardLayout></ProtectedRoute>} />
              <Route path="/meus-pedidos" element={<ProtectedRoute><MyOrders /></ProtectedRoute>} />
              <Route path="/admin-marketplace" element={<ProtectedRoute roles={['admin','support']}><DashboardLayout><AdminMarketplace /></DashboardLayout></ProtectedRoute>} />
              <Route path="/partner-signup" element={<PartnerSignup />} />
              <Route path="/partner-dashboard" element={<ProtectedRoute roles={['partner']}><PartnerDashboard /></ProtectedRoute>} />
              <Route path="/partners" element={<ProtectedRoute roles={['admin', 'support']}><DashboardLayout><Partners /></DashboardLayout></ProtectedRoute>} />
              <Route path="/" element={<Navigate to="/marketplace" />} />
              <Route path="/access-logs" element={<ProtectedRoute roles={['admin', 'support']}><DashboardLayout><AccessLogs /></DashboardLayout></ProtectedRoute>} />
              <Route path="/audit-log" element={<ProtectedRoute roles={['admin']}><DashboardLayout><AuditLog /></DashboardLayout></ProtectedRoute>} />
              <Route path="/clients-auth-audit" element={<ProtectedRoute roles={['admin']}><DashboardLayout><ClientsAuthAudit /></DashboardLayout></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute roles={['admin', 'support']}><DashboardLayout><Dashboard /></DashboardLayout></ProtectedRoute>} />
              <Route path="/clients" element={<ProtectedRoute roles={['admin', 'support']}><DashboardLayout><Clients /></DashboardLayout></ProtectedRoute>} />
              <Route path="/financial" element={<ProtectedRoute roles={['admin', 'support']}><DashboardLayout><Financial /></DashboardLayout></ProtectedRoute>} />
              <Route path="/support" element={<ProtectedRoute roles={['admin', 'support']}><DashboardLayout><Support /></DashboardLayout></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute roles={['admin']}><DashboardLayout><UsersPage /></DashboardLayout></ProtectedRoute>} />
              <Route path="/meta-connections" element={<ProtectedRoute roles={['admin', 'support']}><DashboardLayout><MetaConnections /></DashboardLayout></ProtectedRoute>} />
              <Route path="/meta-apps" element={<ProtectedRoute roles={['admin']}><DashboardLayout><MetaApps /></DashboardLayout></ProtectedRoute>} />
              <Route path="/ads-dashboard" element={<ProtectedRoute roles={['admin', 'support']}><DashboardLayout><AdsDashboard /></DashboardLayout></ProtectedRoute>} />
              <Route path="/asset-map" element={<ProtectedRoute roles={['admin', 'support']}><DashboardLayout><AssetMap /></DashboardLayout></ProtectedRoute>} />
              <Route path="/pages" element={<ProtectedRoute roles={['admin', 'support']}><DashboardLayout><PagesAdmin /></DashboardLayout></ProtectedRoute>} />
              <Route path="/block-log" element={<ProtectedRoute roles={['admin', 'support']}><DashboardLayout><BlockLog /></DashboardLayout></ProtectedRoute>} />
              <Route path="/notification-settings" element={<ProtectedRoute roles={['admin', 'support']}><DashboardLayout><NotificationSettings /></DashboardLayout></ProtectedRoute>} />
              <Route path="/client-dashboard" element={<ProtectedRoute roles={['client']}><ClientDashboard /></ProtectedRoute>} />
              <Route path="/client-view/:clientId" element={<ProtectedRoute roles={['admin', 'support']}><ClientDashboard /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </HashRouter>
        </AuthProvider>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
