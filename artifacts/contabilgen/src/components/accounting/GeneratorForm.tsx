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
  Receipt,
  PieChart,
  Scale,
  Banknote,
  TrendingUp,
  CalendarDays,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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

const ACTIVITIES_BY_SECTOR: Record<string, string[]> = {
  Comercio: [
    "Agrícola y fitosanitarios",
    "Alimentación y bebidas",
    "Automoción y recambios",
    "Construcción y materiales",
    "Deportes y ocio",
    "Droguería y limpieza",
    "Electrodomésticos",
    "Electrónica y tecnología",
    "Farmacia y parafarmacia",
    "Ferretería e industrial",
    "Joyería y relojería",
    "Juguetería",
    "Librería y papelería",
    "Moda y textil",
    "Mobiliario y decoración",
    "Óptica",
    "Productos para mascotas",
    "Productos de peluquería y estética",
  ],
  Servicios: [
    "Academia y formación",
    "Asesoría fiscal y contable",
    "Clínica dental",
    "Clínica veterinaria",
    "Consultoría empresarial",
    "Desarrollo de software",
    "Diseño gráfico y publicidad",
    "Electricidad e instalaciones",
    "Fontanería y calefacción",
    "Fotografía y vídeo",
    "Gestoría administrativa",
    "Limpieza profesional",
    "Mantenimiento y reparaciones",
    "Marketing digital",
    "Peluquería y estética",
    "Taller mecánico",
    "Transporte y logística",
    "Turismo y agencia de viajes",
  ],
  Industria: [
    "Agroalimentaria",
    "Carpintería y madera",
    "Cerámica y vidrio",
    "Confección textil",
    "Cosmética y perfumería",
    "Electrónica",
    "Envasado y embalaje",
    "Fabricación metálica",
    "Impresión y artes gráficas",
    "Industria cárnica",
    "Industria láctea",
    "Maquinaria industrial",
    "Materiales de construcción",
    "Panadería y bollería industrial",
    "Plásticos y caucho",
    "Productos químicos",
    "Vitivinícola y bodegas",
  ],
  Hostelería: [
    "Bar y cafetería",
    "Catering y eventos",
    "Cervecería artesanal",
    "Comida rápida y take-away",
    "Food truck",
    "Heladería y repostería",
    "Hostal y pensión",
    "Hotel",
    "Hotel rural y turismo rural",
    "Pizzería",
    "Pub y coctelería",
    "Restaurante",
    "Restaurante de comida asiática",
    "Restaurante vegetariano/vegano",
    "Sidrería",
    "Taberna y tapas",
  ],
};

