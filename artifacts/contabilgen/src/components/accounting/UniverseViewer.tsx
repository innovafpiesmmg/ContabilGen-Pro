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
  Archive,
  Loader2,
  BookCheck,
  Scale,
  TrendingUp,
  ClipboardList,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  CompanyProfileView, 
  InventoryView, 
  InvoicesView,
  FinancialView,
  ExtraordinaryView,
  ExtraordinaryExpensesView,
  WarehouseCardsView,
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
  CronologiaView,
  BankDebitNotesView,
  SubAccountsView,
  LedgerView,
  TrialBalanceView,
  RegularizationView,
  ProfitAndLossView,
  FinalBalanceSheetView,
  ClosingEntryView,
} from "./UniverseViews";
import { usePdfExport } from "@/hooks/usePdfExport";
import { useToast } from "@/hooks/use-toast";

interface UniverseViewerProps {
  universe: AccountingUniverse;
  onSave?: () => void;
  isSaving?: boolean;
  hideSaveButton?: boolean;
}

export function UniverseViewer({ universe, onSave, isSaving, hideSaveButton }: UniverseViewerProps) {
  const [activeTab, setActiveTab] = useState("empresa");
  const contentRef = useRef<HTMLDivElement>(null);
  const { exporting, exportTab, exportDocumentsAsZip } = usePdfExport();
  const { toast } = useToast();

  const hasTaxLiquidations = universe.taxLiquidations && universe.taxLiquidations.length > 0;
  const hasSS = universe.socialSecurityPayments && universe.socialSecurityPayments.length > 0;
  const hasMortgage = !!universe.mortgage;
  const hasFixedAssets = universe.fixedAssets && universe.fixedAssets.length > 0;
  const hasShareholders = !!universe.shareholdersInfo;
  const hasInitialBalanceSheet = !!universe.initialBalanceSheet;
  const hasShareholderAccounts = !!universe.shareholderAccounts;
  const hasDividends = !!universe.dividendDistribution;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bankDebitNotes: unknown[] = (universe as any).bankDebitNotes ?? [];
  const hasBankDebitNotes = bankDebitNotes.length > 0;
  const hasExtraExpenses = universe.extraordinaryExpenses && universe.extraordinaryExpenses.length > 0;
  const hasWarehouseCards = universe.warehouseCards && universe.warehouseCards.length > 0;
  const hasSubAccounts = !!(universe as any).subAccounts && ((universe as any).subAccounts as unknown[]).length > 0;
  const yearEndClosing = (universe as any).yearEndClosing as any;
  const hasYearEndClosing = !!yearEndClosing?.ledger;

  const companyName = universe.companyProfile.name;


  const handleExportCurrentTab = async () => {
    if (!contentRef.current) return;
    const labels: Record<string, string> = {
      cronologia: "Cronología", empresa: "Empresa", inventarios: "Inventarios", almacen: "Almacén",
      facturas: "Facturas", financiero: "Préstamo y Crédito", hipoteca: "Hipoteca",
      extraordinario: "Extraordinarios", nominas: "Nóminas", ss: "SS TC1",
      impuestos: "Impuestos", inmovilizado: "Inmovilizado",
      socios: "Socios", balance_apertura: "Balance Apertura", cc_socios: "CC Socios",
      dividendos: "Dividendos", bancos: "Extracto Bancario", diario: "Libro Diario",
      notas_cargo: "Notas de Cargo",
    };
    const label = labels[activeTab] ?? activeTab;
    const safeName = companyName.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 25);
    try {
      await exportTab(contentRef.current, companyName, label, `ContabilGen_${safeName}_${activeTab}.pdf`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[PDF export] error:", msg, err);
      toast({ variant: "destructive", title: "Error al exportar PDF", description: msg });
    }
  };

  const handleExportAll = async () => {
    try {
      await exportDocumentsAsZip(universe);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ZIP export] error:", msg, err);
      toast({ variant: "destructive", title: "Error al generar ZIP", description: msg });
    }
  };

  const isExporting = exporting !== null;

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-border/60 min-h-[600px] flex flex-col mt-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="p-6 sm:px-8 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 rounded-t-2xl no-print">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">
            {companyName}
          </h2>
          <p className="text-muted-foreground font-medium">
            Ejercicio {universe.companyProfile.fiscalYear} · {universe.companyProfile.taxRegime} · Nivel Avanzado
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handleExportCurrentTab}
            disabled={isExporting}
            variant="outline"
            className="gap-2 rounded-xl border-border"
          >
            {exporting && exporting !== "zip" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            PDF esta pestaña
          </Button>
          <Button
            onClick={handleExportAll}
            disabled={isExporting}
            variant="outline"
            className="gap-2 rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            {exporting === "zip" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Archive className="w-4 h-4" />
            )}
            {exporting === "zip" ? "Generando documentos..." : "Descargar Documentos ZIP"}
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

      {isExporting && (
        <div className="px-8 py-2 bg-amber-50 border-b border-amber-100 text-sm text-amber-700 flex items-center gap-2 no-print">
          <Loader2 className="w-4 h-4 animate-spin" />
          {exporting === "zip"
            ? "Generando documentos individuales (facturas, extractos, nóminas…) y empaquetando ZIP."
            : `Generando PDF de "${exporting}"…`}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-6 pt-4 border-b overflow-x-auto no-print scrollbar-hide">
          <TabsList className="h-12 bg-transparent space-x-1 pb-2 w-max min-w-full justify-start border-b-0">
            <TabsTrigger value="cronologia" className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 rounded-lg gap-2 font-semibold">
              <FileText className="w-4 h-4" /> Cronología
            </TabsTrigger>
            <TabsTrigger value="empresa" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg gap-2">
              <Building2 className="w-4 h-4" /> Empresa
            </TabsTrigger>
            <TabsTrigger value="inventarios" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg gap-2">
              <PackageSearch className="w-4 h-4" /> Inventarios
            </TabsTrigger>
            {hasWarehouseCards && (
              <TabsTrigger value="almacen" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800 rounded-lg gap-2">
                <Archive className="w-4 h-4" /> Almacén
              </TabsTrigger>
            )}
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
            {hasSubAccounts && (
              <TabsTrigger value="subcuentas" className="data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700 rounded-lg gap-2 font-semibold">
                <Archive className="w-4 h-4" /> Subcuentas
              </TabsTrigger>
            )}
            <TabsTrigger value="diario" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white rounded-lg gap-2 font-bold shadow-sm">
              <BookOpenText className="w-4 h-4" /> Libro Diario
            </TabsTrigger>
            {hasBankDebitNotes && (
              <TabsTrigger value="notas_cargo" className="data-[state=active]:bg-red-700 data-[state=active]:text-white rounded-lg gap-2 font-semibold">
                <FileDown className="w-4 h-4" /> Notas de Cargo
              </TabsTrigger>
            )}
            {hasYearEndClosing && (
              <>
                <div className="w-full px-2 py-2"><div className="border-t border-slate-300" /><p className="text-[10px] text-slate-400 uppercase tracking-widest text-center mt-1">Cierre del Ejercicio</p></div>
                <TabsTrigger value="mayor" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-lg gap-2 font-semibold">
                  <BookCheck className="w-4 h-4" /> Libro Mayor
                </TabsTrigger>
                <TabsTrigger value="sumas_saldos" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-lg gap-2 font-semibold">
                  <Scale className="w-4 h-4" /> Balance Sumas y Saldos
                </TabsTrigger>
                <TabsTrigger value="regularizacion" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white rounded-lg gap-2 font-semibold">
                  <ClipboardList className="w-4 h-4" /> Regularización
                </TabsTrigger>
                <TabsTrigger value="pyg" className="data-[state=active]:bg-emerald-700 data-[state=active]:text-white rounded-lg gap-2 font-semibold">
                  <TrendingUp className="w-4 h-4" /> Pérdidas y Ganancias
                </TabsTrigger>
                <TabsTrigger value="balance_final" className="data-[state=active]:bg-violet-700 data-[state=active]:text-white rounded-lg gap-2 font-semibold">
                  <Home className="w-4 h-4" /> Balance de Situación
                </TabsTrigger>
                <TabsTrigger value="asiento_cierre" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white rounded-lg gap-2 font-bold">
                  <Lock className="w-4 h-4" /> Asiento de Cierre
                </TabsTrigger>
              </>
            )}
          </TabsList>
        </div>

        <div ref={contentRef} className="flex-1 p-6 sm:px-8 bg-white print:p-0">
          <TabsContent value="cronologia" className="mt-0 outline-none">
            <CronologiaView data={universe} />
          </TabsContent>
          <TabsContent value="empresa" className="mt-0 outline-none">
            <CompanyProfileView data={universe} />
          </TabsContent>
          <TabsContent value="inventarios" className="mt-0 outline-none">
            <InventoryView data={universe.inventory} />
          </TabsContent>
          {hasWarehouseCards && (
            <TabsContent value="almacen" className="mt-0 outline-none">
              <WarehouseCardsView data={universe.warehouseCards} />
            </TabsContent>
          )}
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
            {hasExtraExpenses && <ExtraordinaryExpensesView data={universe.extraordinaryExpenses} />}
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
          {hasSubAccounts && (
            <TabsContent value="subcuentas" className="mt-0 outline-none">
              <SubAccountsView data={universe} />
            </TabsContent>
          )}
          <TabsContent value="diario" className="mt-0 outline-none">
            <JournalView entries={universe.journalEntries} universe={universe} />
          </TabsContent>
          {hasBankDebitNotes && (
            <TabsContent value="notas_cargo" className="mt-0 outline-none">
              <BankDebitNotesView
                notes={bankDebitNotes as Parameters<typeof BankDebitNotesView>[0]["notes"]}
                company={universe.companyProfile}
              />
            </TabsContent>
          )}
          {hasYearEndClosing && (
            <>
              <TabsContent value="mayor" className="mt-0 outline-none">
                <LedgerView data={yearEndClosing} />
              </TabsContent>
              <TabsContent value="sumas_saldos" className="mt-0 outline-none">
                <TrialBalanceView data={yearEndClosing} />
              </TabsContent>
              <TabsContent value="regularizacion" className="mt-0 outline-none">
                <RegularizationView data={yearEndClosing} />
              </TabsContent>
              <TabsContent value="pyg" className="mt-0 outline-none">
                <ProfitAndLossView data={yearEndClosing} />
              </TabsContent>
              <TabsContent value="balance_final" className="mt-0 outline-none">
                <FinalBalanceSheetView data={yearEndClosing} />
              </TabsContent>
              <TabsContent value="asiento_cierre" className="mt-0 outline-none">
                <ClosingEntryView data={yearEndClosing} />
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}
