import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Users, Mail, ChevronLeft, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/admin/users", label: "Usuarios", icon: Users },
  { path: "/admin/email", label: "Servidor de correo", icon: Mail },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-60 shrink-0 bg-white border-r border-border flex flex-col">
        <div className="p-5 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm text-foreground">Panel Admin</p>
            <p className="text-xs text-muted-foreground">ContabilGen Pro</p>
          </div>
        </div>

        <nav className="flex-1 p-3 flex flex-col gap-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              href={path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                location === path
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-slate-100 hover:text-foreground",
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-slate-100 hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver a la aplicación
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
