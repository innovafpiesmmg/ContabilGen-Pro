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
              <TableCell className="text-center font-mono text-slate-500">{d.accountCode}</TableCell>
              <TableCell className="text-slate-700">{d.accountName}{d.description ? <span className="text-xs text-slate-400 ml-1">({d.description})</span> : null}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          ))}
          {credits.map((c, i) => (
            <TableRow key={`c-${i}`} className="border-0 hover:bg-slate-100/50">
              <TableCell></TableCell>
              <TableCell className="text-center font-mono text-slate-500">{c.accountCode}</TableCell>
              <TableCell className="text-slate-700 pl-8 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-px bg-slate-300"></span>
                {c.accountName}{c.description ? <span className="text-xs text-slate-400 ml-1">({c.description})</span> : null}
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

export const JournalView = ({ entries }: { entries: JournalEntry[] }) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle title="Libro Diario" description="Registro cronológico de todos los asientos contables generados." />
      
      <Card className="rounded-2xl shadow-xl border-border overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader className="bg-slate-800 text-slate-50">
              <TableRow className="hover:bg-slate-800">
                <TableHead className="text-slate-300 w-24">Nº Asiento</TableHead>
                <TableHead className="text-slate-300 w-28">Fecha</TableHead>
                <TableHead className="text-slate-300 w-24 text-center">Cuenta</TableHead>
                <TableHead className="text-slate-300">Concepto de la Cuenta / Asiento</TableHead>
                <TableHead className="text-slate-300 text-right w-32">Debe</TableHead>
                <TableHead className="text-slate-300 text-right w-32">Haber</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, idx) => (
                <React.Fragment key={idx}>
                  {/* Header row for the Journal Entry */}
                  <TableRow className="bg-slate-100/80 border-t-4 border-slate-200 print-break-inside-avoid">
                    <TableCell className="font-bold text-primary">{entry.entryNumber}</TableCell>
                    <TableCell className="font-semibold text-slate-600">{formatDate(entry.date)}</TableCell>
                    <TableCell colSpan={4} className="font-semibold text-slate-700">
                      {entry.concept}
                      {entry.document && <span className="ml-2 font-normal text-slate-500 text-xs">(Ref: {entry.document})</span>}
                    </TableCell>
                  </TableRow>
                  
                  {/* Debit lines */}
                  {entry.debits.map((d, i) => (
                    <TableRow key={`d-${idx}-${i}`} className="border-0 hover:bg-slate-50 print-break-inside-avoid">
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-center font-mono text-slate-500">{d.accountCode}</TableCell>
                      <TableCell className="text-slate-700">{d.accountName}</TableCell>
                      <TableCell className="text-right font-mono font-medium text-blue-700">{formatEuro(d.amount)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Credit lines */}
                  {entry.credits.map((c, i) => (
                    <TableRow key={`c-${idx}-${i}`} className="border-0 hover:bg-slate-50 print-break-inside-avoid">
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-center font-mono text-slate-500">{c.accountCode}</TableCell>
                      <TableCell className="text-slate-700 pl-8 italic">{c.accountName}</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-mono font-medium text-emerald-700">{formatEuro(c.amount)}</TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
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
      <SectionTitle title="Balance de Apertura" description={data.description} />
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
  | "gasto_extra" | "ingreso_extra";

interface ChronoEvent {
  date: string;
  kind: EventKind;
  label: string;
  subtitle: string;
  amount?: number;
  pdfGenerator?: () => Blob;
  pdfFilename?: string;
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
};

function parsePayrollDate(month: string, year: number): string {
  const meses: Record<string, string> = {
    enero:"01", febrero:"02", marzo:"03", abril:"04", mayo:"05", junio:"06",
    julio:"07", agosto:"08", septiembre:"09", octubre:"10", noviembre:"11", diciembre:"12",
    january:"01", february:"02", march:"03", april:"04", may:"05", june:"06",
    july:"07", august:"08", september:"09", october:"10", november:"11", december:"12",
  };
  const lower = month.toLowerCase();
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

function collectEvents(universe: AccountingUniverse): ChronoEvent[] {
  const events: ChronoEvent[] = [];
  const cp = buildCP(universe);
  const safe = (s: string) => (s || "").replace(/[/\\?%*:|"<>]/g, "-").substring(0, 50);

  (universe.invoices ?? []).forEach((inv) => {
    const kind: EventKind = inv.type === "sale" ? "factura_venta"
      : inv.type === "rectification" ? "factura_rectif" : "factura_compra";
    const tipo = inv.type === "sale" ? "Venta" : "Compra";
    events.push({ date: inv.date, kind, label: inv.invoiceNumber,
      subtitle: inv.partyName, amount: inv.total,
      pdfGenerator: () => generateInvoicePdf(inv, cp),
      pdfFilename: `Factura_${tipo}_${safe(inv.invoiceNumber)}.pdf` });
  });

  (universe.journalEntries ?? []).forEach((e) => {
    events.push({ date: e.date, kind: "asiento", label: `Asiento ${e.entryNumber}`,
      subtitle: e.concept, amount: e.totalAmount });
  });

  (universe.bankStatements ?? []).forEach((bs) => {
    (bs.transactions ?? []).forEach((t) => {
      events.push({ date: t.date, kind: "banco", label: bs.bank,
        subtitle: t.concept, amount: t.debit ?? t.credit ?? undefined,
        pdfGenerator: () => generateBankStatementPdf(bs, cp),
        pdfFilename: `Extracto_${safe(bs.bank || bs.period || "")}.pdf` });
    });
  });

  if (universe.creditCardStatement) {
    const card = universe.creditCardStatement;
    (card.movements ?? []).forEach((m) => {
      events.push({ date: m.date, kind: "tarjeta", label: "Tarjeta crédito",
        subtitle: m.description, amount: m.amount,
        pdfGenerator: () => generateCreditCardStatementPdf(card, cp),
        pdfFilename: `Extracto_Tarjeta_${safe(card.statementPeriod || "")}.pdf` });
    });
  }

  if (universe.bankLoan) {
    const loan = universe.bankLoan;
    (loan.amortizationTable ?? []).forEach((r) => {
      events.push({ date: r.date, kind: "prestamo",
        label: `Cuota ${r.period} préstamo`, subtitle: loan.entity, amount: r.installment,
        pdfGenerator: () => generateBankLoanPdf(loan, cp),
        pdfFilename: `Prestamo_${safe(loan.loanNumber || "")}.pdf` });
    });
  }

  if (universe.mortgage) {
    const mort = universe.mortgage;
    (mort.amortizationTable ?? []).forEach((r) => {
      events.push({ date: r.date, kind: "hipoteca",
        label: `Cuota ${r.period} hipoteca`, subtitle: mort.entity, amount: r.installment,
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

  if (universe.payroll?.month) {
    const yr = (universe.companyProfile?.fiscalYear as number) ?? new Date().getFullYear();
    events.push({ date: parsePayrollDate(universe.payroll.month, yr), kind: "nomina",
      label: "Nómina", subtitle: universe.payroll.month, amount: universe.payroll.totalGross,
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
    events.push({ date: universe.initialBalanceSheet.date, kind: "apertura",
      label: "Balance de apertura", subtitle: universe.initialBalanceSheet.description ?? "Asiento de apertura", amount: universe.initialBalanceSheet.totalAssets,
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

  return events.filter(e => e.date && /^\d{4}-\d{2}-\d{2}/.test(e.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export const CronologiaView: React.FC<{ data: AccountingUniverse }> = ({ data }) => {
  const events = useMemo(() => collectEvents(data), [data]);

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
    { label: "Asientos", kinds: ["asiento"], color: "text-slate-600" },
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
        title="Cronología de documentos"
        description={`${events.length} documentos generados en ${months.length} mes${months.length !== 1 ? "es" : ""} — ordenados cronológicamente`}
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
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-3 rounded-xl border px-3 py-2 ${meta.bg}`}
                  >
                    <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className={`text-xs font-semibold uppercase tracking-wide ${meta.color}`}>
                          {meta.text}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span>
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
                        onClick={() => {
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
