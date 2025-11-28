import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Crops from "./pages/Crops";
import Fields from "./pages/Fields";
import Subscriptions from "./pages/Subscriptions";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import { Layout } from "./components/Layout";
// Admin portal imports
import AdminDashboard from "./admin/pages/AdminDashboard";
import AdminUsers from "./admin/pages/AdminUsers";
import AdminAnalytics from "./admin/pages/AdminAnalytics";
import AdminSubscriptions from "./admin/pages/AdminSubscriptions";
import AdminNotifications from "./admin/pages/AdminNotifications";
import AdminSettings from "./admin/pages/AdminSettings";
import { AdminLayout } from "./admin/components/layout/AdminLayout";
import AdminCrops from "./admin/pages/AdminCrops";
// SuperAdmin portal imports (reuse Admin components with different layout)
import SuperAdminDashboard from "./superadmin/pages/SuperAdminDashboard";
import SuperAdminUsers from "./superadmin/pages/SuperAdminUsers";
import SuperAdminAnalytics from "./superadmin/pages/SuperAdminAnalytics";
import SuperAdminSubscriptions from "./superadmin/pages/SuperAdminSubscriptions";
import SuperAdminNotifications from "./superadmin/pages/SuperAdminNotifications";
import SuperAdminSettings from "./superadmin/pages/SuperAdminSettings";
import { SuperAdminLayout } from "./superadmin/components/layout/SuperAdminLayout";
import SuperAdminCrops from "./superadmin/pages/SuperAdminCrops";
// Agronomist portal imports
import { AgronomistLayout } from "./agronomist/components/layout/AgronomistLayout";
import { SupportLayout } from "./support/components/layout/SupportLayout";
import SupportDashboard from "./support/pages/SupportDashboard";
import SupportNotifications from "./support/pages/SupportNotifications";
import SupportUsers from "./support/pages/SupportUsers";
// Analyst portal imports
import { AnalystLayout } from "./analyst/components/layout/AnalystLayout";
import AnalystDashboard from "./analyst/pages/AnalystDashboard";
import AnalystReports from "./analyst/pages/AnalystReports";
import AnalystNotifications from "./analyst/pages/AnalystNotifications";
import AgronomistDashboard from "./agronomist/pages/AgronomistDashboard";
import AgronomistCrops from "./agronomist/pages/AgronomistCrops";
import AgronomistNotifications from "./agronomist/pages/AgronomistNotifications";
import AgronomistUsers from "./agronomist/pages/AgronomistUsers";
// Business portal imports
import { BusinessLayout } from "./business/components/layout/BusinessLayout";
import BusinessDashboard from "./business/pages/BusinessDashboard";
import BusinessSubscriptions from "./business/pages/BusinessSubscriptions";
import BusinessPayments from "./business/pages/BusinessPayments";
import BusinessNotifications from "./business/pages/BusinessNotifications";
// Developer portal imports
import { DeveloperLayout } from "./developer/components/layout/DeveloperLayout";
import DeveloperDashboard from "./developer/pages/DeveloperDashboard";
import DeveloperUpdates from "./developer/pages/DeveloperUpdates";
import DeveloperNotifications from "./developer/pages/DeveloperNotifications";
import IssuesPage from "./shared/components/IssuesPage";

const queryClient = new QueryClient();

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

const ADMIN_ROLES = [
  "SuperAdmin",
  "Admin",
];

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-sm text-muted-foreground">Loading…</div>
    </div>
  );
}

