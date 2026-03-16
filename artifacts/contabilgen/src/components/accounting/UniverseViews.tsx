import React, { useMemo, useCallback } from 'react';
import { saveAs } from "file-saver";
import {
  generateInvoicePdf, generateBankStatementPdf, generatePayrollPdf,
  generateSSPaymentPdf, generateTaxLiquidationPdf, generateBankLoanPdf,
  generateMortgagePdf, generateCreditPolicyPdf, generateCreditCardStatementPdf,
  generateInsurancePolicyPdf, generateCasualtyReportPdf, generateFixedAssetCardPdf,
  generateBankDebitNotePdf, generateDividendDistributionPdf, generateShareholdersInfoPdf,
  generateInitialBalancePdf, generateShareholderAccountsPdf,
  generateExtraordinaryExpensePdf,
  generateServiceInvoicePdf,
  generatePaymentReceiptPdf,
  type CP,
} from "@/lib/pdfDocuments";
import { 
  AccountingUniverse, 
  AccountEntry, 
  Invoice, 
  InventoryItem,
  AmortizationRow,
  CreditCardMovement,
  PayrollEmployee,
  BankTransaction,
  JournalEntry,
  TaxLiquidation,
  Mortgage,
  SocialSecurityPayment,
  FixedAsset,
  BankLoan,
  CreditPolicy,
  CreditCardStatement,
  InsurancePolicy,
  CasualtyEvent,
  ExtraordinaryExpense,
  WarehouseCard,
  WarehouseMovement,
  Payroll,
  BankStatement,
  ShareholdersInfo,
  InitialBalanceSheet,
  ShareholderAccounts,
  DividendDistribution,
  Shareholder,
} from "@workspace/api-client-react";
import { cn, formatEuro, formatDate, formatAccountCode } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// --- Shared Components ---
const SectionTitle = ({ title, icon: Icon, description }: { title: string, icon?: any, description?: string }) => (
  <div className="mb-6 pb-4 border-b border-border/60">
    <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
      {Icon && <Icon className="w-6 h-6 text-primary" />}
      {title}
    </h2>
    {description && <p className="text-muted-foreground mt-2">{description}</p>}
  </div>
);

