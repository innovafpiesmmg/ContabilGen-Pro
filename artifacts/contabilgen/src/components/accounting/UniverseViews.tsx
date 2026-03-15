import React from 'react';
import { 
  AccountingUniverse, 
  AccountEntry, 
  Invoice, 
  InventoryItem,
  AmortizationRow,
  CreditCardMovement,
  PayrollEmployee,
  BankTransaction,
  JournalEntry
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
              <TableCell className="text-slate-700">{d.accountName} <span className="text-xs text-slate-400 ml-1">({d.description})</span></TableCell>
              <TableCell></TableCell>
            </TableRow>
          ))}
          {credits.map((c, i) => (
            <TableRow key={`c-${i}`} className="border-0 hover:bg-slate-100/50">
              <TableCell></TableCell>
              <TableCell className="text-center font-mono text-slate-500">{c.accountCode}</TableCell>
              <TableCell className="text-slate-700 pl-8 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-px bg-slate-300"></span>
                {c.accountName} <span className="text-xs text-slate-400 ml-1">({c.description})</span>
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
              <p className="font-medium">{company.sector}</p>
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

export const FinancialView = ({ loan, policy, card }: { loan: BankLoan, policy: CreditPolicy, card: CreditCardStatement }) => {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Préstamo */}
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
          <CardContent className="p-6">
            <h4 className="text-sm font-bold text-muted-foreground uppercase mb-4">Cuadro de Amortización (Primeros meses)</h4>
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
            <AsientoContable debits={loan.accountDebits} credits={loan.accountCredits} note={loan.journalNote} />
          </CardContent>
        </Card>
      </section>

      {/* Póliza */}
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

      {/* Tarjeta */}
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

    </div>
  );
};

export const ExtraordinaryView = ({ insurance, casualty }: { insurance: InsurancePolicy[], casualty: CasualtyEvent }) => {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section>
        <SectionTitle title="Pólizas de Seguro" description="Primas anuales y ajustes de periodificación (gastos anticipados)." />
        <div className="space-y-6">
          {insurance.map((ins, i) => (
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
    </div>
  );
};

export const PayrollView = ({ data }: { data: Payroll }) => {
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
