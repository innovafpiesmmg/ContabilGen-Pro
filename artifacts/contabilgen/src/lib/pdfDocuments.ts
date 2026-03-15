import jsPDF from "jspdf";

const A4W = 210;
const A4H = 297;
const M = 15;
const CW = A4W - M * 2;

interface CP {
  name: string;
  nif?: string;
  address?: string;
  city?: string;
  sector?: string;
  taxRegime?: string;
  fiscalYear?: number;
  description?: string;
}

function fmt(n: number | undefined | null): string {
  return (n ?? 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function fmtPct(n: number | undefined | null): string {
  return (n ?? 0).toFixed(2) + " %";
}

function gray(doc: jsPDF, r: number, g: number, b: number) {
  doc.setTextColor(r, g, b);
}

function drawLine(doc: jsPDF, y: number) {
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(M, y, A4W - M, y);
}

function headerBlock(doc: jsPDF, title: string, subtitle: string, cp: CP): number {
  let y = M;
  doc.setFillColor(41, 65, 122);
  doc.rect(0, 0, A4W, 32, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(title, M, y + 12);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, M, y + 20);

  doc.setFontSize(9);
  doc.text(cp.name || "", A4W - M, y + 10, { align: "right" });
  doc.text(`CIF: ${cp.nif || ""}`, A4W - M, y + 16, { align: "right" });
  doc.text(`${cp.address || ""}, ${cp.city || ""}`, A4W - M, y + 22, { align: "right" });

  return 42;
}

function footer(doc: jsPDF, page: number, total: number) {
  doc.setFontSize(7);
  gray(doc, 150, 150, 150);
  doc.text(`Página ${page} de ${total}`, A4W / 2, A4H - 8, { align: "center" });
  doc.text("Documento generado por ContabilGen Pro — Material didáctico para FP", A4W / 2, A4H - 4, { align: "center" });
}

function sectionTitle(doc: jsPDF, y: number, text: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  gray(doc, 41, 65, 122);
  doc.text(text, M, y);
  drawLine(doc, y + 2);
  return y + 8;
}

function labelValue(doc: jsPDF, y: number, label: string, value: string, x = M, w = 45): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  gray(doc, 80, 80, 80);
  doc.text(label, x, y);
  doc.setFont("helvetica", "normal");
  gray(doc, 30, 30, 30);
  doc.text(value, x + w, y);
  return y + 5;
}

function checkPage(doc: jsPDF, y: number, need: number, pageNum: { n: number }, repeatCols?: { label: string; x: number; w: number; align?: "left" | "right" | "center" }[]): number {
  if (y + need > A4H - 20) {
    doc.addPage();
    pageNum.n++;
    let newY = M + 5;
    if (repeatCols) {
      newY = tableHeader(doc, newY, repeatCols);
    }
    return newY;
  }
  return y;
}

function fixupFooters(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    footer(doc, p, total);
  }
}

