import OpenAI from "openai";

interface GenerateParams {
  taxRegime: "IVA" | "IGIC";
  sector: "Comercio" | "Servicios" | "Industria" | "Hostelería";
  complexity: "Avanzado";
  year: number;
  companyName?: string | null;
  educationLevel?: "Medio" | "Superior" | null;
  operationsPerMonth?: number | null;
  includePayroll?: boolean | null;
  includeSocialSecurity?: boolean | null;
  includeTaxLiquidation?: boolean | null;
  includeBankLoan?: boolean | null;
  includeMortgage?: boolean | null;
  includeCreditPolicy?: boolean | null;
  includeFixedAssets?: boolean | null;
  includeShareholdersInfo?: boolean | null;
  isNewCompany?: boolean | null;
  includeInitialBalance?: boolean | null;
  includeShareholderAccounts?: boolean | null;
  includeDividends?: boolean | null;
  startDate?: string | null;
  endDate?: string | null;
}

interface AiConfig {
  provider: string;
  deepseekApiKey: string;
  deepseekBaseUrl: string;
  deepseekModel: string;
}

const TAX_RATES: Record<string, { standard: number; reduced: number; superreduced: number }> = {
  IVA: { standard: 21, reduced: 10, superreduced: 4 },
  IGIC: { standard: 7, reduced: 3, superreduced: 0 },
};

const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function getPeriodInfo(params: GenerateParams) {
  const hasCustom = !!(params.startDate && params.endDate);
  const periodStart = hasCustom ? params.startDate! : `${params.year}-01-01`;
  const periodEnd = hasCustom ? params.endDate! : `${params.year}-12-31`;
  const s = periodStart.split("-");
  const e = periodEnd.split("-");
  const sy = parseInt(s[0], 10), sm = parseInt(s[1], 10);
  const ey = parseInt(e[0], 10), em = parseInt(e[1], 10);
  const numMonths = Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
  const midIdx = Math.floor((sm - 1 + numMonths / 2)) % 12;
  const midYear = sy + Math.floor((sm - 1 + Math.floor(numMonths / 2)) / 12);
  const midMonthLabel = `${MONTHS_ES[midIdx].charAt(0).toUpperCase() + MONTHS_ES[midIdx].slice(1)} ${midYear}`;
  const periodLabel = hasCustom
    ? `del ${parseInt(s[2], 10)} de ${MONTHS_ES[sm - 1]} de ${sy} al ${parseInt(e[2], 10)} de ${MONTHS_ES[em - 1]} de ${ey} (${numMonths} mes${numMonths > 1 ? "es" : ""})`
    : `ejercicio completo ${params.year} (12 meses)`;
  return { periodStart, periodEnd, numMonths, midMonthLabel, periodLabel };
}

function cleanJson(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function repairTruncatedJson(raw: string): unknown | null {
  const cleaned = cleanJson(raw);
  // Try parsing as-is first
  try { return JSON.parse(cleaned); } catch { /* continue to repair */ }

  // Remove trailing partial token/string and repair brackets
  let s = cleaned.trimEnd();
  // Drop trailing incomplete string if any (ends mid-quote)
  s = s.replace(/,\s*"[^"]*$/, "").replace(/,\s*\{[^{}]*$/, "");
  s = s.replace(/,\s*$/, "");

  // Count open/close to add missing closers
  let braces = 0, brackets = 0;
  let inStr = false, escape = false;
  for (const ch of s) {
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inStr) { escape = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{") braces++;
    else if (ch === "}") braces--;
    else if (ch === "[") brackets++;
    else if (ch === "]") brackets--;
  }
  for (let i = 0; i < brackets; i++) s += "]";
  for (let i = 0; i < braces; i++) s += "}";

  try { return JSON.parse(s); } catch { return null; }
}

async function callAI(client: OpenAI, model: string, prompt: string, maxTokens: number): Promise<unknown> {
  const response = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: "system",
        content: "Eres un experto contable español especializado en el Plan General Contable (PGC). Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin bloques de código.",
      },
      { role: "user", content: prompt },
    ],
  });

  const finishReason = response.choices[0]?.finish_reason;
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("La IA no devolvió contenido.");

  if (finishReason === "length") {
    // Attempt to repair and parse truncated JSON instead of hard-failing
    console.warn(`[callAI] finish_reason=length, content length=${content.length} chars, maxTokens=${maxTokens}`);
    const repaired = repairTruncatedJson(content);
    if (repaired !== null) {
      console.warn("[callAI] Respuesta truncada — JSON reparado automáticamente.");
      return repaired;
    }
    console.error("[callAI] No se pudo reparar. Primeros 500 chars:", content.slice(0, 500));
    throw new Error("La respuesta de la IA fue demasiado larga y no se pudo recuperar. Reduce el número de módulos o las operaciones por mes.");
  }

  const cleaned = cleanJson(content);
  return JSON.parse(cleaned);
}

// ─── CALL 1: SCENARIO BLUEPRINT ──────────────────────────────────────────────
async function generateScenario(params: GenerateParams, client: OpenAI, model: string) {
  const rates = TAX_RATES[params.taxRegime];
  const { periodStart, periodEnd, numMonths, midMonthLabel } = getPeriodInfo(params);
  const numEmployees = params.includePayroll !== false ? 2 : 0;
  const withMortgage = params.includeMortgage === true;
  const companyHint = params.companyName ? `La empresa se llama "${params.companyName}".` : "Inventa un nombre realista para el sector.";

  const prompt = `Genera un PLANO DE ESCENARIO compacto para un universo contable de prácticas de FP española.

PARÁMETROS:
- Sector: ${params.sector}
- Régimen fiscal: ${params.taxRegime} (general ${rates.standard}%, reducido ${rates.reduced}%)
- Período: ${periodStart} a ${periodEnd} (${numMonths} mes${numMonths > 1 ? "es" : ""})
- Año fiscal: ${params.year}
- Mes de referencia: ${midMonthLabel}
- ${companyHint}
- Empresa nueva (primer ejercicio): ${params.isNewCompany ? "SÍ" : "NO"}
${numEmployees > 0 ? `- Empleados: ${numEmployees}` : "- Sin nóminas"}
${withMortgage ? "- Incluye hipoteca sobre inmueble" : ""}

Devuelve SOLO este JSON con datos realistas para el sector indicado:
{
  "companyName": "...",
  "cif": "B12345678",
  "legalForm": "Sociedad de Responsabilidad Limitada",
  "address": "Calle ..., 15",
  "city": "...",
  "postalCode": "...",
  "phone": "9XXXXXXXX",
  "email": "info@empresa.com",
  "bankAccount": "ES12 1234 5678 90 1234567890",
  "bankEntity": "...",
  "description": "Breve descripción del negocio adaptada al sector",
  "employees": [
    {"name": "...", "naf": "281234567890", "category": "...", "grossSalary": 2100.00, "irpfRate": 14}
  ],
  "shareholders": [
    {"name": "...", "nif": "12345678A", "role": "socio_administrador", "percentage": 60, "shares": 60},
    {"name": "...", "nif": "87654321B", "role": "socio", "percentage": 40, "shares": 40}
  ],
  "suppliers": [
    {"name": "...", "cif": "A...", "city": "...", "category": "tipo de producto/servicio"},
    {"name": "...", "cif": "B...", "city": "...", "category": "tipo de producto/servicio"}
  ],
  "clients": [
    {"name": "...", "cif": "B...", "city": "...", "category": "tipo cliente"},
    {"name": "...", "cif": "B...", "city": "...", "category": "tipo cliente"}
  ],
  "financials": {
    "shareCapital": 10000,
    "nominalPerShare": 100,
    "totalShares": 100,
    "initialCash": 25000,
    "avgMonthlyRevenue": 18000,
    "avgMonthlyCosts": 11000,
    "netProfitPriorYear": 20000,
    "loanPrincipal": 50000,
    "loanRate": 4.5,
    "loanTermMonths": 60,
    "loanStartDate": "${periodStart}",
    "mortgagePrincipal": 180000,
    "mortgageRate": 3.2,
    "mortgageTermMonths": 240,
    "mortgageStartDate": "${periodStart}",
    "creditPolicyLimit": 30000,
    "creditPolicyDrawn": 15000
  }
}`;

  return await callAI(client, model, prompt, 1200) as Record<string, unknown>;
}

