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
import ClientDashboard from "./pages/ClientDashboard";
import DashboardLayout from "./components/DashboardLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({ children, roles }) => {
  const { user, isAuthenticated } = useAuth();
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
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/login" />} />
            <Route path="/dashboard" element={<ProtectedRoute roles={['admin', 'support']}><DashboardLayout><Dashboard /></DashboardLayout></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute roles={['admin', 'support']}><DashboardLayout><Clients /></DashboardLayout></ProtectedRoute>} />
            <Route path="/financial" element={<ProtectedRoute roles={['admin', 'support']}><DashboardLayout><Financial /></DashboardLayout></ProtectedRoute>} />
            <Route path="/support" element={<ProtectedRoute roles={['admin', 'support']}><DashboardLayout><Support /></DashboardLayout></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute roles={['admin']}><DashboardLayout><UsersPage /></DashboardLayout></ProtectedRoute>} />
            <Route path="/client-dashboard" element={<ProtectedRoute roles={['client']}><ClientDashboard /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