function RequireDeveloper({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  const { roles, loading } = useRoles();
  if (!token) return <Navigate to="/login" replace />;
  if (loading) return <Loading />;
  const hasRole = (roles || []).includes("Developer");
  if (!hasRole) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireBusiness({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  const { roles, loading } = useRoles();
  if (!token) return <Navigate to="/login" replace />;
  if (loading) return <Loading />;
  const hasRole = (roles || []).includes("Business");
  if (!hasRole) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAnalyst({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  const { roles, loading } = useRoles();
  if (!token) return <Navigate to="/login" replace />;
  if (loading) return <Loading />;
  const hasAnalyst = (roles || []).includes("Analyst");
  if (!hasAnalyst) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireSupport({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  const { roles, loading } = useRoles();
  if (!token) return <Navigate to="/login" replace />;
  if (loading) return <Loading />;
  const hasSupport = (roles || []).includes("Support");
  if (!hasSupport) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAgronomist({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  const { roles, loading } = useRoles();
  if (!token) return <Navigate to="/login" replace />;
  if (loading) return <Loading />;
  const hasAgro = (roles || []).includes("Agronomist");
  if (!hasAgro) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  const { roles, loading } = useRoles();
  
  if (!token) return <Navigate to="/login" replace />;
  if (loading) return <Loading />;
  
  const hasSuperAdmin = (roles || []).includes("SuperAdmin");
  if (!hasSuperAdmin) return <Navigate to="/login" replace />;
  
  return <>{children}</>;
}

function useRoles() {
  const [roles, setRoles] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setRoles(null);
      setLoading(false);
      return;
    }
    
    // First, try to get roles from localStorage (faster, no API call)
    try {
      const cachedUser = localStorage.getItem("user");
      if (cachedUser) {
        const userData = JSON.parse(cachedUser);
        if (userData.roles && Array.isArray(userData.roles)) {
          console.log('✅ Using cached roles:', userData.roles);
          setRoles(userData.roles);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to parse cached user data:', e);
    }
    
    // If no cached roles, fetch from API
    (async () => {
      try {
        console.log('📡 Fetching user roles from API...');
        const res = await fetch(`${API_URL}/auth/me/`, { 
          headers: { Authorization: `Token ${token}` } 
        });
        
        if (res.ok) {
          const data = await res.json();
          console.log('✅ Fetched user data:', data);
          const userRoles = Array.isArray(data?.roles) ? data.roles : [];
          setRoles(userRoles);
          
          // Cache the user data for next time
          localStorage.setItem("user", JSON.stringify(data));
        } else if (res.status === 401 || res.status === 403) {
          console.warn('❌ Authentication failed, clearing token');
          // Invalid token: clear and treat as unauthenticated
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setRoles(null);
        } else {
          console.warn('⚠️ API returned error status:', res.status);
          // Other errors, keep token but set empty roles
          setRoles([]);
        }
      } catch (error) {
        console.error('❌ Network error fetching roles:', error);
        // On network error, try to use any cached data
        try {
          const cachedUser = localStorage.getItem("user");
          if (cachedUser) {
            const userData = JSON.parse(cachedUser);
            if (userData.roles && Array.isArray(userData.roles)) {
              console.log('⚠️ Using cached roles after network error');
              setRoles(userData.roles);
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          // Ignore
        }
        
        // If no cached data, clear token
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setRoles(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { roles, loading } as const;
}

function RootRedirect() {
  const token = localStorage.getItem("token");
  const { roles, loading } = useRoles();
  
  if (!token) return <Navigate to="/login" replace />;
  if (loading) return <Loading />;
  if (!roles || roles.length === 0) {
    localStorage.removeItem("token");
    return <Navigate to="/login" replace />;
  }
  
  // Route SuperAdmin to superadmin portal
  if (roles.includes("SuperAdmin")) return <Navigate to="/superadmin/dashboard" replace />;
  
  // Route other roles
  if (roles.includes("Agronomist")) return <Navigate to="/agronomist/dashboard" replace />;
  if (roles.includes("Analyst")) return <Navigate to="/analyst/dashboard" replace />;
  if (roles.includes("Business")) return <Navigate to="/business/dashboard" replace />;
  if (roles.includes("Developer")) return <Navigate to="/developer/dashboard" replace />;
  if (roles.includes("Support")) return <Navigate to="/support/dashboard" replace />;
  
  // Route Admin (without SuperAdmin) to admin portal
  if (roles.includes("Admin")) return <Navigate to="/admin/dashboard" replace />;
  
  // Default to user dashboard
  return <Navigate to="/dashboard" replace />;
}

function RequireRole({ allowed, redirectTo, children }: { allowed: string[]; redirectTo: string; children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  const { roles, loading } = useRoles();
  if (!token) return <Navigate to={redirectTo} replace />;
  if (loading) return <Loading />;
  const hasRole = (roles || []).some((r) => allowed.includes(r));
  if (!hasRole) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}

function RequireUser({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  const { roles, loading } = useRoles();
  
  if (!token) return <Navigate to="/login" replace />;
  if (loading) return <Loading />;
  
  // If user has admin roles, redirect to admin dashboard
  const isAdmin = (roles || []).some((r) => ADMIN_ROLES.includes(r));
  if (isAdmin) return <Navigate to="/admin/dashboard" replace />;
  
  // If user doesn't have End-App-User role, redirect to login
  const hasUserRole = (roles || []).includes("End-App-User");
  if (!hasUserRole) return <Navigate to="/login" replace />;
  
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  const { roles, loading } = useRoles();
  
  if (!token) return <Navigate to="/login" replace />;
  if (loading) return <Loading />;
  
  // If user has only End-App-User role, redirect to user dashboard
  const isUserOnly = (roles || []).length === 1 && (roles || []).includes("End-App-User");
  if (isUserOnly) return <Navigate to="/dashboard" replace />;
  
  // Check for Admin role (but not SuperAdmin for this route)
  const hasAdmin = (roles || []).includes("Admin") && !(roles || []).includes("SuperAdmin");
  if (!hasAdmin) return <Navigate to="/login" replace />;
  
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<RequireUser><Layout><Dashboard /></Layout></RequireUser>} />
          <Route path="/crops" element={<RequireUser><Layout><Crops /></Layout></RequireUser>} />
          <Route path="/fields" element={<RequireUser><Layout><Fields /></Layout></RequireUser>} />
          <Route path="/subscriptions" element={<RequireUser><Layout><Subscriptions /></Layout></RequireUser>} />
          <Route path="/reports" element={<RequireUser><Layout><Reports /></Layout></RequireUser>} />
          <Route path="/settings" element={<RequireUser><Layout><Settings /></Layout></RequireUser>} />
          {/* SuperAdmin routes */}
          <Route path="/superadmin" element={<Navigate to="/superadmin/dashboard" replace />} />
          <Route path="/superadmin/dashboard" element={<RequireSuperAdmin><SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout></RequireSuperAdmin>} />
          <Route path="/superadmin/users" element={<RequireSuperAdmin><SuperAdminLayout><SuperAdminUsers /></SuperAdminLayout></RequireSuperAdmin>} />
          <Route path="/superadmin/analytics" element={<RequireSuperAdmin><SuperAdminLayout><SuperAdminAnalytics /></SuperAdminLayout></RequireSuperAdmin>} />
          <Route path="/superadmin/subscriptions" element={<RequireSuperAdmin><SuperAdminLayout><SuperAdminSubscriptions /></SuperAdminLayout></RequireSuperAdmin>} />
          <Route path="/superadmin/notifications" element={<RequireSuperAdmin><SuperAdminLayout><SuperAdminNotifications /></SuperAdminLayout></RequireSuperAdmin>} />
          <Route path="/superadmin/settings" element={<RequireSuperAdmin><SuperAdminLayout><SuperAdminSettings /></SuperAdminLayout></RequireSuperAdmin>} />
          <Route path="/superadmin/crops" element={<RequireSuperAdmin><SuperAdminLayout><SuperAdminCrops /></SuperAdminLayout></RequireSuperAdmin>} />
          
          {/* Admin routes - now restricted to Admin role only (not SuperAdmin) */}
          <Route path="/admin" element={<Navigate to="/login" replace />} />
          <Route path="/admin/login" element={<Navigate to="/login" replace />} />
          <Route path="/admin/dashboard" element={<RequireAdmin><AdminLayout><AdminDashboard /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/users" element={<RequireAdmin><AdminLayout><AdminUsers /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/analytics" element={<RequireAdmin><AdminLayout><AdminAnalytics /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/subscriptions" element={<RequireAdmin><AdminLayout><AdminSubscriptions /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/notifications" element={<RequireAdmin><AdminLayout><AdminNotifications /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/settings" element={<RequireAdmin><AdminLayout><AdminSettings /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/crops" element={<RequireAdmin><AdminLayout><AdminCrops /></AdminLayout></RequireAdmin>} />
          <Route path="/admin/issues" element={<RequireAdmin><AdminLayout><IssuesPage /></AdminLayout></RequireAdmin>} />
          
          {/* Agronomist routes */}
          <Route path="/agronomist" element={<Navigate to="/agronomist/dashboard" replace />} />
          <Route path="/agronomist/dashboard" element={<RequireAgronomist><AgronomistLayout><AgronomistDashboard /></AgronomistLayout></RequireAgronomist>} />
          <Route path="/agronomist/crops" element={<RequireAgronomist><AgronomistLayout><AgronomistCrops /></AgronomistLayout></RequireAgronomist>} />
          <Route path="/agronomist/notifications" element={<RequireAgronomist><AgronomistLayout><AgronomistNotifications /></AgronomistLayout></RequireAgronomist>} />
          <Route path="/agronomist/users" element={<RequireAgronomist><AgronomistLayout><AgronomistUsers /></AgronomistLayout></RequireAgronomist>} />
          <Route path="/agronomist/settings" element={<RequireAgronomist><AgronomistLayout><Settings /></AgronomistLayout></RequireAgronomist>} />
          <Route path="/agronomist/issues" element={<RequireAgronomist><AgronomistLayout><IssuesPage /></AgronomistLayout></RequireAgronomist>} />
          {/* Support routes */}
          <Route path="/support" element={<Navigate to="/support/dashboard" replace />} />
          <Route path="/support/dashboard" element={<RequireSupport><SupportLayout><SupportDashboard /></SupportLayout></RequireSupport>} />
          <Route path="/support/notifications" element={<RequireSupport><SupportLayout><SupportNotifications /></SupportLayout></RequireSupport>} />
          <Route path="/support/users" element={<RequireSupport><SupportLayout><SupportUsers /></SupportLayout></RequireSupport>} />
          <Route path="/support/settings" element={<RequireSupport><SupportLayout><Settings /></SupportLayout></RequireSupport>} />
          {/* Analyst routes */}
          <Route path="/analyst" element={<Navigate to="/analyst/dashboard" replace />} />
          <Route path="/analyst/dashboard" element={<RequireAnalyst><AnalystLayout><AnalystDashboard /></AnalystLayout></RequireAnalyst>} />
          <Route path="/analyst/reports" element={<RequireAnalyst><AnalystLayout><AnalystReports /></AnalystLayout></RequireAnalyst>} />
          <Route path="/analyst/notifications" element={<RequireAnalyst><AnalystLayout><AnalystNotifications /></AnalystLayout></RequireAnalyst>} />
          <Route path="/analyst/settings" element={<RequireAnalyst><AnalystLayout><Settings /></AnalystLayout></RequireAnalyst>} />
          <Route path="/analyst/issues" element={<RequireAnalyst><AnalystLayout><IssuesPage /></AnalystLayout></RequireAnalyst>} />
          {/* Business routes */}
          <Route path="/business" element={<Navigate to="/business/dashboard" replace />} />
          <Route path="/business/dashboard" element={<RequireBusiness><BusinessLayout><BusinessDashboard /></BusinessLayout></RequireBusiness>} />
          <Route path="/business/subscriptions" element={<RequireBusiness><BusinessLayout><BusinessSubscriptions /></BusinessLayout></RequireBusiness>} />
          <Route path="/business/payments" element={<RequireBusiness><BusinessLayout><BusinessPayments /></BusinessLayout></RequireBusiness>} />
          <Route path="/business/notifications" element={<RequireBusiness><BusinessLayout><BusinessNotifications /></BusinessLayout></RequireBusiness>} />
          <Route path="/business/settings" element={<RequireBusiness><BusinessLayout><Settings /></BusinessLayout></RequireBusiness>} />
          <Route path="/business/issues" element={<RequireBusiness><BusinessLayout><IssuesPage /></BusinessLayout></RequireBusiness>} />
          {/* Developer routes */}
          <Route path="/developer" element={<Navigate to="/developer/dashboard" replace />} />
          <Route path="/developer/dashboard" element={<RequireDeveloper><DeveloperLayout><DeveloperDashboard /></DeveloperLayout></RequireDeveloper>} />
          <Route path="/developer/updates" element={<RequireDeveloper><DeveloperLayout><DeveloperUpdates /></DeveloperLayout></RequireDeveloper>} />
          <Route path="/developer/notifications" element={<RequireDeveloper><DeveloperLayout><DeveloperNotifications /></DeveloperLayout></RequireDeveloper>} />
          <Route path="/developer/settings" element={<RequireDeveloper><DeveloperLayout><Settings /></DeveloperLayout></RequireDeveloper>} />
          <Route path="/developer/issues" element={<RequireDeveloper><DeveloperLayout><IssuesPage /></DeveloperLayout></RequireDeveloper>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;