// ─── SECTOR CONTEXT ───────────────────────────────────────────────────────────
function getSectorContext(sector: string, taxRegime: string) {
  const tax = taxRegime === "IGIC" ? "IGIC" : "IVA";

  switch (sector) {
    case "Servicios":
      return {
        inventoryNote: `INVENTARIO: empresa de SERVICIOS. Sin mercaderías para reventa. El inventario puede incluir únicamente consumibles de oficina (cta. 328) o material de trabajo (602). Si los importes son insignificantes genera inventario con initialTotal=0 y finalTotal=0 y arrays vacíos.`,
        invoiceNote: `FACTURAS: empresa de SERVICIOS — vende SERVICIOS, NO bienes físicos.
  - Facturas de VENTA (type:"sale"): servicios prestados (consultoría, asesoría, diseño, formación, mantenimiento, limpieza, software, transporte, etc.).
    Líneas: "Horas de servicio" o "Servicio de X" × tarifa/hora o precio fijo. Cuenta venta: 705 (Prestaciones de servicios), NO 700.
    journalNote: "705 → 477 (${tax} repercutido) + 430 (Clientes)"; accountDebits: [430]; accountCredits: [705, 477]
  - Facturas de COMPRA (type:"purchase"): gastos necesarios para prestar el servicio — subcontratación de profesionales (621), software/licencias (626), telefonía (629), material de oficina (602), servicios de limpieza (629), publicidad (627), asesoría jurídica/fiscal (623), seguros profesionales (625), etc. Cuenta compra: 62x (gastos), NO 600.
    journalNote: "62x → 472 (${tax} soportado) + 400 (Acreedores/Proveedores)"; accountDebits: [62x, 472]; accountCredits: [400]`,
        saleAccount: { code: "705", name: "Prestaciones de servicios" },
        purchaseAccount: { code: "629", name: "Otros servicios" },
        purchaseSuppliersLabel: "proveedores de servicios y profesionales externos",
        clientsLabel: "empresas y particulares que contratan servicios",
      };
    case "Industria":
      return {
        inventoryNote: `INVENTARIO: empresa INDUSTRIAL. Tiene materias primas (310), productos en curso (330) y productos terminados (350). Usa accountCode "310" para materias primas, "300" para productos terminados.`,
        invoiceNote: `FACTURAS: empresa INDUSTRIAL — fabrica y vende productos elaborados propios.
  - Facturas de VENTA (type:"sale"): venta de productos fabricados. Cuenta: 701 (Ventas de productos terminados).
    journalNote: "701 → 477 + 430"; accountDebits: [430]; accountCredits: [701, 477]
  - Facturas de COMPRA (type:"purchase"): compra de materias primas y componentes. Cuenta: 601 (Compras de materias primas).
    journalNote: "601 → 472 + 400"; accountDebits: [601, 472]; accountCredits: [400]`,
        saleAccount: { code: "701", name: "Ventas de productos terminados" },
        purchaseAccount: { code: "601", name: "Compras de materias primas" },
        purchaseSuppliersLabel: "proveedores de materias primas e insumos industriales",
        clientsLabel: "distribuidores, mayoristas e industrias compradoras",
      };
    case "Hostelería":
      return {
        inventoryNote: `INVENTARIO: empresa de HOSTELERÍA. Tiene existencias perecederas: alimentos y bebidas (cta. 300). Rotación alta y cantidades variables. Incluye 2-3 productos representativos (vinos, bebidas, alimentos).`,
        invoiceNote: `FACTURAS: empresa de HOSTELERÍA — vende servicios de alojamiento y/o restauración.
  - Facturas de VENTA (type:"sale"): servicios de restaurante (menús, eventos), alojamiento, catering. Cuenta: 705 (Prestaciones de servicios hosteleros).
    journalNote: "705 → 477 + 430/570 (efectivo o cliente)"; accountDebits: [430]; accountCredits: [705, 477]
  - Facturas de COMPRA (type:"purchase"): compra de alimentos, bebidas y suministros. Cuenta: 600 (Compras de mercaderías — alimentación), con ${tax} al tipo reducido donde aplique.
    journalNote: "600 → 472 + 400"; accountDebits: [600, 472]; accountCredits: [400]`,
        saleAccount: { code: "705", name: "Prestaciones de servicios hosteleros" },
        purchaseAccount: { code: "600", name: "Compras de mercaderías (alimentación)" },
        purchaseSuppliersLabel: "proveedores de alimentos, bebidas y suministros",
        clientsLabel: "clientes individuales, empresas para eventos y agencias",
      };
    default: // Comercio
      return {
        inventoryNote: `INVENTARIO: empresa COMERCIAL. Compra y revende mercaderías (cta. 300). Incluye 2-3 líneas de productos representativos del sector.`,
        invoiceNote: `FACTURAS: empresa COMERCIAL — compra bienes para revenderlos.
  - Facturas de VENTA (type:"sale"): venta de mercaderías a clientes. Cuenta: 700 (Ventas de mercaderías).
    journalNote: "700 → 477 + 430"; accountDebits: [430]; accountCredits: [700, 477]
  - Facturas de COMPRA (type:"purchase"): compra de mercaderías a proveedores. Cuenta: 600 (Compras de mercaderías).
    journalNote: "600 → 472 + 400"; accountDebits: [600, 472]; accountCredits: [400]`,
        saleAccount: { code: "700", name: "Ventas de mercaderías" },
        purchaseAccount: { code: "600", name: "Compras de mercaderías" },
        purchaseSuppliersLabel: "proveedores mayoristas o fabricantes",
        clientsLabel: "clientes minoristas o empresas compradoras",
      };
  }
}

