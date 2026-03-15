import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, CheckCircle, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`/api${path}`, { ...options, credentials: "include", headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) } });
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
      toast({ title: "Configuración guardada" });
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
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Servidor de correo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configura Resend para enviar correos de recuperación de contraseña
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex gap-3">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-medium mb-1">¿Cómo obtener una clave API de Resend?</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-600">
            <li>Crea una cuenta gratuita en <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">resend.com</a></li>
            <li>En el panel, ve a «API Keys» y crea una nueva clave</li>
            <li>Verifica tu dominio o usa el dominio de prueba de Resend</li>
            <li>Pega la clave y el remitente a continuación</li>
          </ol>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
          <div className="mb-6 flex items-center gap-3 pb-5 border-b border-border">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${keyIsSet ? "bg-green-100" : "bg-slate-100"}`}>
              {keyIsSet
                ? <CheckCircle className="w-5 h-5 text-green-600" />
                : <Mail className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div>
              <p className="font-medium text-sm text-foreground">
                {keyIsSet ? "Clave API configurada" : "Sin clave API"}
              </p>
              {keyIsSet && data?.resend_api_key_masked && (
                <p className="text-xs text-muted-foreground font-mono">{data.resend_api_key_masked}</p>
              )}
              {!keyIsSet && (
                <p className="text-xs text-muted-foreground">Los correos de recuperación se muestran solo en el log del servidor</p>
              )}
            </div>
            {keyIsSet && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-destructive hover:text-destructive"
                onClick={() => deleteKeyMutation.mutate()}
                disabled={deleteKeyMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Eliminar clave
              </Button>
            )}
          </div>

          <form onSubmit={handleSave} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apiKey">
                {keyIsSet ? "Actualizar clave API de Resend" : "Clave API de Resend"}
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
              <Label htmlFor="emailFrom">Dirección de remitente</Label>
              <Input
                id="emailFrom"
                type="text"
                placeholder="ContabilGen Pro <noreply@tudominio.com>"
                value={emailFrom}
                onChange={(e) => setEmailFrom(e.target.value)}
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                Formato: «Nombre &lt;correo@dominio.com&gt;» — El dominio debe estar verificado en Resend.
              </p>
            </div>

            <Button
              type="submit"
              disabled={saveMutation.isPending || (!apiKey.trim() && !emailFrom.trim())}
              className="w-full rounded-xl py-5 font-semibold"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar configuración"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
