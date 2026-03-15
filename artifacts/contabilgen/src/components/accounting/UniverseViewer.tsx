import { useState, useRef } from "react";
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
  Save,
  FileDown,
  Home,
  Calculator,
  FileText,
  BarChart3,
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
  JournalView,
  TaxLiquidationsView,
  SocialSecurityView,
  MortgageView,
  FixedAssetsView,
  ShareholdersView,
  InitialBalanceSheetView,
  ShareholderAccountsView,
  DividendsView,
} from "./UniverseViews";

interface UniverseViewerProps {
  universe: AccountingUniverse;
  onSave?: () => void;
  isSaving?: boolean;
  hideSaveButton?: boolean;
}

export function UniverseViewer({ universe, onSave, isSaving, hideSaveButton }: UniverseViewerProps) {
  const [activeTab, setActiveTab] = useState("empresa");
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const hasTaxLiquidations = universe.taxLiquidations && universe.taxLiquidations.length > 0;
  const hasSS = universe.socialSecurityPayments && universe.socialSecurityPayments.length > 0;
  const hasMortgage = !!universe.mortgage;
  const hasFixedAssets = universe.fixedAssets && universe.fixedAssets.length > 0;
  const hasShareholders = !!universe.shareholdersInfo;
  const hasInitialBalanceSheet = !!universe.initialBalanceSheet;
  const hasShareholderAccounts = !!universe.shareholderAccounts;
  const hasDividends = !!universe.dividendDistribution;

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-border/60 min-h-[600px] flex flex-col mt-8 animate-in fade-in duration-700">
      <div className="p-6 sm:px-8 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 rounded-t-2xl no-print">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">
            {universe.companyProfile.name}
          </h2>
          <p className="text-muted-foreground font-medium">
            Ejercicio {universe.companyProfile.fiscalYear} · {universe.companyProfile.taxRegime} · Nivel Avanzado
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handlePrint}
            variant="outline"
            className="gap-2 rounded-xl border-border"
          >
            <FileDown className="w-4 h-4" />
            Imprimir / PDF
          </Button>
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
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
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
              <Landmark className="w-4 h-4" /> Préstamo
            </TabsTrigger>
            {hasMortgage && (
              <TabsTrigger value="hipoteca" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg gap-2">
                <Home className="w-4 h-4" /> Hipoteca
              </TabsTrigger>
            )}
            <TabsTrigger value="extraordinario" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg gap-2">
              <ShieldCheck className="w-4 h-4" /> Extraordinarios
            </TabsTrigger>
            <TabsTrigger value="nominas" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg gap-2">
              <Users className="w-4 h-4" /> Nóminas
            </TabsTrigger>
            {hasSS && (
              <TabsTrigger value="ss" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg gap-2">
                <FileText className="w-4 h-4" /> SS / TC1
              </TabsTrigger>
            )}
            {hasTaxLiquidations && (
              <TabsTrigger value="impuestos" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg gap-2">
                <Calculator className="w-4 h-4" /> Impuestos
              </TabsTrigger>
            )}
            {hasFixedAssets && (
              <TabsTrigger value="inmovilizado" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg gap-2">
                <BarChart3 className="w-4 h-4" /> Inmovilizado
              </TabsTrigger>
            )}
            {hasShareholders && (
              <TabsTrigger value="socios" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg gap-2">
                <Users className="w-4 h-4" /> Socios
              </TabsTrigger>
            )}
            {hasInitialBalanceSheet && (
              <TabsTrigger value="balance_apertura" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg gap-2">
                <BarChart3 className="w-4 h-4" /> Apertura
              </TabsTrigger>
            )}
            {hasShareholderAccounts && (
              <TabsTrigger value="cc_socios" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg gap-2">
                <Calculator className="w-4 h-4" /> C/C Socios
              </TabsTrigger>
            )}
            {hasDividends && (
              <TabsTrigger value="dividendos" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg gap-2">
                <Landmark className="w-4 h-4" /> Dividendos
              </TabsTrigger>
            )}
            <TabsTrigger value="bancos" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg gap-2">
              <Wallet className="w-4 h-4" /> Bancos
            </TabsTrigger>
            <TabsTrigger value="diario" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white rounded-lg gap-2 font-bold shadow-sm">
              <BookOpenText className="w-4 h-4" /> Libro Diario
            </TabsTrigger>
          </TabsList>
        </div>

        <div ref={contentRef} className="flex-1 p-6 sm:px-8 bg-white print:p-0">
          {/* Print-only header with logo and company info */}
          <div className="hidden print-only mb-6 pb-4 border-b-2 border-gray-300">
            <div className="flex items-center justify-between">
              <img src="/logo.png" alt="ContabilGen Pro" className="h-10 w-auto" />
              <div className="text-right">
                <div className="font-bold text-lg">{universe.companyProfile.name}</div>
                <div className="text-sm text-gray-600">NIF: {universe.companyProfile.nif} · Ejercicio {universe.companyProfile.fiscalYear} · {universe.companyProfile.taxRegime}</div>
                <div className="text-sm text-gray-600">{universe.companyProfile.address}, {universe.companyProfile.city}</div>
              </div>
            </div>
          </div>
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
          {hasMortgage && (
            <TabsContent value="hipoteca" className="mt-0 outline-none">
              <MortgageView mortgage={universe.mortgage} company={universe.companyProfile} />
            </TabsContent>
          )}
          <TabsContent value="extraordinario" className="mt-0 outline-none">
            <ExtraordinaryView insurance={universe.insurancePolicies} casualty={universe.casualtyEvent} />
          </TabsContent>
          <TabsContent value="nominas" className="mt-0 outline-none">
            <PayrollView data={universe.payroll} />
          </TabsContent>
          {hasSS && (
            <TabsContent value="ss" className="mt-0 outline-none">
              <SocialSecurityView payments={universe.socialSecurityPayments!} company={universe.companyProfile} />
            </TabsContent>
          )}
          {hasTaxLiquidations && (
            <TabsContent value="impuestos" className="mt-0 outline-none">
              <TaxLiquidationsView liquidations={universe.taxLiquidations!} company={universe.companyProfile} />
            </TabsContent>
          )}
          {hasFixedAssets && (
            <TabsContent value="inmovilizado" className="mt-0 outline-none">
              <FixedAssetsView assets={universe.fixedAssets!} company={universe.companyProfile} />
            </TabsContent>
          )}
          {hasShareholders && (
            <TabsContent value="socios" className="mt-0 outline-none">
              <ShareholdersView data={universe.shareholdersInfo} />
            </TabsContent>
          )}
          {hasInitialBalanceSheet && (
            <TabsContent value="balance_apertura" className="mt-0 outline-none">
              <InitialBalanceSheetView data={universe.initialBalanceSheet} />
            </TabsContent>
          )}
          {hasShareholderAccounts && (
            <TabsContent value="cc_socios" className="mt-0 outline-none">
              <ShareholderAccountsView data={universe.shareholderAccounts} />
            </TabsContent>
          )}
          {hasDividends && (
            <TabsContent value="dividendos" className="mt-0 outline-none">
              <DividendsView data={universe.dividendDistribution} />
            </TabsContent>
          )}
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