// ─── CALL 2A: COMMERCIAL INVOICES BLOCK ───────────────────────────────────────
async function generateCommercialBlock(
  params: GenerateParams,
  scenario: Record<string, unknown>,
  client: OpenAI,
  model: string,
) {
  const rates = TAX_RATES[params.taxRegime];
  const { periodStart, periodEnd, numMonths } = getPeriodInfo(params);
  const sc = JSON.stringify(scenario, null, 0);
  const sectorCtx = getSectorContext(params.sector, params.taxRegime);

  const prompt = `Genera el PERFIL COMERCIAL del universo contable usando este escenario:
${sc}

PERÍODO: ${periodStart} a ${periodEnd} (${numMonths} mes${numMonths > 1 ? "es" : ""})
RÉGIMEN FISCAL: ${params.taxRegime} (general ${rates.standard}%, reducido ${rates.reduced}%)
SECTOR: ${params.sector}

══ REGLAS SECTORIALES ══
${sectorCtx.inventoryNote}
Proveedores: ${sectorCtx.purchaseSuppliersLabel}
Clientes: ${sectorCtx.clientsLabel}
══════════════════════

Genera exactamente este JSON (SIN facturas — se generan aparte):
{
  "companyProfile": {
    "name": "(del escenario)",
    "nif": "(del escenario)",
    "address": "(del escenario)",
    "city": "(del escenario)",
    "sector": "${params.sector}",
    "taxRegime": "${params.taxRegime}",
    "fiscalYear": ${params.year},
    "description": "(del escenario)",
    "companyType": "SL",
    "legalForm": "(del escenario)"
  },
  "inventory": {
    "initialInventory": [
      {"code": "P001", "description": "apropiado al sector", "quantity": 100, "unitCost": 12.50, "totalCost": 1250.00, "accountCode": "300"},
      {"code": "P002", "description": "...", "quantity": 50, "unitCost": 25.00, "totalCost": 1250.00, "accountCode": "300"}
    ],
    "finalInventory": [
      {"code": "P001", "description": "...", "quantity": 70, "unitCost": 12.50, "totalCost": 875.00, "accountCode": "300"},
      {"code": "P002", "description": "...", "quantity": 30, "unitCost": 25.00, "totalCost": 750.00, "accountCode": "300"}
    ],
    "initialTotal": 2500.00,
    "finalTotal": 1625.00,
    "stockVariation": -875.00
  },
  "suppliers": [
    {"name": "...", "nif": "...", "address": "...", "city": "...", "accountCode": "400"},
    {"name": "...", "nif": "...", "address": "...", "city": "...", "accountCode": "400"}
  ],
  "clients": [
    {"name": "...", "nif": "...", "address": "...", "city": "...", "accountCode": "430"},
    {"name": "...", "nif": "...", "address": "...", "city": "...", "accountCode": "430"}
  ]
}

Importes realistas para sector ${params.sector}. Usa datos del escenario.`;

  return await callAI(client, model, prompt, 2500) as Record<string, unknown>;
}

// ─── CALL 2A-MONTHLY: INVOICES PER MONTH ──────────────────────────────────────
function getMonthsInPeriod(params: GenerateParams) {
  const { periodStart, periodEnd } = getPeriodInfo(params);
  const [sy, sm] = periodStart.split("-").map(Number);
  const [ey, em] = periodEnd.split("-").map(Number);
  const months: Array<{ start: string; end: string; label: string; numStr: string }> = [];
  let cy = sy, cm = sm;
  while (cy < ey || (cy === ey && cm <= em)) {
    const mm = String(cm).padStart(2, "0");
    const lastDay = new Date(cy, cm, 0).getDate();
    months.push({
      start: `${cy}-${mm}-01`,
      end: `${cy}-${mm}-${lastDay}`,
      label: `${MONTHS_ES[cm - 1].charAt(0).toUpperCase() + MONTHS_ES[cm - 1].slice(1)} ${cy}`,
      numStr: `${cy}${mm}`,
    });
    cm++;
    if (cm > 12) { cm = 1; cy++; }
  }
  return months;
}

async function generateMonthlyInvoices(
  params: GenerateParams,
  scenario: Record<string, unknown>,
  client: OpenAI,
  model: string,
  monthStart: string,
  monthEnd: string,
  monthLabel: string,
  monthNumStr: string,
  invoicesPerMonth: number,
  invoiceStartNum: number,
): Promise<{ invoices: unknown[] }> {
  const rates = TAX_RATES[params.taxRegime];
  const sectorCtx = getSectorContext(params.sector, params.taxRegime);

  const sectorSaleHint = params.sector === "Servicios"
    ? "servicios prestados (consultoría, diseño, formación…), cuenta 705"
    : params.sector === "Industria"
    ? "productos fabricados, cuenta 701"
    : params.sector === "Hostelería"
    ? "servicios de hostelería/restauración, cuenta 705"
    : "mercaderías, cuenta 700";

  const sectorBuyHint = params.sector === "Servicios"
    ? "gastos de explotación: subcontratación, software, telefonía, oficina… cuentas 62x"
    : params.sector === "Industria"
    ? "materias primas o componentes, cuenta 601"
    : "mercaderías o alimentos, cuenta 600";

  const nums = Array.from({ length: invoicesPerMonth }, (_, i) =>
    `F-${params.year}/${String(invoiceStartNum + i).padStart(3, "0")}`
  );

  const prompt = `Genera ${invoicesPerMonth} facturas de ${monthLabel} para empresa "${scenario.companyName}" (${params.sector}, ${params.taxRegime}).
Fechas: ${monthStart} a ${monthEnd}. IVA general ${rates.standard}%, reducido ${rates.reduced}%.
Ventas: ${sectorSaleHint}. Compras: ${sectorBuyHint}.
Mezcla compras y ventas. Números: ${nums.join(", ")}.

JSON exacto (sin texto extra):
{"invoices":[{"invoiceNumber":"${nums[0]}","date":"${monthStart.slice(0,7)}-DD","type":"sale","partyName":"...","partyNif":"B12345678","lines":[{"description":"...","quantity":1,"unitPrice":500,"discount":0,"subtotal":500,"taxRate":${rates.standard},"taxAmount":${(rates.standard / 100 * 500).toFixed(2)},"total":${(500 * (1 + rates.standard / 100)).toFixed(2)}}],"subtotal":500,"taxBase":500,"taxAmount":${(rates.standard / 100 * 500).toFixed(2)},"total":${(500 * (1 + rates.standard / 100)).toFixed(2)},"paymentMethod":"transfer","dueDate":"${monthEnd}","accountDebits":[{"accountCode":"430","accountName":"Clientes","amount":${(500 * (1 + rates.standard / 100)).toFixed(2)},"description":"..."}],"accountCredits":[{"accountCode":"${sectorCtx.saleAccount.code}","accountName":"${sectorCtx.saleAccount.name}","amount":500,"description":"..."},{"accountCode":"477","accountName":"IVA repercutido","amount":${(rates.standard / 100 * 500).toFixed(2)},"description":"..."}]}]}

Genera exactamente ${invoicesPerMonth} objetos en el array. Importes variados y realistas.`;

  return await callAI(client, model, prompt, 4000) as { invoices: unknown[] };
}

