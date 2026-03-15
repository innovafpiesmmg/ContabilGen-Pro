import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@workspace/replit-auth-web";
import { Calculator, LogIn, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import SavedUniverse from "@/pages/saved-universe";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    }
  }
});

function LoginScreen() {
  const { login } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/40 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-border p-8 flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-inner">
          <Calculator className="w-9 h-9 text-primary-foreground" />
        </div>
        <div className="text-center">
          <h1 className="font-bold text-2xl text-foreground">ContabilGen Pro</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generador de universos contables con IA
          </p>
        </div>
        <p className="text-sm text-center text-muted-foreground px-2">
          Accede con tu cuenta para guardar tus generaciones y configurar tu propia API key.
        </p>
        <Button onClick={login} className="w-full gap-2 py-6 rounded-xl text-base font-semibold shadow-md hover:shadow-lg transition-all">
          <LogIn className="w-5 h-5" />
          Acceder
        </Button>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/40">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-inner">
          <Calculator className="w-8 h-8 text-primary-foreground" />
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/generations/:id" component={SavedUniverse} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </WouterRouter>
  );
}

function AppContent() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <LoginScreen />;
  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
