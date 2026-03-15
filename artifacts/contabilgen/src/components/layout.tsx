import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calculator, 
  History, 
  Menu, 
  Plus, 
  FileText, 
  X, 
  Trash2,
  Printer,
  ChevronRight,
  Settings,
  LogOut,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useListGenerations, useDeleteGeneration } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { data: generations, isLoading } = useListGenerations();
  const deleteMutation = useDeleteGeneration();
  const { toast } = useToast();
  const { user, logout } = useAuth();

  const closeSidebar = () => setSidebarOpen(false);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("¿Estás seguro de que deseas eliminar este universo contable?")) {
      try {
        await deleteMutation.mutateAsync({ id });
        toast({ title: "Universo eliminado", description: "El universo se ha eliminado correctamente." });
        if (location === `/generations/${id}`) {
          setLocation("/");
        }
      } catch {
        toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el universo." });
      }
    }
  };

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
    : user?.email ?? "Usuario";

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border shadow-lg">
      <div className="p-6 flex items-center gap-3 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-inner">
          <Calculator className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display font-bold text-xl leading-tight text-sidebar-foreground">ContabilGen</h1>
          <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">Pro Edition</p>
        </div>
      </div>

      <div className="p-4">
        <Link href="/" onClick={closeSidebar} className="w-full">
          <Button variant="default" className="w-full justify-start gap-2 shadow-md hover:shadow-lg transition-all rounded-xl py-6 bg-gradient-to-r from-primary to-primary/90">
            <Plus className="w-5 h-5" />
            <span className="font-semibold text-base">Nuevo Universo</span>
          </Button>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6">
        <div>
          <div className="flex items-center gap-2 px-2 mb-3 text-sm font-semibold text-muted-foreground">
            <History className="w-4 h-4" />
            Historial de Generaciones
          </div>
          
          <div className="space-y-1.5">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))
            ) : generations?.length === 0 ? (
              <div className="text-sm text-muted-foreground px-2 py-4 text-center border border-dashed rounded-xl bg-muted/30">
                No hay universos guardados
              </div>
            ) : (
              generations?.map((gen) => {
                const isActive = location === `/generations/${gen.id}`;
                return (
                  <Link key={gen.id} href={`/generations/${gen.id}`} onClick={closeSidebar} className="block">
                    <div className={cn(
                      "group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 border",
                      isActive 
                        ? "bg-primary/5 border-primary/20 shadow-sm" 
                        : "bg-transparent border-transparent hover:bg-muted/50 hover:border-border"
                    )}>
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                          isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary"
                        )}>
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <p className={cn("text-sm font-semibold truncate transition-colors", isActive ? "text-primary" : "text-foreground group-hover:text-foreground")}>
                            {gen.companyName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {gen.sector} • {gen.fiscalYear}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <button 
                          onClick={(e) => handleDelete(gen.id, e)}
                          className={cn(
                            "p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors",
                            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )}
                          title="Eliminar universo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-sidebar-border mt-auto shrink-0 space-y-2">
        <Link href="/settings" onClick={closeSidebar} className="block w-full">
          <Button variant={location === "/settings" ? "secondary" : "ghost"} className="w-full justify-start gap-2 rounded-xl">
            <Settings className="w-5 h-5" />
            <span className="font-semibold text-sm">Configuración</span>
          </Button>
        </Link>

        <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-muted/40 border border-border/50">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-foreground">{displayName}</p>
            {user?.email && (
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            )}
          </div>
          <button
            onClick={logout}
            title="Cerrar sesión"
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-gradient-to-br from-slate-50 to-blue-50/30 overflow-hidden">
      <aside className="hidden md:block w-80 shrink-0 h-full z-10 no-print">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeSidebar}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden no-print"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-80 z-50 md:hidden no-print"
            >
              <SidebarContent />
              <button 
                onClick={closeSidebar}
                className="absolute top-6 -right-12 p-2 bg-white rounded-xl shadow-xl text-foreground"
              >
                <X className="w-6 h-6" />
              </button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-16 shrink-0 bg-white/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 sm:px-8 sticky top-0 z-20 no-print">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center text-sm font-medium text-muted-foreground">
              <span className="hidden sm:inline">ContabilGen</span>
              <ChevronRight className="w-4 h-4 mx-1 hidden sm:inline opacity-50" />
              <span className="text-foreground">{location === '/' ? 'Nuevo Universo' : location === '/settings' ? 'Configuración' : 'Universo Guardado'}</span>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 rounded-xl shadow-sm hover:shadow bg-white"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Imprimir Vista</span>
          </Button>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}