// ─── CALL 2B: BANKING & INSURANCE BLOCK ───────────────────────────────────────
async function generateBankingBlock(
  params: GenerateParams,
  scenario: Record<string, unknown>,
  client: OpenAI,
  model: string,
) {
  const rates = TAX_RATES[params.taxRegime];
  const { periodStart, periodEnd, numMonths } = getPeriodInfo(params);
  const sc = JSON.stringify({
    companyName: scenario.companyName,
    sector: params.sector,
    bankEntity: scenario.bankEntity,
    bankAccount: scenario.bankAccount,
    taxRegime: params.taxRegime,
    year: params.year,
  }, null, 0);

  const prompt = `Genera el BLOQUE BANCARIO Y SEGUROS del universo contable.

EMPRESA: ${sc}
PERÍODO: ${periodStart} a ${periodEnd} (${numMonths} mes${numMonths > 1 ? "es" : ""})
RÉGIMEN FISCAL: ${params.taxRegime} (IVA general ${rates.standard}%)

Genera exactamente este JSON:
{
  "creditCardStatement": {
    "cardNumber": "**** **** **** 1234",
    "entity": "(del escenario bankEntity)",
    "statementPeriod": "Extracto ${params.year}",
    "movements": [
      {"date": "YYYY-MM-DD", "description": "...", "amount": 120.00, "category": "...", "accountCode": "629", "accountName": "Otros servicios"}
    ],
    "totalCharges": 120.00,
    "settlementDate": "YYYY-MM-DD",
    "journalNote": "Cada gasto con tarjeta: gasto (xxx) a deuda (5201). Al cargo bancario: 5201 a 572.",
    "accountDebits": [{"accountCode": "629", "accountName": "Otros servicios", "amount": 120.00, "description": "Gastos tarjeta"}],
    "accountCredits": [{"accountCode": "5201", "accountName": "Deudas tarjeta crédito", "amount": 120.00, "description": "Total pendiente"}]
  },
  "insurancePolicies": [
    {
      "policyNumber": "SEG-${params.year}-001",
      "insurer": "Mapfre Seguros",
      "type": "Seguro multirriesgo",
      "annualPremium": 1800.00,
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "prepaidExpense": 900.00,
      "journalNote": "Prima anual. Parte del siguiente ejercicio se periodifica en cuenta 480 (gastos anticipados).",
      "accountDebits": [{"accountCode": "625", "accountName": "Primas de seguros", "amount": 900.00, "description": "Parte año ${params.year}"},{"accountCode": "480", "accountName": "Gastos anticipados", "amount": 900.00, "description": "Parte año ${params.year + 1}"}],
      "accountCredits": [{"accountCode": "572", "accountName": "Bancos", "amount": 1800.00, "description": "Pago prima"}]
    }
  ],
  "casualtyEvent": {
    "date": "YYYY-MM-DD",
    "description": "...",
    "assetAffected": "...",
    "bookValue": 5000.00,
    "insuranceCompensation": 3500.00,
    "netLoss": 1500.00,
    "journalNote": "Siniestro: pérdida (678) compensada parcialmente por seguro (778). El cobro pendiente se registra en 430.",
    "accountDebits": [{"accountCode": "678", "accountName": "Gastos excepcionales", "amount": 5000.00, "description": "Baja bienes siniestrados"},{"accountCode": "430", "accountName": "Clientes (seguro)", "amount": 3500.00, "description": "Indemnización a cobrar"}],
    "accountCredits": [{"accountCode": "300", "accountName": "Mercaderías / Inmovilizado", "amount": 5000.00, "description": "Baja por siniestro"},{"accountCode": "778", "accountName": "Ingresos excepcionales", "amount": 3500.00, "description": "Indemnización seguro"}]
  },
  "bankStatements": [
    {
      "bank": "(del escenario bankEntity)",
      "accountNumber": "(del escenario bankAccount)",
      "period": "MMMM ${params.year}",
      "openingBalance": 25000.00,
      "closingBalance": 22500.00,
      "transactions": [
        {"date": "YYYY-MM-DD", "concept": "...", "debit": null, "credit": 3500.00, "balance": 28500.00},
        {"date": "YYYY-MM-DD", "concept": "...", "debit": 6000.00, "credit": null, "balance": 22500.00}
      ]
    }
  ]
}

REGLAS CRÍTICAS:
- EXTRACTOS BANCARIOS: genera ${numMonths} extracto(s) mensuales con al menos 4 transacciones cada uno, cubriendo todos los meses de ${periodStart} a ${periodEnd}
- TARJETA: mínimo ${Math.min(numMonths * 2, 12)} movimientos distribuidos en todos los meses del período
- Todas las fechas dentro del período ${periodStart}–${periodEnd}
- Importes coherentes con el sector ${params.sector}`;

  return await callAI(client, model, prompt, 4500) as Record<string, unknown>;
}

