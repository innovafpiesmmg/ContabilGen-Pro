import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

import Layout from "@/components/layout";
import AdminLayout from "@/components/admin-layout";
import Dashboard from "@/pages/dashboard";
import SavedUniverse from "@/pages/saved-universe";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import AdminUsersPage from "@/pages/admin/users";
import AdminEmailConfigPage from "@/pages/admin/email-config";
import AdminAiConfigPage from "@/pages/admin/ai-config";
import LandingPage from "@/pages/landing";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    }
  }
});

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/40">
      <div className="flex flex-col items-center gap-4">
        <img src="/logo.png" alt="ContabilGen Pro" className="w-16 h-16 drop-shadow-md" />
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    </div>
  );
}

function AdminSection() {
  const { user } = useAuth();
  if (!user?.isAdmin) return <LoginPage />;
  return (
    <Switch>
      <Route path="/admin/users" component={AdminUsersPage} />
      <Route path="/admin/email" component={AdminEmailConfigPage} />
      <Route path="/admin/ai" component={AdminAiConfigPage} />
      <Route>
        <AdminUsersPage />
      </Route>
    </Switch>
  );
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function AppContent() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <LoadingScreen />;

  return (
    <WouterRouter base={BASE}>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />

        {isAuthenticated ? (
          <Switch>
            <Route path="/admin/:rest*" component={AdminSection} />
            <Route>
              <Layout>
                <Switch>
                  <Route path="/" component={Dashboard} />
                  <Route path="/generations/:id" component={SavedUniverse} />
                  <Route path="/settings" component={SettingsPage} />
                  <Route component={NotFound} />
                </Switch>
              </Layout>
            </Route>
          </Switch>
        ) : (
          <Switch>
            <Route path="/" component={LandingPage} />
            <Route>
              <LandingPage />
            </Route>
          </Switch>
        )}
      </Switch>
    </WouterRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppContent />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
