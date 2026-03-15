import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Building2, 
  MapPin, 
  Briefcase, 
  Calculator, 
  Calendar,
  Sparkles,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
});

type FormValues = z.infer<typeof formSchema>;

interface GeneratorFormProps {
  onSubmit: (data: GenerateUniverseRequest) => void;
  isPending: boolean;
}

export function GeneratorForm({ onSubmit, isPending }: GeneratorFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      taxRegime: "IVA",
      sector: "Comercio",
      complexity: "Avanzado",
      year: new Date().getFullYear(),
      companyName: "",
    },
  });

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
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 sm:px-8 space-y-8">
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
              name="complexity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-muted-foreground" />
                    Nivel de Complejidad
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled>
                    <FormControl>
                      <SelectTrigger className="rounded-xl bg-slate-50/50 opacity-80">
                        <SelectValue placeholder="Selecciona complejidad" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Avanzado">Avanzado (Completo)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>Incluye préstamos, pólizas, nóminas, etc.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-border/50">
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
