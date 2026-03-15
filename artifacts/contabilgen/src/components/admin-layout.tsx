import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Users, Mail, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/admin/users", label: "Usuarios", icon: Users },
  { path: "/admin/email", label: "Servidor de correo", icon: Mail },
  { path: "/admin/ai", label: "IA compartida", icon: Cpu },
];

interface AdminShellProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function AdminShell({ title, description, children }: AdminShellProps) {
  const [location] = useLocation();

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">{title}</h1>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>

      <div className="flex gap-1 mb-6 border-b border-border/60 overflow-x-auto">
        {navItems.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            href={path}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              location === path
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
