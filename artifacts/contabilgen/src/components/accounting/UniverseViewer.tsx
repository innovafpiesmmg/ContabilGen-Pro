import { AccountingUniverse } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, 
  PackageSearch, 
  Receipt, 
  Landmark, 
  CreditCard, 
  ShieldCheck, 
  Users, 
  Wallet,
  BookOpenText,
  Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  CompanyProfileView, 
  InventoryView, 
  InvoicesView,
  FinancialView,
  ExtraordinaryView,
  PayrollView,
  BankStatementView,
  JournalView
} from "./UniverseViews";

interface UniverseViewerProps {
  universe: AccountingUniverse;
  onSave?: () => void;
  isSaving?: boolean;
  hideSaveButton?: boolean;
}

export function UniverseViewer({ universe, onSave, isSaving, hideSaveButton }: UniverseViewerProps) {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-border/60 min-h-[600px] flex flex-col mt-8 animate-in fade-in duration-700">
      <div className="p-6 sm:px-8 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 rounded-t-2xl no-print">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">
            {universe.companyProfile.name}
          </h2>
          <p className="text-muted-foreground font-medium">
            Ejercicio {universe.companyProfile.fiscalYear} • {universe.companyProfile.taxRegime} • Nivel Avanzado
          </p>
        </div>
        {!hideSaveButton && onSave && (
          <Button 
            onClick={onSave} 
            disabled={isSaving}
            className="gap-2 shadow-md hover:shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Guardando..." : "Guardar Universo"}
          </Button>
        )}
      </div>

      <Tabs defaultValue="empresa" className="flex-1 flex flex-col">
        <div className="px-6 pt-4 border-b overflow-x-auto no-print scrollbar-hide">
          <TabsList className="h-12 bg-transparent space-x-1 pb-2 w-max min-w-full justify-start border-b-0">
            <TabsTrigger value="empresa" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg gap-2">
              <Building2 className="w-4 h-4" /> Empresa
            </TabsTrigger>
            <TabsTrigger value="inventarios" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg gap-2">
              <PackageSearch className="w-4 h-4" /> Inventarios
            </TabsTrigger>
            <TabsTrigger value="facturas" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg gap-2">
              <Receipt className="w-4 h-4" /> Facturas
            </TabsTrigger>
            <TabsTrigger value="financiero" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg gap-2">
              <Landmark className="w-4 h-4" /> Financiero
            </TabsTrigger>
            <TabsTrigger value="extraordinario" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg gap-2">
              <ShieldCheck className="w-4 h-4" /> Extraordinarios
            </TabsTrigger>
            <TabsTrigger value="nominas" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg gap-2">
              <Users className="w-4 h-4" /> Nóminas
            </TabsTrigger>
            <TabsTrigger value="bancos" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg gap-2">
              <Wallet className="w-4 h-4" /> Bancos
            </TabsTrigger>
            <TabsTrigger value="diario" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white rounded-lg gap-2 font-bold shadow-sm">
              <BookOpenText className="w-4 h-4" /> Libro Diario
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 p-6 sm:px-8 bg-white print:p-0">
          <TabsContent value="empresa" className="mt-0 outline-none">
            <CompanyProfileView data={universe} />
          </TabsContent>
          <TabsContent value="inventarios" className="mt-0 outline-none">
            <InventoryView data={universe.inventory} />
          </TabsContent>
          <TabsContent value="facturas" className="mt-0 outline-none">
            <InvoicesView data={universe.invoices} />
          </TabsContent>
          <TabsContent value="financiero" className="mt-0 outline-none">
            <FinancialView loan={universe.bankLoan} policy={universe.creditPolicy} card={universe.creditCardStatement} />
          </TabsContent>
          <TabsContent value="extraordinario" className="mt-0 outline-none">
            <ExtraordinaryView insurance={universe.insurancePolicies} casualty={universe.casualtyEvent} />
          </TabsContent>
          <TabsContent value="nominas" className="mt-0 outline-none">
            <PayrollView data={universe.payroll} />
          </TabsContent>
          <TabsContent value="bancos" className="mt-0 outline-none">
            <BankStatementView statements={universe.bankStatements} />
          </TabsContent>
          <TabsContent value="diario" className="mt-0 outline-none">
            <JournalView entries={universe.journalEntries} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