const formSchema = z.object({
  taxRegime: z.enum(["IVA", "IGIC"]),
  sector: z.enum(["Comercio", "Servicios", "Industria", "Hostelería"]),
  activity: z.string().optional().nullable(),
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
  includeShareholdersInfo: z.boolean().optional(),
  isNewCompany: z.boolean().optional(),
  includeInitialBalance: z.boolean().optional(),
  includeShareholderAccounts: z.boolean().optional(),
  includeDividends: z.boolean().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
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
  group?: "society";
}

const checkOptions: CheckOption[] = [
  { name: "includePayroll", label: "Nóminas (IRPF + SS)", description: "Recibos de salario con retenciones y Seguridad Social", icon: Users },
  { name: "includeSocialSecurity", label: "TC1 Seguridad Social", description: "Boletines de cotización mensuales a la TGSS", icon: FileText, dependsOn: "includePayroll" },
  { name: "includeTaxLiquidation", label: "Impuestos (IVA/IS)", description: "Liquidaciones trimestrales Mod.303/420 y Mod.200 IS anual", icon: Receipt },
  { name: "includeBankLoan", label: "Préstamo bancario", description: "Cuadro de amortización y asientos de cuotas", icon: Landmark },
  { name: "includeMortgage", label: "Hipoteca", description: "Préstamo hipotecario sobre inmueble con tabla de amortización", icon: Home },
  { name: "includeCreditPolicy", label: "Póliza de crédito", description: "Cuenta de crédito con liquidación de intereses y comisiones", icon: BarChart3 },
  { name: "includeFixedAssets", label: "Inmovilizado y amortización", description: "Elementos del activo fijo con dotación anual de amortización", icon: Building2 },
  { name: "includeShareholdersInfo", label: "Socios y capital social", description: "Estructura de socios, participaciones y tipo de sociedad (SL, SA...)", icon: PieChart, group: "society" },
  { name: "includeInitialBalance", label: "Balance de apertura", description: "Asiento de apertura con activos, pasivos y patrimonio neto inicial", icon: Scale, group: "society" },
  { name: "includeShareholderAccounts", label: "C/C socios y admins", description: "Operaciones en cuentas 551 y 553: anticipos, préstamos y retribuciones", icon: Banknote, group: "society" },
  { name: "includeDividends", label: "Reparto de dividendos", description: "Junta de socios: dotación de reservas y pago de dividendos con retención IRPF", icon: TrendingUp, group: "society" },
];

function getMonthsBetween(start: string, end: string): number {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  return Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
}

export function GeneratorForm({ onSubmit, isPending }: GeneratorFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useCustomPeriod, setUseCustomPeriod] = useState(false);

  const today = new Date();
  const currentYear = today.getFullYear();
  const defaultStart = `${currentYear}-01-01`;
  const defaultEnd = `${currentYear}-12-31`;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      taxRegime: "IGIC",
      sector: "Comercio",
      activity: null,
      complexity: "Avanzado",
      year: currentYear,
      companyName: "",
      educationLevel: "Medio",
      operationsPerMonth: 8,
      includePayroll: true,
      includeSocialSecurity: true,
      includeTaxLiquidation: true,
      includeBankLoan: true,
      includeMortgage: true,
      includeCreditPolicy: true,
      includeFixedAssets: true,
      includeShareholdersInfo: true,
      isNewCompany: false,
      includeInitialBalance: true,
      includeShareholderAccounts: true,
      includeDividends: true,
      startDate: defaultStart,
      endDate: defaultEnd,
    },
  });

  const watchPayroll = form.watch("includePayroll");
  const watchIsNew = form.watch("isNewCompany");
  const watchOps = form.watch("operationsPerMonth") ?? 8;
  const watchStart = form.watch("startDate") ?? defaultStart;
  const watchEnd = form.watch("endDate") ?? defaultEnd;
  const watchSector = form.watch("sector");
  const activitiesForSector = ACTIVITIES_BY_SECTOR[watchSector] ?? [];

  const numMonths = useCustomPeriod ? getMonthsBetween(watchStart, watchEnd) : 12;
  const estimatedEntries = watchOps * numMonths;

  const handleSubmit = (data: FormValues) => {
    if (!data.includePayroll) {
      data.includeSocialSecurity = false;
    }
    if (data.isNewCompany) {
      data.includeInitialBalance = false;
      data.includeDividends = false;
    }
    const payload: Record<string, unknown> = { ...data };
    if (useCustomPeriod && data.startDate) {
      payload.year = parseInt(data.startDate.split("-")[0], 10);
    } else {
      delete payload.startDate;
      delete payload.endDate;
    }
    onSubmit(payload as GenerateUniverseRequest);
  };

  const enabledCount = checkOptions.filter(opt => {
    if (opt.dependsOn && !form.watch(opt.dependsOn as any)) return false;
    const isBalanceOrDividend = opt.name === "includeInitialBalance" || opt.name === "includeDividends";
    if (watchIsNew && isBalanceOrDividend) return false;
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
                  <Select onValueChange={(v) => { field.onChange(v); form.setValue("activity", null); }} defaultValue={field.value}>
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
              name="activity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    Actividad
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? undefined}
                    key={watchSector}
                  >
                    <FormControl>
                      <SelectTrigger className="rounded-xl bg-slate-50/50">
                        <SelectValue placeholder="Selecciona actividad (opcional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activitiesForSector.map((act) => (
                        <SelectItem key={act} value={act}>{act}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Contextualiza los productos, proveedores y documentos
                  </FormDescription>
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

            {/* Period selector */}
            <div className="lg:col-span-2">
              <Label className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                Período del Ejercicio
              </Label>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="custom-period"
                    checked={useCustomPeriod}
                    onCheckedChange={(checked) => {
                      setUseCustomPeriod(checked);
                      if (!checked) {
                        form.setValue("startDate", null);
                        form.setValue("endDate", null);
                      } else {
                        const y = form.getValues("year");
                        form.setValue("startDate", `${y}-01-01`);
                        form.setValue("endDate", `${y}-12-31`);
                      }
                    }}
                  />
                  <label htmlFor="custom-period" className="text-sm text-muted-foreground cursor-pointer select-none">
                    Período personalizado
                  </label>
                </div>
                {useCustomPeriod && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Clock className="w-3 h-3" />
                    {numMonths} mes{numMonths !== 1 ? "es" : ""}
                  </Badge>
                )}
              </div>

              {!useCustomPeriod ? (
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input 
                            type="number" 
                            className="rounded-xl bg-slate-50/50 pl-9" 
                            placeholder="Año fiscal completo"
                            {...field} 
                          />
                        </div>
                      </FormControl>
                      <FormDescription>Ejercicio anual completo (1 ene – 31 dic).</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Fecha inicio</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            className="rounded-xl bg-slate-50/50"
                            value={field.value ?? ""}
                            onChange={(e) => {
                              field.onChange(e.target.value);
                              if (e.target.value) {
                                form.setValue("year", parseInt(e.target.value.split("-")[0], 10));
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Fecha fin</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            className="rounded-xl bg-slate-50/50"
                            value={field.value ?? ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
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
                      <FormDescription>
                        Total estimado: ~{estimatedEntries} asientos
                        {useCustomPeriod ? ` en ${numMonths} mes${numMonths !== 1 ? "es" : ""}` : " anuales"}
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-semibold">Módulos a incluir</Label>
                    <div className="flex items-center gap-3">
                      <FormField
                        control={form.control}
                        name="isNewCompany"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2 space-y-0">
                            <FormControl>
                              <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <FormLabel className="text-xs text-muted-foreground font-normal cursor-pointer">Empresa de nueva creación</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {watchIsNew && (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3 border border-amber-200">
                      Al ser empresa nueva no se generará balance de apertura ni reparto de dividendos.
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {checkOptions.map((opt) => {
                      const isSociety = opt.group === "society";
                      const isSSDependency = opt.dependsOn === "includePayroll" && !watchPayroll;
                      const isNewCompanyDisabled = watchIsNew && (opt.name === "includeInitialBalance" || opt.name === "includeDividends");
                      const disabled = isSSDependency || isNewCompanyDisabled;
                      const Icon = opt.icon;

                      let itemClass = "flex items-start gap-3 p-3 rounded-xl border transition-colors ";
                      if (disabled) {
                        itemClass += "opacity-40 bg-slate-50 border-border/30";
                      } else if (isSociety) {
                        const val = form.watch(opt.name as any);
                        itemClass += val ? "border-violet-300 bg-violet-50/60" : "border-violet-100 bg-slate-50/50";
                      } else {
                        const val = form.watch(opt.name as any);
                        itemClass += val ? "border-primary/30 bg-primary/5" : "border-border/50 bg-slate-50/50";
                      }

                      return (
                        <FormField
                          key={opt.name}
                          control={form.control}
                          name={opt.name as any}
                          render={({ field }) => (
                            <FormItem className={itemClass}>
                              <FormControl>
                                <Checkbox
                                  checked={!!field.value && !disabled}
                                  onCheckedChange={field.onChange}
                                  disabled={!!disabled}
                                  className={`mt-0.5 ${isSociety && !disabled ? "data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600" : ""}`}
                                />
                              </FormControl>
                              <div className="space-y-0.5 flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isSociety ? "text-violet-500" : "text-muted-foreground"}`} />
                                  <FormLabel className="text-sm font-medium leading-tight cursor-pointer">{opt.label}</FormLabel>
                                  {isSociety && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 border border-violet-200 leading-none">
                                      Sociedad
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground leading-tight">{opt.description}</p>
                                {isSSDependency && <p className="text-xs text-amber-600">Requiere activar Nóminas</p>}
                                {isNewCompanyDisabled && <p className="text-xs text-amber-600">No aplica a empresa nueva</p>}
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
