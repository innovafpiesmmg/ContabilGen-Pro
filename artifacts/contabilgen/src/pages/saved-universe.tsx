import { useParams } from "wouter";
import { useGetGeneration } from "@workspace/api-client-react";
import { UniverseViewer } from "@/components/accounting/UniverseViewer";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { FileWarning, ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function SavedUniverse() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  
  const { data, isLoading, isError } = useGetGeneration(id, {
    query: {
      queryKey: ['generation', id],
      enabled: id > 0,
      retry: false
    }
  });

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-8">
        <Skeleton className="w-40 h-10 rounded-xl" />
        <Card className="rounded-2xl border-border/50 shadow-sm min-h-[600px]">
          <CardContent className="p-8 space-y-6">
            <Skeleton className="w-1/3 h-10" />
            <Skeleton className="w-1/4 h-6" />
            <div className="pt-8 flex gap-4">
              <Skeleton className="w-24 h-10" />
              <Skeleton className="w-24 h-10" />
              <Skeleton className="w-24 h-10" />
            </div>
            <div className="space-y-4 pt-4">
              <Skeleton className="w-full h-32" />
              <Skeleton className="w-full h-32" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-[1400px] mx-auto pt-20">
        <Card className="rounded-2xl border-destructive/20 bg-destructive/5 max-w-2xl mx-auto shadow-sm">
          <CardContent className="p-12 flex flex-col items-center text-center space-y-4">
            <FileWarning className="w-16 h-16 text-destructive/50" />
            <h2 className="text-2xl font-bold text-destructive">Universo no encontrado</h2>
            <p className="text-muted-foreground">El universo contable que intentas buscar no existe o ha sido eliminado.</p>
            <Link href="/" className="mt-4">
              <Button variant="outline" className="gap-2">
                <ChevronLeft className="w-4 h-4" /> Volver al Inicio
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-[1400px] mx-auto pb-12"
    >
      <div className="mb-6 flex justify-between items-center no-print">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Visualización de Universo
          </h1>
          <p className="text-muted-foreground mt-1">
            Generado el {new Date(data.createdAt).toLocaleDateString('es-ES', { 
              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
            })}
          </p>
        </div>
      </div>
      
      <UniverseViewer 
        universe={data.universeJson} 
        hideSaveButton={true} 
      />
    </motion.div>
  );
}