const AsientoContable = ({ debits, credits, note }: { debits: AccountEntry[], credits: AccountEntry[], note?: string }) => {
  const totalDebit = debits.reduce((acc, d) => acc + d.amount, 0);
  const totalCredit = credits.reduce((acc, c) => acc + c.amount, 0);

  return (
    <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden print-break-inside-avoid">
      <div className="bg-slate-100/80 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider flex justify-between items-center border-b border-slate-200">
        <span>Propuesta de Asiento Contable</span>
        {note && <span className="text-slate-400 font-normal lowercase normal-case">{note}</span>}
      </div>
      <Table className="text-sm">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[120px] text-right text-slate-600">Debe</TableHead>
            <TableHead className="w-[80px] text-center text-slate-600">Cuenta</TableHead>
            <TableHead className="text-slate-600">Concepto</TableHead>
            <TableHead className="w-[120px] text-right text-slate-600">Haber</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {debits.map((d, i) => (
            <TableRow key={`d-${i}`} className="border-0 hover:bg-slate-100/50">
              <TableCell className="text-right font-mono font-medium text-blue-700">{formatEuro(d.amount)}</TableCell>
              <TableCell className="text-center font-mono text-slate-500">{d.accountCode || ''}</TableCell>
              <TableCell className="text-slate-700">{(d.accountName && d.accountName !== 'undefined') ? d.accountName : ''}{d.description ? <span className="text-xs text-slate-400 ml-1">({d.description})</span> : null}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          ))}
          {credits.map((c, i) => (
            <TableRow key={`c-${i}`} className="border-0 hover:bg-slate-100/50">
              <TableCell></TableCell>
              <TableCell className="text-center font-mono text-slate-500">{c.accountCode || ''}</TableCell>
              <TableCell className="text-slate-700 pl-8 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-px bg-slate-300"></span>
                {(c.accountName && c.accountName !== 'undefined') ? c.accountName : ''}{c.description ? <span className="text-xs text-slate-400 ml-1">({c.description})</span> : null}
              </TableCell>
              <TableCell className="text-right font-mono font-medium text-emerald-700">{formatEuro(c.amount)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-slate-100/50 border-t border-slate-200">
            <TableCell className="text-right font-mono font-bold text-slate-700">{formatEuro(totalDebit)}</TableCell>
            <TableCell colSpan={2} className="text-right text-xs font-semibold text-slate-500">TOTAL</TableCell>
            <TableCell className="text-right font-mono font-bold text-slate-700">{formatEuro(totalCredit)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

// --- Specific Views ---

export const CompanyProfileView = ({ data }: { data: AccountingUniverse }) => {
  const { companyProfile: company, suppliers, clients } = data;
  
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle title="Perfil de la Empresa" description="Datos fiscales y comerciales de la entidad principal." />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="bg-muted/30 border-b pb-4">
            <CardTitle className="font-display text-xl text-primary">{company.name}</CardTitle>
            <CardDescription>{company.description}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-2 gap-y-4 gap-x-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">NIF</p>
              <p className="font-mono font-medium">{company.nif}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Régimen Fiscal</p>
              <Badge variant="outline" className="font-semibold text-primary bg-primary/5">{company.taxRegime}</Badge>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Dirección</p>
              <p>{company.address}, {company.city}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Sector</p>
              <p className="font-medium">{company.sector}{company.activity ? ` — ${company.activity}` : ""}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Ejercicio</p>
              <p className="font-medium">{company.fiscalYear}</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Proveedores (Acreedores)</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {suppliers.map(s => (
                  <li key={s.nif} className="flex justify-between items-center p-2 rounded-lg bg-muted/30">
                    <div>
                      <p className="font-semibold text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{s.nif} • {s.accountCode}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Clientes (Deudores)</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {clients.map(c => (
                  <li key={c.nif} className="flex justify-between items-center p-2 rounded-lg bg-muted/30">
                    <div>
                      <p className="font-semibold text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{c.nif} • {c.accountCode}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export const InventoryView = ({ data }: { data: AccountingUniverse['inventory'] }) => {
  const renderTable = (items: InventoryItem[], total: number, title: string) => (
    <Card className="rounded-2xl shadow-sm overflow-hidden print-break-inside-avoid">
      <CardHeader className="bg-slate-50 border-b">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead className="text-right">Coste Unit.</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-center">Cuenta PGC</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(item => (
            <TableRow key={item.code}>
              <TableCell className="font-mono text-xs">{item.code}</TableCell>
              <TableCell className="font-medium">{item.description}</TableCell>
              <TableCell className="text-right">{item.quantity}</TableCell>
              <TableCell className="text-right font-mono">{formatEuro(item.unitCost)}</TableCell>
              <TableCell className="text-right font-mono font-medium">{formatEuro(item.totalCost)}</TableCell>
              <TableCell className="text-center">
                <Badge variant="secondary" className="font-mono">{item.accountCode}</Badge>
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/30">
            <TableCell colSpan={4} className="text-right font-bold">TOTAL INVENTARIO:</TableCell>
            <TableCell className="text-right font-mono font-bold text-primary">{formatEuro(total)}</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle title="Control de Existencias" description="Desglose del inventario inicial y final del ejercicio para el cálculo de la variación." />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderTable(data.initialInventory, data.initialTotal, "Inventario Inicial (Apertura)")}
        {renderTable(data.finalInventory, data.finalTotal, "Inventario Final (Cierre)")}
      </div>

      <Card className="rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 print-break-inside-avoid">
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <h3 className="text-lg font-bold text-foreground">Variación de Existencias (Grupo 3)</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Inventario Final - Inventario Inicial. Si es positivo, supone un ingreso (haber 71x). Si es negativo, un gasto (debe 61x).
            </p>
          </div>
          <div className="text-right">
            <div className={cn(
              "text-3xl font-mono font-bold tracking-tight",
              data.stockVariation >= 0 ? "text-emerald-600" : "text-destructive"
            )}>
              {data.stockVariation > 0 ? "+" : ""}{formatEuro(data.stockVariation)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const InvoicesView = ({ data }: { data: Invoice[] }) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle title="Facturación" description="Registro de facturas emitidas y recibidas con su correspondiente apunte contable." />
      
      <div className="space-y-8">
        {data.map(invoice => (
          <Card key={invoice.invoiceNumber} className="rounded-2xl shadow-md border-border/60 overflow-hidden print-break-inside-avoid">
            <div className={cn(
              "h-2 w-full",
              invoice.type === 'sale' ? "bg-emerald-500" : invoice.type === 'purchase' ? "bg-blue-500" : "bg-amber-500"
            )} />
            <CardHeader className="pb-4 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/50">
              <div>
                <Badge variant="outline" className={cn(
                  "mb-2 uppercase tracking-wider text-xs font-bold",
                  invoice.type === 'sale' ? "text-emerald-700 bg-emerald-50 border-emerald-200" : 
                  invoice.type === 'purchase' ? "text-blue-700 bg-blue-50 border-blue-200" : 
                  "text-amber-700 bg-amber-50 border-amber-200"
                )}>
                  {invoice.type === 'sale' ? 'Factura Emitida' : invoice.type === 'purchase' ? 'Factura Recibida' : 'Factura Rectificativa'}
                </Badge>
                <CardTitle className="text-2xl font-mono">{invoice.invoiceNumber}</CardTitle>
                <CardDescription className="mt-1 font-medium text-foreground">Fecha: {formatDate(invoice.date)}</CardDescription>
              </div>
              <div className="sm:col-span-2 text-left sm:text-right">
                <p className="text-sm text-muted-foreground uppercase font-semibold">Tercero</p>
                <p className="font-bold text-lg">{invoice.partyName}</p>
                <p className="font-mono text-muted-foreground">{invoice.partyNif}</p>
                <p className="text-sm mt-1">Forma de pago: <span className="capitalize font-medium">{invoice.paymentMethod.replace('_', ' ')}</span></p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-100">
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Dto.</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{line.description}</TableCell>
                      <TableCell className="text-right">{line.quantity}</TableCell>
                      <TableCell className="text-right font-mono">{formatEuro(line.unitPrice)}</TableCell>
                      <TableCell className="text-right">{line.discount}%</TableCell>
                      <TableCell className="text-right font-mono">{formatEuro(line.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <div className="flex justify-end p-6 bg-slate-50 border-t border-b">
                <div className="w-full max-w-sm space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Base Imponible</span>
                    <span className="font-mono font-medium">{formatEuro(invoice.taxBase)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cuota Impuesto ({invoice.lines[0]?.taxRate}%)</span>
                    <span className="font-mono font-medium">{formatEuro(invoice.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-200">
                    <span>TOTAL FACTURA</span>
                    <span className="font-mono text-primary">{formatEuro(invoice.total)}</span>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <AsientoContable debits={invoice.accountDebits} credits={invoice.accountCredits} note={invoice.journalNote} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export const FinancialView = ({ loan, policy, card }: { loan?: BankLoan | null, policy?: CreditPolicy | null, card?: CreditCardStatement | null }) => {
  if (!loan && !policy && !card) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">No se han generado datos financieros.</p>
        <p className="text-sm mt-1">Activa las opciones de préstamo y póliza en la configuración avanzada.</p>
      </div>
    );
  }
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Préstamo */}
      {loan && (
        <section>
          <SectionTitle title="Préstamo Bancario" description="Condiciones del préstamo y cuadro de amortización (Sistema Francés)." />
          <Card className="rounded-2xl shadow-md overflow-hidden print-break-inside-avoid">
            <CardHeader className="bg-slate-50 border-b grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Entidad</p>
                <p className="font-bold">{loan.entity}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Principal</p>
                <p className="font-mono font-bold text-primary text-lg">{formatEuro(loan.principal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Tipo Interés</p>
                <p className="font-mono font-medium">{loan.annualRate}% Anual</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Plazo</p>
                <p className="font-medium">{loan.termMonths} meses</p>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {loan.initialClassification && (
                <div className="rounded-xl border p-4 bg-blue-50/50">
                  <h4 className="text-sm font-bold text-muted-foreground uppercase mb-3">Clasificación Inicial de la Deuda</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-white rounded-lg border">
                      <p className="text-xs text-muted-foreground font-semibold">170 — Largo Plazo (&gt; 12 meses)</p>
                      <p className="font-mono font-bold text-lg text-blue-700">{formatEuro(loan.initialClassification.longTerm170)}</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg border">
                      <p className="text-xs text-muted-foreground font-semibold">5200 — Corto Plazo (≤ 12 meses)</p>
                      <p className="font-mono font-bold text-lg text-amber-700">{formatEuro(loan.initialClassification.shortTerm5200)}</p>
                    </div>
                  </div>
                </div>
              )}
              {loan.reclassification31Dec && (
                <div className="rounded-xl border p-4 bg-amber-50/50">
                  <h4 className="text-sm font-bold text-muted-foreground uppercase mb-2">Reclasificación al Cierre ({loan.reclassification31Dec.date})</h4>
                  <p className="text-sm text-slate-600 mb-2">Traspasar de 170 (LP) a 5200 (CP) el capital que vence en los próximos 12 meses:</p>
                  <p className="font-mono font-bold text-lg text-amber-700">{formatEuro(loan.reclassification31Dec.shortTerm5200)}</p>
                </div>
              )}
              <h4 className="text-sm font-bold text-muted-foreground uppercase mb-4">Cuadro de Amortización — Sistema Francés</h4>
              <div className="rounded-xl border overflow-hidden mb-6">
                <Table>
                  <TableHeader className="bg-slate-100">
                    <TableRow>
                      <TableHead className="text-center w-16">Mes</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Cuota (Total)</TableHead>
                      <TableHead className="text-right">Intereses</TableHead>
                      <TableHead className="text-right">Amort. Principal</TableHead>
                      <TableHead className="text-right">Capital Pendiente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loan.amortizationTable.slice(0, 12).map(row => (
                      <TableRow key={row.period}>
                        <TableCell className="text-center font-medium">{row.period}</TableCell>
                        <TableCell>{formatDate(row.date)}</TableCell>
                        <TableCell className="text-right font-mono bg-slate-50">{formatEuro(row.installment)}</TableCell>
                        <TableCell className="text-right font-mono text-destructive/80">{formatEuro(row.interest)}</TableCell>
                        <TableCell className="text-right font-mono text-primary/80">{formatEuro(row.principal)}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatEuro(row.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {loan.formalizationEntry ? (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-muted-foreground uppercase">Asiento de Formalización</h4>
                  <AsientoContable debits={loan.formalizationEntry.accountDebits} credits={loan.formalizationEntry.accountCredits} note={loan.journalNote} />
                  {loan.installmentEntry && (
                    <>
                      <h4 className="text-sm font-bold text-muted-foreground uppercase mt-4">Asiento de Pago de Cuota</h4>
                      <AsientoContable debits={loan.installmentEntry.accountDebits} credits={loan.installmentEntry.accountCredits} note={loan.installmentEntry.journalNote} />
                    </>
                  )}
                  {loan.reclassificationEntry && (
                    <>
                      <h4 className="text-sm font-bold text-muted-foreground uppercase mt-4">Asiento de Reclasificación LP → CP</h4>
                      <AsientoContable debits={loan.reclassificationEntry.accountDebits} credits={loan.reclassificationEntry.accountCredits} note={loan.reclassificationEntry.journalNote} />
                    </>
                  )}
                </div>
              ) : (
                <AsientoContable debits={loan.accountDebits} credits={loan.accountCredits} note={loan.journalNote} />
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Póliza */}
      {policy && (
        <section>
          <SectionTitle title="Póliza de Crédito" description="Liquidación de intereses de la línea de crédito." />
          <Card className="rounded-2xl shadow-md overflow-hidden print-break-inside-avoid">
            <CardHeader className="bg-slate-50 border-b grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Entidad</p>
                <p className="font-bold">{policy.entity}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Límite / Dispuesto</p>
                <p className="font-mono font-medium">
                  {formatEuro(policy.limit)} / <span className="text-destructive font-bold">{formatEuro(policy.drawnAmount)}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Interés Anual</p>
                <p className="font-mono font-medium">{policy.annualRate}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Liquidación Total</p>
                <p className="font-mono font-bold text-destructive text-lg">{formatEuro(policy.totalSettlement)}</p>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <AsientoContable debits={policy.accountDebits} credits={policy.accountCredits} note={policy.journalNote} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* Tarjeta */}
      {card && (
        <section>
          <SectionTitle title="Extracto Tarjeta de Crédito" description="Relación de gastos mensuales cargados en la tarjeta corporativa." />
          <Card className="rounded-2xl shadow-md overflow-hidden print-break-inside-avoid">
            <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Tarjeta {card.cardNumber}
                  <Badge variant="outline">{card.entity}</Badge>
                </CardTitle>
                <CardDescription>Período: {card.statementPeriod} | Liquidación: {formatDate(card.settlementDate)}</CardDescription>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Total Cargos</p>
                <p className="font-mono font-bold text-xl text-destructive">{formatEuro(card.totalCharges)}</p>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="rounded-xl border overflow-hidden mb-6">
                <Table>
                  <TableHeader className="bg-slate-100">
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Categoría / Cuenta</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {card.movements.map((mov, i) => (
                      <TableRow key={i}>
                        <TableCell>{formatDate(mov.date)}</TableCell>
                        <TableCell className="font-medium">{mov.description}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono font-normal mr-2">{mov.accountCode}</Badge>
                          <span className="text-sm text-muted-foreground">{mov.category}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatEuro(mov.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <AsientoContable debits={card.accountDebits} credits={card.accountCredits} note={card.journalNote} />
            </CardContent>
          </Card>
        </section>
      )}

    </div>
  );
};

export const ExtraordinaryView = ({ insurance, casualty }: { insurance?: InsurancePolicy[] | null, casualty?: CasualtyEvent | null }) => {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section>
        <SectionTitle title="Pólizas de Seguro" description="Primas anuales y ajustes de periodificación (gastos anticipados)." />
        <div className="space-y-6">
          {(insurance ?? []).map((ins, i) => (
            <Card key={i} className="rounded-2xl shadow-md overflow-hidden print-break-inside-avoid">
              <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Póliza: {ins.policyNumber}</CardTitle>
                  <CardDescription>{ins.insurer} - {ins.type}</CardDescription>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-lg">{formatEuro(ins.annualPremium)}</p>
                  <p className="text-xs text-muted-foreground font-medium mt-1">Prima Anual</p>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex gap-8 mb-6 text-sm">
                  <div>
                    <span className="text-muted-foreground mr-2">Vigencia:</span>
                    <span className="font-medium">{formatDate(ins.startDate)} al {formatDate(ins.endDate)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground mr-2">Gasto a periodificar (Cta 480):</span>
                    <span className="font-mono font-bold text-primary">{formatEuro(ins.prepaidExpense)}</span>
                  </div>
                </div>
                <AsientoContable debits={ins.accountDebits} credits={ins.accountCredits} note={ins.journalNote} />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {casualty && (
        <section>
          <SectionTitle title="Siniestro" description="Registro de pérdidas extraordinarias y compensaciones del seguro." />
          <Card className="rounded-2xl border-destructive/20 shadow-md overflow-hidden print-break-inside-avoid">
            <CardHeader className="bg-destructive/5 border-b border-destructive/10">
              <CardTitle className="text-destructive flex items-center gap-2">
                Siniestro: {casualty.assetAffected}
              </CardTitle>
              <CardDescription className="text-destructive/70">{casualty.description} - Fecha: {formatDate(casualty.date)}</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Valor Contable (Pérdida)</p>
                  <p className="font-mono text-xl text-destructive font-bold">{formatEuro(casualty.bookValue)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Indemnización Seguro</p>
                  <p className="font-mono text-xl text-emerald-600 font-bold">{formatEuro(casualty.insuranceCompensation)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Impacto Neto (Cta 678/778)</p>
                  <p className={cn(
                    "font-mono text-xl font-bold",
                    casualty.netLoss > 0 ? "text-destructive" : "text-emerald-600"
                  )}>
                    {formatEuro(Math.abs(casualty.netLoss))} {casualty.netLoss > 0 ? '(Pérdida)' : '(Beneficio)'}
                  </p>
                </div>
              </div>
              <AsientoContable debits={casualty.accountDebits} credits={casualty.accountCredits} note={casualty.journalNote} />
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
};

const EXTRA_TYPE_LABELS: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  multa: { label: "Multa / Sanción", color: "text-red-700", bgColor: "bg-red-50", borderColor: "border-red-200" },
  donacion: { label: "Donación", color: "text-purple-700", bgColor: "bg-purple-50", borderColor: "border-purple-200" },
  perdida_inmovilizado: { label: "Pérdida Inmovilizado", color: "text-orange-700", bgColor: "bg-orange-50", borderColor: "border-orange-200" },
  ingreso_extraordinario: { label: "Ingreso Extraordinario", color: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-200" },
  otro: { label: "Otro", color: "text-slate-700", bgColor: "bg-slate-50", borderColor: "border-slate-200" },
};

export const ExtraordinaryExpensesView = ({ data }: { data?: ExtraordinaryExpense[] | null }) => {
  if (!data?.length) return null;

  const isIncome = (e: ExtraordinaryExpense) => e.type === 'ingreso_extraordinario' || (e.accountCode || '').startsWith('7');
  const totalGastos = data.filter(e => !isIncome(e)).reduce((s, e) => s + e.amount, 0);
  const totalIngresos = data.filter(e => isIncome(e)).reduce((s, e) => s + e.amount, 0);

  return (
    <section className="mt-8">
      <SectionTitle title="Gastos e Ingresos Extraordinarios" description="Partidas no recurrentes: multas, sanciones, donaciones, pérdidas y beneficios extraordinarios." />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="rounded-xl border-destructive/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold">Total Gastos Extraordinarios</p>
              <p className="text-sm text-muted-foreground">Ctas. 671, 678, etc.</p>
            </div>
            <p className="font-mono text-2xl font-bold text-destructive">{formatEuro(totalGastos)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-emerald-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold">Total Ingresos Extraordinarios</p>
              <p className="text-sm text-muted-foreground">Ctas. 771, 778, etc.</p>
            </div>
            <p className="font-mono text-2xl font-bold text-emerald-600">{formatEuro(totalIngresos)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {data.map((exp, i) => {
          const style = EXTRA_TYPE_LABELS[exp.type] || EXTRA_TYPE_LABELS.otro;
          const isIngreso = isIncome(exp);
          return (
            <Card key={i} className="rounded-2xl shadow-md overflow-hidden print-break-inside-avoid">
              <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between">
                <div>
                  <Badge variant="outline" className={cn("mb-2 uppercase tracking-wider text-xs font-bold", style.color, style.bgColor, style.borderColor)}>
                    {style.label}
                  </Badge>
                  <CardTitle className="text-base">{exp.description}</CardTitle>
                  <CardDescription>Fecha: {formatDate(exp.date)}</CardDescription>
                </div>
                <div className="text-right">
                  <p className={cn("font-mono text-xl font-bold", isIngreso ? "text-emerald-600" : "text-destructive")}>
                    {isIngreso ? "+" : "-"}{formatEuro(exp.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cta. {exp.accountCode} ({exp.accountName})
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <AsientoContable debits={exp.accountDebits} credits={exp.accountCredits} note={exp.journalNote} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
};

export const WarehouseCardsView = ({ data }: { data?: WarehouseCard[] | null }) => {
  if (!data?.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">No se han generado fichas de almacén.</p>
        <p className="text-sm mt-1">Las fichas se generan automáticamente para empresas comerciales e industriales con inventario.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle title="Fichas de Almacén" description="Control de existencias por producto con método de valoración PMP (Precio Medio Ponderado)." />

      {data.map((card, ci) => (
        <Card key={ci} className="rounded-2xl shadow-md overflow-hidden print-break-inside-avoid">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b">
            <div className="flex items-center justify-between">
              <div>
                <Badge variant="outline" className="mb-2 font-mono text-xs bg-amber-100 text-amber-800 border-amber-300">
                  {card.productCode}
                </Badge>
                <CardTitle className="text-lg">{card.productDescription}</CardTitle>
                <CardDescription>Cuenta PGC: {card.accountCode} · Método: {card.valuationMethod}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100">
                    <TableHead rowSpan={2} className="border-r font-bold text-center align-middle">Fecha</TableHead>
                    <TableHead rowSpan={2} className="border-r font-bold align-middle">Concepto</TableHead>
                    <TableHead rowSpan={2} className="border-r font-bold text-xs align-middle">Doc.</TableHead>
                    <TableHead colSpan={3} className="border-r text-center font-bold bg-emerald-50 text-emerald-700">ENTRADAS</TableHead>
                    <TableHead colSpan={3} className="border-r text-center font-bold bg-red-50 text-red-700">SALIDAS</TableHead>
                    <TableHead colSpan={3} className="text-center font-bold bg-blue-50 text-blue-700">EXISTENCIAS</TableHead>
                  </TableRow>
                  <TableRow className="bg-slate-50 text-xs">
                    <TableHead className="text-right bg-emerald-50/50">Uds.</TableHead>
                    <TableHead className="text-right bg-emerald-50/50">P.Unit.</TableHead>
                    <TableHead className="text-right border-r bg-emerald-50/50">Total</TableHead>
                    <TableHead className="text-right bg-red-50/50">Uds.</TableHead>
                    <TableHead className="text-right bg-red-50/50">P.Unit.</TableHead>
                    <TableHead className="text-right border-r bg-red-50/50">Total</TableHead>
                    <TableHead className="text-right bg-blue-50/50">Uds.</TableHead>
                    <TableHead className="text-right bg-blue-50/50">P.Unit.</TableHead>
                    <TableHead className="text-right bg-blue-50/50">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {card.movements.map((mov, mi) => (
                    <TableRow key={mi} className={cn(
                      mi === 0 ? "bg-slate-50/50 font-medium" : "",
                      mov.concept.includes("Regularización") ? "bg-amber-50/30" : ""
                    )}>
                      <TableCell className="border-r text-xs whitespace-nowrap">{mov.date.includes("-") ? formatDate(mov.date) : mov.date}</TableCell>
                      <TableCell className="border-r text-sm max-w-[200px] truncate">{mov.concept}</TableCell>
                      <TableCell className="border-r text-xs font-mono">{mov.document}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{mov.entryQty > 0 ? mov.entryQty : ""}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{mov.entryQty > 0 ? formatEuro(mov.entryUnitCost) : ""}</TableCell>
                      <TableCell className="text-right font-mono text-xs border-r text-emerald-700">{mov.entryQty > 0 ? formatEuro(mov.entryTotal) : ""}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{mov.exitQty > 0 ? mov.exitQty : ""}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{mov.exitQty > 0 ? formatEuro(mov.exitUnitCost) : ""}</TableCell>
                      <TableCell className="text-right font-mono text-xs border-r text-red-600">{mov.exitQty > 0 ? formatEuro(mov.exitTotal) : ""}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium">{mov.balanceQty}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatEuro(mov.balanceUnitCost)}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-primary">{formatEuro(mov.balanceTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export const PayrollView = ({ data }: { data?: Payroll | null }) => {
  if (!data) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">No se han generado nóminas.</p>
        <p className="text-sm mt-1">Activa la opción Nóminas en la configuración avanzada del generador.</p>
      </div>
    );
  }
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle title={`Nóminas - ${data.month}`} description="Resumen de liquidación de sueldos, retenciones y seguros sociales." />
      
      <Card className="rounded-2xl shadow-md overflow-hidden print-break-inside-avoid">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle>Desglose por Empleado</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-100">
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead className="text-right">Sueldo Bruto</TableHead>
                <TableHead className="text-right">IRPF</TableHead>
                <TableHead className="text-right">SS Trab.</TableHead>
                <TableHead className="text-right">Neto a Pagar</TableHead>
                <TableHead className="text-right bg-slate-200/50">SS Empresa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.employees.map((emp, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <p className="font-semibold">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.category}</p>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">{formatEuro(emp.grossSalary)}</TableCell>
                  <TableCell className="text-right font-mono text-destructive/80">
                    <div>{formatEuro(emp.irpfAmount)}</div>
                    <div className="text-xs text-muted-foreground">{emp.irpfRate}%</div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-destructive/80">
                    <div>{formatEuro(emp.ssEmployeeAmount)}</div>
                    <div className="text-xs text-muted-foreground">{emp.ssEmployeeRate}%</div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-emerald-600 bg-emerald-50/30">
                    {formatEuro(emp.netSalary)}
                  </TableCell>
                  <TableCell className="text-right font-mono bg-slate-100/50">
                    {formatEuro(emp.ssEmployerAmount)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-slate-50 border-t-2 border-slate-200">
                <TableCell className="font-bold text-right">TOTALES:</TableCell>
                <TableCell className="text-right font-mono font-bold">{formatEuro(data.totalGross)}</TableCell>
                <TableCell className="text-right font-mono font-bold text-destructive">{formatEuro(data.totalIrpf)}</TableCell>
                <TableCell className="text-right font-mono font-bold text-destructive">{formatEuro(data.totalSsEmployee)}</TableCell>
                <TableCell className="text-right font-mono font-bold text-primary bg-primary/5">{formatEuro(data.totalNetSalary)}</TableCell>
                <TableCell className="text-right font-mono font-bold bg-slate-100">{formatEuro(data.totalSsEmployer)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-md border-border/60 overflow-hidden print-break-inside-avoid">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">Asiento Contable de Nóminas</h3>
            <div className="text-right">
              <p className="text-xs font-bold text-muted-foreground uppercase">Coste Laboral Total</p>
              <p className="font-mono text-xl font-bold">{formatEuro(data.totalLaborCost)}</p>
            </div>
          </div>
          <AsientoContable debits={data.accountDebits} credits={data.accountCredits} note={data.journalNote} />
        </CardContent>
      </Card>
    </div>
  );
};

export const BankStatementView = ({ statements }: { statements: BankStatement[] }) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle title="Extractos Bancarios" description="Movimientos en las cuentas corrientes de la empresa." />
      
      {statements.map((statement, idx) => (
        <Card key={idx} className="rounded-2xl shadow-md border-border/60 overflow-hidden print-break-inside-avoid">
          <CardHeader className="bg-slate-800 text-slate-50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                {statement.bank}
              </CardTitle>
              <CardDescription className="text-slate-300 font-mono mt-1">{statement.accountNumber} • {statement.period}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-100">
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="text-right">Cargo (Debe)</TableHead>
                  <TableHead className="text-right">Abono (Haber)</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-slate-50/50 italic text-muted-foreground">
                  <TableCell colSpan={4} className="text-right">Saldo Inicial</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{formatEuro(statement.openingBalance)}</TableCell>
                </TableRow>
                {statement.transactions.map((tx, i) => (
                  <TableRow key={i} className="hover:bg-slate-50">
                    <TableCell>{formatDate(tx.date)}</TableCell>
                    <TableCell className="font-medium">{tx.concept}</TableCell>
                    <TableCell className="text-right font-mono text-destructive">
                      {tx.debit ? formatEuro(tx.debit) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-600">
                      {tx.credit ? formatEuro(tx.credit) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">{formatEuro(tx.balance)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-100 border-t-2 border-slate-200">
                  <TableCell colSpan={4} className="text-right font-bold">SALDO FINAL</TableCell>
                  <TableCell className="text-right font-mono font-bold text-lg">{formatEuro(statement.closingBalance)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

function docBadgeStyle(doc: string): { bg: string; text: string; label: string } {
  const d = (doc || "").toLowerCase();
  if (d.includes("apertura")) return { bg: "bg-emerald-100 text-emerald-700 border-emerald-300", text: "Apertura", label: doc };
  if (d.startsWith("fra-") || d.startsWith("fv-") || /^[a-z]*\d+\//.test(d)) {
    if (d.includes("compra") || d.startsWith("fc")) return { bg: "bg-orange-100 text-orange-700 border-orange-300", text: "Fra. compra", label: doc };
    return { bg: "bg-blue-100 text-blue-700 border-blue-300", text: "Fra. venta", label: doc };
  }
  if (d.startsWith("rec-") || d.startsWith("cob-") || d.startsWith("pag-")) return { bg: "bg-sky-100 text-sky-700 border-sky-300", text: "Recibo", label: doc };
  if (d.includes("nómina") || d.includes("nomina")) return { bg: "bg-purple-100 text-purple-700 border-purple-300", text: "Nómina", label: doc };
  if (d.includes("tc1")) return { bg: "bg-amber-100 text-amber-700 border-amber-300", text: "TC1", label: doc };
  if (d.includes("mod.") || d.includes("modelo")) return { bg: "bg-red-100 text-red-700 border-red-300", text: "Liquidación", label: doc };
  if (d.includes("tarjeta")) return { bg: "bg-indigo-100 text-indigo-700 border-indigo-300", text: "Tarjeta", label: doc };
  if (d.includes("préstamo") || d.includes("prestamo")) return { bg: "bg-teal-100 text-teal-700 border-teal-300", text: "Préstamo", label: doc };
  if (d.includes("hipoteca")) return { bg: "bg-cyan-100 text-cyan-700 border-cyan-300", text: "Hipoteca", label: doc };
  if (d.includes("póliza") || d.includes("poliza") || d.includes("crédito") || d.includes("credito")) return { bg: "bg-violet-100 text-violet-700 border-violet-300", text: "Póliza", label: doc };
  if (d.includes("seguro")) return { bg: "bg-sky-100 text-sky-700 border-sky-300", text: "Seguro", label: doc };
  if (d.includes("siniestro")) return { bg: "bg-rose-100 text-rose-700 border-rose-300", text: "Siniestro", label: doc };
  if (d.includes("amort")) return { bg: "bg-gray-100 text-gray-700 border-gray-300", text: "Amortización", label: doc };
  if (d.includes("dividendo")) return { bg: "bg-yellow-100 text-yellow-700 border-yellow-300", text: "Dividendos", label: doc };
  if (d.includes("cc-socios") || d.includes("socio")) return { bg: "bg-pink-100 text-pink-700 border-pink-300", text: "Socios", label: doc };
  if (d.includes("extraordinario") || d.includes("gasto_extra") || d.includes("ingreso_extra")) return { bg: "bg-red-100 text-red-600 border-red-300", text: "Extraordinario", label: doc };
  return { bg: "bg-slate-100 text-slate-600 border-slate-300", text: "Doc.", label: doc };
}

function buildPdfLookup(universe: AccountingUniverse): Map<string, { gen: () => Blob; filename: string }> {
  const cp = buildCP(universe);
  const safe = (s: string) => (s || "").replace(/[/\\?%*:|"<>]/g, "-").substring(0, 50);
  const map = new Map<string, { gen: () => Blob; filename: string }>();

  (universe.invoices ?? []).forEach(inv => {
    const tipo = inv.type === "sale" ? "Venta" : "Compra";
    map.set(inv.invoiceNumber, { gen: () => generateInvoicePdf(inv, cp), filename: `Factura_${tipo}_${safe(inv.invoiceNumber)}.pdf` });
  });

  (universe.paymentReceipts ?? []).forEach(pr => {
    const tipo = pr.type === "cobro" ? "Cobro" : "Pago";
    map.set(pr.receiptNumber, { gen: () => generatePaymentReceiptPdf(pr, cp), filename: `${tipo}_${safe(pr.receiptNumber)}.pdf` });
  });

  (universe.serviceInvoices ?? []).forEach(si => {
    map.set(si.invoiceNumber, { gen: () => generateServiceInvoicePdf(si, cp), filename: `Suministro_${safe(si.invoiceNumber)}.pdf` });
  });

  const monthlyPayrolls = (universe as any).monthlyPayrolls as Array<typeof universe.payroll> | undefined;
  if (monthlyPayrolls?.length) {
    monthlyPayrolls.forEach(pay => {
      if (pay?.month) map.set(`Nómina ${pay.month}`, { gen: () => generatePayrollPdf(pay, cp), filename: `Nomina_${safe(pay.month)}.pdf` });
    });
  } else if (universe.payroll?.month) {
    map.set(`Nómina ${universe.payroll.month}`, { gen: () => generatePayrollPdf(universe.payroll!, cp), filename: `Nomina_${safe(universe.payroll!.month)}.pdf` });
  }

  (universe.socialSecurityPayments ?? []).forEach(ss => {
    map.set(`TC1-${ss.month}`, { gen: () => generateSSPaymentPdf(ss, cp), filename: `TC1_${safe(String(ss.month))}.pdf` });
  });

  (universe.taxLiquidations ?? []).forEach(t => {
    const ref = `Mod.${t.model}-${t.period}`;
    map.set(ref, { gen: () => generateTaxLiquidationPdf(t, cp), filename: `Mod${t.model}_${safe(t.period)}.pdf` });
  });

  if (universe.bankLoan) {
    const loan = universe.bankLoan;
    const num = loan.loanNumber || "";
    if (num) map.set(num, { gen: () => generateBankLoanPdf(loan, cp), filename: `Prestamo_${safe(num)}.pdf` });
  }

  if (universe.mortgage) {
    const mort = universe.mortgage;
    const num = mort.loanNumber || "";
    if (num) map.set(num, { gen: () => generateMortgagePdf(mort, cp), filename: `Hipoteca_${safe(num)}.pdf` });
  }

  if (universe.creditPolicy) {
    const pol = universe.creditPolicy;
    const num = pol.policyNumber || "";
    if (num) map.set(num, { gen: () => generateCreditPolicyPdf(pol, cp), filename: `Poliza_Credito_${safe(num)}.pdf` });
  }

  if (universe.creditCardStatement) {
    map.set("Tarjeta-liquidación", {
      gen: () => generateCreditCardStatementPdf(universe.creditCardStatement!, cp),
      filename: "Extracto_Tarjeta.pdf"
    });
  }

  (universe.insurancePolicies ?? []).forEach((ins: any) => {
    const num = ins.policyNumber || "";
    if (num) map.set(num, { gen: () => generateInsurancePolicyPdf(ins, cp), filename: `Poliza_Seguro_${safe(num)}.pdf` });
  });

  if (universe.casualtyEvent) {
    map.set("Siniestro", { gen: () => generateCasualtyReportPdf(universe.casualtyEvent!, cp), filename: "Siniestro.pdf" });
  }

  (universe.fixedAssets ?? []).forEach(a => {
    map.set(`Amort-${a.code || ""}`, { gen: () => generateFixedAssetCardPdf(a, cp), filename: `Inmovilizado_${safe(a.description)}.pdf` });
  });

  if (universe.initialBalanceSheet) {
    map.set("Asiento apertura", { gen: () => generateInitialBalancePdf(universe.initialBalanceSheet!, cp), filename: "Balance_Apertura.pdf" });
  }

  if (universe.dividendDistribution) {
    const dd = universe.dividendDistribution;
    map.set("Dividendos", { gen: () => generateDividendDistributionPdf(dd, cp), filename: `Dividendos_${dd.fiscalYear || ""}.pdf` });
  }

  if (universe.shareholderAccounts) {
    const acc = universe.shareholderAccounts;
    map.set("CC-Socios", { gen: () => generateShareholderAccountsPdf(acc, cp), filename: "Cta_Corriente_Socios.pdf" });
  }

  if (universe.shareholdersInfo) {
    map.set("Capital-social", { gen: () => generateShareholdersInfoPdf(universe.shareholdersInfo!, cp), filename: "Info_Socios.pdf" });
  }

  (universe.bankDebitNotes ?? []).forEach((note: any) => {
    const ref = note.noteNumber || note.reference || "";
    if (ref) map.set(ref, { gen: () => generateBankDebitNotePdf(note, cp), filename: `Nota_Cargo_${safe(ref)}.pdf` });
  });

  (universe.extraordinaryExpenses ?? []).forEach(exp => {
    const ref = `${exp.type}-${exp.date}`;
    const isInc = exp.type === "ingreso_extraordinario" || (exp.accountCode || "").startsWith("7");
    map.set(ref, { gen: () => generateExtraordinaryExpensePdf(exp, cp), filename: `${isInc ? "Ingreso" : "Gasto"}_Extra_${safe(exp.description)}.pdf` });
  });

  (universe.bankStatements ?? []).forEach(bs => {
    const key = `Extracto-${bs.bank || bs.period || ""}`;
    map.set(key, { gen: () => generateBankStatementPdf(bs, cp), filename: `Extracto_${safe(bs.bank || bs.period || "")}.pdf` });
  });

  return map;
}

function findPdf(pdfMap: Map<string, { gen: () => Blob; filename: string }>, docRef: string): { gen: () => Blob; filename: string } | undefined {
  if (!docRef) return undefined;
  const exact = pdfMap.get(docRef);
  if (exact) return exact;
  const normalized = docRef.toLowerCase().trim();
  if (normalized.length < 3) return undefined;
  for (const [key, val] of pdfMap) {
    if (key.toLowerCase().trim() === normalized) return val;
  }
  return undefined;
}

export const JournalView = ({ entries, universe }: { entries: JournalEntry[]; universe?: AccountingUniverse }) => {
  const pdfMap = useMemo(() => universe ? buildPdfLookup(universe) : new Map<string, { gen: () => Blob; filename: string }>(), [universe]);

  const handleDownload = useCallback((docRef: string) => {
    const pdf = findPdf(pdfMap, docRef);
    if (!pdf) return;
    try {
      const blob = pdf.gen();
      saveAs(blob, pdf.filename);
    } catch (err) {
      console.error("Error generando PDF:", err);
    }
  }, [pdfMap]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle title="Libro Diario" description="Registro cronológico de todos los asientos contables. Cada asiento incluye su documento de soporte." />
      
      <Card className="rounded-2xl shadow-xl border-border overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader className="bg-slate-800 text-slate-50">
              <TableRow className="hover:bg-slate-800">
                <TableHead className="text-slate-300 w-16">Nº</TableHead>
                <TableHead className="text-slate-300 w-24">Fecha</TableHead>
                <TableHead className="text-slate-300 w-24 text-center">Cuenta</TableHead>
                <TableHead className="text-slate-300">Concepto</TableHead>
                <TableHead className="text-slate-300 w-48">Documento soporte</TableHead>
                <TableHead className="text-slate-300 text-right w-28">Debe</TableHead>
                <TableHead className="text-slate-300 text-right w-28">Haber</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, idx) => {
                const badge = entry.document ? docBadgeStyle(entry.document) : null;
                const hasPdf = entry.document ? !!findPdf(pdfMap, entry.document) : false;
                return (
                <React.Fragment key={idx}>
                  <TableRow className="bg-slate-100/80 border-t-4 border-slate-200 print-break-inside-avoid">
                    <TableCell className="font-bold text-primary">{entry.entryNumber}</TableCell>
                    <TableCell className="font-semibold text-slate-600">{formatDate(entry.date)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="font-semibold text-slate-700">{entry.concept}</TableCell>
                    <TableCell>
                      {badge && (
                        <button
                          type="button"
                          disabled={!hasPdf}
                          onClick={() => hasPdf && handleDownload(entry.document)}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-semibold transition-all ${badge.bg} ${hasPdf ? "cursor-pointer hover:shadow-md hover:scale-105 active:scale-95" : "opacity-70"}`}
                          title={hasPdf ? `Descargar PDF: ${badge.label}` : badge.label}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {hasPdf ? (
                              <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>
                            ) : (
                              <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>
                            )}
                          </svg>
                          {badge.label}
                        </button>
                      )}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                  
                  {entry.debits.map((d, i) => (
                    <TableRow key={`d-${idx}-${i}`} className="border-0 hover:bg-slate-50 print-break-inside-avoid">
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-center font-mono text-slate-500">{d.accountCode || ''}</TableCell>
                      <TableCell className="text-slate-700">{(d.accountName && d.accountName !== 'undefined') ? d.accountName : ''}</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-mono font-medium text-blue-700">{formatEuro(d.amount)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                  
                  {entry.credits.map((c, i) => (
                    <TableRow key={`c-${idx}-${i}`} className="border-0 hover:bg-slate-50 print-break-inside-avoid">
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-center font-mono text-slate-500">{c.accountCode || ''}</TableCell>
                      <TableCell className="text-slate-700 pl-8 italic">{(c.accountName && c.accountName !== 'undefined') ? c.accountName : ''}</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-mono font-medium text-emerald-700">{formatEuro(c.amount)}</TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

// ─── Document Header (Logo for print) ──────────────────────────────────────
export const DocumentHeader = ({ company }: { company: AccountingUniverse["companyProfile"] }) => (
  <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-primary/20">
    <div className="flex items-center gap-3">
      <img src="/logo.png" alt="ContabilGen Pro" className="h-10 w-auto" />
    </div>
    <div className="text-right">
      <div className="font-display font-bold text-lg text-foreground">{company.name}</div>
      <div className="text-sm text-muted-foreground">NIF: {company.nif} | Ejercicio {company.fiscalYear}</div>
    </div>
  </div>
);

// ─── Tax Liquidations ───────────────────────────────────────────────────────
interface TaxLiquidationsViewProps {
  liquidations: TaxLiquidation[];
  company: AccountingUniverse["companyProfile"];
}

export const TaxLiquidationsView = ({ liquidations, company }: TaxLiquidationsViewProps) => {
  if (!liquidations || liquidations.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">No se han generado liquidaciones fiscales.</p>
        <p className="text-sm mt-1">Activa la opción en la configuración avanzada del generador.</p>
      </div>
    );
  }

  const modelLabels: Record<string, string> = {
    "303": "Modelo 303 - IVA Trimestral",
    "420": "Modelo 420 - IGIC Trimestral",
    "IS": "Modelo 200 - Impuesto sobre Sociedades",
  };

  const paymentBadge: Record<string, string> = {
    "ingreso": "bg-red-100 text-red-700 border-red-200",
    "devolución": "bg-green-100 text-green-700 border-green-200",
    "compensación": "bg-blue-100 text-blue-700 border-blue-200",
  };

  return (
    <div className="space-y-8">
      <SectionTitle
        title="Liquidaciones Fiscales"
        description="Modelos de IVA/IGIC trimestrales e Impuesto sobre Sociedades anual"
      />
      <DocumentHeader company={company} />

      {liquidations.map((liq, idx) => (
        <Card key={idx} className="border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-transparent pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold">
                  {modelLabels[liq.model] ?? `Modelo ${liq.model}`}
                </CardTitle>
                <CardDescription>
                  Período: <strong>{liq.period}</strong> · Vencimiento: {formatDate(liq.dueDate)}
                </CardDescription>
              </div>
              <Badge className={`border ${paymentBadge[liq.paymentType] ?? ""} text-sm px-3 py-1`}>
                {liq.paymentType === "ingreso" ? "A ingresar" : liq.paymentType === "devolución" ? "A devolver" : "A compensar"}:&nbsp;{formatEuro(Math.abs(liq.result))}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs text-muted-foreground">Base imponible</div>
                <div className="font-mono font-bold text-lg text-foreground">{formatEuro(liq.taxableBase)}</div>
              </div>
              {liq.model !== "IS" && (
                <>
                  <div className="bg-orange-50 rounded-xl p-3">
                    <div className="text-xs text-muted-foreground">Cuota devengada</div>
                    <div className="font-mono font-bold text-lg text-orange-700">{formatEuro(liq.outputTax)}</div>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3">
                    <div className="text-xs text-muted-foreground">Cuota deducible</div>
                    <div className="font-mono font-bold text-lg text-green-700">{formatEuro(liq.inputTax)}</div>
                  </div>
                </>
              )}
              <div className={`rounded-xl p-3 ${liq.result >= 0 ? "bg-red-50" : "bg-emerald-50"}`}>
                <div className="text-xs text-muted-foreground">Resultado</div>
                <div className={`font-mono font-bold text-lg ${liq.result >= 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {formatEuro(Math.abs(liq.result))}
                </div>
              </div>
            </div>

            <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-4 mb-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-1">📚 Nota contable</h4>
              <p className="text-sm text-slate-700 leading-relaxed">{liq.journalNote}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">DEBE</h4>
                <div className="space-y-1.5">
                  {liq.accountDebits.map((e, i) => (
                    <div key={i} className="flex items-center justify-between bg-blue-50/60 rounded-lg px-3 py-2">
                      <div>
                        <span className="font-mono text-sm text-blue-700 font-bold">{e.accountCode}</span>
                        <span className="ml-2 text-sm text-slate-700">{e.accountName}</span>
                      </div>
                      <span className="font-mono font-bold text-blue-700">{formatEuro(e.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">HABER</h4>
                <div className="space-y-1.5">
                  {liq.accountCredits.map((e, i) => (
                    <div key={i} className="flex items-center justify-between bg-emerald-50/60 rounded-lg px-3 py-2">
                      <div>
                        <span className="font-mono text-sm text-emerald-700 font-bold">{e.accountCode}</span>
                        <span className="ml-2 text-sm text-slate-700">{e.accountName}</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-700">{formatEuro(e.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// ─── Social Security Payments ───────────────────────────────────────────────
interface SocialSecurityViewProps {
  payments: SocialSecurityPayment[];
  company: AccountingUniverse["companyProfile"];
}

export const SocialSecurityView = ({ payments, company }: SocialSecurityViewProps) => {
  if (!payments || payments.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">No se han generado boletines de Seguridad Social.</p>
        <p className="text-sm mt-1">Activa las opciones Nóminas y TC1 en la configuración avanzada.</p>
      </div>
    );
  }

  const totalSsEmployee = payments.reduce((s, p) => s + p.ssEmployeeAmount, 0);
  const totalSsEmployer = payments.reduce((s, p) => s + p.ssEmployerAmount, 0);
  const totalPayments = payments.reduce((s, p) => s + p.totalPayment, 0);

  return (
    <div className="space-y-8">
      <SectionTitle
        title="Boletines TC1 - Seguridad Social"
        description="Liquidación mensual de cuotas a la Tesorería General de la Seguridad Social"
      />
      <DocumentHeader company={company} />

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="text-xs text-blue-600 font-medium">Cuota Obrera (Total año)</div>
          <div className="font-mono font-bold text-xl text-blue-800 mt-1">{formatEuro(totalSsEmployee)}</div>
        </div>
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
          <div className="text-xs text-orange-600 font-medium">Cuota Patronal (Total año)</div>
          <div className="font-mono font-bold text-xl text-orange-800 mt-1">{formatEuro(totalSsEmployer)}</div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-100">
          <div className="text-xs text-red-600 font-medium">Total TC1 (Año completo)</div>
          <div className="font-mono font-bold text-xl text-red-800 mt-1">{formatEuro(totalPayments)}</div>
        </div>
      </div>

      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-800">
                <TableHead className="text-slate-300">Mes</TableHead>
                <TableHead className="text-slate-300">Vencimiento</TableHead>
                <TableHead className="text-slate-300 text-right">Nº Trabajadores</TableHead>
                <TableHead className="text-slate-300 text-right">Base Cotización</TableHead>
                <TableHead className="text-slate-300 text-right">Cuota Obrera</TableHead>
                <TableHead className="text-slate-300 text-right">Cuota Patronal</TableHead>
                <TableHead className="text-slate-300 text-right font-bold">Total TC1</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p, idx) => (
                <TableRow key={idx} className="hover:bg-slate-50">
                  <TableCell className="font-medium">{p.month}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.dueDate)}</TableCell>
                  <TableCell className="text-right">{p.employeeCount}</TableCell>
                  <TableCell className="text-right font-mono">{formatEuro(p.totalGross)}</TableCell>
                  <TableCell className="text-right font-mono text-blue-700">{formatEuro(p.ssEmployeeAmount)}</TableCell>
                  <TableCell className="text-right font-mono text-orange-700">{formatEuro(p.ssEmployerAmount)}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-red-700">{formatEuro(p.totalPayment)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-4">
        <h4 className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-1">📚 Nota contable</h4>
        <p className="text-sm text-slate-700 leading-relaxed">{payments[0]?.journalNote}</p>
      </div>
    </div>
  );
};

// ─── Mortgage View ──────────────────────────────────────────────────────────
interface MortgageViewProps {
  mortgage: Mortgage | null | undefined;
  company: AccountingUniverse["companyProfile"];
}

export const MortgageView = ({ mortgage, company }: MortgageViewProps) => {
  if (!mortgage) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">No se ha generado hipoteca.</p>
        <p className="text-sm mt-1">Activa la opción Hipoteca en la configuración avanzada del generador.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionTitle
        title="Préstamo Hipotecario"
        description={`${mortgage.entity} · ${mortgage.loanNumber}`}
      />
      <DocumentHeader company={company} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 col-span-2">
          <div className="text-xs text-muted-foreground">Inmueble hipotecado</div>
          <div className="font-semibold text-foreground mt-1">{mortgage.propertyDescription}</div>
          <div className="text-sm text-muted-foreground mt-0.5">Valor: {formatEuro(mortgage.propertyValue)}</div>
        </div>
        <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
          <div className="text-xs text-muted-foreground">Capital prestado</div>
          <div className="font-mono font-bold text-xl text-primary mt-1">{formatEuro(mortgage.principal)}</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="text-xs text-muted-foreground">Cuota mensual</div>
          <div className="font-mono font-bold text-xl mt-1">{formatEuro(mortgage.monthlyInstallment)}</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="text-xs text-muted-foreground">Tipo de interés</div>
          <div className="font-mono font-bold text-xl mt-1">{mortgage.annualRate}%</div>
          <div className="text-xs text-muted-foreground">TAE anual</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="text-xs text-muted-foreground">Plazo</div>
          <div className="font-mono font-bold text-xl mt-1">{mortgage.termMonths} meses</div>
          <div className="text-xs text-muted-foreground">({Math.round(mortgage.termMonths / 12)} años)</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="text-xs text-muted-foreground">Fecha inicio</div>
          <div className="font-semibold text-lg mt-1">{formatDate(mortgage.startDate)}</div>
        </div>
      </div>

      {mortgage.initialClassification && (
        <div className="rounded-xl border p-4 bg-blue-50/50">
          <h4 className="text-sm font-bold text-muted-foreground uppercase mb-3">Clasificación Inicial de la Deuda Hipotecaria</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-white rounded-lg border">
              <p className="text-xs text-muted-foreground font-semibold">170 — Largo Plazo (&gt; 12 meses)</p>
              <p className="font-mono font-bold text-lg text-blue-700">{formatEuro(mortgage.initialClassification.longTerm170)}</p>
            </div>
            <div className="p-3 bg-white rounded-lg border">
              <p className="text-xs text-muted-foreground font-semibold">5200 — Corto Plazo (≤ 12 meses)</p>
              <p className="font-mono font-bold text-lg text-amber-700">{formatEuro(mortgage.initialClassification.shortTerm5200)}</p>
            </div>
          </div>
        </div>
      )}

      {mortgage.reclassification31Dec && (
        <div className="rounded-xl border p-4 bg-amber-50/50">
          <h4 className="text-sm font-bold text-muted-foreground uppercase mb-2">Reclasificación al Cierre ({mortgage.reclassification31Dec.date})</h4>
          <p className="text-sm text-slate-600 mb-2">Traspasar de 170 (LP) a 5200 (CP) el capital que vence en los próximos 12 meses:</p>
          <p className="font-mono font-bold text-lg text-amber-700">{formatEuro(mortgage.reclassification31Dec.shortTerm5200)}</p>
        </div>
      )}

      <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-4">
        <h4 className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-1">Nota contable</h4>
        <p className="text-sm text-slate-700 leading-relaxed">{mortgage.journalNote}</p>
      </div>

      {mortgage.acquisitionEntry ? (
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-muted-foreground uppercase">Asiento de Adquisición del Inmueble</h4>
          <AsientoContable debits={mortgage.acquisitionEntry.accountDebits} credits={mortgage.acquisitionEntry.accountCredits} note="" />
          {mortgage.installmentEntry && (
            <>
              <h4 className="text-sm font-bold text-muted-foreground uppercase mt-4">Asiento de Pago de Cuota</h4>
              <AsientoContable debits={mortgage.installmentEntry.accountDebits} credits={mortgage.installmentEntry.accountCredits} note={mortgage.installmentEntry.journalNote} />
            </>
          )}
          {mortgage.reclassificationEntry && (
            <>
              <h4 className="text-sm font-bold text-muted-foreground uppercase mt-4">Asiento de Reclasificación LP → CP</h4>
              <AsientoContable debits={mortgage.reclassificationEntry.accountDebits} credits={mortgage.reclassificationEntry.accountCredits} note={mortgage.reclassificationEntry.journalNote} />
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">DEBE</h4>
            <div className="space-y-1.5">
              {mortgage.accountDebits?.map((e, i) => (
                <div key={i} className="flex items-center justify-between bg-blue-50/60 rounded-lg px-3 py-2">
                  <div><span className="font-mono text-sm text-blue-700 font-bold">{e.accountCode}</span><span className="ml-2 text-sm text-slate-700">{e.accountName}</span></div>
                  <span className="font-mono font-bold text-blue-700">{formatEuro(e.amount)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">HABER</h4>
            <div className="space-y-1.5">
              {mortgage.accountCredits?.map((e, i) => (
                <div key={i} className="flex items-center justify-between bg-emerald-50/60 rounded-lg px-3 py-2">
                  <div><span className="font-mono text-sm text-emerald-700 font-bold">{e.accountCode}</span><span className="ml-2 text-sm text-slate-700">{e.accountName}</span></div>
                  <span className="font-mono font-bold text-emerald-700">{formatEuro(e.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <h3 className="font-bold text-base text-foreground">Cuadro de Amortización (primeros períodos)</h3>
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-800">
                <TableHead className="text-slate-300">Período</TableHead>
                <TableHead className="text-slate-300">Fecha</TableHead>
                <TableHead className="text-slate-300 text-right">Cuota</TableHead>
                <TableHead className="text-slate-300 text-right">Intereses</TableHead>
                <TableHead className="text-slate-300 text-right">Amort. Capital</TableHead>
                <TableHead className="text-slate-300 text-right">Capital Pendiente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mortgage.amortizationTable.map((row, idx) => (
                <TableRow key={idx} className="hover:bg-slate-50">
                  <TableCell className="font-mono text-center">{row.period}</TableCell>
                  <TableCell>{formatDate(row.date)}</TableCell>
                  <TableCell className="text-right font-mono">{formatEuro(row.installment)}</TableCell>
                  <TableCell className="text-right font-mono text-red-600">{formatEuro(row.interest)}</TableCell>
                  <TableCell className="text-right font-mono text-blue-700">{formatEuro(row.principal)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{formatEuro(row.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Fixed Assets View ──────────────────────────────────────────────────────
interface FixedAssetsViewProps {
  assets: FixedAsset[];
  company: AccountingUniverse["companyProfile"];
}

export const FixedAssetsView = ({ assets, company }: FixedAssetsViewProps) => {
  if (!assets || assets.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">No se ha generado inmovilizado.</p>
        <p className="text-sm mt-1">Activa la opción Inmovilizado en la configuración avanzada del generador.</p>
      </div>
    );
  }

  const totalCost = assets.reduce((s, a) => s + a.purchaseCost, 0);
  const totalDepreciation = assets.reduce((s, a) => s + a.annualDepreciation, 0);
  const totalNetValue = assets.reduce((s, a) => s + a.netBookValue, 0);

  return (
    <div className="space-y-8">
      <SectionTitle
        title="Inmovilizado Material y Amortización"
        description="Elementos del activo fijo y dotación anual de amortización"
      />
      <DocumentHeader company={company} />

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="text-xs text-muted-foreground">Coste total adquisición</div>
          <div className="font-mono font-bold text-xl mt-1">{formatEuro(totalCost)}</div>
        </div>
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
          <div className="text-xs text-orange-600">Dotación amortización anual</div>
          <div className="font-mono font-bold text-xl text-orange-700 mt-1">{formatEuro(totalDepreciation)}</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <div className="text-xs text-green-600">Valor neto contable</div>
          <div className="font-mono font-bold text-xl text-green-700 mt-1">{formatEuro(totalNetValue)}</div>
        </div>
      </div>

      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-800">
                <TableHead className="text-slate-300">Código</TableHead>
                <TableHead className="text-slate-300">Descripción</TableHead>
                <TableHead className="text-slate-300">F. Adquisición</TableHead>
                <TableHead className="text-slate-300 text-right">Coste</TableHead>
                <TableHead className="text-slate-300">Vida útil</TableHead>
                <TableHead className="text-slate-300">Método</TableHead>
                <TableHead className="text-slate-300 text-right">Amort. Anual</TableHead>
                <TableHead className="text-slate-300 text-right">Amort. Acum.</TableHead>
                <TableHead className="text-slate-300 text-right">Valor Neto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset, idx) => (
                <TableRow key={idx} className="hover:bg-slate-50">
                  <TableCell className="font-mono text-xs text-muted-foreground">{asset.code}</TableCell>
                  <TableCell className="font-medium">{asset.description}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(asset.purchaseDate)}</TableCell>
                  <TableCell className="text-right font-mono">{formatEuro(asset.purchaseCost)}</TableCell>
                  <TableCell>{asset.usefulLifeYears} años</TableCell>
                  <TableCell>{asset.depreciationMethod}</TableCell>
                  <TableCell className="text-right font-mono text-orange-700">{formatEuro(asset.annualDepreciation)}</TableCell>
                  <TableCell className="text-right font-mono text-red-600">{formatEuro(asset.accumulatedDepreciation)}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-green-700">{formatEuro(asset.netBookValue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {assets.map((asset, idx) => (
        <Card key={idx} className="border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-transparent pb-3">
            <CardTitle className="text-sm font-bold">{asset.code} — {asset.description}</CardTitle>
            <CardDescription>Cuentas: {asset.assetAccountCode} (activo) · {asset.accDepreciationCode} (amort. acum.) · {asset.depExpenseCode} (gasto)</CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-4 mb-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-1">📚 Nota contable</h4>
              <p className="text-sm text-slate-700 leading-relaxed">{asset.journalNote}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">DEBE</h4>
                <div className="space-y-1.5">
                  {asset.accountDebits.map((e, i) => (
                    <div key={i} className="flex items-center justify-between bg-blue-50/60 rounded-lg px-3 py-2">
                      <div><span className="font-mono text-sm text-blue-700 font-bold">{e.accountCode}</span><span className="ml-2 text-sm text-slate-700">{e.accountName}</span></div>
                      <span className="font-mono font-bold text-blue-700">{formatEuro(e.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">HABER</h4>
                <div className="space-y-1.5">
                  {asset.accountCredits.map((e, i) => (
                    <div key={i} className="flex items-center justify-between bg-emerald-50/60 rounded-lg px-3 py-2">
                      <div><span className="font-mono text-sm text-emerald-700 font-bold">{e.accountCode}</span><span className="ml-2 text-sm text-slate-700">{e.accountName}</span></div>
                      <span className="font-mono font-bold text-emerald-700">{formatEuro(e.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const roleLabel: Record<string, { label: string; color: string }> = {
  socio: { label: "Socio", color: "bg-blue-100 text-blue-700 border-blue-200" },
  administrador: { label: "Administrador", color: "bg-violet-100 text-violet-700 border-violet-200" },
  socio_administrador: { label: "Socio-Administrador", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

export const ShareholdersView = ({ data }: { data?: ShareholdersInfo | null }) => {
  if (!data) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">No se ha incluido información de socios.</p>
        <p className="text-sm mt-1">Activa la opción "Socios y capital social" en la configuración avanzada.</p>
      </div>
    );
  }
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle title="Socios y Capital Social" description="Estructura societaria, participaciones y distribución del capital." />
      <Card className="rounded-2xl shadow-md overflow-hidden print-break-inside-avoid">
        <CardHeader className="bg-slate-50 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle>{data.legalForm}</CardTitle>
              <CardDescription>Tipo: {data.companyType} · Inscrita: {data.registryEntry}</CardDescription>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="bg-white rounded-xl border px-4 py-2 text-center">
                <p className="text-xs text-muted-foreground uppercase font-bold">Capital Social</p>
                <p className="font-mono font-bold text-lg text-foreground">{formatEuro(data.shareCapital)}</p>
              </div>
              <div className="bg-white rounded-xl border px-4 py-2 text-center">
                <p className="text-xs text-muted-foreground uppercase font-bold">Participaciones</p>
                <p className="font-mono font-bold text-lg text-foreground">{data.totalShares}</p>
              </div>
              <div className="bg-white rounded-xl border px-4 py-2 text-center">
                <p className="text-xs text-muted-foreground uppercase font-bold">Valor Nominal</p>
                <p className="font-mono font-bold text-lg text-foreground">{formatEuro(data.nominalValuePerShare)}/ud</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground mb-4">Fecha constitución: <span className="font-medium text-foreground">{formatDate(data.constitutionDate)}</span></p>
          <div className="rounded-xl border overflow-hidden mb-6">
            <Table>
              <TableHeader className="bg-slate-100">
                <TableRow>
                  <TableHead>Nombre / NIF</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="text-right">Nº Participaciones</TableHead>
                  <TableHead className="text-right">Valor Nominal/ud</TableHead>
                  <TableHead className="text-right">Capital Aportado</TableHead>
                  <TableHead className="text-right">% Participación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.shareholders.map((s: Shareholder, i: number) => {
                  const rolInfo = roleLabel[s.role] ?? { label: s.role, color: "bg-slate-100 text-slate-700 border-slate-200" };
                  return (
                    <TableRow key={i}>
                      <TableCell>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{s.nif}</p>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${rolInfo.color}`}>{rolInfo.label}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">{s.numberOfShares}</TableCell>
                      <TableCell className="text-right font-mono">{formatEuro(s.nominalValuePerShare)}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{formatEuro(s.totalCapitalAmount)}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-primary">{s.participationPercentage}%</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <AsientoContable debits={data.accountDebits} credits={data.accountCredits} note={data.journalNote} />
        </CardContent>
      </Card>
    </div>
  );
};

const BalanceSheetSection = ({ title, lines, isCredit }: { title: string; lines: { accountCode: string; accountName: string; amount: number; note?: string }[]; isCredit: boolean }) => {
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return (
    <div>
      <h4 className={`text-sm font-bold uppercase tracking-wide mb-2 ${isCredit ? "text-violet-700" : "text-blue-700"}`}>{title}</h4>
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader className={`${isCredit ? "bg-violet-50" : "bg-blue-50"}`}>
            <TableRow>
              <TableHead className="w-20">Cuenta</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead className="text-right">Importe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-sm font-bold">{l.accountCode}</TableCell>
                <TableCell>
                  <p className="font-medium text-sm">{l.accountName}</p>
                  {l.note && <p className="text-xs text-muted-foreground">{l.note}</p>}
                </TableCell>
                <TableCell className="text-right font-mono font-medium">{formatEuro(l.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className={`flex justify-end mt-1 mr-1 text-sm font-bold ${isCredit ? "text-violet-700" : "text-blue-700"}`}>
        Total: {formatEuro(total)}
      </div>
    </div>
  );
};

export const InitialBalanceSheetView = ({ data }: { data?: InitialBalanceSheet | null }) => {
  if (!data) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">No se ha generado balance de apertura.</p>
        <p className="text-sm mt-1">Activa la opción "Balance de apertura" para empresas ya constituidas.</p>
      </div>
    );
  }
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle
        title={data.priorYear
          ? `Balance de Situación Final — Ejercicio ${data.priorYear}`
          : "Balance de Apertura"}
        description={data.description}
      />
      {data.priorYearEndDate && (
        <Card className="rounded-2xl shadow-md border-amber-200 bg-amber-50/50 print-break-inside-avoid">
          <CardContent className="p-4 flex items-center gap-3">
            <span className="text-amber-600 text-lg">📋</span>
            <p className="text-sm text-amber-800">
              Este balance corresponde al cierre del ejercicio {data.priorYear} (a {data.priorYearEndDate}) y
              constituye la base del <strong>asiento de apertura</strong> del ejercicio actual.
              Se cargan todos los activos al Debe y se abonan todos los pasivos y el patrimonio neto al Haber.
            </p>
          </CardContent>
        </Card>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl shadow-md overflow-hidden print-break-inside-avoid">
          <CardHeader className="bg-blue-50 border-b border-blue-100">
            <CardTitle className="text-blue-800">ACTIVO</CardTitle>
            <CardDescription className="text-blue-600">Total Activo: <span className="font-bold font-mono">{formatEuro(data.totalAssets)}</span></CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <BalanceSheetSection title="Activo No Corriente (Inmovilizado)" lines={data.nonCurrentAssets} isCredit={false} />
            <BalanceSheetSection title="Activo Corriente (Circulante)" lines={data.currentAssets} isCredit={false} />
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-md overflow-hidden print-break-inside-avoid">
          <CardHeader className="bg-violet-50 border-b border-violet-100">
            <CardTitle className="text-violet-800">PATRIMONIO NETO Y PASIVO</CardTitle>
            <CardDescription className="text-violet-600">Total PN + Pasivo: <span className="font-bold font-mono">{formatEuro(data.totalEquityAndLiabilities)}</span></CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <BalanceSheetSection title="Patrimonio Neto" lines={data.equity} isCredit={true} />
            <BalanceSheetSection title="Pasivo No Corriente" lines={data.nonCurrentLiabilities} isCredit={true} />
            <BalanceSheetSection title="Pasivo Corriente" lines={data.currentLiabilities} isCredit={true} />
          </CardContent>
        </Card>
      </div>
      <Card className="rounded-2xl shadow-md border-2 border-primary/20 print-break-inside-avoid">
        <CardContent className="p-6">
          <div className="flex justify-between items-center text-lg font-bold mb-4">
            <span>TOTAL ACTIVO</span>
            <span className="font-mono text-blue-700">{formatEuro(data.totalAssets)}</span>
          </div>
          <div className="flex justify-between items-center text-lg font-bold border-t pt-4">
            <span>TOTAL PN + PASIVO</span>
            <span className="font-mono text-violet-700">{formatEuro(data.totalEquityAndLiabilities)}</span>
          </div>
          <div className={cn(
            "mt-3 p-3 rounded-xl text-sm font-medium text-center",
            Math.abs(data.totalAssets - data.totalEquityAndLiabilities) < 0.01
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          )}>
            {Math.abs(data.totalAssets - data.totalEquityAndLiabilities) < 0.01
              ? "✓ Balance CUADRADO — Activo = Patrimonio Neto + Pasivo"
              : `⚠ Diferencia: ${formatEuro(Math.abs(data.totalAssets - data.totalEquityAndLiabilities))}`}
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl shadow-md print-break-inside-avoid">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base">Asiento de Apertura</CardTitle>
          <CardDescription>Fecha: {formatDate(data.date)}</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <AsientoContable debits={data.accountDebits} credits={data.accountCredits} note={data.journalNote} />
        </CardContent>
      </Card>
    </div>
  );
};

export const ShareholderAccountsView = ({ data }: { data?: ShareholderAccounts | null }) => {
  if (!data) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">No se han generado operaciones con socios/administradores.</p>
        <p className="text-sm mt-1">Activa la opción "C/C socios y administradores" en la configuración.</p>
      </div>
    );
  }
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle title="C/C Socios y Administradores" description="Operaciones en cuentas 551 (administradores) y 553 (socios)." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-violet-200 shadow-md">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700 font-bold font-mono text-lg">551</div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold">Cta. Administradores</p>
              <p className={cn("font-mono text-2xl font-bold", data.closingBalance551 < 0 ? "text-red-600" : "text-emerald-600")}>
                {formatEuro(data.closingBalance551)}
              </p>
              <p className="text-xs text-muted-foreground">{data.closingBalance551 < 0 ? "Empresa debe a administrador" : "Administrador debe a empresa"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-blue-200 shadow-md">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold font-mono text-lg">553</div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold">Cta. Socios</p>
              <p className={cn("font-mono text-2xl font-bold", data.closingBalance553 < 0 ? "text-red-600" : "text-emerald-600")}>
                {formatEuro(data.closingBalance553)}
              </p>
              <p className="text-xs text-muted-foreground">{data.closingBalance553 < 0 ? "Empresa debe al socio" : "Socio debe a empresa"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="rounded-2xl shadow-md overflow-hidden print-break-inside-avoid">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle>Movimientos</CardTitle>
          <CardDescription>{data.description}</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="rounded-xl border overflow-hidden mb-6">
            <Table>
              <TableHeader className="bg-slate-100">
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Socio / Administrador</TableHead>
                  <TableHead className="text-center">Cta.</TableHead>
                  <TableHead className="text-right">Debe</TableHead>
                  <TableHead className="text-right">Haber</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.transactions.map((tx, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{formatDate(tx.date)}</TableCell>
                    <TableCell className="text-sm font-medium">{tx.concept}</TableCell>
                    <TableCell className="text-sm">{tx.shareholderName}</TableCell>
                    <TableCell className="text-center font-mono font-bold text-xs">{tx.accountCode}</TableCell>
                    <TableCell className="text-right font-mono text-red-600">{tx.debit != null ? formatEuro(tx.debit) : "—"}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-600">{tx.credit != null ? formatEuro(tx.credit) : "—"}</TableCell>
                    <TableCell className={cn("text-right font-mono font-bold text-sm", tx.balance < 0 ? "text-red-600" : "text-emerald-600")}>
                      {formatEuro(tx.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <AsientoContable debits={data.accountDebits} credits={data.accountCredits} note={data.journalNote} />
        </CardContent>
      </Card>
    </div>
  );
};

// ─── CRONOLOGÍA VIEW ──────────────────────────────────────────────────────────

type EventKind =
  | "factura_venta" | "factura_compra" | "factura_rectif"
  | "asiento" | "banco" | "tarjeta"
  | "prestamo" | "hipoteca" | "poliza_credito"
  | "ss" | "impuesto"
  | "nomina" | "socio" | "dividendo" | "apertura" | "inmovilizado"
  | "seguro" | "siniestro" | "nota_cargo"
  | "gasto_extra" | "ingreso_extra"
  | "suministro" | "cobro" | "pago";

interface ChronoEvent {
  date: string;
  kind: EventKind;
  label: string;
  subtitle: string;
  amount?: number;
  pdfGenerator?: () => Blob;
  pdfFilename?: string;
  journalEntry?: JournalEntry;
}

const KIND_META: Record<EventKind, { color: string; bg: string; text: string; dot: string }> = {
  factura_venta:  { color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",   text: "Factura venta",  dot: "bg-blue-500" },
  factura_compra: { color: "text-orange-700",  bg: "bg-orange-50 border-orange-200", text: "Factura compra", dot: "bg-orange-500" },
  factura_rectif: { color: "text-red-700",     bg: "bg-red-50 border-red-200",     text: "Rectificativa",  dot: "bg-red-500" },
  asiento:        { color: "text-slate-700",   bg: "bg-slate-50 border-slate-200", text: "Asiento diario", dot: "bg-slate-500" },
  banco:          { color: "text-green-700",   bg: "bg-green-50 border-green-200", text: "Mov. bancario",  dot: "bg-green-500" },
  tarjeta:        { color: "text-indigo-700",  bg: "bg-indigo-50 border-indigo-200", text: "Cargo tarjeta", dot: "bg-indigo-500" },
  prestamo:       { color: "text-teal-700",    bg: "bg-teal-50 border-teal-200",   text: "Cuota préstamo", dot: "bg-teal-500" },
  hipoteca:       { color: "text-cyan-700",    bg: "bg-cyan-50 border-cyan-200",   text: "Cuota hipoteca", dot: "bg-cyan-500" },
  ss:             { color: "text-amber-700",   bg: "bg-amber-50 border-amber-200", text: "Pago SS / TC1",  dot: "bg-amber-500" },
  impuesto:       { color: "text-red-700",     bg: "bg-red-50 border-red-200",     text: "Liquidación fiscal", dot: "bg-red-600" },
  nomina:         { color: "text-purple-700",  bg: "bg-purple-50 border-purple-200", text: "Nómina",       dot: "bg-purple-500" },
  socio:          { color: "text-pink-700",    bg: "bg-pink-50 border-pink-200",   text: "Oper. socios",   dot: "bg-pink-500" },
  dividendo:      { color: "text-yellow-700",  bg: "bg-yellow-50 border-yellow-200", text: "Dividendos",   dot: "bg-yellow-500" },
  apertura:       { color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", text: "Bal. apertura", dot: "bg-emerald-500" },
  inmovilizado:   { color: "text-gray-700",    bg: "bg-gray-50 border-gray-200",   text: "Inmovilizado",  dot: "bg-gray-500" },
  seguro:         { color: "text-sky-700",     bg: "bg-sky-50 border-sky-200",     text: "Póliza seguro", dot: "bg-sky-500" },
  siniestro:      { color: "text-rose-700",    bg: "bg-rose-50 border-rose-200",   text: "Siniestro",     dot: "bg-rose-500" },
  nota_cargo:     { color: "text-amber-700",   bg: "bg-amber-50 border-amber-200", text: "Nota de cargo", dot: "bg-amber-500" },
  poliza_credito: { color: "text-violet-700",  bg: "bg-violet-50 border-violet-200", text: "Póliza crédito", dot: "bg-violet-500" },
  gasto_extra:    { color: "text-red-700",     bg: "bg-red-50 border-red-200",     text: "Gasto extraordinario", dot: "bg-red-400" },
  ingreso_extra:  { color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", text: "Ingreso extraordinario", dot: "bg-emerald-400" },
  suministro:     { color: "text-lime-700",    bg: "bg-lime-50 border-lime-200",   text: "Suministro/Servicio", dot: "bg-lime-500" },
  cobro:          { color: "text-blue-700",    bg: "bg-blue-50 border-blue-200",   text: "Cobro cliente",    dot: "bg-blue-400" },
  pago:           { color: "text-orange-700",  bg: "bg-orange-50 border-orange-200", text: "Pago proveedor",  dot: "bg-orange-400" },
};

function parsePayrollDate(month: string, year: number): string {
  const meses: Record<string, string> = {
    enero:"01", febrero:"02", marzo:"03", abril:"04", mayo:"05", junio:"06",
    julio:"07", agosto:"08", septiembre:"09", octubre:"10", noviembre:"11", diciembre:"12",
    january:"01", february:"02", march:"03", april:"04", may:"05", june:"06",
    july:"07", august:"08", september:"09", october:"10", november:"11", december:"12",
  };
  const lower = month.toLowerCase().trim();
  const yymm = lower.match(/^(\d{4})-(\d{2})$/);
  if (yymm) return `${yymm[1]}-${yymm[2]}-28`;
  for (const [name, num] of Object.entries(meses)) {
    if (lower.includes(name)) {
      const yr = lower.match(/\d{4}/)?.[0] ?? String(year);
      return `${yr}-${num}-28`;
    }
  }
  return `${year}-06-28`;
}

function buildCP(universe: AccountingUniverse): CP {
  const p = universe.companyProfile;
  return {
    name: p?.name || "Empresa",
    nif: p?.nif || (p as any)?.cif || "",
    address: p?.address || "",
    city: p?.city || "",
    sector: p?.sector || "",
    taxRegime: p?.taxRegime || "",
    fiscalYear: p?.fiscalYear as number | undefined,
    description: (p as any)?.description || "",
  };
}

function buildJournalLookup(entries: JournalEntry[]): Map<string, JournalEntry[]> {
  const map = new Map<string, JournalEntry[]>();
  const addKey = (key: string, e: JournalEntry) => {
    if (!key) return;
    const k = key.trim().toLowerCase();
    if (!k) return;
    const arr = map.get(k) ?? [];
    arr.push(e);
    map.set(k, arr);
  };
  for (const e of entries) {
    if (e.document) addKey(e.document, e);
    const refs = (e.concept || "").match(/(?:Ref|Fra|Nº|Factura|Recibo|Póliza|Préstamo|Hipoteca|Nómina)[.:# ]*\s*([A-Z0-9][\w\-/]*)/gi);
    if (refs) {
      for (const r of refs) {
        const val = r.replace(/^[^:# ]*[.:# ]*\s*/i, "").trim();
        addKey(val, e);
      }
    }
  }
  return map;
}

function findJournalEntry(lookup: Map<string, JournalEntry[]>, docRef: string, date?: string): JournalEntry | undefined {
  const key = (docRef || "").trim().toLowerCase();
  if (!key) return undefined;

  const pickBest = (candidates: JournalEntry[]): JournalEntry => {
    if (candidates.length === 1 || !date) return candidates[0];
    const byDate = candidates.filter(j => j.date === date);
    return byDate.length > 0 ? byDate[0] : candidates[0];
  };

  if (lookup.has(key)) return pickBest(lookup.get(key)!);
  for (const [k, arr] of lookup) {
    if (k.includes(key) || (key.includes(k) && k.length > 3)) return pickBest(arr);
  }
  return undefined;
}

function collectEvents(universe: AccountingUniverse): ChronoEvent[] {
  const events: ChronoEvent[] = [];
  const cp = buildCP(universe);
  const safe = (s: string) => (s || "").replace(/[/\\?%*:|"<>]/g, "-").substring(0, 50);
  const jLookup = buildJournalLookup(universe.journalEntries ?? []);

  (universe.invoices ?? []).forEach((inv) => {
    const kind: EventKind = inv.type === "sale" ? "factura_venta"
      : inv.type === "rectification" ? "factura_rectif" : "factura_compra";
    const tipo = inv.type === "sale" ? "Venta" : "Compra";
    events.push({ date: inv.date, kind, label: inv.invoiceNumber,
      subtitle: inv.partyName, amount: inv.total,
      pdfGenerator: () => generateInvoicePdf(inv, cp),
      pdfFilename: `Factura_${tipo}_${safe(inv.invoiceNumber)}.pdf`,
      journalEntry: findJournalEntry(jLookup, inv.invoiceNumber, inv.date) });
  });

  (universe.bankStatements ?? []).forEach((bs) => {
    const txs = bs.transactions ?? [];
    if (txs.length > 0) {
      const firstDate = txs.reduce((d, t) => t.date < d ? t.date : d, txs[0].date);
      const totalMov = txs.reduce((s, t) => s + (t.debit ?? 0) + (t.credit ?? 0), 0);
      events.push({ date: firstDate, kind: "banco",
        label: `Extracto ${bs.bank || ""}`,
        subtitle: `${bs.period || ""} — ${txs.length} movimientos`,
        amount: totalMov,
        pdfGenerator: () => generateBankStatementPdf(bs, cp),
        pdfFilename: `Extracto_${safe(bs.bank || bs.period || "")}.pdf` });
    }
  });

  if (universe.creditCardStatement) {
    const card = universe.creditCardStatement;
    const movs = card.movements ?? [];
    if (movs.length > 0) {
      const firstDate = movs.reduce((d, m) => m.date < d ? m.date : d, movs[0].date);
      const totalMov = movs.reduce((s, m) => s + (m.amount ?? 0), 0);
      events.push({ date: firstDate, kind: "tarjeta",
        label: "Extracto tarjeta crédito",
        subtitle: `${card.statementPeriod || ""} — ${movs.length} cargos`,
        amount: totalMov,
        pdfGenerator: () => generateCreditCardStatementPdf(card, cp),
        pdfFilename: `Extracto_Tarjeta_${safe(card.statementPeriod || "")}.pdf` });
    }
  }

  if (universe.bankLoan) {
    const loan = universe.bankLoan;
    const cuotas = loan.amortizationTable ?? [];
    cuotas.forEach((r) => {
      events.push({ date: r.date, kind: "prestamo",
        label: `Cuota ${r.period} — ${loan.loanNumber || "Préstamo"}`,
        subtitle: `${loan.entity} — Capital: ${formatEuro(r.principal ?? 0)} + Int: ${formatEuro(r.interest ?? 0)}`,
        amount: r.installment,
        pdfGenerator: () => generateBankLoanPdf(loan, cp),
        pdfFilename: `Prestamo_${safe(loan.loanNumber || "")}.pdf` });
    });
  }

  if (universe.mortgage) {
    const mort = universe.mortgage;
    const cuotas = mort.amortizationTable ?? [];
    cuotas.forEach((r) => {
      events.push({ date: r.date, kind: "hipoteca",
        label: `Cuota ${r.period} — ${mort.loanNumber || "Hipoteca"}`,
        subtitle: `${mort.entity} — Capital: ${formatEuro(r.principal ?? 0)} + Int: ${formatEuro(r.interest ?? 0)}`,
        amount: r.installment,
        pdfGenerator: () => generateMortgagePdf(mort, cp),
        pdfFilename: `Hipoteca_${safe(mort.loanNumber || "")}.pdf` });
    });
  }

  (universe.socialSecurityPayments ?? []).forEach((ss) => {
    if (ss.dueDate) events.push({ date: ss.dueDate, kind: "ss", label: "Pago TC1",
      subtitle: ss.month, amount: ss.totalPayment,
      pdfGenerator: () => generateSSPaymentPdf(ss, cp),
      pdfFilename: `TC1_${safe(ss.month || "")}.pdf` });
  });

  (universe.taxLiquidations ?? []).forEach((t) => {
    if (t.dueDate) events.push({ date: t.dueDate, kind: "impuesto",
      label: `Mod.${t.model} – ${t.period}`, subtitle: "Liquidación", amount: t.result,
      pdfGenerator: () => generateTaxLiquidationPdf(t, cp),
      pdfFilename: `Mod${t.model || "303"}_${safe(t.period || "")}.pdf` });
  });

  const yr = (universe.companyProfile?.fiscalYear as number) ?? new Date().getFullYear();
  const monthlyPayrolls = (universe as any).monthlyPayrolls as Array<typeof universe.payroll> | undefined;
  if (monthlyPayrolls?.length) {
    monthlyPayrolls.forEach((pay) => {
      if (!pay?.month) return;
      events.push({ date: parsePayrollDate(pay.month, yr), kind: "nomina",
        label: `Nómina ${pay.month}`, subtitle: `Bruto: ${formatEuro(pay.totalGross ?? 0)}`, amount: pay.totalGross,
        pdfGenerator: () => generatePayrollPdf(pay, cp),
        pdfFilename: `Nomina_${safe(pay.month || "")}.pdf` });
    });
  } else if (universe.payroll?.month) {
    events.push({ date: parsePayrollDate(universe.payroll.month, yr), kind: "nomina",
      label: `Nómina ${universe.payroll.month}`, subtitle: `Bruto: ${formatEuro(universe.payroll.totalGross ?? 0)}`, amount: universe.payroll.totalGross,
      pdfGenerator: () => generatePayrollPdf(universe.payroll!, cp),
      pdfFilename: `Nomina_${safe(universe.payroll!.month || "")}.pdf` });
  }

  if (universe.shareholderAccounts) {
    const acc = universe.shareholderAccounts;
    (acc.transactions ?? []).forEach((t) => {
      events.push({ date: t.date, kind: "socio", label: t.accountName,
        subtitle: `${t.shareholderName} — ${t.concept}`, amount: t.debit ?? t.credit ?? undefined,
        pdfGenerator: () => generateShareholderAccountsPdf(acc, cp),
        pdfFilename: `Cta_Corriente_Socios.pdf` });
    });
  }

  if (universe.dividendDistribution) {
    const dd = universe.dividendDistribution;
    if (dd.approvalDate) events.push({ date: dd.approvalDate, kind: "dividendo",
      label: "Aprobación dividendos", subtitle: `Junta − ejercicio ${dd.fiscalYear}`, amount: dd.totalDividends,
      pdfGenerator: () => generateDividendDistributionPdf(dd, cp),
      pdfFilename: `Dividendos_Ejercicio_${dd.fiscalYear || ""}.pdf` });
    if (dd.paymentDate) events.push({ date: dd.paymentDate, kind: "dividendo",
      label: "Pago dividendos", subtitle: "Distribución a socios", amount: dd.totalDividends,
      pdfGenerator: () => generateDividendDistributionPdf(dd, cp),
      pdfFilename: `Dividendos_Ejercicio_${dd.fiscalYear || ""}.pdf` });
  }

  if (universe.initialBalanceSheet?.date) {
    const priorYr = universe.initialBalanceSheet.priorYear;
    events.push({ date: universe.initialBalanceSheet.date, kind: "apertura",
      label: priorYr ? `Balance Final Ej. ${priorYr} — Apertura` : "Balance de apertura",
      subtitle: universe.initialBalanceSheet.description ?? "Asiento de apertura", amount: universe.initialBalanceSheet.totalAssets,
      pdfGenerator: () => generateInitialBalancePdf(universe.initialBalanceSheet!, cp),
      pdfFilename: `Balance_Apertura.pdf` });
  }

  (universe.fixedAssets ?? []).forEach((a) => {
    if (a.purchaseDate) events.push({ date: a.purchaseDate, kind: "inmovilizado",
      label: `Alta: ${a.description}`, subtitle: `Cta. ${a.accountCode}`, amount: a.purchaseValue,
      pdfGenerator: () => generateFixedAssetCardPdf(a, cp),
      pdfFilename: `Inmovilizado_${safe(a.description || "")}.pdf` });
  });

  (universe.insurancePolicies ?? []).forEach((ins: any) => {
    if (ins.startDate) events.push({ date: ins.startDate, kind: "seguro",
      label: `Póliza: ${ins.type || "Seguro"}`, subtitle: ins.insurer || "", amount: ins.annualPremium,
      pdfGenerator: () => generateInsurancePolicyPdf(ins, cp),
      pdfFilename: `Poliza_Seguro_${safe(ins.policyNumber || "")}.pdf` });
  });

  if (universe.casualtyEvent?.date) {
    events.push({ date: universe.casualtyEvent.date, kind: "siniestro",
      label: "Siniestro", subtitle: universe.casualtyEvent.description || "",
      amount: universe.casualtyEvent.insuranceCompensation,
      pdfGenerator: () => generateCasualtyReportPdf(universe.casualtyEvent!, cp),
      pdfFilename: `Siniestro.pdf` });
  }

  if (universe.creditPolicy?.startDate) {
    events.push({ date: universe.creditPolicy.startDate, kind: "poliza_credito",
      label: `Póliza crédito: ${universe.creditPolicy.policyNumber || ""}`,
      subtitle: universe.creditPolicy.entity || "", amount: universe.creditPolicy.limit,
      pdfGenerator: () => generateCreditPolicyPdf(universe.creditPolicy!, cp),
      pdfFilename: `Poliza_Credito_${safe(universe.creditPolicy!.policyNumber || "")}.pdf` });
  }

  ((universe as any).bankDebitNotes ?? []).forEach((n: any) => {
    if (n.date) events.push({ date: n.date, kind: "nota_cargo",
      label: `Nota cargo: ${n.reference || ""}`, subtitle: n.concept || "", amount: n.amount,
      pdfGenerator: () => generateBankDebitNotePdf(n, cp),
      pdfFilename: `Nota_Cargo_${safe(n.reference || "")}.pdf` });
  });

  (universe.extraordinaryExpenses ?? []).forEach((exp) => {
    const isInc = exp.type === "ingreso_extraordinario" || (exp.accountCode || "").startsWith("7");
    const kind: EventKind = isInc ? "ingreso_extra" : "gasto_extra";
    events.push({ date: exp.date, kind, label: exp.description,
      subtitle: `Cta. ${exp.accountCode} — ${exp.accountName}`, amount: exp.amount,
      pdfGenerator: () => generateExtraordinaryExpensePdf(exp, cp),
      pdfFilename: `${isInc ? "Ingreso" : "Gasto"}_Extra_${safe(exp.description || "")}.pdf` });
  });

  (universe.serviceInvoices ?? []).forEach((si) => {
    events.push({ date: si.date, kind: "suministro",
      label: si.invoiceNumber,
      subtitle: `${si.provider} — ${si.concept}`, amount: si.total,
      pdfGenerator: () => generateServiceInvoicePdf(si, cp),
      pdfFilename: `Suministro_${safe(si.invoiceNumber || "")}.pdf` });
  });

  (universe.paymentReceipts ?? []).forEach((pr) => {
    const kind: EventKind = pr.type === "cobro" ? "cobro" : "pago";
    events.push({ date: pr.date, kind,
      label: pr.receiptNumber,
      subtitle: `${pr.partyName} — ${pr.concept}`, amount: pr.amount,
      pdfGenerator: () => generatePaymentReceiptPdf(pr, cp),
      pdfFilename: `${pr.type === "cobro" ? "Cobro" : "Pago"}_${safe(pr.receiptNumber || "")}.pdf` });
  });

  const journalEntries = universe.journalEntries ?? [];
  const matchedEntryNumbers = new Set<string>();

  const markMatched = (je: JournalEntry) => matchedEntryNumbers.add(String(je.entryNumber));

  const jeByDate = new Map<string, JournalEntry[]>();
  journalEntries.forEach(je => {
    const arr = jeByDate.get(je.date) ?? [];
    arr.push(je);
    jeByDate.set(je.date, arr);
  });

  events.forEach(ev => {
    if (ev.journalEntry) { markMatched(ev.journalEntry); return; }
    const je = findJournalEntry(jLookup, ev.label, ev.date);
    if (je) { ev.journalEntry = je; markMatched(je); return; }
  });

  const kindKeywords: Partial<Record<EventKind, string[]>> = {
    prestamo:       ["préstamo", "prestamo", "cuota préstamo", "170", "5200"],
    hipoteca:       ["hipoteca", "cuota hipoteca"],
    ss:             ["tc1", "seguridad social", "cuota obrera", "476"],
    impuesto:       ["iva", "irpf", "modelo", "liquidación", "4750", "475", "4751"],
    nomina:         ["nómina", "nomina", "salario", "640", "642"],
    apertura:       ["apertura", "asiento apertura"],
    dividendo:      ["dividendo", "reparto", "beneficio", "526", "557"],
    socio:          ["socio", "551", "retribución administrador", "640"],
    seguro:         ["seguro", "póliza seguro", "prima", "625"],
    siniestro:      ["siniestro", "671", "indemnización"],
    poliza_credito: ["póliza crédito", "poliza credito", "5201"],
    inmovilizado:   ["inmovilizado", "amortización", "alta activo", "281", "211", "213", "217", "218"],
    gasto_extra:    ["extraordinario", "gasto extraordinario", "671", "678"],
    ingreso_extra:  ["extraordinario", "ingreso extraordinario", "771", "778"],
  };

  events.forEach(ev => {
    if (ev.journalEntry) return;
    const kws = kindKeywords[ev.kind];
    const candidates = jeByDate.get(ev.date)?.filter(j => !matchedEntryNumbers.has(String(j.entryNumber))) ?? [];
    if (candidates.length === 0) return;

    if (kws) {
      const match = candidates.find(j => {
        const c = (j.concept || "").toLowerCase();
        const d = (j.document || "").toLowerCase();
        return kws.some(kw => c.includes(kw) || d.includes(kw));
      });
      if (match) { ev.journalEntry = match; markMatched(match); return; }
    }

    const evLabel = (ev.label || "").toLowerCase();
    const evSub = (ev.subtitle || "").toLowerCase();
    const conceptMatch = candidates.find(j => {
      const c = (j.concept || "").toLowerCase();
      const jDoc = (j.document || "").toLowerCase();
      if (evLabel && c.includes(evLabel)) return true;
      if (jDoc && evLabel && evLabel.includes(jDoc)) return true;
      if (evSub && c.includes(evSub)) return true;
      if (jDoc && evSub && evSub.includes(jDoc)) return true;
      return false;
    });
    if (conceptMatch) { ev.journalEntry = conceptMatch; markMatched(conceptMatch); return; }

    if (candidates.length === 1) { ev.journalEntry = candidates[0]; markMatched(candidates[0]); }
  });

  return events.filter(e => e.date && /^\d{4}-\d{2}-\d{2}/.test(e.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export const CronologiaView: React.FC<{ data: AccountingUniverse }> = ({ data }) => {
  const events = useMemo(() => collectEvents(data), [data]);
  const [expandedEntries, setExpandedEntries] = React.useState<Set<string>>(new Set());
  React.useEffect(() => { setExpandedEntries(new Set()); }, [data]);
  const toggleEntry = useCallback((key: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const byMonth = useMemo(() => {
    const map: Record<string, ChronoEvent[]> = {};
    events.forEach(e => {
      const key = e.date.substring(0, 7);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [events]);

  const months = Object.keys(byMonth).sort();

  const countByKind = useMemo(() => {
    const counts: Partial<Record<EventKind, number>> = {};
    events.forEach(e => { counts[e.kind] = (counts[e.kind] ?? 0) + 1; });
    return counts;
  }, [events]);

  const statGroups: { label: string; kinds: EventKind[]; color: string }[] = [
    { label: "Facturas", kinds: ["factura_compra","factura_venta","factura_rectif"], color: "text-orange-600" },
    { label: "Cobros/Pagos", kinds: ["cobro","pago"], color: "text-blue-600" },
    { label: "Suministros", kinds: ["suministro"], color: "text-lime-600" },
    { label: "Mov. bancarios", kinds: ["banco","nota_cargo"], color: "text-green-600" },
    { label: "Financiación", kinds: ["prestamo","hipoteca","poliza_credito"], color: "text-teal-600" },
    { label: "SS e Impuestos", kinds: ["ss","impuesto"], color: "text-red-600" },
    { label: "Nóminas", kinds: ["nomina"], color: "text-purple-600" },
    { label: "Tarjeta", kinds: ["tarjeta"], color: "text-indigo-600" },
    { label: "Socios/Dividendos", kinds: ["socio","dividendo"], color: "text-pink-600" },
    { label: "Apertura/Inmov.", kinds: ["apertura","inmovilizado"], color: "text-emerald-600" },
    { label: "Seguros/Siniestro", kinds: ["seguro","siniestro"], color: "text-sky-600" },
    { label: "Extraordinarios", kinds: ["gasto_extra","ingreso_extra"], color: "text-red-500" },
  ];

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Cronología del ejercicio"
        description={`${events.length} operaciones en ${months.length} mes${months.length !== 1 ? "es" : ""} — cada documento incluye su asiento contable`}
      />

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="rounded-2xl border-border/50 shadow-sm col-span-2 sm:col-span-3 lg:col-span-1 bg-slate-800 text-white">
          <CardContent className="p-4 flex flex-col items-center justify-center h-full">
            <p className="text-4xl font-bold font-mono">{events.length}</p>
            <p className="text-slate-300 text-sm mt-1">Total documentos</p>
            <p className="text-slate-400 text-xs">{months.length} meses cubiertos</p>
          </CardContent>
        </Card>
        {statGroups.map(g => {
          const count = g.kinds.reduce((s, k) => s + (countByKind[k] ?? 0), 0);
          if (count === 0) return null;
          return (
            <Card key={g.label} className="rounded-2xl border-border/50 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                <p className={`text-3xl font-bold font-mono ${g.color}`}>{count}</p>
                <p className="text-muted-foreground text-xs mt-1">{g.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Month coverage heatmap ── */}
      <Card className="rounded-2xl border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Cobertura mensual</CardTitle>
          <CardDescription>Documentos generados por mes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {months.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin datos</p>
            ) : (
              months.map(m => {
                const count = byMonth[m].length;
                const [yr, mo] = m.split("-");
                const moName = MONTH_NAMES[parseInt(mo) - 1] ?? mo;
                const intensity = count >= 10 ? "bg-primary text-white" :
                  count >= 5 ? "bg-primary/60 text-white" :
                  count >= 3 ? "bg-primary/30 text-primary" :
                  "bg-primary/10 text-primary/70";
                return (
                  <div key={m} className={`rounded-xl px-3 py-2 text-center min-w-[64px] ${intensity}`}>
                    <div className="text-xs font-medium">{moName} {yr}</div>
                    <div className="text-xl font-bold font-mono leading-tight">{count}</div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Chronological list ── */}
      {months.map(m => {
        const [yr, mo] = m.split("-");
        const moName = MONTH_NAMES[parseInt(mo) - 1] ?? mo;
        const evs = byMonth[m];
        return (
          <div key={m}>
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-slate-800 text-white rounded-xl px-3 py-1 text-sm font-bold">
                {moName} {yr}
              </div>
              <div className="flex-1 border-b border-border/50" />
              <Badge variant="secondary" className="rounded-lg">{evs.length} docs</Badge>
            </div>
            <div className="space-y-2 pl-2">
              {evs.map((e, i) => {
                const meta = KIND_META[e.kind];
                const entryKey = `${m}-${i}`;
                const isExpanded = expandedEntries.has(entryKey);
                const je = e.journalEntry;
                return (
                  <div key={i} className="space-y-0">
                    <div className={`flex items-start gap-3 rounded-xl border px-3 py-2 ${meta.bg} ${je ? "cursor-pointer" : ""}`}
                      onClick={() => je && toggleEntry(entryKey)}
                    >
                      <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className={`text-xs font-semibold uppercase tracking-wide ${meta.color}`}>
                            {meta.text}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span>
                          {je && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                              Asiento {je.entryNumber}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-medium text-foreground truncate">{e.label}</div>
                        {e.subtitle && <div className="text-xs text-muted-foreground truncate">{e.subtitle}</div>}
                      </div>
                      {e.amount !== undefined && (
                        <div className={`text-sm font-mono font-semibold flex-shrink-0 ${meta.color}`}>
                          {formatEuro(Math.abs(e.amount))}
                        </div>
                      )}
                      {e.pdfGenerator && (
                        <button
                          type="button"
                          title="Descargar PDF"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            try {
                              const blob = e.pdfGenerator!();
                              saveAs(blob, e.pdfFilename || "documento.pdf");
                            } catch (err) {
                              console.error("Error generando PDF:", err);
                            }
                          }}
                          className="flex-shrink-0 mt-0.5 p-1.5 rounded-lg hover:bg-white/60 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={meta.color}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </button>
                      )}
                      {je && (
                        <div className="flex-shrink-0 mt-0.5 p-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                      )}
                    </div>
                    {je && isExpanded && (
                      <div className="ml-5 mt-1 mb-1 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="px-3 py-1.5 bg-slate-800 text-white flex items-center justify-between">
                          <span className="text-xs font-semibold">Asiento {je.entryNumber}</span>
                          <span className="text-[10px] text-slate-300">{je.concept}</span>
                        </div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b text-slate-500">
                              <th className="text-left px-3 py-1 font-medium w-20">Cuenta</th>
                              <th className="text-left px-3 py-1 font-medium">Concepto</th>
                              <th className="text-right px-3 py-1 font-medium w-24">Debe</th>
                              <th className="text-right px-3 py-1 font-medium w-24">Haber</th>
                            </tr>
                          </thead>
                          <tbody>
                            {je.debits.map((d, di) => (
                              <tr key={`d${di}`} className="border-b border-slate-100">
                                <td className="px-3 py-1 font-mono text-slate-500">{d.accountCode}</td>
                                <td className="px-3 py-1 text-slate-700">{d.accountName}</td>
                                <td className="px-3 py-1 text-right font-mono font-medium text-blue-700">{formatEuro(d.amount)}</td>
                                <td className="px-3 py-1"></td>
                              </tr>
                            ))}
                            {je.credits.map((c, ci) => (
                              <tr key={`c${ci}`} className="border-b border-slate-100">
                                <td className="px-3 py-1 font-mono text-slate-500">{c.accountCode}</td>
                                <td className="px-3 py-1 text-slate-700 pl-6 italic">{c.accountName}</td>
                                <td className="px-3 py-1"></td>
                                <td className="px-3 py-1 text-right font-mono font-medium text-emerald-700">{formatEuro(c.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50 font-semibold">
                              <td className="px-3 py-1" colSpan={2}>Total</td>
                              <td className="px-3 py-1 text-right font-mono text-blue-700">{formatEuro(je.debits.reduce((s, d) => s + d.amount, 0))}</td>
                              <td className="px-3 py-1 text-right font-mono text-emerald-700">{formatEuro(je.credits.reduce((s, c) => s + c.amount, 0))}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {events.length === 0 && (
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardContent className="p-12 text-center text-muted-foreground">
            No hay documentos con fecha en este universo.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export const DividendsView = ({ data }: { data?: DividendDistribution | null }) => {
  if (!data) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">No se ha generado reparto de dividendos.</p>
        <p className="text-sm mt-1">Activa la opción "Reparto de dividendos" en la configuración.</p>
      </div>
    );
  }
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle title="Reparto de Dividendos" description={`Distribución del resultado del ejercicio ${data.fiscalYear}. Junta aprobada el ${formatDate(data.approvalDate)}.`} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Beneficio Neto", value: data.totalNetProfit, color: "text-foreground" },
          { label: "Reserva Legal (112)", value: data.legalReserve, color: "text-amber-600" },
          { label: "Reserva Voluntaria (113)", value: data.voluntaryReserve, color: "text-blue-600" },
          { label: "Total Dividendos", value: data.totalDividends, color: "text-emerald-600" },
        ].map((item) => (
          <Card key={item.label} className="rounded-2xl shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase font-bold mb-1">{item.label}</p>
              <p className={cn("font-mono text-xl font-bold", item.color)}>{formatEuro(item.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-2xl shadow-md overflow-hidden print-break-inside-avoid">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle>Reparto por Socio</CardTitle>
          <CardDescription>Retención IRPF: {data.irpfWithholdingRate}% · Dividendo/participación: {formatEuro(data.dividendPerShare)} · Pago: {formatDate(data.paymentDate)}</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="rounded-xl border overflow-hidden mb-6">
            <Table>
              <TableHeader className="bg-slate-100">
                <TableRow>
                  <TableHead>Socio</TableHead>
                  <TableHead className="text-right">% Participación</TableHead>
                  <TableHead className="text-right">Dividendo Bruto</TableHead>
                  <TableHead className="text-right">Retención IRPF ({data.irpfWithholdingRate}%)</TableHead>
                  <TableHead className="text-right bg-emerald-50">Dividendo Neto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.perShareholder.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{s.shareholderName}</TableCell>
                    <TableCell className="text-right font-mono">{s.participationPercentage}%</TableCell>
                    <TableCell className="text-right font-mono">{formatEuro(s.grossDividend)}</TableCell>
                    <TableCell className="text-right font-mono text-red-600">- {formatEuro(s.irpfWithholdingAmount)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-600 bg-emerald-50">{formatEuro(s.netDividend)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-50 font-bold border-t-2">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right font-mono">100%</TableCell>
                  <TableCell className="text-right font-mono">{formatEuro(data.totalDividends)}</TableCell>
                  <TableCell className="text-right font-mono text-red-600">- {formatEuro(data.perShareholder.reduce((s, p) => s + p.irpfWithholdingAmount, 0))}</TableCell>
                  <TableCell className="text-right font-mono text-emerald-600 bg-emerald-50">{formatEuro(data.perShareholder.reduce((s, p) => s + p.netDividend, 0))}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <AsientoContable debits={data.accountDebits} credits={data.accountCredits} note={data.journalNote} />
        </CardContent>
      </Card>
    </div>
  );
};

// ─── BANK DEBIT NOTES VIEW ────────────────────────────────────────────────────
interface BankDebitNote {
  id: string;
  date: string;
  concept: string;
  reference: string;
  beneficiary: string;
  amount: number;
  category: string;
  accountDebits: AccountEntry[];
  accountCredits: AccountEntry[];
  journalNote: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Seguridad Social":    "bg-blue-100 text-blue-800 border-blue-200",
  "IRPF Mod.111":        "bg-amber-100 text-amber-800 border-amber-200",
  "IVA Mod.303":         "bg-purple-100 text-purple-800 border-purple-200",
  "IGIC Mod.420":        "bg-purple-100 text-purple-800 border-purple-200",
  "Impuesto Sociedades": "bg-red-100 text-red-800 border-red-200",
  "Préstamo Bancario":   "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Hipoteca":            "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Seguros":             "bg-teal-100 text-teal-800 border-teal-200",
  "Póliza de Crédito":   "bg-orange-100 text-orange-800 border-orange-200",
  "Nóminas":             "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Dividendos":          "bg-pink-100 text-pink-800 border-pink-200",
};

function catColor(cat: string): string {
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  for (const key of Object.keys(CATEGORY_COLORS)) {
    if (cat.startsWith(key.split(" ")[0])) return CATEGORY_COLORS[key];
  }
  return "bg-slate-100 text-slate-800 border-slate-200";
}

export const BankDebitNotesView = ({
  notes,
  company,
}: {
  notes: BankDebitNote[];
  company: { name: string; nif: string };
}) => {
  const totalAmount = notes.reduce((s, n) => s + n.amount, 0);
  const byCategory = notes.reduce<Record<string, number>>((acc, n) => {
    acc[n.category] = (acc[n.category] ?? 0) + n.amount;
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle
        title="Notas de Adeudo Bancario"
        description="Documentos bancarios que acreditan cada cargo en cuenta — pagos a la TGSS, Hacienda, entidades financieras y otros acreedores."
      />

      {/* Summary card */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-700 px-5 py-3 rounded-t-xl">
          <p className="text-base font-semibold text-white">Resumen de cargos — {company.name}</p>
        </div>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
            {Object.entries(byCategory).map(([cat, total]) => (
              <div key={cat} className={`rounded-lg border px-3 py-2 ${catColor(cat)}`}>
                <div className="text-xs font-medium truncate leading-tight">{cat}</div>
                <div className="text-sm font-bold font-mono mt-1">{formatEuro(total)}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center border-t pt-3">
            <span className="text-sm font-semibold text-slate-600">TOTAL CARGOS EN CUENTA</span>
            <span className="text-lg font-bold font-mono text-red-600">{formatEuro(totalAmount)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Individual note cards */}
      {notes.map((note) => (
        <Card key={note.id} className="border border-slate-200 shadow-sm overflow-hidden print-break-inside-avoid">
          {/* Bank document header */}
          <div className="bg-slate-700 text-white px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-400 font-mono tracking-wide">{note.reference}</div>
              <div className="font-semibold text-sm sm:text-base leading-snug mt-0.5">{note.concept}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-bold font-mono text-red-300">– {formatEuro(note.amount)}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">Cargo en cuenta</div>
            </div>
          </div>

          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Fecha valor</div>
                <div className="font-semibold">{note.date ? formatDate(note.date) : "—"}</div>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <div className="text-xs text-muted-foreground mb-0.5">Beneficiario / Destinatario</div>
                <div className="font-semibold text-xs leading-snug">{note.beneficiary}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Tipo de pago</div>
                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${catColor(note.category)}`}>
                  {note.category}
                </span>
              </div>
            </div>

            <AsientoContable
              debits={note.accountDebits}
              credits={note.accountCredits}
              note={note.journalNote}
            />
          </CardContent>
        </Card>
      ))}

      {notes.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          No hay notas de adeudo disponibles para este universo.
        </div>
      )}
    </div>
  );
};

// ─── SUB-ACCOUNTS VIEW ───────────────────────────────────────────────────────

export const SubAccountsView = ({ data }: { data: AccountingUniverse }) => {
  const subAccounts = (data as any).subAccounts as Array<{ baseCode: string; subCode: string; entityName: string }> | undefined;
  const digits = (data as any).accountDigits as number | undefined;

  if (!subAccounts || subAccounts.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">No se han generado subcuentas.</p>
        <p className="text-sm mt-1">Selecciona un número de dígitos del plan contable en la configuración para activar las subcuentas.</p>
      </div>
    );
  }

  const grouped = subAccounts.reduce<Record<string, Array<{ baseCode: string; subCode: string; entityName: string }>>>((acc, sa) => {
    const base = sa.baseCode;
    if (!acc[base]) acc[base] = [];
    acc[base].push(sa);
    return acc;
  }, {});

  const baseNames: Record<string, string> = {
    "400": "Proveedores",
    "410": "Acreedores por prestaciones de servicios",
    "430": "Clientes",
    "440": "Deudores",
    "465": "Remuneraciones pendientes de pago",
    "551": "Cuenta corriente con socios y admins",
    "553": "Cuenta corriente con socios y admins",
    "572": "Bancos e instituciones de crédito c/c",
    "170": "Deudas a l/p con entidades de crédito",
    "520": "Deudas a c/p con entidades de crédito",
    "5200": "Préstamos a c/p de entidades de crédito",
    "5201": "Deudas a c/p por crédito dispuesto",
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle
        title={`Cuadro de Subcuentas (${digits} dígitos)`}
        description={`Se han asignado ${subAccounts.length} subcuentas específicas para individualizar cada proveedor, cliente, banco y demás terceros.`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([base, entries]) => (
          <Card key={base} className="rounded-2xl shadow-sm border-border/50 overflow-hidden">
            <div className="bg-slate-800 px-4 py-2 flex items-center justify-between">
              <span className="text-white font-mono font-bold text-sm">{base}</span>
              <span className="text-slate-300 text-xs">{baseNames[base] || "Cuenta"}</span>
            </div>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b text-slate-500">
                    <th className="text-left px-4 py-2 font-medium w-32">Subcuenta</th>
                    <th className="text-left px-4 py-2 font-medium">Tercero / Entidad</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((sa, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono font-semibold text-primary">{sa.subCode}</td>
                      <td className="px-4 py-2 text-slate-700">{sa.entityName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ─── YEAR-END CLOSING VIEWS ──────────────────────────────────────────────────

type YearEndData = {
  ledger: Array<{
    accountCode: string; accountName: string;
    movements: Array<{ entryNumber: string; date: string; concept: string; debit: number; credit: number; balance: number }>;
    totalDebit: number; totalCredit: number; balance: number; balanceSide: string;
  }>;
  trialBalance: Array<{ accountCode: string; accountName: string; sumDebit: number; sumCredit: number; balanceDebit: number; balanceCredit: number }>;
  regularizationEntries: Array<{
    entryNumber: string; date: string; concept: string;
    debits: Array<{ accountCode: string; accountName: string; amount: number }>;
    credits: Array<{ accountCode: string; accountName: string; amount: number }>;
    totalAmount: number;
  }>;
  profitAndLoss: {
    income: Array<{ title: string; accounts: Array<{ accountCode: string; accountName: string; amount: number }>; subtotal: number }>;
    expenses: Array<{ title: string; accounts: Array<{ accountCode: string; accountName: string; amount: number }>; subtotal: number }>;
    totalIncome: number; totalExpenses: number; netResult: number; resultType: string;
  };
  finalBalanceSheet: {
    assets: Array<{ title: string; items: Array<{ accountCode: string; accountName: string; amount: number }>; subtotal: number }>;
    totalAssets: number;
    equity: Array<{ title: string; items: Array<{ accountCode: string; accountName: string; amount: number }>; subtotal: number }>;
    liabilities: Array<{ title: string; items: Array<{ accountCode: string; accountName: string; amount: number }>; subtotal: number }>;
    totalEquityAndLiabilities: number;
  };
  closingEntry: {
    entryNumber: string; date: string; concept: string;
    debits: Array<{ accountCode: string; accountName: string; amount: number }>;
    credits: Array<{ accountCode: string; accountName: string; amount: number }>;
    totalAmount: number;
  };
};

export const LedgerView = ({ data }: { data: YearEndData }) => {
  const [openAccount, setOpenAccount] = React.useState<string | null>(null);
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle
        title="Libro Mayor"
        description="Cada cuenta con todos sus movimientos del ejercicio, sumas y saldo final."
      />
      {data.ledger.map((acc) => (
        <Card key={acc.accountCode} className="rounded-xl shadow-sm border-border/50 overflow-hidden">
          <button
            className="w-full text-left px-4 py-3 flex items-center justify-between bg-slate-800 hover:bg-slate-700 transition-colors"
            onClick={() => setOpenAccount(openAccount === acc.accountCode ? null : acc.accountCode)}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-white text-sm">{formatAccountCode(acc.accountCode)}</span>
              <span className="text-slate-200 text-sm">{acc.accountName}</span>
              <Badge variant="outline" className="text-xs text-slate-300 border-slate-500">{acc.movements.length} mov.</Badge>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-red-300 font-mono">{formatEuro(acc.totalDebit)}</span>
              <span className="text-emerald-300 font-mono">{formatEuro(acc.totalCredit)}</span>
              <Badge className={cn("font-mono text-xs", acc.balanceSide === "deudor" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800")}>
                S{acc.balanceSide === "deudor" ? "d" : "a"} {formatEuro(acc.balance)}
              </Badge>
              <span className="text-slate-400">{openAccount === acc.accountCode ? "▲" : "▼"}</span>
            </div>
          </button>
          {openAccount === acc.accountCode && (
            <CardContent className="p-0">
              <Table className="text-sm">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-16">Nº</TableHead>
                    <TableHead className="w-24">Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right w-28">Debe</TableHead>
                    <TableHead className="text-right w-28">Haber</TableHead>
                    <TableHead className="text-right w-28">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {acc.movements.map((m, i) => (
                    <TableRow key={i} className="hover:bg-slate-50">
                      <TableCell className="font-mono text-xs text-muted-foreground">{m.entryNumber}</TableCell>
                      <TableCell className="text-xs">{formatDate(m.date)}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate">{m.concept}</TableCell>
                      <TableCell className="text-right font-mono text-destructive">{m.debit ? formatEuro(m.debit) : ""}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-600">{m.credit ? formatEuro(m.credit) : ""}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{formatEuro(m.balance)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-slate-100 border-t-2">
                    <TableCell colSpan={3} className="text-right font-bold text-slate-600">TOTALES</TableCell>
                    <TableCell className="text-right font-mono font-bold text-destructive">{formatEuro(acc.totalDebit)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-600">{formatEuro(acc.totalCredit)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{formatEuro(acc.balance)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
};

export const TrialBalanceView = ({ data }: { data: YearEndData }) => {
  const totals = useMemo(() => {
    let sd = 0, sc = 0, bd = 0, bc = 0;
    for (const r of data.trialBalance) { sd += r.sumDebit; sc += r.sumCredit; bd += r.balanceDebit; bc += r.balanceCredit; }
    return { sd: Math.round(sd * 100) / 100, sc: Math.round(sc * 100) / 100, bd: Math.round(bd * 100) / 100, bc: Math.round(bc * 100) / 100 };
  }, [data.trialBalance]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle
        title="Balance de Comprobación de Sumas y Saldos"
        description="Resumen de las sumas deudoras y acreedoras de cada cuenta, con el saldo resultante."
      />
      <Card className="rounded-2xl shadow-md border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <Table className="text-sm">
            <TableHeader className="bg-slate-800 text-white">
              <TableRow className="hover:bg-slate-800">
                <TableHead className="text-slate-300 w-24">Cuenta</TableHead>
                <TableHead className="text-slate-300">Denominación</TableHead>
                <TableHead className="text-slate-300 text-right w-28" colSpan={1}>Sumas Debe</TableHead>
                <TableHead className="text-slate-300 text-right w-28" colSpan={1}>Sumas Haber</TableHead>
                <TableHead className="text-slate-300 text-right w-28">Saldo Deudor</TableHead>
                <TableHead className="text-slate-300 text-right w-28">Saldo Acreedor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.trialBalance.map((row, i) => (
                <TableRow key={i} className="hover:bg-slate-50">
                  <TableCell className="font-mono font-semibold text-primary">{formatAccountCode(row.accountCode)}</TableCell>
                  <TableCell>{row.accountName}</TableCell>
                  <TableCell className="text-right font-mono">{formatEuro(row.sumDebit)}</TableCell>
                  <TableCell className="text-right font-mono">{formatEuro(row.sumCredit)}</TableCell>
                  <TableCell className="text-right font-mono text-amber-700">{row.balanceDebit ? formatEuro(row.balanceDebit) : ""}</TableCell>
                  <TableCell className="text-right font-mono text-blue-700">{row.balanceCredit ? formatEuro(row.balanceCredit) : ""}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-slate-200 border-t-4 border-slate-300 font-bold">
                <TableCell colSpan={2} className="text-right">TOTALES</TableCell>
                <TableCell className="text-right font-mono">{formatEuro(totals.sd)}</TableCell>
                <TableCell className="text-right font-mono">{formatEuro(totals.sc)}</TableCell>
                <TableCell className="text-right font-mono text-amber-700">{formatEuro(totals.bd)}</TableCell>
                <TableCell className="text-right font-mono text-blue-700">{formatEuro(totals.bc)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

const ClosingEntryTable = ({ entry }: { entry: YearEndData["closingEntry"] }) => (
  <Card className="rounded-2xl shadow-md border-border/50 overflow-hidden">
    <div className="bg-slate-800 px-5 py-3">
      <div className="flex items-center justify-between">
        <span className="text-white font-semibold">Asiento Nº {entry.entryNumber} — {formatDate(entry.date)}</span>
        <Badge className="bg-amber-200 text-amber-900 text-xs">{formatEuro(entry.totalAmount)}</Badge>
      </div>
      <p className="text-slate-300 text-xs mt-1">{entry.concept}</p>
    </div>
    <CardContent className="p-0">
      <Table className="text-sm">
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="w-24">Cuenta</TableHead>
            <TableHead>Concepto</TableHead>
            <TableHead className="text-right w-28">Debe</TableHead>
            <TableHead className="text-right w-28">Haber</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entry.debits.map((d, i) => (
            <TableRow key={`d-${i}`} className="hover:bg-slate-50">
              <TableCell className="font-mono font-semibold text-primary">{formatAccountCode(d.accountCode)}</TableCell>
              <TableCell>{d.accountName}</TableCell>
              <TableCell className="text-right font-mono font-semibold text-destructive">{formatEuro(d.amount)}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          ))}
          {entry.credits.map((c, i) => (
            <TableRow key={`c-${i}`} className="hover:bg-slate-50">
              <TableCell className="font-mono font-semibold text-primary">{formatAccountCode(c.accountCode)}</TableCell>
              <TableCell className="pl-8">{c.accountName}</TableCell>
              <TableCell></TableCell>
              <TableCell className="text-right font-mono font-semibold text-emerald-600">{formatEuro(c.amount)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-slate-100 border-t-2">
            <TableCell colSpan={2} className="text-right font-bold">TOTALES</TableCell>
            <TableCell className="text-right font-mono font-bold text-destructive">{formatEuro(entry.debits.reduce((s, d) => s + d.amount, 0))}</TableCell>
            <TableCell className="text-right font-mono font-bold text-emerald-600">{formatEuro(entry.credits.reduce((s, c) => s + c.amount, 0))}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);

export const RegularizationView = ({ data }: { data: YearEndData }) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <SectionTitle
      title="Asientos de Regularización"
      description="Cierre de las cuentas de gastos (grupo 6) e ingresos (grupo 7), traspasando sus saldos a la cuenta 129 — Resultado del ejercicio."
    />
    {data.regularizationEntries.map((entry, i) => (
      <ClosingEntryTable key={i} entry={entry} />
    ))}
    {data.regularizationEntries.length === 0 && (
      <div className="text-center py-16 text-muted-foreground">No se han generado asientos de regularización.</div>
    )}
  </div>
);

export const ProfitAndLossView = ({ data }: { data: YearEndData }) => {
  const pl = data.profitAndLoss;
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle
        title="Cuenta de Pérdidas y Ganancias"
        description="Resultado del ejercicio desglosado por naturaleza de gastos e ingresos según el PGC."
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl shadow-md border-red-200 overflow-hidden">
          <div className="bg-red-700 px-5 py-3">
            <p className="text-white font-bold text-lg">GASTOS</p>
          </div>
          <CardContent className="p-0">
            {pl.expenses.map((sec, si) => (
              <div key={si} className="border-b border-slate-100 last:border-0">
                <div className="bg-red-50 px-4 py-2 flex justify-between items-center">
                  <span className="text-sm font-semibold text-red-800">{sec.title}</span>
                  <span className="font-mono font-bold text-red-700 text-sm">{formatEuro(sec.subtotal)}</span>
                </div>
                {sec.accounts.map((a, ai) => (
                  <div key={ai} className="flex justify-between px-4 py-1.5 text-sm hover:bg-red-50/50">
                    <span><span className="font-mono text-xs text-muted-foreground mr-2">{formatAccountCode(a.accountCode)}</span>{a.accountName}</span>
                    <span className="font-mono">{formatEuro(a.amount)}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="bg-red-100 px-4 py-3 flex justify-between items-center border-t-2 border-red-300">
              <span className="font-bold text-red-900">TOTAL GASTOS</span>
              <span className="font-mono font-bold text-red-900 text-lg">{formatEuro(pl.totalExpenses)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-md border-emerald-200 overflow-hidden">
          <div className="bg-emerald-700 px-5 py-3">
            <p className="text-white font-bold text-lg">INGRESOS</p>
          </div>
          <CardContent className="p-0">
            {pl.income.map((sec, si) => (
              <div key={si} className="border-b border-slate-100 last:border-0">
                <div className="bg-emerald-50 px-4 py-2 flex justify-between items-center">
                  <span className="text-sm font-semibold text-emerald-800">{sec.title}</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">{formatEuro(sec.subtotal)}</span>
                </div>
                {sec.accounts.map((a, ai) => (
                  <div key={ai} className="flex justify-between px-4 py-1.5 text-sm hover:bg-emerald-50/50">
                    <span><span className="font-mono text-xs text-muted-foreground mr-2">{formatAccountCode(a.accountCode)}</span>{a.accountName}</span>
                    <span className="font-mono">{formatEuro(a.amount)}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="bg-emerald-100 px-4 py-3 flex justify-between items-center border-t-2 border-emerald-300">
              <span className="font-bold text-emerald-900">TOTAL INGRESOS</span>
              <span className="font-mono font-bold text-emerald-900 text-lg">{formatEuro(pl.totalIncome)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={cn("rounded-2xl shadow-lg overflow-hidden", pl.resultType === "Beneficio" ? "border-emerald-300" : "border-red-300")}>
        <div className={cn("px-6 py-5 flex items-center justify-between", pl.resultType === "Beneficio" ? "bg-emerald-600" : "bg-red-600")}>
          <div>
            <p className="text-white text-sm font-medium uppercase tracking-wider">Resultado del Ejercicio</p>
            <p className="text-white/80 text-xs mt-1">Cuenta 129 — {pl.resultType}</p>
          </div>
          <span className="text-white font-mono font-bold text-3xl">{pl.netResult >= 0 ? "+" : ""}{formatEuro(pl.netResult)}</span>
        </div>
      </Card>
    </div>
  );
};

export const FinalBalanceSheetView = ({ data }: { data: YearEndData }) => {
  const bs = data.finalBalanceSheet;
  const colorMap: Record<string, { bg: string; textTitle: string; textAmount: string }> = {
    blue: { bg: "bg-blue-50", textTitle: "text-blue-800", textAmount: "text-blue-700" },
    violet: { bg: "bg-violet-50", textTitle: "text-violet-800", textAmount: "text-violet-700" },
    orange: { bg: "bg-orange-50", textTitle: "text-orange-800", textAmount: "text-orange-700" },
  };
  const BalanceSection = ({ sections, color }: { sections: typeof bs.assets; color: string }) => {
    const c = colorMap[color] ?? colorMap.blue;
    return (
      <>
        {sections.map((sec, si) => (
          <div key={si} className="mb-3">
            <div className={`px-4 py-2 rounded-lg ${c.bg} flex justify-between items-center`}>
              <span className={`text-sm font-semibold ${c.textTitle}`}>{sec.title}</span>
              <span className={`font-mono font-bold ${c.textAmount} text-sm`}>{formatEuro(sec.subtotal)}</span>
            </div>
            {sec.items.map((item, ii) => (
              <div key={ii} className="flex justify-between px-4 py-1.5 text-sm hover:bg-slate-50">
                <span><span className="font-mono text-xs text-muted-foreground mr-2">{formatAccountCode(item.accountCode)}</span>{item.accountName}</span>
                <span className={cn("font-mono", item.amount < 0 && "text-red-600")}>{formatEuro(item.amount)}</span>
              </div>
            ))}
          </div>
        ))}
      </>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle
        title="Balance de Situación Final"
        description="Patrimonio de la empresa al cierre del ejercicio — activo, patrimonio neto y pasivo."
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl shadow-md border-blue-200 overflow-hidden">
          <div className="bg-blue-700 px-5 py-3">
            <p className="text-white font-bold text-lg">ACTIVO</p>
          </div>
          <CardContent className="pt-4">
            <BalanceSection sections={bs.assets} color="blue" />
            <div className="bg-blue-100 px-4 py-3 flex justify-between items-center border-t-2 border-blue-300 rounded-lg mt-2">
              <span className="font-bold text-blue-900">TOTAL ACTIVO</span>
              <span className="font-mono font-bold text-blue-900 text-lg">{formatEuro(bs.totalAssets)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-md border-violet-200 overflow-hidden">
          <div className="bg-violet-700 px-5 py-3">
            <p className="text-white font-bold text-lg">PATRIMONIO NETO Y PASIVO</p>
          </div>
          <CardContent className="pt-4">
            {bs.equity.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-bold text-violet-600 uppercase tracking-wider mb-2 px-4">Patrimonio Neto</h4>
                <BalanceSection sections={bs.equity} color="violet" />
              </div>
            )}
            {bs.liabilities.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-2 px-4">Pasivo</h4>
                <BalanceSection sections={bs.liabilities} color="orange" />
              </div>
            )}
            <div className="bg-violet-100 px-4 py-3 flex justify-between items-center border-t-2 border-violet-300 rounded-lg mt-2">
              <span className="font-bold text-violet-900">TOTAL PN + PASIVO</span>
              <span className="font-mono font-bold text-violet-900 text-lg">{formatEuro(bs.totalEquityAndLiabilities)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {Math.abs(bs.totalAssets - bs.totalEquityAndLiabilities) < 0.02 ? (
        <div className="text-center py-3 text-emerald-600 font-semibold text-sm">
          El balance cuadra: Activo ({formatEuro(bs.totalAssets)}) = PN + Pasivo ({formatEuro(bs.totalEquityAndLiabilities)})
        </div>
      ) : (
        <div className="text-center py-3 text-amber-600 font-semibold text-sm">
          Diferencia de cuadre: {formatEuro(Math.abs(bs.totalAssets - bs.totalEquityAndLiabilities))} (Activo: {formatEuro(bs.totalAssets)} vs PN+Pasivo: {formatEuro(bs.totalEquityAndLiabilities)})
        </div>
      )}
    </div>
  );
};

export const ClosingEntryView = ({ data }: { data: YearEndData }) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <SectionTitle
      title="Asiento de Cierre"
      description="Se cierran todas las cuentas de balance (grupos 1 a 5) dejando todos los saldos a cero para el inicio del nuevo ejercicio."
    />
    <ClosingEntryTable entry={data.closingEntry} />
  </div>
);
