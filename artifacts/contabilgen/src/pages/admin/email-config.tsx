import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, CheckCircle, Trash2, Info, Send, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AdminShell } from "@/components/admin-layout";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error en la petición");
  return data;
}

export default function EmailConfigPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [emailFrom, setEmailFrom] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-email-config"],
    queryFn: () => apiFetch("/admin/email-config").then((d) => d.config as Record<string, string>),
  });

  useEffect(() => {
    if (data?.email_from) setEmailFrom(data.email_from);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch("/admin/email-config", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-email-config"] });
      toast({ title: "Configuración guardada", description: "Los cambios han sido aplicados correctamente." });
      setApiKey("");
    },
    onError: (e) => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  const deleteKeyMutation = useMutation({
    mutationFn: () => apiFetch("/admin/email-config/key", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-email-config"] });
      toast({ title: "Clave API eliminada" });
    },
    onError: (e) => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, string> = {};
    if (apiKey.trim()) body.resend_api_key = apiKey.trim();
    if (emailFrom.trim()) body.email_from = emailFrom.trim();
    if (Object.keys(body).length === 0) return;
    saveMutation.mutate(body);
  };

  const keyIsSet = data?.resend_api_key_set === "true";

  return (
    <AdminShell
      title="Servidor de correo"
      description="Configura Resend para enviar correos de recuperación de contraseña a los usuarios"
    >
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      ) : (
        <div className="max-w-2xl space-y-5">
          {/* Status card */}
          <Card className={`rounded-2xl border shadow-sm ${keyIsSet ? "border-emerald-200 bg-emerald-50/40" : "border-border/50"}`}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${keyIsSet ? "bg-emerald-100" : "bg-slate-100"}`}>
                {keyIsSet
                  ? <CheckCircle className="w-6 h-6 text-emerald-600" />
                  : <Mail className="w-6 h-6 text-muted-foreground" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${keyIsSet ? "text-emerald-800" : "text-foreground"}`}>
                  {keyIsSet ? "Servidor de correo configurado" : "Sin servidor de correo"}
                </p>
                {keyIsSet && data?.resend_api_key_masked ? (
                  <p className="text-xs text-emerald-700 font-mono mt-0.5">{data.resend_api_key_masked}</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sin clave configurada — los correos de recuperación solo aparecen en el log del servidor
                  </p>
                )}
              </div>
              {keyIsSet && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 shrink-0"
                  onClick={() => deleteKeyMutation.mutate()}
                  disabled={deleteKeyMutation.isPending}
                >
                  {deleteKeyMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />
                  }
                  Eliminar clave
                </Button>
              )}
            </CardContent>
          </Card>

          {/* How to guide */}
          <Card className="rounded-2xl border-blue-200 bg-blue-50/50 shadow-sm">
            <CardContent className="p-5">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-800 mb-2">¿Cómo configurar Resend?</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-blue-700">
                    <li>Crea una cuenta gratuita en <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline font-medium inline-flex items-center gap-1">resend.com <ExternalLink className="w-3 h-3" /></a></li>
                    <li>Ve a «API Keys» en el panel y crea una nueva clave</li>
                    <li>Verifica tu dominio o usa el dominio de prueba de Resend</li>
                    <li>Pega la clave y el remitente en el formulario de abajo</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Config form */}
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                {keyIsSet ? "Actualizar configuración" : "Configurar Resend"}
              </CardTitle>
              <CardDescription>
                La clave API se almacena cifrada en la base de datos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="apiKey" className="text-sm font-medium">
                    {keyIsSet ? "Nueva clave API de Resend" : "Clave API de Resend"}
                  </Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder={keyIsSet ? "Escribe para reemplazar la clave actual" : "re_xxxxxxxxxxxxxxxxxxxxxxxx"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="rounded-xl font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="emailFrom" className="text-sm font-medium">Dirección del remitente</Label>
                  <Input
                    id="emailFrom"
                    type="text"
                    placeholder='ContabilGen Pro <noreply@tudominio.com>'
                    value={emailFrom}
                    onChange={(e) => setEmailFrom(e.target.value)}
                    className="rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    Formato: <span className="font-mono">Nombre &lt;correo@dominio.com&gt;</span> — El dominio debe estar verificado en Resend.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={saveMutation.isPending || (!apiKey.trim() && !emailFrom.trim())}
                  className="rounded-xl py-5 font-semibold gap-2"
                >
                  {saveMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />
                  }
                  Guardar configuración
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