// ─── CALL 3: OPERATIONS BLOCK ─────────────────────────────────────────────────
async function generateOperationsBlock(
  params: GenerateParams,
  scenario: Record<string, unknown>,
  client: OpenAI,
  model: string,
) {
  const rates = TAX_RATES[params.taxRegime];
  const { periodStart, periodEnd, numMonths, midMonthLabel } = getPeriodInfo(params);
  const withPayroll = params.includePayroll !== false;
  const withSS = params.includeSocialSecurity !== false && withPayroll;
  const withTax = params.includeTaxLiquidation !== false;
  const withLoan = params.includeBankLoan !== false;
  const withMortgage = params.includeMortgage === true;
  const withPolicy = params.includeCreditPolicy !== false;
  const withFixedAssets = params.includeFixedAssets !== false;
  const level = params.educationLevel ?? "Medio";
  const fin = (scenario.financials as Record<string, number>) ?? {};

  const levelNote = level === "Superior"
    ? "Nivel Superior FP: incluye periodificaciones, efectos comerciales, leasing si aplica."
    : "Nivel Medio FP: operaciones claras, nóminas básicas, IVA trimestral, préstamos sencillos.";

  const sc = JSON.stringify({
    companyName: scenario.companyName,
    cif: scenario.cif,
    bankEntity: scenario.bankEntity,
    bankAccount: scenario.bankAccount,
    employees: scenario.employees,
    financials: scenario.financials,
  }, null, 0);

  const sections: string[] = [];

  if (withPayroll) {
    sections.push(`"payroll": {
    "month": "${midMonthLabel}",
    "employees": [
      {
        "name": "(nombre del empleado del escenario)",
        "naf": "XXXXXXXX/XX",
        "category": "Oficial 1ª / Auxiliar / etc.",
        "grossSalary": X,
        "irpfRate": X,
        "irpfAmount": X,
        "ssEmployeeRate": 6.35,
        "ssEmployeeAmount": X,
        "netSalary": X,
        "ssEmployerRate": 30.40,
        "ssEmployerAmount": X
      }
    ],
    "totalGross": X, "totalIrpf": X, "totalSsEmployee": X, "totalNetSalary": X, "totalSsEmployer": X, "totalLaborCost": X,
    "journalNote": "Nómina: 640 (sueldos) y 642 (SS empresa) al debe; 465 (salarios netos), 4751 (IRPF retenido), 476 (SS total) al haber.",
    "accountDebits": [{"accountCode":"640","accountName":"Sueldos y salarios","amount":X,"description":"Nómina mes"},{"accountCode":"642","accountName":"SS a cargo empresa","amount":X,"description":"Cuota patronal"}],
    "accountCredits": [{"accountCode":"465","accountName":"Remuneraciones pendientes","amount":X,"description":"Salario neto"},{"accountCode":"4751","accountName":"HP acreedora IRPF","amount":X,"description":"Retención IRPF"},{"accountCode":"476","accountName":"Organismos SS acreedores","amount":X,"description":"SS total mes"}]
  }`);
  }

  if (withSS) {
    sections.push(`"socialSecurityPayments": [{
    "month": "...", "dueDate": "YYYY-MM-DD", "employeeCount": X,
    "totalGross": X, "ssEmployeeAmount": X, "ssEmployerAmount": X, "totalPayment": X,
    "journalNote": "Pago TC1: cancela deuda SS (476 al debe) contra banco (572 al haber).",
    "accountDebits": [{"accountCode":"476","accountName":"Organismos SS acreedores","amount":X,"description":"Cuota SS mes"}],
    "accountCredits": [{"accountCode":"572","accountName":"Bancos","amount":X,"description":"Pago domiciliado"}]
  }]`);
  } else {
    sections.push(`"socialSecurityPayments": []`);
  }

  if (withTax) {
    sections.push(`"taxLiquidations": [
    {
      "model": "${params.taxRegime === "IGIC" ? "420" : "303"}",
      "period": "T1", "dueDate": "${params.year}-04-20",
      "taxableBase": X, "outputTax": X, "inputTax": X, "result": X, "paymentType": "ingreso",
      "journalNote": "Liquidación Mod.${params.taxRegime === "IGIC" ? "420 IGIC" : "303 IVA"}: 477 (repercutido) menos 472 (soportado) = cuota 4750.",
      "accountDebits": [{"accountCode":"477","accountName":"${params.taxRegime} repercutido","amount":X,"description":"${params.taxRegime} devengado 1T"}],
      "accountCredits": [{"accountCode":"472","accountName":"${params.taxRegime} soportado","amount":X,"description":"${params.taxRegime} deducible"},{"accountCode":"4750","accountName":"HP acreedora por ${params.taxRegime}","amount":X,"description":"Cuota a pagar"}]
    },
    {
      "model": "IS", "period": "Annual", "dueDate": "${params.year + 1}-07-25",
      "taxableBase": X, "outputTax": X, "inputTax": 0, "result": X, "paymentType": "ingreso",
      "journalNote": "IS ejercicio ${params.year}: tipo 25%. Gasto (630) y deuda Hacienda (4752).",
      "accountDebits": [{"accountCode":"630","accountName":"Impuesto sobre beneficios","amount":X,"description":"IS ejercicio ${params.year}"}],
      "accountCredits": [{"accountCode":"4752","accountName":"HP acreedora IS","amount":X,"description":"Cuota IS"}]
    }
  ]`);
  } else {
    sections.push(`"taxLiquidations": []`);
  }

  if (withLoan) {
    const p = fin.loanPrincipal ?? 50000;
    const r = fin.loanRate ?? 4.5;
    const t = fin.loanTermMonths ?? 60;
    const monthly = p * (r / 1200) / (1 - Math.pow(1 + r / 1200, -t));
    sections.push(`"bankLoan": {
    "entity": "${String(scenario.bankEntity ?? "Banco Ejemplo")}",
    "loanNumber": "PRE-${params.year}-001",
    "principal": ${p}, "annualRate": ${r}, "termMonths": ${t},
    "startDate": "${fin.loanStartDate ?? periodStart}",
    "monthlyInstallment": ${monthly.toFixed(2)},
    "amortizationTable": [GENERA 3 filas: period, date, installment, interest, principal, balance],
    "journalNote": "Recepción del préstamo: 572 al debe, 170 al haber. Cada cuota: 170/520 (capital) y 662 (intereses) al debe, 572 al haber.",
    "accountDebits": [{"accountCode":"572","accountName":"Bancos","amount":${p},"description":"Recepción préstamo"}],
    "accountCredits": [{"accountCode":"170","accountName":"Deudas LP entidades de crédito","amount":${p},"description":"Préstamo bancario"}]
  }`);
  }

  if (withMortgage) {
    const mp = fin.mortgagePrincipal ?? 180000;
    const mr = fin.mortgageRate ?? 3.2;
    const mt = fin.mortgageTermMonths ?? 240;
    const mMonthly = mp * (mr / 1200) / (1 - Math.pow(1 + mr / 1200, -mt));
    sections.push(`"mortgage": {
    "entity": "${String(scenario.bankEntity ?? "CaixaBank")}",
    "loanNumber": "HIP-${params.year}-001",
    "propertyDescription": "Local comercial sector ${params.sector}",
    "propertyValue": ${Math.round(mp * 1.4)},
    "principal": ${mp}, "annualRate": ${mr}, "termMonths": ${mt},
    "startDate": "${fin.mortgageStartDate ?? periodStart}",
    "monthlyInstallment": ${mMonthly.toFixed(2)},
    "amortizationTable": [GENERA 3 filas: period, date, installment, interest, principal, balance],
    "journalNote": "Inmueble activo (221/222). Hipoteca: LP (170) y CP (521). Cuotas: 662 (intereses) + amortización capital.",
    "accountDebits": [{"accountCode":"221","accountName":"Construcciones","amount":${Math.round(mp * 1.4)},"description":"Adquisición local"}],
    "accountCredits": [{"accountCode":"170","accountName":"Deudas LP","amount":${Math.round(mp * 0.9)},"description":"Hipoteca LP"},{"accountCode":"521","accountName":"Deudas CP entidades crédito","amount":${Math.round(mp * 0.07)},"description":"Vencimiento CP hipoteca"},{"accountCode":"572","accountName":"Bancos","amount":${Math.round(mp * 0.03 + mp * 0.4)},"description":"Entrada + gastos"}]
  }`);
  }

  if (withPolicy) {
    const limit = fin.creditPolicyLimit ?? 30000;
    const drawn = fin.creditPolicyDrawn ?? 15000;
    sections.push(`"creditPolicy": {
    "entity": "${String(scenario.bankEntity ?? "Banco Ejemplo")}",
    "policyNumber": "POL-${params.year}-001",
    "limit": ${limit}, "drawnAmount": ${drawn}, "annualRate": 5.5,
    "openingCommission": 150.00, "unusedCommission": ${Math.round((limit - drawn) * 0.005)},
    "startDate": "${params.year}-06-01", "endDate": "${params.year}-11-30",
    "interestAmount": ${Math.round(drawn * 0.055 / 2)},
    "totalSettlement": ${Math.round(drawn * 0.055 / 2 + 150 + (limit - drawn) * 0.005)},
    "journalNote": "Disposición póliza: 5201 al haber, 572 al debe. Liquidación: 663 (intereses) y 626 (comisiones).",
    "accountDebits": [{"accountCode":"663","accountName":"Intereses de deudas","amount":${Math.round(drawn * 0.055 / 2)},"description":"Intereses saldo dispuesto"},{"accountCode":"626","accountName":"Servicios bancarios","amount":${Math.round(150 + (limit - drawn) * 0.005)},"description":"Comisiones apertura y no disposición"}],
    "accountCredits": [{"accountCode":"5201","accountName":"Deudas CP póliza de crédito","amount":${Math.round(drawn * 0.055 / 2 + 150 + (limit - drawn) * 0.005)},"description":"Total liquidación"}]
  }`);
  }

  if (withFixedAssets) {
    sections.push(`"fixedAssets": [
    {
      "code": "AE-001", "description": "Mobiliario de oficina",
      "purchaseDate": "${periodStart}", "purchaseCost": 8500.00, "usefulLifeYears": 10,
      "annualDepreciation": 850.00, "accumulatedDepreciation": 850.00, "netBookValue": 7650.00,
      "depreciationMethod": "Lineal",
      "assetAccountCode": "216", "accDepreciationCode": "2816", "depExpenseCode": "681",
      "journalNote": "Amortización lineal: coste/vida útil. 681 al debe, 2816 al haber.",
      "accountDebits": [{"accountCode":"681","accountName":"Amortización inmovilizado material","amount":850.00,"description":"Dotación amortización mobiliario"}],
      "accountCredits": [{"accountCode":"2816","accountName":"Amort. acum. mobiliario","amount":850.00,"description":"Amortización acumulada"}]
    },
    {
      "code": "AE-002", "description": "Equipos informáticos",
      "purchaseDate": "${periodStart}", "purchaseCost": 4200.00, "usefulLifeYears": 4,
      "annualDepreciation": 1050.00, "accumulatedDepreciation": 1050.00, "netBookValue": 3150.00,
      "depreciationMethod": "Lineal",
      "assetAccountCode": "217", "accDepreciationCode": "2817", "depExpenseCode": "681",
      "journalNote": "Equipos informáticos: vida útil fiscal 4 años. 681 al debe, 2817 al haber.",
      "accountDebits": [{"accountCode":"681","accountName":"Amortización inmovilizado material","amount":1050.00,"description":"Dotación amortización equipos"}],
      "accountCredits": [{"accountCode":"2817","accountName":"Amort. acum. equipos informáticos","amount":1050.00,"description":"Amortización acumulada"}]
    }
  ]`);
  } else {
    sections.push(`"fixedAssets": []`);
  }

  const prompt = `Genera el BLOQUE DE OPERACIONES del universo contable.

ESCENARIO (usa estos datos para coherencia):
${sc}

PERÍODO: ${periodStart} a ${periodEnd} | SECTOR: ${params.sector} | ${params.taxRegime} general ${rates.standard}%
${levelNote}

Genera exactamente este JSON (todas las fechas dentro de ${periodStart}–${periodEnd}):
{
  ${sections.join(",\n  ")}
}

REGLAS:
- Importes calculados matemáticamente correctos
- journalNote didáctica en cada sección explicando cuentas PGC
- Usa nombre/cuenta bancaria del escenario
- Asientos cuadrados (debe = haber)`;

  return await callAI(client, model, prompt, 5000) as Record<string, unknown>;
}

