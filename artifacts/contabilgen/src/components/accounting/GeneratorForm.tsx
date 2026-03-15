import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Building2, 
  MapPin, 
  Briefcase, 
  Calendar,
  Sparkles,
  Loader2,
  Settings2,
  ChevronDown,
  ChevronUp,
  Users,
  FileText,
  Landmark,
  Home,
  BarChart3,
  Receipt
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { GenerateUniverseRequest } from "@workspace/api-client-react";

const formSchema = z.object({
  taxRegime: z.enum(["IVA", "IGIC"]),
  sector: z.enum(["Comercio", "Servicios", "Industria", "Hostelería"]),
  complexity: z.enum(["Avanzado"]),
  year: z.coerce.number().min(2000).max(2100),
  companyName: z.string().optional().nullable(),
  educationLevel: z.enum(["Medio", "Superior"]).optional(),
  operationsPerMonth: z.number().min(3).max(25).optional(),
  includePayroll: z.boolean().optional(),
  includeSocialSecurity: z.boolean().optional(),
  includeTaxLiquidation: z.boolean().optional(),
  includeBankLoan: z.boolean().optional(),
  includeMortgage: z.boolean().optional(),
  includeCreditPolicy: z.boolean().optional(),
  includeFixedAssets: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface GeneratorFormProps {
  onSubmit: (data: GenerateUniverseRequest) => void;
  isPending: boolean;
}

interface CheckOption {
  name: keyof FormValues;
  label: string;
  description: string;
  icon: React.ElementType;
  dependsOn?: keyof FormValues;
}

const checkOptions: CheckOption[] = [
  { name: "includePayroll", label: "Nóminas (IRPF + SS)", description: "Recibos de salario con retenciones y Seguridad Social", icon: Users },
  { name: "includeSocialSecurity", label: "TC1 Seguridad Social", description: "Boletines de cotización mensuales a la TGSS", icon: FileText, dependsOn: "includePayroll" },
  { name: "includeTaxLiquidation", label: "Impuestos (IVA/IS)", description: "Liquidaciones trimestrales Mod.303/420 y Mod.200 IS anual", icon: Receipt },
  { name: "includeBankLoan", label: "Préstamo bancario", description: "Cuadro de amortización y asientos de cuotas", icon: Landmark },
  { name: "includeMortgage", label: "Hipoteca", description: "Préstamo hipotecario sobre inmueble con tabla de amortización", icon: Home },
  { name: "includeCreditPolicy", label: "Póliza de crédito", description: "Cuenta de crédito con liquidación de intereses y comisiones", icon: BarChart3 },
  { name: "includeFixedAssets", label: "Inmovilizado y amortización", description: "Elementos del activo fijo con dotación anual de amortización", icon: Building2 },
];

export function GeneratorForm({ onSubmit, isPending }: GeneratorFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      taxRegime: "IVA",
      sector: "Comercio",
      complexity: "Avanzado",
      year: new Date().getFullYear(),
      companyName: "",
      educationLevel: "Medio",
      operationsPerMonth: 8,
      includePayroll: true,
      includeSocialSecurity: true,
      includeTaxLiquidation: true,
      includeBankLoan: true,
      includeMortgage: false,
      includeCreditPolicy: true,
      includeFixedAssets: true,
    },
  });

  const watchPayroll = form.watch("includePayroll");
  const watchOps = form.watch("operationsPerMonth") ?? 8;

  const handleSubmit = (data: FormValues) => {
    if (!data.includePayroll) {
      data.includeSocialSecurity = false;
    }
    onSubmit(data as GenerateUniverseRequest);
  };

  const enabledCount = checkOptions.filter(opt => {
    if (opt.dependsOn && !form.watch(opt.dependsOn as any)) return false;
    return form.watch(opt.name as any) === true;
  }).length;

  return (
    <div className="bg-white rounded-2xl shadow-xl shadow-blue-900/5 border border-border/50 overflow-hidden">
      <div className="bg-gradient-to-r from-primary/5 to-transparent border-b border-border/50 p-6 sm:px-8 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Configuración del Universo Contable
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Define los parámetros para generar una nueva simulación con IA.
          </p>
        </div>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="p-6 sm:px-8 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    Nombre de la Empresa
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Innovaciones SL (Opcional)" 
                      className="rounded-xl bg-slate-50/50" 
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormDescription>Dejar en blanco para autogenerar.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sector"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    Sector Económico
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="rounded-xl bg-slate-50/50">
                        <SelectValue placeholder="Selecciona un sector" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Comercio">Comercio</SelectItem>
                      <SelectItem value="Servicios">Servicios</SelectItem>
                      <SelectItem value="Industria">Industria</SelectItem>
                      <SelectItem value="Hostelería">Hostelería</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="taxRegime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    Régimen Fiscal
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="rounded-xl bg-slate-50/50">
                        <SelectValue placeholder="Selecciona régimen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="IVA">IVA (Península/Baleares)</SelectItem>
                      <SelectItem value="IGIC">IGIC (Canarias)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    Ejercicio Fiscal
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      className="rounded-xl bg-slate-50/50" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="educationLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-muted-foreground" />
                    Nivel Educativo
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="rounded-xl bg-slate-50/50">
                        <SelectValue placeholder="Selecciona nivel" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Medio">Grado Medio</SelectItem>
                      <SelectItem value="Superior">Grado Superior</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>Adapta la complejidad de las operaciones.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="border border-border/40 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between p-4 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm text-foreground">Configuración Avanzada</span>
                <Badge variant="secondary" className="text-xs">
                  {enabledCount} módulos activos
                </Badge>
              </div>
              {showAdvanced ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {showAdvanced && (
              <div className="p-6 space-y-6 border-t border-border/40 bg-white">
                <FormField
                  control={form.control}
                  name="operationsPerMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">
                        Operaciones por mes en el Libro Diario: <span className="text-primary font-bold">{watchOps}</span>
                      </FormLabel>
                      <FormControl>
                        <div className="pt-2 px-1">
                          <Slider
                            min={3}
                            max={20}
                            step={1}
                            value={[field.value ?? 8]}
                            onValueChange={(v) => field.onChange(v[0])}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>3 (básico)</span>
                            <span>20 (intensivo)</span>
                          </div>
                        </div>
                      </FormControl>
                      <FormDescription>Total estimado: ~{watchOps * 12} asientos anuales</FormDescription>
                    </FormItem>
                  )}
                />

                <div>
                  <Label className="text-sm font-semibold block mb-3">Módulos a incluir</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {checkOptions.map((opt) => {
                      const disabled = opt.dependsOn && !form.watch(opt.dependsOn as any);
                      const Icon = opt.icon;
                      return (
                        <FormField
                          key={opt.name}
                          control={form.control}
                          name={opt.name as any}
                          render={({ field }) => (
                            <FormItem className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                              disabled ? "opacity-40 bg-slate-50" : field.value ? "border-primary/30 bg-primary/5" : "border-border/50 bg-slate-50/50"
                            }`}>
                              <FormControl>
                                <Checkbox
                                  checked={!!field.value}
                                  onCheckedChange={field.onChange}
                                  disabled={!!disabled}
                                  className="mt-0.5"
                                />
                              </FormControl>
                              <div className="space-y-0.5 flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                  <FormLabel className="text-sm font-medium leading-tight cursor-pointer">{opt.label}</FormLabel>
                                </div>
                                <p className="text-xs text-muted-foreground leading-tight">{opt.description}</p>
                                {disabled && <p className="text-xs text-amber-600">Requiere activar Nóminas</p>}
                              </div>
                            </FormItem>
                          )}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button 
              type="submit" 
              disabled={isPending}
              size="lg"
              className="rounded-xl px-8 shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 transition-all text-base font-semibold"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generando Universo...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Generar Universo Contable
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