function tableHeader(doc: jsPDF, y: number, cols: { label: string; x: number; w: number; align?: "left" | "right" | "center" }[]): number {
  doc.setFillColor(41, 65, 122);
  doc.rect(M, y - 4, CW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  for (const c of cols) {
    const align = c.align || "left";
    const tx = align === "right" ? c.x + c.w : align === "center" ? c.x + c.w / 2 : c.x;
    doc.text(c.label, tx, y, { align } as any);
  }
  return y + 6;
}

function tableRow(doc: jsPDF, y: number, cols: { x: number; w: number; align?: "left" | "right" | "center" }[], values: string[], even: boolean): number {
  if (even) {
    doc.setFillColor(245, 247, 250);
    doc.rect(M, y - 3.5, CW, 5.5, "F");
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  gray(doc, 30, 30, 30);
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    const align = c.align || "left";
    const tx = align === "right" ? c.x + c.w : align === "center" ? c.x + c.w / 2 : c.x;
    doc.text((values[i] || "").substring(0, 60), tx, y, { align } as any);
  }
  return y + 5.5;
}

export function generateInvoicePdf(inv: any, cp: CP): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const isSale = inv.type === "sale";
  const pageNum = { n: 1 };

  let y = headerBlock(doc, "FACTURA", inv.invoiceNumber || "", cp);

  y = sectionTitle(doc, y, isSale ? "DATOS DEL CLIENTE" : "DATOS DEL PROVEEDOR");
  y = labelValue(doc, y, "Nombre:", inv.partyName || "");
  y = labelValue(doc, y, "NIF/CIF:", inv.partyNif || "");
  y += 2;

  y = sectionTitle(doc, y, "DATOS DE LA FACTURA");
  y = labelValue(doc, y, "Fecha:", inv.date || "");
  y = labelValue(doc, y, "Tipo:", isSale ? "Venta" : "Compra");
  y = labelValue(doc, y, "Forma de pago:", translatePayment(inv.paymentMethod));
  if (inv.dueDate) y = labelValue(doc, y, "Vencimiento:", inv.dueDate);
  y += 4;

  const cols = [
    { label: "DESCRIPCIÓN", x: M, w: 62 },
    { label: "CANT.", x: M + 62, w: 15, align: "right" as const },
    { label: "P. UNIT.", x: M + 77, w: 22, align: "right" as const },
    { label: "DTO.", x: M + 99, w: 15, align: "right" as const },
    { label: "SUBTOTAL", x: M + 114, w: 22, align: "right" as const },
    { label: "IMP.%", x: M + 136, w: 15, align: "right" as const },
    { label: "TOTAL", x: M + 151, w: 27, align: "right" as const },
  ];
  y = tableHeader(doc, y, cols);

  const lines = Array.isArray(inv.lines) ? inv.lines : [];
  for (let i = 0; i < lines.length; i++) {
    y = checkPage(doc, y, 8, pageNum, cols);
    const l = lines[i];
    y = tableRow(doc, y, cols, [
      l.description || "",
      String(l.quantity ?? ""),
      fmt(l.unitPrice),
      fmtPct(l.discount),
      fmt(l.subtotal),
      fmtPct(l.taxRate),
      fmt(l.total),
    ], i % 2 === 0);
  }

  y += 6;
  drawLine(doc, y); y += 5;

  const summaryX = M + 110;
  doc.setFontSize(9);
  y = labelValue(doc, y, "Base Imponible:", fmt(inv.taxBase), summaryX, 30);
  y = labelValue(doc, y, "Impuesto:", fmt(inv.taxAmount), summaryX, 30);

  doc.setFillColor(41, 65, 122);
  doc.rect(summaryX - 2, y - 4, CW - summaryX + M + 2, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL:", summaryX, y + 1);
  doc.text(fmt(inv.total), A4W - M, y + 1, { align: "right" });

  y += 14;
  if (inv.journalNote) {
    y = checkPage(doc, y, 20, pageNum);
    y = sectionTitle(doc, y, "NOTA CONTABLE (didáctica)");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    gray(doc, 80, 80, 80);
    const noteLines = doc.splitTextToSize(inv.journalNote, CW);
    doc.text(noteLines, M, y);
  }

  fixupFooters(doc);
  return doc.output("blob");
}

function translatePayment(m: string | undefined): string {
  const map: Record<string, string> = {
    cash: "Efectivo", transfer: "Transferencia bancaria", check: "Cheque",
    promissory_note: "Pagaré", credit: "Crédito", card: "Tarjeta",
  };
  return map[m || ""] || m || "—";
}

export function generateBankStatementPdf(stmt: any, cp: CP): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageNum = { n: 1 };

  let y = headerBlock(doc, "EXTRACTO BANCARIO", stmt.period || "", cp);

  y = sectionTitle(doc, y, "DATOS DE LA CUENTA");
  y = labelValue(doc, y, "Entidad:", stmt.bank || "");
  y = labelValue(doc, y, "Nº Cuenta:", stmt.accountNumber || "");
  y = labelValue(doc, y, "Período:", stmt.period || "");
  y = labelValue(doc, y, "Saldo Inicial:", fmt(stmt.openingBalance));
  y += 4;

  const cols = [
    { label: "FECHA", x: M, w: 22 },
    { label: "CONCEPTO", x: M + 22, w: 68 },
    { label: "DEBE", x: M + 90, w: 28, align: "right" as const },
    { label: "HABER", x: M + 118, w: 28, align: "right" as const },
    { label: "SALDO", x: M + 146, w: 32, align: "right" as const },
  ];
  y = tableHeader(doc, y, cols);

  const txns = Array.isArray(stmt.transactions) ? stmt.transactions : [];
  for (let i = 0; i < txns.length; i++) {
    y = checkPage(doc, y, 8, pageNum, cols);
    const t = txns[i];
    y = tableRow(doc, y, cols, [
      t.date || "",
      t.concept || "",
      t.debit ? fmt(t.debit) : "",
      t.credit ? fmt(t.credit) : "",
      fmt(t.balance),
    ], i % 2 === 0);
  }

  y += 6;
  drawLine(doc, y); y += 5;
  doc.setFillColor(41, 65, 122);
  doc.rect(M + 100, y - 4, CW - 100, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("SALDO FINAL:", M + 102, y + 1);
  doc.text(fmt(stmt.closingBalance), A4W - M, y + 1, { align: "right" });

  fixupFooters(doc);
  return doc.output("blob");
}

export function generatePayrollPdf(payroll: any, cp: CP): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = headerBlock(doc, "NÓMINA", payroll.month || "", cp);

  const employees = Array.isArray(payroll.employees) ? payroll.employees : [];

  for (let ei = 0; ei < employees.length; ei++) {
    const emp = employees[ei];
    if (ei > 0) { doc.addPage(); y = headerBlock(doc, "NÓMINA", payroll.month || "", cp); }

    y = sectionTitle(doc, y, "DATOS DEL TRABAJADOR");
    y = labelValue(doc, y, "Nombre:", emp.name || "");
    y = labelValue(doc, y, "NAF:", emp.naf || "");
    y = labelValue(doc, y, "Categoría:", emp.category || "");
    y += 3;

    y = sectionTitle(doc, y, "DEVENGOS");
    doc.setFillColor(230, 240, 230);
    doc.rect(M, y - 3, CW, 6, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); gray(doc, 30, 30, 30);
    doc.text("Salario Bruto", M + 2, y);
    doc.text(fmt(emp.grossSalary), A4W - M - 2, y, { align: "right" });
    y += 10;

    y = sectionTitle(doc, y, "DEDUCCIONES");
    y = labelValue(doc, y, `IRPF (${fmtPct(emp.irpfRate)}):`, fmt(emp.irpfAmount));
    y = labelValue(doc, y, `SS Trabajador (${fmtPct(emp.ssEmployeeRate)}):`, fmt(emp.ssEmployeeAmount));
    y += 3;
    drawLine(doc, y); y += 5;

    doc.setFillColor(41, 65, 122);
    doc.rect(M, y - 4, CW, 10, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text("LÍQUIDO A PERCIBIR:", M + 3, y + 2);
    doc.text(fmt(emp.netSalary), A4W - M - 3, y + 2, { align: "right" });
    y += 16;

    y = sectionTitle(doc, y, "COSTE EMPRESA");
    y = labelValue(doc, y, `SS Empresa (${fmtPct(emp.ssEmployerRate)}):`, fmt(emp.ssEmployerAmount));
    y = labelValue(doc, y, "Coste Total:", fmt((emp.grossSalary ?? 0) + (emp.ssEmployerAmount ?? 0)));
    y += 6;

    if (payroll.paymentDate) {
      y = labelValue(doc, y, "Fecha de pago:", payroll.paymentDate);
    }
  }

  y += 10;
  if (employees.length > 1) {
    y = sectionTitle(doc, y, "RESUMEN TOTAL NÓMINAS");
    y = labelValue(doc, y, "Total Bruto:", fmt(payroll.totalGross));
    y = labelValue(doc, y, "Total IRPF:", fmt(payroll.totalIrpf));
    y = labelValue(doc, y, "Total SS Trabajador:", fmt(payroll.totalSsEmployee));
    y = labelValue(doc, y, "Total Neto:", fmt(payroll.totalNetSalary));
    y = labelValue(doc, y, "Total SS Empresa:", fmt(payroll.totalSsEmployer));
    y = labelValue(doc, y, "Coste Laboral Total:", fmt(payroll.totalLaborCost));
  }

  fixupFooters(doc);
  return doc.output("blob");
}

export function generateSSPaymentPdf(ss: any, cp: CP): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = headerBlock(doc, "RECIBO TC1 — SEGURIDAD SOCIAL", ss.month || "", cp);

  y = sectionTitle(doc, y, "DATOS DEL PAGO");
  y = labelValue(doc, y, "Período:", ss.month || "");
  y = labelValue(doc, y, "Fecha Pago:", ss.dueDate || "");
  y = labelValue(doc, y, "Nº Empleados:", String(ss.employeeCount ?? ""));
  y += 4;

  y = sectionTitle(doc, y, "DESGLOSE");
  y = labelValue(doc, y, "Total Bruto:", fmt(ss.totalGross));
  y = labelValue(doc, y, "Cuota Obrera (trabajador):", fmt(ss.ssEmployeeAmount));
  y = labelValue(doc, y, "Cuota Patronal (empresa):", fmt(ss.ssEmployerAmount));
  y += 3;

  drawLine(doc, y); y += 5;
  doc.setFillColor(41, 65, 122);
  doc.rect(M, y - 4, CW, 10, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL TC1:", M + 3, y + 2);
  doc.text(fmt(ss.totalPayment), A4W - M - 3, y + 2, { align: "right" });

  y += 16;
  y = labelValue(doc, y, "Beneficiario:", "Tesorería General de la Seguridad Social (TGSS)");
  y = labelValue(doc, y, "Concepto:", `Adeudo domiciliado TC1 — ${ss.month}`);

  fixupFooters(doc);
  return doc.output("blob");
}

export function generateTaxLiquidationPdf(liq: any, cp: CP): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const model = liq.model || "303";
  const modelLabel = model === "IS" ? "Mod. 200 — Impuesto sobre Sociedades"
    : model === "111" ? "Mod. 111 — IRPF Retenciones"
    : `Mod. ${model} — ${cp.taxRegime || "IVA"}`;

  let y = headerBlock(doc, "LIQUIDACIÓN TRIBUTARIA", modelLabel, cp);

  y = sectionTitle(doc, y, "DATOS DE LA LIQUIDACIÓN");
  y = labelValue(doc, y, "Modelo:", model);
  y = labelValue(doc, y, "Período:", liq.period || "");
  y = labelValue(doc, y, "Fecha Vencimiento:", liq.dueDate || "");
  y += 4;

  y = sectionTitle(doc, y, "CÁLCULO");
  y = labelValue(doc, y, "Base Imponible:", fmt(liq.taxableBase));
  if (model !== "111" && model !== "IS") {
    y = labelValue(doc, y, `${cp.taxRegime || "IVA"} Devengado:`, fmt(liq.outputTax));
    y = labelValue(doc, y, `${cp.taxRegime || "IVA"} Deducible:`, fmt(liq.inputTax));
  } else {
    y = labelValue(doc, y, "Cuota:", fmt(liq.outputTax));
  }
  y += 3;

  drawLine(doc, y); y += 5;
  const resultColor = (liq.result ?? 0) >= 0 ? [180, 40, 40] : [40, 130, 40];
  doc.setFillColor(resultColor[0], resultColor[1], resultColor[2]);
  doc.rect(M, y - 4, CW, 10, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("RESULTADO:", M + 3, y + 2);
  doc.text(`${(liq.result ?? 0) >= 0 ? "A INGRESAR" : "A DEVOLVER"}: ${fmt(Math.abs(liq.result ?? 0))}`, A4W - M - 3, y + 2, { align: "right" });

  y += 16;
  y = labelValue(doc, y, "Tipo:", translatePaymentType(liq.paymentType));
  y = labelValue(doc, y, "Organismo:", "Agencia Tributaria (AEAT)");

  if (liq.journalNote) {
    y += 6;
    y = sectionTitle(doc, y, "NOTA CONTABLE (didáctica)");
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    gray(doc, 80, 80, 80);
    const lines = doc.splitTextToSize(liq.journalNote, CW);
    doc.text(lines, M, y);
  }

  fixupFooters(doc);
  return doc.output("blob");
}

function translatePaymentType(t: string | undefined): string {
  const map: Record<string, string> = { ingreso: "Ingreso", "devolución": "Devolución", "compensación": "Compensación" };
  return map[t || ""] || t || "—";
}

export function generateBankLoanPdf(loan: any, cp: CP): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageNum = { n: 1 };

  let y = headerBlock(doc, "CONTRATO DE PRÉSTAMO BANCARIO", loan.loanNumber || "", cp);

  y = sectionTitle(doc, y, "DATOS DEL PRÉSTAMO");
  y = labelValue(doc, y, "Entidad:", loan.entity || "");
  y = labelValue(doc, y, "Nº Préstamo:", loan.loanNumber || "");
  y = labelValue(doc, y, "Capital:", fmt(loan.principal));
  y = labelValue(doc, y, "Tipo Interés Anual:", fmtPct(loan.annualRate));
  y = labelValue(doc, y, "Plazo:", `${loan.termMonths || 0} meses`);
  y = labelValue(doc, y, "Fecha Inicio:", loan.startDate || "");
  y = labelValue(doc, y, "Cuota Mensual:", fmt(loan.monthlyInstallment));
  y += 4;

  y = sectionTitle(doc, y, "CUADRO DE AMORTIZACIÓN");
  const cols = [
    { label: "Nº", x: M, w: 12, align: "center" as const },
    { label: "FECHA", x: M + 12, w: 25 },
    { label: "CUOTA", x: M + 37, w: 28, align: "right" as const },
    { label: "INTERESES", x: M + 65, w: 28, align: "right" as const },
    { label: "CAPITAL", x: M + 93, w: 28, align: "right" as const },
    { label: "SALDO VIVO", x: M + 121, w: 30, align: "right" as const },
  ];
  y = tableHeader(doc, y, cols);

  const table = Array.isArray(loan.amortizationTable) ? loan.amortizationTable : [];
  for (let i = 0; i < table.length; i++) {
    y = checkPage(doc, y, 8, pageNum, cols);
    const r = table[i];
    y = tableRow(doc, y, cols, [
      String(r.period ?? i + 1),
      r.date || "",
      fmt(r.installment),
      fmt(r.interest),
      fmt(r.principal),
      fmt(r.balance),
    ], i % 2 === 0);
  }

  fixupFooters(doc);
  return doc.output("blob");
}