// ─── CALL 4: EQUITY BLOCK ─────────────────────────────────────────────────────
async function generateEquityBlock(
  params: GenerateParams,
  scenario: Record<string, unknown>,
  client: OpenAI,
  model: string,
) {
  const rates = TAX_RATES[params.taxRegime];
  const { periodStart, periodEnd } = getPeriodInfo(params);
  const withShareholders = params.includeShareholdersInfo !== false;
  const withInitialBalance = params.includeInitialBalance !== false && params.isNewCompany !== true;
  const withShareholderAccounts = params.includeShareholderAccounts !== false;
  const withDividends = params.includeDividends !== false && params.isNewCompany !== true;

  const fin = (scenario.financials as Record<string, number>) ?? {};
  const shareholders = (scenario.shareholders as Array<Record<string, unknown>>) ?? [];
  const capital = fin.shareCapital ?? 10000;
  const netProfit = fin.netProfitPriorYear ?? 20000;

  const sc = JSON.stringify({
    companyName: scenario.companyName,
    cif: scenario.cif,
    shareholders: scenario.shareholders,
    financials: scenario.financials,
  }, null, 0);

  const sections: string[] = [];

  if (withShareholders) {
    sections.push(`"shareholdersInfo": {
    "companyType": "SL",
    "legalForm": "Sociedad de Responsabilidad Limitada",
    "shareCapital": ${capital},
    "nominalValuePerShare": ${fin.nominalPerShare ?? 100},
    "totalShares": ${fin.totalShares ?? 100},
    "constitutionDate": "${params.year - 3}-06-15",
    "registryEntry": "Tomo 1234, Folio 56, Sección 8ª, Hoja M-123456",
    "shareholders": [GENERA usando datos del escenario: name, nif, role, participationPercentage, nominalValuePerShare, numberOfShares, totalCapitalAmount],
    "journalNote": "Capital social (100): aportaciones de socios. Cada socio tiene participaciones a valor nominal. Reservas (112, 113): beneficios no distribuidos.",
    "accountDebits": [{"accountCode":"572","accountName":"Bancos","amount":${capital},"description":"Desembolso capital"}],
    "accountCredits": [{"accountCode":"100","accountName":"Capital social","amount":${capital},"description":"Capital suscrito y desembolsado"}]
  }`);
  }

  if (withInitialBalance) {
    sections.push(`"initialBalanceSheet": {
    "date": "${periodStart}",
    "description": "Balance de apertura a ${periodStart} — Asiento de apertura del ejercicio",
    "nonCurrentAssets": [{"accountCode":"XXX","accountName":"...","amount":X}],
    "currentAssets": [{"accountCode":"300","accountName":"Mercaderías","amount":X},{"accountCode":"430","accountName":"Clientes","amount":X},{"accountCode":"572","accountName":"Bancos c/c","amount":X}],
    "equity": [{"accountCode":"100","accountName":"Capital social","amount":X},{"accountCode":"112","accountName":"Reserva legal","amount":X},{"accountCode":"129","accountName":"Resultado del ejercicio","amount":X}],
    "nonCurrentLiabilities": [{"accountCode":"170","accountName":"Deudas LP entidades crédito","amount":X}],
    "currentLiabilities": [{"accountCode":"400","accountName":"Proveedores","amount":X},{"accountCode":"477","accountName":"${params.taxRegime} repercutido","amount":X}],
    "totalAssets": X,
    "totalEquityAndLiabilities": X,
    "journalNote": "Asiento de apertura: se cargan todos los activos y se abonan pasivos y patrimonio neto. Total Activo = Total Pasivo + PN.",
    "accountDebits": [{"accountCode":"XXX","accountName":"Nombre activo","amount":X,"description":"Activo en apertura"}],
    "accountCredits": [{"accountCode":"XXX","accountName":"Nombre pasivo/PN","amount":X,"description":"Pasivo/PN en apertura"}]
  }`);
  }

  if (withShareholderAccounts) {
    sections.push(`"shareholderAccounts": {
    "description": "Cuenta corriente con socios y administradores — ejercicio ${params.year}",
    "transactions": [
      {"date":"YYYY-MM-DD","concept":"Anticipo a cuenta de dividendos","shareholderName":"(del escenario)","accountCode":"553","accountName":"C/C con socios","debit":null,"credit":2000.00,"balance":-2000.00},
      {"date":"YYYY-MM-DD","concept":"Préstamo del socio a la empresa","shareholderName":"(del escenario)","accountCode":"553","accountName":"C/C con socios","debit":null,"credit":5000.00,"balance":-7000.00},
      {"date":"YYYY-MM-DD","concept":"Devolución parcial préstamo","shareholderName":"(del escenario)","accountCode":"553","accountName":"C/C con socios","debit":3000.00,"credit":null,"balance":-4000.00},
      {"date":"YYYY-MM-DD","concept":"Retribución administrador pendiente","shareholderName":"(del escenario)","accountCode":"551","accountName":"C/C con administradores","debit":null,"credit":1500.00,"balance":-1500.00}
    ],
    "closingBalance551": -1500.00,
    "closingBalance553": -4000.00,
    "journalNote": "551: operaciones administradores (retribuciones, anticipos). 553: operaciones socios. Saldo acreedor = empresa debe. Saldo deudor = socio/admin debe. Intereses art.18 LIS.",
    "accountDebits": [{"accountCode":"651","accountName":"Retribución administradores","amount":1500.00,"description":"Remuneración órgano administración"}],
    "accountCredits": [{"accountCode":"551","accountName":"C/C con administradores","amount":1500.00,"description":"Retribución pendiente pago"}]
  }`);
  }

  if (withDividends) {
    const legalReserve = Math.round(netProfit * 0.1);
    const voluntaryReserve = Math.round(netProfit * 0.15);
    const totalDividends = netProfit - legalReserve - voluntaryReserve;
    const perShare = fin.totalShares ? (totalDividends / fin.totalShares) : 0;
    sections.push(`"dividendDistribution": {
    "fiscalYear": ${params.year - 1},
    "approvalDate": "${params.year}-06-30",
    "paymentDate": "${params.year}-07-15",
    "totalNetProfit": ${netProfit},
    "legalReserve": ${legalReserve},
    "voluntaryReserve": ${voluntaryReserve},
    "totalDividends": ${totalDividends},
    "dividendPerShare": ${perShare.toFixed(2)},
    "irpfWithholdingRate": 19,
    "perShareholder": [GENERA para cada socio del escenario: name, percentage, grossDividend, irpfWithholdingRate(19), irpfWithholdingAmount, netDividend],
    "journalNote": "Distribución resultado: (1) Reserva Legal mín. 10% hasta 20% capital (112); (2) Reservas voluntarias (113); (3) Dividendos aprobados en Junta (526). Al pagar: 526 a 572 + retención IRPF 19% en 4751. Mod.123.",
    "accountDebits": [{"accountCode":"129","accountName":"Resultado del ejercicio","amount":${netProfit},"description":"Aplicación resultado ${params.year - 1}"}],
    "accountCredits": [{"accountCode":"112","accountName":"Reserva legal","amount":${legalReserve},"description":"Dotación 10%"},{"accountCode":"113","accountName":"Reservas voluntarias","amount":${voluntaryReserve},"description":"Reserva voluntaria"},{"accountCode":"526","accountName":"Dividendo activo a pagar","amount":${totalDividends},"description":"Dividendos aprobados en Junta"}]
  }`);
  }

  if (sections.length === 0) return {};

  const prompt = `Genera el BLOQUE DE PATRIMONIO del universo contable.

ESCENARIO:
${sc}

PERÍODO: ${periodStart} a ${periodEnd} | RÉGIMEN: ${params.taxRegime} | SECTOR: ${params.sector}

Genera exactamente este JSON con datos coherentes con el escenario:
{
  ${sections.join(",\n  ")}
}

REGLAS:
- Usa nombres y NIF exactos del escenario
- Total Activo = Total Pasivo + PN (en initialBalanceSheet)
- Asientos cuadrados en todos los elementos
- journalNote didáctica explicando cuentas PGC en cada sección
- Todas las fechas dentro de ${periodStart}–${periodEnd}`;

  return await callAI(client, model, prompt, 4500) as Record<string, unknown>;
}

