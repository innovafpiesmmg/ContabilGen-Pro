import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Calculator, Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setError("Enlace inválido. Por favor, solicita un nuevo enlace de restablecimiento.");
    } else {
      setToken(t);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al restablecer la contraseña");
      setSuccess(true);
      setTimeout(() => setLocation("/login"), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al restablecer la contraseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/40 p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-inner mb-4">
            <Calculator className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="font-bold text-2xl text-foreground">Nueva contraseña</h1>
          <p className="text-sm text-muted-foreground mt-1">Elige una contraseña segura</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-border p-8">
          {success ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <p className="text-center text-sm text-muted-foreground">
                Contraseña actualizada correctamente. Redirigiendo al inicio de sesión...
              </p>
            </div>
          ) : error && !token ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <AlertCircle className="w-12 h-12 text-destructive" />
              <p className="text-center text-sm text-destructive">{error}</p>
              <Link href="/forgot-password">
                <Button variant="outline" className="rounded-xl mt-2">
                  Solicitar nuevo enlace
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newPassword">Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 8 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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

              <Button type="submit" disabled={loading} className="w-full py-6 rounded-xl text-base font-semibold shadow-md">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Cambiar contraseña"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