export function generateMortgagePdf(mortgage: any, cp: CP): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageNum = { n: 1 };

  let y = headerBlock(doc, "ESCRITURA DE HIPOTECA", mortgage.loanNumber || "", cp);

  y = sectionTitle(doc, y, "DATOS DE LA HIPOTECA");
  y = labelValue(doc, y, "Entidad:", mortgage.entity || "");
  y = labelValue(doc, y, "Nº Hipoteca:", mortgage.loanNumber || "");
  y = labelValue(doc, y, "Inmueble:", mortgage.propertyDescription || "");
  y = labelValue(doc, y, "Valor Tasación:", fmt(mortgage.propertyValue));
  y = labelValue(doc, y, "Capital:", fmt(mortgage.principal));
  y = labelValue(doc, y, "Tipo Interés:", fmtPct(mortgage.annualRate));
  y = labelValue(doc, y, "Plazo:", `${mortgage.termMonths || 0} meses`);
  y = labelValue(doc, y, "Fecha Inicio:", mortgage.startDate || "");
  y = labelValue(doc, y, "Cuota Mensual:", fmt(mortgage.monthlyInstallment));
  y += 4;

  y = sectionTitle(doc, y, "CUADRO DE AMORTIZACIÓN");
  const cols = [
    { label: "Nº", x: M, w: 12, align: "center" as const },
    { label: "FECHA", x: M + 12, w: 25 },
    { label: "CUOTA", x: M + 37, w: 28, align: "right" as const },
    { label: "INTERESES", x: M + 65, w: 28, align: "right" as const },
    { label: "CAPITAL", x: M + 93, w: 28, align: "right" as const },
    { label: "SALDO VIVO", x: M + 121, w: 30, align: "right" as const },
  ];
  y = tableHeader(doc, y, cols);

  const table = Array.isArray(mortgage.amortizationTable) ? mortgage.amortizationTable : [];
  for (let i = 0; i < table.length; i++) {
    y = checkPage(doc, y, 8, pageNum, cols);
    const r = table[i];
    y = tableRow(doc, y, cols, [
      String(r.period ?? i + 1),
      r.date || "",
      fmt(r.installment),
      fmt(r.interest),
      fmt(r.principal),
      fmt(r.balance),
    ], i % 2 === 0);
  }

  fixupFooters(doc);
  return doc.output("blob");
}