// ─── CALL 5: JOURNAL ENTRIES ──────────────────────────────────────────────────
async function generateJournalBlock(
  params: GenerateParams,
  scenario: Record<string, unknown>,
  client: OpenAI,
  model: string,
) {
  const { periodStart, periodEnd, numMonths } = getPeriodInfo(params);
  const opsPerMonth = params.operationsPerMonth ?? 8;
  const targetEntries = Math.min(opsPerMonth * numMonths, 20);
  const level = params.educationLevel ?? "Medio";

  const sc = JSON.stringify({
    companyName: scenario.companyName,
    sector: params.sector,
    taxRegime: params.taxRegime,
    year: params.year,
    bankEntity: scenario.bankEntity,
    bankAccount: scenario.bankAccount,
  }, null, 0);

  const sectorCtxJ = getSectorContext(params.sector, params.taxRegime);
  const enabledOps: string[] = [
    "facturas de compra y venta",
    "cobros y pagos a clientes/proveedores",
  ];
  if (params.includePayroll !== false) enabledOps.push("nóminas y pagos de seguridad social");
  if (params.includeTaxLiquidation !== false) enabledOps.push("liquidaciones trimestrales de " + params.taxRegime + " e IS anual");
  if (params.includeBankLoan !== false) enabledOps.push("cuotas del préstamo bancario (capital e intereses)");
  if (params.includeMortgage) enabledOps.push("cuotas de hipoteca");
  if (params.includeCreditPolicy !== false) enabledOps.push("disposición y liquidación de póliza de crédito");
  if (params.includeFixedAssets !== false) enabledOps.push("amortizaciones de inmovilizado");
  enabledOps.push("gastos generales (suministros, seguros, servicios bancarios)");
  if (params.sector !== "Servicios") enabledOps.push("variación de existencias");

  const prompt = `Genera el LIBRO DIARIO (journalEntries) del universo contable.

EMPRESA: ${sc}
PERÍODO: ${periodStart} a ${periodEnd}
NIVEL: ${level === "Superior" ? "FP Grado Superior (incluye periodificaciones, ajustes de ejercicio)" : "FP Grado Medio"}

SECTOR ${params.sector.toUpperCase()} — CUENTAS OBLIGATORIAS:
- Ventas: cuenta ${sectorCtxJ.saleAccount.code} (${sectorCtxJ.saleAccount.name}) — NO usar 700 si el sector es Servicios o Hostelería
- Compras: cuenta ${sectorCtxJ.purchaseAccount.code} (${sectorCtxJ.purchaseAccount.name})
${params.sector === "Servicios" ? "- Esta empresa NO vende bienes físicos — los asientos de ventas deben reflejar servicios prestados (705)" : ""}

OPERACIONES A INCLUIR: ${enabledOps.join(", ")}

Genera exactamente ${targetEntries} asientos contables distribuidos a lo largo del período, cubriendo todas las operaciones listadas.

Formato JSON:
{
  "journalEntries": [
    {
      "entryNumber": "1",
      "date": "YYYY-MM-DD (dentro de ${periodStart}–${periodEnd})",
      "concept": "Descripción clara del asiento",
      "document": "Referencia del documento (F-2025/001, NOM-ENE, etc.)",
      "debits": [
        {"accountCode": "XXX", "accountName": "Nombre cuenta PGC", "amount": X.XX, "description": "..."}
      ],
      "credits": [
        {"accountCode": "XXX", "accountName": "Nombre cuenta PGC", "amount": X.XX, "description": "..."}
      ],
      "totalAmount": X.XX
    }
  ]
}

REGLAS CRÍTICAS:
- Cada asiento DEBE cuadrar: suma(débitos) = suma(créditos) = totalAmount
- DISTRIBUCIÓN OBLIGATORIA: al menos ${Math.min(numMonths, targetEntries)} meses distintos deben tener asientos — no agrupes todos en los primeros meses
- Asientos en orden cronológico estricto (date ascendente)
- Cuentas PGC correctas (3 o 4 dígitos)
- Conceptos claros y educativos (máximo 8 palabras)
- Importes coherentes con los datos del escenario
- SÉ CONCISO: description de cada línea en máximo 4 palabras
- Máximo 3 líneas de débito y 3 de crédito por asiento`;

  return await callAI(client, model, prompt, 4000) as Record<string, unknown>;
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
function getClient(config: AiConfig): OpenAI {
  if (!config.deepseekApiKey) {
    throw new Error("No hay ninguna API Key de DeepSeek configurada. Añade tu clave en Configuración o contacta al administrador.");
  }
  return new OpenAI({
    apiKey: config.deepseekApiKey,
    baseURL: config.deepseekBaseUrl || "https://api.deepseek.com",
  });
}

function getModel(config: AiConfig): string {
  return config.deepseekModel || "deepseek-chat";
}

export async function generateAccountingUniverse(params: GenerateParams, aiConfig: AiConfig): Promise<unknown> {
  const client = getClient(aiConfig);
  const model = getModel(aiConfig);

  // Phase 1: Planning — generates consistent scenario blueprint
  const scenario = await generateScenario(params, client, model);

  // Phase 2: Generate all blocks in parallel (each independent, all use scenario context)
  const withEquity =
    params.includeShareholdersInfo !== false ||
    (params.includeInitialBalance !== false && params.isNewCompany !== true) ||
    params.includeShareholderAccounts !== false ||
    (params.includeDividends !== false && params.isNewCompany !== true);

  // Compute per-month invoice count (2–5 based on operationsPerMonth)
  const opsPerMonth = params.operationsPerMonth ?? 8;
  const invoicesPerMonth = Math.max(2, Math.min(Math.ceil(opsPerMonth * 0.35), 5));

  // Build monthly invoice promises (one small AI call per month, all in parallel)
  const months = getMonthsInPeriod(params);
  let invoiceNum = 1;
  const monthlyInvoicePromises = months.map((m) => {
    const startNum = invoiceNum;
    invoiceNum += invoicesPerMonth;
    return generateMonthlyInvoices(
      params, scenario, client, model,
      m.start, m.end, m.label, m.numStr,
      invoicesPerMonth, startNum,
    );
  });

  const blockPromises: Promise<Record<string, unknown>>[] = [
    generateCommercialBlock(params, scenario, client, model),
    generateBankingBlock(params, scenario, client, model),
    generateOperationsBlock(params, scenario, client, model),
    generateJournalBlock(params, scenario, client, model),
  ];
  if (withEquity) {
    blockPromises.push(generateEquityBlock(params, scenario, client, model));
  }

  // Run all blocks + monthly invoice calls in parallel
  const [blocks, monthlyResults] = await Promise.all([
    Promise.all(blockPromises),
    Promise.all(monthlyInvoicePromises),
  ]);

  // Phase 3: Merge all blocks into one universe object
  const universe: Record<string, unknown> = {};
  for (const block of blocks) {
    if (block && typeof block === "object") {
      Object.assign(universe, block);
    }
  }

  // Merge all monthly invoices into a single sorted array
  const allInvoices: unknown[] = [];
  for (const result of monthlyResults) {
    if (result?.invoices && Array.isArray(result.invoices)) {
      allInvoices.push(...result.invoices);
    }
  }
  universe.invoices = allInvoices;

  return universe;
}
