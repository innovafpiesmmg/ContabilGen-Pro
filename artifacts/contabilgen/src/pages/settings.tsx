import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { useGetSettings, useUpdateSettings, AiSettingsProvider } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings as SettingsIcon, Save, Cpu, Share2 } from "lucide-react";

const settingsSchema = z.object({
  provider: z.enum(["deepseek", "shared_deepseek"]),
  deepseekApiKey: z.string().optional(),
  deepseekBaseUrl: z.string().min(1, "La URL base es requerida"),
  deepseekModel: z.string().min(1, "El modelo es requerido"),
}).superRefine((data, ctx) => {
  if (data.provider === "deepseek" && !data.deepseekApiKey) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "La API Key es requerida cuando se usa DeepSeek propio",
      path: ["deepseekApiKey"],
    });
  }
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();

  const sharedAvailable = (settings as typeof settings & { sharedDeepseekAvailable?: boolean })?.sharedDeepseekAvailable ?? false;
  const sharedModel = (settings as typeof settings & { sharedDeepseekModel?: string | null })?.sharedDeepseekModel;

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      provider: "deepseek",
      deepseekApiKey: "",
      deepseekBaseUrl: "https://api.deepseek.com",
      deepseekModel: "deepseek-chat",
    },
  });

  useEffect(() => {
    if (settings) {
      const p = settings.provider as AiSettingsProvider;
      form.reset({
        provider: (p === "deepseek" || p === "shared_deepseek") ? p : "deepseek",
        deepseekApiKey: settings.deepseekApiKey || "",
        deepseekBaseUrl: settings.deepseekBaseUrl || "https://api.deepseek.com",
        deepseekModel: settings.deepseekModel || "deepseek-chat",
      });
    }
  }, [settings, form]);

  const provider = form.watch("provider");

  const onSubmit = async (data: SettingsFormValues) => {
    try {
      await updateSettings.mutateAsync({
        data: {
          provider: data.provider as AiSettingsProvider,
          deepseekApiKey: data.deepseekApiKey || null,
          deepseekBaseUrl: data.deepseekBaseUrl,
          deepseekModel: data.deepseekModel,
        }
      });
      
      queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      
      toast({
        title: "Configuración guardada",
        description: "Los cambios se han guardado correctamente.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: "Hubo un problema al guardar la configuración.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-[800px] mx-auto space-y-8">
        <Skeleton className="h-10 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto space-y-8 pb-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground flex items-center gap-3">
              <SettingsIcon className="w-8 h-8 text-primary" />
              Configuración
            </h1>
            <p className="text-muted-foreground mt-1">
              Ajusta las preferencias de la aplicación y proveedores de IA.
            </p>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card className="shadow-sm border-border/50 overflow-hidden">
            <div className="h-2 w-full bg-gradient-to-r from-primary to-primary/50"></div>
            
            <CardHeader className="pb-6 relative">
              <div className="absolute right-6 top-6">
                <Badge variant="secondary" className="shadow-sm gap-1.5 px-3 py-1">
                  {provider === "shared_deepseek" ? <Share2 className="w-3.5 h-3.5" /> : <Cpu className="w-3.5 h-3.5" />}
                  Usando: {provider === "shared_deepseek" ? "DeepSeek compartido" : "DeepSeek"} ✓
                </Badge>
              </div>
              <CardTitle className="text-xl">Configuración de IA</CardTitle>
              <CardDescription>
                Selecciona el proveedor de inteligencia artificial para generar los universos contables.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <Label className="text-base font-semibold">Proveedor de IA</Label>
                <RadioGroup 
                  value={provider} 
                  onValueChange={(value) => form.setValue("provider", value as "deepseek" | "shared_deepseek", { shouldValidate: true })}
                  className={`grid gap-4 ${sharedAvailable ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}
                >
                  <div>
                    <RadioGroupItem value="deepseek" id="deepseek" className="peer sr-only" />
                    <Label
                      htmlFor="deepseek"
                      className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                    >
                      <Cpu className="mb-3 h-8 w-8" />
                      <div className="text-center">
                        <div className="font-semibold">DeepSeek (API Key propia)</div>
                        <div className="text-xs text-muted-foreground mt-1">Introduce tu propia clave de DeepSeek</div>
                      </div>
                    </Label>
                  </div>

                  {sharedAvailable && (
                    <div>
                      <RadioGroupItem value="shared_deepseek" id="shared_deepseek" className="peer sr-only" />
                      <Label
                        htmlFor="shared_deepseek"
                        className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                      >
                        <Share2 className="mb-3 h-8 w-8 text-green-600" />
                        <div className="text-center">
                          <div className="font-semibold">DeepSeek compartido</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {sharedModel ? `Modelo: ${sharedModel}` : "Proporcionado por el administrador"}
                          </div>
                        </div>
                      </Label>
                    </div>
                  )}
                </RadioGroup>
              </div>

              {provider === "deepseek" && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-5 p-5 bg-muted/30 rounded-xl border border-border"
                >
                  <div className="space-y-2">
                    <Label htmlFor="deepseekApiKey">API Key de DeepSeek</Label>
                    <Input 
                      id="deepseekApiKey"
                      type="password"
                      placeholder="sk-..."
                      {...form.register("deepseekApiKey")}
                      className={form.formState.errors.deepseekApiKey ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {form.formState.errors.deepseekApiKey && (
                      <p className="text-sm text-destructive font-medium">{form.formState.errors.deepseekApiKey.message}</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="deepseekBaseUrl">URL Base</Label>
                      <Input 
                        id="deepseekBaseUrl"
                        placeholder="https://api.deepseek.com"
                        {...form.register("deepseekBaseUrl")}
                      />
                      {form.formState.errors.deepseekBaseUrl && (
                        <p className="text-sm text-destructive font-medium">{form.formState.errors.deepseekBaseUrl.message}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="deepseekModel">Modelo</Label>
                      <Input 
                        id="deepseekModel"
                        placeholder="deepseek-chat"
                        {...form.register("deepseekModel")}
                      />
                      <p className="text-xs text-muted-foreground">Disponibles: deepseek-chat, deepseek-reasoner</p>
                      {form.formState.errors.deepseekModel && (
                        <p className="text-sm text-destructive font-medium">{form.formState.errors.deepseekModel.message}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {provider === "shared_deepseek" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl"
                >
                  <Share2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800">Usando la clave compartida del administrador</p>
                    <p className="text-xs text-green-700 mt-0.5">
                      No necesitas configurar ninguna API key. El administrador ha habilitado el acceso a DeepSeek para todos los usuarios.
                      {sharedModel && ` Modelo activo: ${sharedModel}.`}
                    </p>
                  </div>
                </motion.div>
              )}
            </CardContent>
            
            <div className="bg-muted/30 px-6 py-4 flex justify-end border-t border-border">
              <Button type="submit" disabled={updateSettings.isPending} className="gap-2 rounded-xl shadow-md hover:shadow-lg transition-all min-w-[200px]">
                <Save className="w-4 h-4" />
                {updateSettings.isPending ? "Guardando..." : "Guardar Configuración"}
              </Button>
            </div>
          </Card>
        </form>
      </motion.div>
    </div>
  );
}