export function generateCreditPolicyPdf(policy: any, cp: CP): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = headerBlock(doc, "PÓLIZA DE CRÉDITO", policy.policyNumber || "", cp);

  y = sectionTitle(doc, y, "CONDICIONES DE LA PÓLIZA");
  y = labelValue(doc, y, "Entidad:", policy.entity || "");
  y = labelValue(doc, y, "Nº Póliza:", policy.policyNumber || "");
  y = labelValue(doc, y, "Límite:", fmt(policy.limit));
  y = labelValue(doc, y, "Dispuesto:", fmt(policy.drawnAmount));
  y = labelValue(doc, y, "Tipo Interés:", fmtPct(policy.annualRate));
  y = labelValue(doc, y, "Comisión Apertura:", fmt(policy.openingCommission));
  y = labelValue(doc, y, "Comisión No Disposición:", fmt(policy.unusedCommission));
  y = labelValue(doc, y, "Fecha Inicio:", policy.startDate || "");
  y = labelValue(doc, y, "Fecha Vencimiento:", policy.endDate || "");
  y += 4;

  y = sectionTitle(doc, y, "LIQUIDACIÓN AL VENCIMIENTO");
  y = labelValue(doc, y, "Intereses:", fmt(policy.interestAmount));
  y = labelValue(doc, y, "Comisiones:", fmt((policy.openingCommission ?? 0) + (policy.unusedCommission ?? 0)));
  y += 3;

  drawLine(doc, y); y += 5;
  doc.setFillColor(41, 65, 122);
  doc.rect(M, y - 4, CW, 10, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL LIQUIDACIÓN:", M + 3, y + 2);
  doc.text(fmt(policy.totalSettlement), A4W - M - 3, y + 2, { align: "right" });

  fixupFooters(doc);
  return doc.output("blob");
}

export function generateCreditCardStatementPdf(card: any, cp: CP): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageNum = { n: 1 };

  let y = headerBlock(doc, "EXTRACTO TARJETA DE CRÉDITO", card.statementPeriod || "", cp);

  y = sectionTitle(doc, y, "DATOS DE LA TARJETA");
  y = labelValue(doc, y, "Tarjeta:", card.cardNumber || "");
  y = labelValue(doc, y, "Entidad:", card.entity || "");
  y = labelValue(doc, y, "Período:", card.statementPeriod || "");
  y += 4;

  const cols = [
    { label: "FECHA", x: M, w: 22 },
    { label: "CONCEPTO", x: M + 22, w: 60 },
    { label: "CATEGORÍA", x: M + 82, w: 35 },
    { label: "CUENTA", x: M + 117, w: 18, align: "center" as const },
    { label: "IMPORTE", x: M + 135, w: 28, align: "right" as const },
  ];
  y = tableHeader(doc, y, cols);

  const movs = Array.isArray(card.movements) ? card.movements : [];
  for (let i = 0; i < movs.length; i++) {
    y = checkPage(doc, y, 8, pageNum, cols);
    const m = movs[i];
    y = tableRow(doc, y, cols, [
      m.date || "",
      m.description || "",
      m.category || "",
      m.accountCode || "",
      fmt(m.amount),
    ], i % 2 === 0);
  }

  y += 6;
  drawLine(doc, y); y += 5;
  doc.setFillColor(41, 65, 122);
  doc.rect(M + 100, y - 4, CW - 100, 8, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL:", M + 102, y + 1);
  doc.text(fmt(card.totalCharges), A4W - M, y + 1, { align: "right" });

  y += 12;
  y = labelValue(doc, y, "Fecha Liquidación:", card.settlementDate || "");

  fixupFooters(doc);
  return doc.output("blob");
}

export function generateInsurancePolicyPdf(ins: any, cp: CP): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = headerBlock(doc, "PÓLIZA DE SEGURO", ins.policyNumber || "", cp);

  y = sectionTitle(doc, y, "DATOS DE LA PÓLIZA");
  y = labelValue(doc, y, "Aseguradora:", ins.insurer || "");
  y = labelValue(doc, y, "Nº Póliza:", ins.policyNumber || "");
  y = labelValue(doc, y, "Tipo:", ins.type || "");
  y = labelValue(doc, y, "Prima Anual:", fmt(ins.annualPremium));
  y = labelValue(doc, y, "Vigencia:", `${ins.startDate || ""} — ${ins.endDate || ""}`);
  y += 4;

  if (ins.prepaidExpense || ins.prepaidNextPeriod || ins.expenseCurrentPeriod) {
    y = sectionTitle(doc, y, "PERIODIFICACIÓN");
    y = labelValue(doc, y, "Gasto Ejercicio Actual:", fmt(ins.expenseCurrentPeriod ?? ins.annualPremium));
    y = labelValue(doc, y, "Gasto Anticipado (cta 480):", fmt(ins.prepaidExpense ?? ins.prepaidNextPeriod ?? 0));
  }

  if (ins.journalNote) {
    y += 6;
    y = sectionTitle(doc, y, "NOTA CONTABLE (didáctica)");
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    gray(doc, 80, 80, 80);
    const lines = doc.splitTextToSize(ins.journalNote, CW);
    doc.text(lines, M, y);
  }

  fixupFooters(doc);
  return doc.output("blob");
}

export function generateCasualtyReportPdf(cas: any, cp: CP): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = headerBlock(doc, "PARTE DE SINIESTRO", cas.date || "", cp);

  y = sectionTitle(doc, y, "DATOS DEL SINIESTRO");
  y = labelValue(doc, y, "Fecha:", cas.date || "");
  y = labelValue(doc, y, "Descripción:", "");
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  gray(doc, 30, 30, 30);
  const descLines = doc.splitTextToSize(cas.description || "", CW);
  doc.text(descLines, M, y);
  y += descLines.length * 4 + 4;

  y = labelValue(doc, y, "Bien Afectado:", cas.assetAffected || "");
  y = labelValue(doc, y, "Valor Contable:", fmt(cas.bookValue));
  y = labelValue(doc, y, "Indemnización Seguro:", fmt(cas.insuranceCompensation));
  y += 3;

  drawLine(doc, y); y += 5;
  const lossColor = (cas.netLoss ?? 0) > 0 ? [180, 40, 40] : [40, 130, 40];
  doc.setFillColor(lossColor[0], lossColor[1], lossColor[2]);
  doc.rect(M, y - 4, CW, 10, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("PÉRDIDA NETA:", M + 3, y + 2);
  doc.text(fmt(cas.netLoss), A4W - M - 3, y + 2, { align: "right" });

  fixupFooters(doc);
  return doc.output("blob");
}

