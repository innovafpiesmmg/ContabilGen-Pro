import { useState } from "react";
import { GeneratorForm } from "@/components/accounting/GeneratorForm";
import { UniverseViewer } from "@/components/accounting/UniverseViewer";
import { 
  useGenerateAccountingUniverse, 
  useSaveGeneration,
  GenerateUniverseRequest,
  AccountingUniverse
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListGenerationsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function Dashboard() {
  const [universe, setUniverse] = useState<AccountingUniverse | null>(null);
  const [requestData, setRequestData] = useState<GenerateUniverseRequest | null>(null);
  
  const generateMutation = useGenerateAccountingUniverse();
  const saveMutation = useSaveGeneration();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleGenerate = async (data: GenerateUniverseRequest) => {
    setRequestData(data);
    try {
      const result = await generateMutation.mutateAsync({ data });
      setUniverse(result);
      toast({
        title: "Universo generado con éxito",
        description: "Revisa las diferentes pestañas para explorar los documentos y el libro diario.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al generar",
        description: error.message || "Ocurrió un error al contactar a la IA.",
      });
    }
  };

  const handleSave = async () => {
    if (!universe || !requestData) return;
    
    try {
      await saveMutation.mutateAsync({
        data: {
          companyName: universe.companyProfile.name,
          sector: requestData.sector,
          taxRegime: requestData.taxRegime,
          fiscalYear: requestData.year,
          universeJson: universe
        }
      });
      
      queryClient.invalidateQueries({ queryKey: getListGenerationsQueryKey() });
      toast({
        title: "Universo guardado",
        description: "El universo ha sido guardado en tu historial.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: error.message || "No se pudo guardar en la base de datos.",
      });
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <GeneratorForm 
          onSubmit={handleGenerate} 
          isPending={generateMutation.isPending} 
        />
      </motion.div>

      {universe && (
        <UniverseViewer 
          universe={universe} 
          onSave={handleSave} 
          isSaving={saveMutation.isPending} 
        />
      )}
    </div>
  );
}
