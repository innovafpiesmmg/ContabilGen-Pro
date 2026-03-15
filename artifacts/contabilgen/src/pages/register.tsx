import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const { register } = useAuth();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "", firstName: "", lastName: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (form.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setLoading(true);
    try {
      await register({ email: form.email, password: form.password, firstName: form.firstName || undefined, lastName: form.lastName || undefined });
      setLocation("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/40 p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="ContabilGen Pro" className="w-20 h-20 mb-4 drop-shadow-md" />
          <h1 className="font-bold text-2xl text-foreground">ContabilGen Pro</h1>
          <p className="text-sm text-muted-foreground mt-1">Crea tu cuenta gratuita</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-border p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="firstName">Nombre</Label>
                <Input id="firstName" placeholder="Ana" value={form.firstName} onChange={set("firstName")} className="rounded-xl" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lastName">Apellido</Label>
                <Input id="lastName" placeholder="García" value={form.lastName} onChange={set("lastName")} className="rounded-xl" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@correo.com"
                value={form.email}
                onChange={set("email")}
                required
                autoComplete="email"
                className="rounded-xl"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  value={form.password}
                  onChange={set("password")}
                  required
                  autoComplete="new-password"
                  className="rounded-xl pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repite la contraseña"
                value={form.confirmPassword}
                onChange={set("confirmPassword")}
                required
                autoComplete="new-password"
                className="rounded-xl"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full py-6 rounded-xl text-base font-semibold shadow-md mt-1">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Crear cuenta"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