export function generateFixedAssetCardPdf(asset: any, cp: CP): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = headerBlock(doc, "FICHA DE INMOVILIZADO", asset.code || "", cp);

  y = sectionTitle(doc, y, "DATOS DEL ACTIVO");
  y = labelValue(doc, y, "Código:", asset.code || "");
  y = labelValue(doc, y, "Descripción:", asset.description || "");
  y = labelValue(doc, y, "Fecha Adquisición:", asset.purchaseDate || "");
  y = labelValue(doc, y, "Coste Adquisición:", fmt(asset.purchaseCost));
  y = labelValue(doc, y, "Vida Útil:", `${asset.usefulLifeYears || 0} años`);
  y = labelValue(doc, y, "Método:", asset.depreciationMethod || "Lineal");
  y += 4;

  y = sectionTitle(doc, y, "AMORTIZACIÓN");
  y = labelValue(doc, y, "Cuenta Activo:", `${asset.assetAccountCode || ""}`);
  y = labelValue(doc, y, "Cuenta Amort. Acum.:", `${asset.accDepreciationCode || ""}`);
  y = labelValue(doc, y, "Cuenta Gasto:", `${asset.depExpenseCode || ""}`);
  y += 3;

  y = labelValue(doc, y, "Amortización Anual:", fmt(asset.annualDepreciation));
  if (asset.periodDepreciation) {
    y = labelValue(doc, y, `Amortización Período (${asset.periodMonths || 0} meses):`, fmt(asset.periodDepreciation));
  }
  y = labelValue(doc, y, "Amort. Acumulada:", fmt(asset.accumulatedDepreciation));
  y += 3;

  drawLine(doc, y); y += 5;
  doc.setFillColor(41, 65, 122);
  doc.rect(M, y - 4, CW, 10, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("VALOR NETO CONTABLE:", M + 3, y + 2);
  doc.text(fmt(asset.netBookValue), A4W - M - 3, y + 2, { align: "right" });

  fixupFooters(doc);
  return doc.output("blob");
}

export function generateBankDebitNotePdf(note: any, cp: CP): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = headerBlock(doc, "NOTA DE CARGO BANCARIO", note.reference || "", cp);

  y = sectionTitle(doc, y, "DETALLE DEL ADEUDO");
  y = labelValue(doc, y, "Fecha:", note.date || "");
  y = labelValue(doc, y, "Referencia:", note.reference || "");
  y = labelValue(doc, y, "Concepto:", note.concept || "");
  y = labelValue(doc, y, "Beneficiario:", note.beneficiary || "");
  y = labelValue(doc, y, "Categoría:", note.category || "");
  y += 4;

  drawLine(doc, y); y += 5;
  doc.setFillColor(41, 65, 122);
  doc.rect(M, y - 4, CW, 10, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("IMPORTE ADEUDADO:", M + 3, y + 2);
  doc.text(fmt(note.amount), A4W - M - 3, y + 2, { align: "right" });

  y += 16;
  if (note.journalNote) {
    y = sectionTitle(doc, y, "NOTA CONTABLE (didáctica)");
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    gray(doc, 80, 80, 80);
    const lines = doc.splitTextToSize(note.journalNote, CW);
    doc.text(lines, M, y);
  }

  fixupFooters(doc);
  return doc.output("blob");
}

export function generateDividendDistributionPdf(div: any, cp: CP): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = headerBlock(doc, "ACTA DE DISTRIBUCIÓN DE DIVIDENDOS", `Ejercicio ${div.fiscalYear || ""}`, cp);

  y = sectionTitle(doc, y, "ACUERDO JUNTA GENERAL");
  y = labelValue(doc, y, "Ejercicio:", String(div.fiscalYear || ""));
  y = labelValue(doc, y, "Fecha Aprobación:", div.approvalDate || "");
  y = labelValue(doc, y, "Fecha Pago:", div.paymentDate || "");
  y += 4;

  y = sectionTitle(doc, y, "DISTRIBUCIÓN DEL RESULTADO");
  y = labelValue(doc, y, "Beneficio Neto:", fmt(div.totalNetProfit));
  y = labelValue(doc, y, "Reserva Legal:", fmt(div.legalReserve));
  y = labelValue(doc, y, "Reserva Voluntaria:", fmt(div.voluntaryReserve));
  y = labelValue(doc, y, "Total Dividendos Brutos:", fmt(div.totalDividends));
  y = labelValue(doc, y, "Dividendo por Participación:", fmt(div.dividendPerShare));
  y = labelValue(doc, y, "Retención IRPF:", fmtPct(div.irpfWithholdingRate));
  y += 4;

  const perSh = Array.isArray(div.perShareholder) ? div.perShareholder : [];
  if (perSh.length > 0) {
    y = sectionTitle(doc, y, "DETALLE POR SOCIO");
    const cols = [
      { label: "SOCIO", x: M, w: 45 },
      { label: "%", x: M + 45, w: 15, align: "right" as const },
      { label: "BRUTO", x: M + 60, w: 28, align: "right" as const },
      { label: "RET. IRPF", x: M + 88, w: 28, align: "right" as const },
      { label: "NETO", x: M + 116, w: 28, align: "right" as const },
    ];
    y = tableHeader(doc, y, cols);
    for (let i = 0; i < perSh.length; i++) {
      const s = perSh[i];
      y = tableRow(doc, y, cols, [
        s.shareholderName || `Socio ${i + 1}`,
        fmtPct(s.participationPercentage),
        fmt(s.grossDividend),
        fmt(s.irpfWithholdingAmount),
        fmt(s.netDividend),
      ], i % 2 === 0);
    }
  }

  fixupFooters(doc);
  return doc.output("blob");
}

export function generateShareholdersInfoPdf(info: any, cp: CP): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = headerBlock(doc, "LIBRO DE SOCIOS / ACCIONISTAS", cp.name || "", cp);

  y = sectionTitle(doc, y, "DATOS SOCIETARIOS");
  y = labelValue(doc, y, "Forma Jurídica:", info.legalForm || "");
  y = labelValue(doc, y, "Capital Social:", fmt(info.shareCapital));
  y = labelValue(doc, y, "Nº Participaciones:", String(info.totalShares || ""));
  y = labelValue(doc, y, "Valor Nominal:", fmt(info.nominalValuePerShare));
  if (info.constitutionDate) y = labelValue(doc, y, "Fecha Constitución:", info.constitutionDate);
  if (info.registryEntry) y = labelValue(doc, y, "Registro Mercantil:", info.registryEntry);
  y += 4;

  const shs = Array.isArray(info.shareholders) ? info.shareholders : [];
  if (shs.length > 0) {
    y = sectionTitle(doc, y, "COMPOSICIÓN DEL CAPITAL");
    const cols = [
      { label: "SOCIO", x: M, w: 40 },
      { label: "NIF", x: M + 40, w: 22 },
      { label: "ROL", x: M + 62, w: 28 },
      { label: "%", x: M + 90, w: 15, align: "right" as const },
      { label: "PARTIC.", x: M + 105, w: 18, align: "right" as const },
      { label: "CAPITAL", x: M + 123, w: 28, align: "right" as const },
    ];
    y = tableHeader(doc, y, cols);
    for (let i = 0; i < shs.length; i++) {
      const s = shs[i];
      y = tableRow(doc, y, cols, [
        s.name || "",
        s.nif || "",
        translateRole(s.role),
        fmtPct(s.participationPercentage),
        String(s.numberOfShares || ""),
        fmt(s.totalCapitalAmount),
      ], i % 2 === 0);
    }
  }

  fixupFooters(doc);
  return doc.output("blob");
}

function translateRole(r: string | undefined): string {
  const map: Record<string, string> = {
    socio: "Socio", administrador: "Administrador", socio_administrador: "Socio-Admin",
  };
  return map[r || ""] || r || "";
}

