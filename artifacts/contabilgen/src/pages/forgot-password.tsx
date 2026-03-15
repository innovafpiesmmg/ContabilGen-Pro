import { useState } from "react";
import { Link } from "wouter";
import { Calculator, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al enviar el correo");
      }
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al enviar el correo");
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
          <h1 className="font-bold text-2xl text-foreground">Recuperar contraseña</h1>
          <p className="text-sm text-muted-foreground mt-1">Te enviaremos un enlace de restablecimiento</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-border p-8">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <p className="text-center text-sm text-muted-foreground">
                Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña en los próximos minutos.
              </p>
              <Link href="/login">
                <Button variant="outline" className="gap-2 rounded-xl mt-2">
                  <ArrowLeft className="w-4 h-4" />
                  Volver al inicio de sesión
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="rounded-xl"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={loading} className="w-full py-6 rounded-xl text-base font-semibold shadow-md">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Enviar enlace de recuperación"}
              </Button>

              <Link href="/login" className="text-center">
                <button type="button" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 mx-auto transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                  Volver al inicio de sesión
                </button>
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
