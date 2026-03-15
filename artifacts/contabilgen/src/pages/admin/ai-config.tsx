import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Cpu, Save, Trash2, Eye, EyeOff, KeyRound, CheckCircle2, XCircle } from "lucide-react";

interface DeepseekConfig {
  shared_deepseek_enabled?: string;
  shared_deepseek_api_key_set?: string;
  shared_deepseek_api_key_masked?: string;
  shared_deepseek_base_url?: string;
  shared_deepseek_model?: string;
}

export default function AdminAiConfigPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<DeepseekConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com");
  const [model, setModel] = useState("deepseek-chat");

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      const res = await fetch("/api/admin/deepseek-config", { credentials: "include" });
      const data = await res.json();
      setConfig(data.config ?? {});
      setEnabled(data.config?.shared_deepseek_enabled === "true");
      setBaseUrl(data.config?.shared_deepseek_base_url || "https://api.deepseek.com");
      setModel(data.config?.shared_deepseek_model || "deepseek-chat");
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo cargar la configuración." });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { enabled, base_url: baseUrl, model };
      if (apiKey.trim()) body.api_key = apiKey.trim();

      const res = await fetch("/api/admin/deepseek-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Configuración guardada", description: "Los cambios se han aplicado correctamente." });
      setApiKey("");
      await fetchConfig();
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la configuración." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteKey() {
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/deepseek-config/key", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      toast({ title: "Clave eliminada", description: "La API key compartida ha sido borrada." });
      await fetchConfig();
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar la clave." });
    } finally {
      setDeleting(false);
    }
  }

  const keyIsSet = config.shared_deepseek_api_key_set === "true";

  return (
    <AdminLayout>
      <div className="p-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Cpu className="w-6 h-6 text-primary" />
            DeepSeek compartido
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configura una clave API de DeepSeek para que todos los usuarios puedan usarla sin necesidad de la suya propia.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="shadow-sm border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Estado del servicio compartido</CardTitle>
                    <CardDescription>Activa o desactiva el uso de la clave compartida para todos los usuarios.</CardDescription>
                  </div>
                  {keyIsSet ? (
                    <Badge variant="default" className="gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Clave configurada
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      Sin clave
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Switch
                    id="enabled"
                    checked={enabled}
                    onCheckedChange={setEnabled}
                    disabled={!keyIsSet}
                  />
                  <Label htmlFor="enabled" className="cursor-pointer">
                    {enabled ? "Activado — los usuarios pueden seleccionar DeepSeek compartido" : "Desactivado"}
                  </Label>
                </div>
                {!keyIsSet && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Debes introducir una API key para poder activar el servicio compartido.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/50">
              <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-t-xl" />
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  API Key de DeepSeek
                </CardTitle>
                <CardDescription>
                  La clave se almacena de forma segura en la base de datos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {keyIsSet && (
                  <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border">
                    <div className="flex items-center gap-2 min-w-0">
                      <KeyRound className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-mono text-sm text-foreground truncate">
                        {config.shared_deepseek_api_key_masked}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDeleteKey}
                      disabled={deleting}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 shrink-0 ml-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      {deleting ? "Eliminando..." : "Eliminar"}
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="apiKey">
                    {keyIsSet ? "Nueva API Key (deja vacío para mantener la actual)" : "API Key"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type={showApiKey ? "text" : "password"}
                      placeholder="sk-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="baseUrl">URL Base</Label>
                    <Input
                      id="baseUrl"
                      placeholder="https://api.deepseek.com"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Modelo</Label>
                    <Input
                      id="model"
                      placeholder="deepseek-chat"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Ej: deepseek-chat, deepseek-reasoner</p>
                  </div>
                </div>
              </CardContent>
              <div className="bg-muted/30 px-6 py-4 flex justify-end border-t border-border">
                <Button onClick={handleSave} disabled={saving} className="gap-2 rounded-xl min-w-[160px]">
                  <Save className="w-4 h-4" />
                  {saving ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