export function generateInitialBalancePdf(bal: any, cp: CP): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageNum = { n: 1 };

  let y = headerBlock(doc, "BALANCE DE APERTURA", bal.date || "", cp);

  const sections = [
    { title: "ACTIVO NO CORRIENTE", data: bal.nonCurrentAssets },
    { title: "ACTIVO CORRIENTE", data: bal.currentAssets },
    { title: "PATRIMONIO NETO", data: bal.equity },
    { title: "PASIVO NO CORRIENTE", data: bal.nonCurrentLiabilities },
    { title: "PASIVO CORRIENTE", data: bal.currentLiabilities },
  ];

  const cols = [
    { label: "CUENTA", x: M, w: 18, align: "center" as const },
    { label: "DENOMINACIÓN", x: M + 18, w: 100 },
    { label: "IMPORTE", x: M + 118, w: 30, align: "right" as const },
  ];

  for (const sec of sections) {
    y = checkPage(doc, y, 20, pageNum);
    y = sectionTitle(doc, y, sec.title);
    y = tableHeader(doc, y, cols);
    const lines = Array.isArray(sec.data) ? sec.data : [];
    for (let i = 0; i < lines.length; i++) {
      y = checkPage(doc, y, 8, pageNum, cols);
      const l = lines[i];
      y = tableRow(doc, y, cols, [
        l.accountCode || "",
        l.accountName || "",
        fmt(l.amount),
      ], i % 2 === 0);
    }
    y += 4;
  }

  y = checkPage(doc, y, 20, pageNum);
  drawLine(doc, y); y += 5;
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  gray(doc, 41, 65, 122);
  doc.text("Total Activo:", M, y);
  doc.text(fmt(bal.totalAssets), M + 80, y, { align: "right" });
  y += 6;
  doc.text("Total Pasivo + PN:", M, y);
  doc.text(fmt(bal.totalEquityAndLiabilities), M + 80, y, { align: "right" });

  fixupFooters(doc);
  return doc.output("blob");
}

export function generateJournalEntriesPdf(entries: any[], cp: CP): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageNum = { n: 1 };

  let y = headerBlock(doc, "LIBRO DIARIO", `Ejercicio ${cp.fiscalYear || ""}`, cp);

  for (let i = 0; i < entries.length; i++) {
    y = checkPage(doc, y, 30, pageNum);
    const e = entries[i];

    doc.setFillColor(240, 243, 248);
    doc.rect(M, y - 3.5, CW, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    gray(doc, 41, 65, 122);
    doc.text(`Asiento ${e.entryNumber || i + 1}`, M + 2, y);
    doc.text(e.date || "", M + 30, y);
    doc.setFont("helvetica", "normal");
    gray(doc, 60, 60, 60);
    doc.text((e.concept || "").substring(0, 70), M + 55, y);
    if (e.document) {
      doc.setFontSize(7);
      doc.text(`Ref: ${e.document}`, A4W - M, y, { align: "right" });
    }
    y += 5;

    const debits = Array.isArray(e.debits) ? e.debits : [];
    const credits = Array.isArray(e.credits) ? e.credits : [];

    doc.setFontSize(7.5);
    for (const d of debits) {
      y = checkPage(doc, y, 6, pageNum);
      gray(doc, 30, 30, 30);
      doc.text(`  ${d.accountCode || ""} ${d.accountName || ""}`, M + 4, y);
      doc.text(fmt(d.amount), M + CW / 2 - 5, y, { align: "right" });
      y += 4.5;
    }
    for (const c of credits) {
      y = checkPage(doc, y, 6, pageNum);
      gray(doc, 80, 80, 80);
      doc.text(`      a  ${c.accountCode || ""} ${c.accountName || ""}`, M + 4, y);
      doc.text(fmt(c.amount), A4W - M, y, { align: "right" });
      y += 4.5;
    }

    doc.setFont("helvetica", "bold"); doc.setFontSize(7);
    gray(doc, 41, 65, 122);
    doc.text(`Total: ${fmt(e.totalAmount)}`, A4W - M, y, { align: "right" });
    y += 3;
    drawLine(doc, y);
    y += 4;
  }

  fixupFooters(doc);
  return doc.output("blob");
}

export function generateShareholderAccountsPdf(acc: any, cp: CP): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageNum = { n: 1 };

  let y = headerBlock(doc, "CUENTA CORRIENTE CON SOCIOS", cp.name || "", cp);

  y = sectionTitle(doc, y, "MOVIMIENTOS");
  const cols = [
    { label: "FECHA", x: M, w: 20 },
    { label: "CONCEPTO", x: M + 20, w: 50 },
    { label: "SOCIO", x: M + 70, w: 30 },
    { label: "CUENTA", x: M + 100, w: 15, align: "center" as const },
    { label: "DEBE", x: M + 115, w: 22, align: "right" as const },
    { label: "HABER", x: M + 137, w: 22, align: "right" as const },
    { label: "SALDO", x: M + 159, w: 20, align: "right" as const },
  ];
  y = tableHeader(doc, y, cols);

  const txns = Array.isArray(acc.transactions) ? acc.transactions : [];
  for (let i = 0; i < txns.length; i++) {
    y = checkPage(doc, y, 8, pageNum, cols);
    const t = txns[i];
    y = tableRow(doc, y, cols, [
      t.date || "",
      (t.concept || "").substring(0, 30),
      (t.shareholderName || "").substring(0, 20),
      t.accountCode || "",
      t.debit ? fmt(t.debit) : "",
      t.credit ? fmt(t.credit) : "",
      fmt(t.balance),
    ], i % 2 === 0);
  }

  y += 8;
  y = labelValue(doc, y, "Saldo cta 551 (Admin.):", fmt(acc.closingBalance551));
  y = labelValue(doc, y, "Saldo cta 553 (Socios):", fmt(acc.closingBalance553));

  fixupFooters(doc);
  return doc.output("blob");
}

export interface ZipDocumentSet {
  date: string;
  docType: string;
  filename: string;
  blob: Blob;
}

function parseMonthDate(month: string, year: number): string {
  const meses: Record<string, string> = {
    enero:"01", febrero:"02", marzo:"03", abril:"04", mayo:"05", junio:"06",
    julio:"07", agosto:"08", septiembre:"09", octubre:"10", noviembre:"11", diciembre:"12",
    january:"01", february:"02", march:"03", april:"04", may:"05", june:"06",
    july:"07", august:"08", september:"09", october:"10", november:"11", december:"12",
  };
  const lower = (month || "").toLowerCase();
  for (const [name, num] of Object.entries(meses)) {
    if (lower.includes(name)) {
      const yr = lower.match(/\d{4}/)?.[0] ?? String(year);
      return `${yr}-${num}-28`;
    }
  }
  return `${year}-06-28`;
}

function extractDate(dateStr: string | undefined | null, fallback: string): string {
  if (dateStr && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.substring(0, 10);
  if (dateStr && /^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
    const [d, m, y] = dateStr.split("/");
    return `${y}-${m}-${d}`;
  }
  return fallback;
}

export function generateExtraordinaryExpensePdf(exp: any, cp: CP): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const typeLabels: Record<string, string> = {
    multa: "Multa / Sanción", donacion: "Donación",
    perdida_inmovilizado: "Pérdida Inmovilizado",
    ingreso_extraordinario: "Ingreso Extraordinario", otro: "Gasto Extraordinario",
  };
  let y = headerBlock(doc, typeLabels[exp.type] || "Gasto Extraordinario", `Fecha: ${exp.date || ""}`, cp);
  y = sectionTitle(doc, y, "Detalle de la Partida");
  y = labelValue(doc, y, "Tipo:", typeLabels[exp.type] || exp.type);
  y = labelValue(doc, y, "Descripción:", exp.description || "");
  y = labelValue(doc, y, "Importe:", fmt(exp.amount));
  y = labelValue(doc, y, "Cuenta:", `${exp.accountCode} - ${exp.accountName}`);
  y = labelValue(doc, y, "Contrapartida:", `${exp.counterpartAccountCode} - ${exp.counterpartAccountName}`);
  y += 5;

  y = sectionTitle(doc, y, "Asiento Contable");
  const cols = [
    { label: "Cuenta", x: M, w: 15 },
    { label: "Denominación", x: M + 16, w: 50 },
    { label: "Debe", x: M + 90, w: 25, align: "right" as const },
    { label: "Haber", x: M + 120, w: 25, align: "right" as const },
  ];
  y = tableHeader(doc, y, cols);
  const debits = Array.isArray(exp.accountDebits) ? exp.accountDebits : [];
  const credits = Array.isArray(exp.accountCredits) ? exp.accountCredits : [];
  let row = 0;
  for (const d of debits) {
    y = tableRow(doc, y, cols, [d.accountCode, d.accountName, fmt(d.amount), ""], row++ % 2 === 0);
  }
  for (const c of credits) {
    y = tableRow(doc, y, cols, [c.accountCode, c.accountName, "", fmt(c.amount)], row++ % 2 === 0);
  }
  if (exp.journalNote) {
    y += 5;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    gray(doc, 80, 80, 80);
    const lines = doc.splitTextToSize(exp.journalNote, CW);
    doc.text(lines, M, y);
  }
  fixupFooters(doc);
  return doc.output("blob");
}

export function generateWarehouseCardPdf(card: any, cp: CP): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const LW = 297;
  const LH = 210;
  const LM = 10;

  let y = LM;
  doc.setFillColor(41, 65, 122);
  doc.rect(0, 0, LW, 26, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("FICHA DE ALMACÉN", LM, y + 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${cp.name || ""} · CIF: ${cp.nif || ""}`, LM, y + 17);
  doc.text(`Producto: ${card.productCode} - ${card.productDescription}`, LW - LM, y + 10, { align: "right" });
  doc.text(`Cuenta PGC: ${card.accountCode} · Método: ${card.valuationMethod}`, LW - LM, y + 17, { align: "right" });
  y = 34;

  const cols = [
    { label: "Fecha", x: LM, w: 22 },
    { label: "Concepto", x: LM + 23, w: 50 },
    { label: "Doc.", x: LM + 74, w: 20 },
    { label: "Uds.E", x: LM + 95, w: 12, align: "right" as const },
    { label: "P.U.E", x: LM + 108, w: 18, align: "right" as const },
    { label: "Total E", x: LM + 127, w: 20, align: "right" as const },
    { label: "Uds.S", x: LM + 148, w: 12, align: "right" as const },
    { label: "P.U.S", x: LM + 161, w: 18, align: "right" as const },
    { label: "Total S", x: LM + 180, w: 20, align: "right" as const },
    { label: "Uds.Ex", x: LM + 201, w: 12, align: "right" as const },
    { label: "P.U.Ex", x: LM + 214, w: 18, align: "right" as const },
    { label: "Total Ex", x: LM + 233, w: 25, align: "right" as const },
  ];

  const pn = { n: 1 };
  y = tableHeader(doc, y, cols);

  const movements = Array.isArray(card.movements) ? card.movements : [];
  for (let i = 0; i < movements.length; i++) {
    if (y + 6 > LH - 15) {
      doc.addPage();
      pn.n++;
      y = LM + 5;
      y = tableHeader(doc, y, cols);
    }
    const m = movements[i];
    const dateStr = m.date?.includes("-") ? m.date : m.date;
    y = tableRow(doc, y, cols, [
      dateStr || "",
      (m.concept || "").substring(0, 40),
      (m.document || "").substring(0, 15),
      m.entryQty > 0 ? String(m.entryQty) : "",
      m.entryQty > 0 ? fmt(m.entryUnitCost) : "",
      m.entryQty > 0 ? fmt(m.entryTotal) : "",
      m.exitQty > 0 ? String(m.exitQty) : "",
      m.exitQty > 0 ? fmt(m.exitUnitCost) : "",
      m.exitQty > 0 ? fmt(m.exitTotal) : "",
      String(m.balanceQty ?? 0),
      fmt(m.balanceUnitCost),
      fmt(m.balanceTotal),
    ], i % 2 === 0);
  }

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    gray(doc, 150, 150, 150);
    doc.text(`Página ${p} de ${total}`, LW / 2, LH - 5, { align: "center" });
    doc.text("Documento generado por ContabilGen Pro — Material didáctico para FP", LW / 2, LH - 2, { align: "center" });
  }
  return doc.output("blob");
}

export function buildAllDocuments(universe: any, cp: CP): ZipDocumentSet[] {
  const docs: ZipDocumentSet[] = [];
  const safe = (s: string) => (s || "").replace(/[/\\?%*:|"<>]/g, "-").substring(0, 50);
  const yr = cp.fiscalYear ?? new Date().getFullYear();
  const fallback = `${yr}-01-01`;

  if (universe.initialBalanceSheet) {
    docs.push({
      date: extractDate(universe.initialBalanceSheet.date, `${yr}-01-01`),
      docType: "Balance_Apertura",
      filename: `Balance_Apertura.pdf`,
      blob: generateInitialBalancePdf(universe.initialBalanceSheet, cp),
    });
  }

  if (universe.shareholdersInfo) {
    docs.push({
      date: extractDate(universe.shareholdersInfo.constitutionDate, `${yr}-01-01`),
      docType: "Libro_Socios",
      filename: `Libro_Socios.pdf`,
      blob: generateShareholdersInfoPdf(universe.shareholdersInfo, cp),
    });
  }

  const invoices = Array.isArray(universe.invoices) ? universe.invoices : [];
  for (const inv of invoices) {
    const tipo = inv.type === "sale" ? "Venta" : "Compra";
    docs.push({
      date: extractDate(inv.date, fallback),
      docType: `Factura_${tipo}`,
      filename: `Factura_${tipo}_${safe(inv.invoiceNumber)}.pdf`,
      blob: generateInvoicePdf(inv, cp),
    });
  }

  if (universe.bankLoan) {
    docs.push({
      date: extractDate(universe.bankLoan.startDate, fallback),
      docType: "Prestamo",
      filename: `Prestamo_${safe(universe.bankLoan.loanNumber || "")}.pdf`,
      blob: generateBankLoanPdf(universe.bankLoan, cp),
    });
  }

  if (universe.mortgage) {
    docs.push({
      date: extractDate(universe.mortgage.startDate, fallback),
      docType: "Hipoteca",
      filename: `Hipoteca_${safe(universe.mortgage.loanNumber || "")}.pdf`,
      blob: generateMortgagePdf(universe.mortgage, cp),
    });
  }

  if (universe.creditPolicy) {
    docs.push({
      date: extractDate(universe.creditPolicy.startDate, fallback),
      docType: "Poliza_Credito",
      filename: `Poliza_Credito_${safe(universe.creditPolicy.policyNumber || "")}.pdf`,
      blob: generateCreditPolicyPdf(universe.creditPolicy, cp),
    });
  }

  const insurances = Array.isArray(universe.insurancePolicies) ? universe.insurancePolicies : [];
  for (const ins of insurances) {
    docs.push({
      date: extractDate(ins.startDate, fallback),
      docType: "Poliza_Seguro",
      filename: `Poliza_Seguro_${safe(ins.policyNumber || "")}.pdf`,
      blob: generateInsurancePolicyPdf(ins, cp),
    });
  }

  const assets = Array.isArray(universe.fixedAssets) ? universe.fixedAssets : [];
  for (const asset of assets) {
    docs.push({
      date: extractDate(asset.purchaseDate, fallback),
      docType: "Inmovilizado",
      filename: `Inmovilizado_${safe(asset.description || asset.code || "")}.pdf`,
      blob: generateFixedAssetCardPdf(asset, cp),
    });
  }

  if (universe.payroll) {
    docs.push({
      date: parseMonthDate(universe.payroll.month || "", yr),
      docType: "Nomina",
      filename: `Nomina_${safe(universe.payroll.month || "")}.pdf`,
      blob: generatePayrollPdf(universe.payroll, cp),
    });
  }

  const ssPayments = Array.isArray(universe.socialSecurityPayments) ? universe.socialSecurityPayments : [];
  for (const ss of ssPayments) {
    docs.push({
      date: extractDate(ss.dueDate, parseMonthDate(ss.month || "", yr)),
      docType: "TC1_SS",
      filename: `TC1_${safe(ss.month || "")}.pdf`,
      blob: generateSSPaymentPdf(ss, cp),
    });
  }

  const taxLiqs = Array.isArray(universe.taxLiquidations) ? universe.taxLiquidations : [];
  for (const liq of taxLiqs) {
    docs.push({
      date: extractDate(liq.dueDate, fallback),
      docType: `Mod${liq.model || "303"}`,
      filename: `Mod${liq.model || "303"}_${safe(liq.period || "")}.pdf`,
      blob: generateTaxLiquidationPdf(liq, cp),
    });
  }

  const bankStmts = Array.isArray(universe.bankStatements) ? universe.bankStatements : [];
  for (let i = 0; i < bankStmts.length; i++) {
    const txns = Array.isArray(bankStmts[i].transactions) ? bankStmts[i].transactions : [];
    const firstDate = txns.length > 0 ? extractDate(txns[0].date, fallback) : fallback;
    docs.push({
      date: firstDate,
      docType: "Extracto_Bancario",
      filename: `Extracto_Bancario_${safe(bankStmts[i].period || `${i + 1}`)}.pdf`,
      blob: generateBankStatementPdf(bankStmts[i], cp),
    });
  }

  if (universe.creditCardStatement) {
    const movs = Array.isArray(universe.creditCardStatement.movements) ? universe.creditCardStatement.movements : [];
    const firstDate = movs.length > 0 ? extractDate(movs[0].date, fallback) : fallback;
    docs.push({
      date: firstDate,
      docType: "Extracto_Tarjeta",
      filename: `Extracto_Tarjeta_${safe(universe.creditCardStatement.statementPeriod || "")}.pdf`,
      blob: generateCreditCardStatementPdf(universe.creditCardStatement, cp),
    });
  }

  if (universe.casualtyEvent) {
    docs.push({
      date: extractDate(universe.casualtyEvent.date, fallback),
      docType: "Siniestro",
      filename: `Siniestro.pdf`,
      blob: generateCasualtyReportPdf(universe.casualtyEvent, cp),
    });
  }

  const extraExpenses = Array.isArray(universe.extraordinaryExpenses) ? universe.extraordinaryExpenses : [];
  for (const exp of extraExpenses) {
    const typeLabels: Record<string, string> = {
      multa: "Multa", donacion: "Donacion", perdida_inmovilizado: "Perdida_Inmov",
      ingreso_extraordinario: "Ingreso_Extra", otro: "Gasto_Extra",
    };
    docs.push({
      date: extractDate(exp.date, fallback),
      docType: typeLabels[exp.type] || "Gasto_Extra",
      filename: `${typeLabels[exp.type] || "Gasto_Extra"}_${safe(exp.description || "")}.pdf`,
      blob: generateExtraordinaryExpensePdf(exp, cp),
    });
  }

  const warehouseCards = Array.isArray(universe.warehouseCards) ? universe.warehouseCards : [];
  for (const card of warehouseCards) {
    docs.push({
      date: `${yr}-01-01`,
      docType: "Ficha_Almacen",
      filename: `Ficha_Almacen_${safe(card.productCode || "")}_${safe(card.productDescription || "")}.pdf`,
      blob: generateWarehouseCardPdf(card, cp),
    });
  }

  if (universe.shareholderAccounts) {
    const txns = Array.isArray(universe.shareholderAccounts.transactions) ? universe.shareholderAccounts.transactions : [];
    const firstDate = txns.length > 0 ? extractDate(txns[0].date, fallback) : fallback;
    docs.push({
      date: firstDate,
      docType: "Cta_Socios",
      filename: `Cta_Corriente_Socios.pdf`,
      blob: generateShareholderAccountsPdf(universe.shareholderAccounts, cp),
    });
  }

  if (universe.dividendDistribution) {
    const dd = universe.dividendDistribution;
    docs.push({
      date: extractDate(dd.approvalDate || dd.paymentDate, fallback),
      docType: "Dividendos",
      filename: `Dividendos_Ejercicio_${dd.fiscalYear || ""}.pdf`,
      blob: generateDividendDistributionPdf(dd, cp),
    });
  }

  const bankNotes = Array.isArray((universe as any).bankDebitNotes) ? (universe as any).bankDebitNotes : [];
  for (const note of bankNotes) {
    docs.push({
      date: extractDate(note.date, fallback),
      docType: "Nota_Cargo",
      filename: `Nota_Cargo_${safe(note.reference || note.id || "")}.pdf`,
      blob: generateBankDebitNotePdf(note, cp),
    });
  }

  const entries = Array.isArray(universe.journalEntries) ? universe.journalEntries : [];
  if (entries.length > 0) {
    docs.push({
      date: `${yr}-12-31`,
      docType: "Libro_Diario",
      filename: `Libro_Diario_${yr}.pdf`,
      blob: generateJournalEntriesPdf(entries, cp),
    });
  }

  docs.sort((a, b) => a.date.localeCompare(b.date));

  return docs.map((d, i) => ({
    ...d,
    filename: `${String(i + 1).padStart(3, "0")}_${d.date}_${d.filename}`,
  }));
}
