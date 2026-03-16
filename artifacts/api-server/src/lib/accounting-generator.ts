import OpenAI from "openai";

interface GenerateParams {
  taxRegime: "IVA" | "IGIC";
  sector: "Comercio" | "Servicios" | "Industria" | "Hostelería";
  activity?: string | null;
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
  try { return JSON.parse(cleaned); } catch { /* continue to repair */ }

  let s = cleaned.trimEnd();

  if (s.endsWith('"')) {
    s = s.replace(/,\s*"[^"]*"?\s*$/, "");
  }

  s = s.replace(/,\s*\{[^{}]*$/, "");
  s = s.replace(/,\s*\[[^\[\]]*$/, "");
  s = s.replace(/,\s*"[^"]*$/, "");
  s = s.replace(/:\s*"[^"]*$/, ': ""');
  s = s.replace(/:\s*$/, ': null');
  s = s.replace(/,\s*$/, "");

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
  if (inStr) s += '"';
  for (let i = 0; i < brackets; i++) s += "]";
  for (let i = 0; i < braces; i++) s += "}";

  try { return JSON.parse(s); } catch { /* continue to aggressive repair */ }

  const lastGoodArray = s.lastIndexOf("}]");
  if (lastGoodArray > 0) {
    let attempt = s.substring(0, lastGoodArray + 2);
    let b2 = 0, k2 = 0;
    let inS2 = false, esc2 = false;
    for (const ch of attempt) {
      if (esc2) { esc2 = false; continue; }
      if (ch === "\\" && inS2) { esc2 = true; continue; }
      if (ch === '"') { inS2 = !inS2; continue; }
      if (inS2) continue;
      if (ch === "{") b2++; else if (ch === "}") b2--;
      if (ch === "[") k2++; else if (ch === "]") k2--;
    }
    for (let i = 0; i < k2; i++) attempt += "]";
    for (let i = 0; i < b2; i++) attempt += "}";
    try { return JSON.parse(attempt); } catch { /* fall through */ }
  }

  return null;
}

async function callAI(client: OpenAI, model: string, prompt: string, maxTokens: number): Promise<unknown> {
  const response = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: "system",
        content: "Eres un experto contable español especializado en el Plan General Contable (PGC). Responde ÚNICAMENTE con JSON válido, sin texto adicional. PROHIBIDO usar bloques de código markdown (```). Empieza directamente con { y termina con }.",
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
  const companyHint = params.companyName ? `La empresa se llama "${params.companyName}".` : "Inventa un nombre realista para el sector y actividad.";
  const activityHint = params.activity ? `- Actividad concreta: ${params.activity}` : "";

  const prompt = `Genera un PLANO DE ESCENARIO compacto para un universo contable de prácticas de FP española.

PARÁMETROS:
- Sector: ${params.sector}
${activityHint}
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
function getActivityLabel(params: GenerateParams): string {
  if (params.activity) return `${params.sector} — ${params.activity}`;
  return params.sector;
}

function getSectorContext(sector: string, taxRegime: string, activity?: string | null) {
  const tax = taxRegime === "IGIC" ? "IGIC" : "IVA";
  const activityNote = activity ? `\nACTIVIDAD CONCRETA: ${activity}. TODOS los productos, mercaderías, materias primas, servicios, proveedores y clientes deben ser coherentes con esta actividad. Usa terminología y productos propios del subsector.` : "";

  switch (sector) {
    case "Servicios":
      return {
        inventoryNote: `INVENTARIO: empresa de SERVICIOS. Sin mercaderías para reventa. El inventario puede incluir únicamente consumibles de oficina (cta. 328) o material de trabajo (602). Si los importes son insignificantes genera inventario con initialTotal=0 y finalTotal=0 y arrays vacíos.${activityNote}`,
        invoiceNote: `FACTURAS: empresa de SERVICIOS — vende SERVICIOS, NO bienes físicos.${activityNote}
  - Facturas de VENTA (type:"sale"): servicios prestados coherentes con la actividad.
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
        inventoryNote: `INVENTARIO: empresa INDUSTRIAL. Tiene materias primas (310), productos en curso (330) y productos terminados (350). Usa accountCode "310" para materias primas, "300" para productos terminados.${activityNote}`,
        invoiceNote: `FACTURAS: empresa INDUSTRIAL — fabrica y vende productos elaborados propios.${activityNote}
  - Facturas de VENTA (type:"sale"): venta de productos fabricados coherentes con la actividad. Cuenta: 701 (Ventas de productos terminados).
    journalNote: "701 → 477 + 430"; accountDebits: [430]; accountCredits: [701, 477]
  - Facturas de COMPRA (type:"purchase"): compra de materias primas y componentes propios de la actividad. Cuenta: 601 (Compras de materias primas).
    journalNote: "601 → 472 + 400"; accountDebits: [601, 472]; accountCredits: [400]`,
        saleAccount: { code: "701", name: "Ventas de productos terminados" },
        purchaseAccount: { code: "601", name: "Compras de materias primas" },
        purchaseSuppliersLabel: "proveedores de materias primas e insumos industriales",
        clientsLabel: "distribuidores, mayoristas e industrias compradoras",
      };
    case "Hostelería":
      return {
        inventoryNote: `INVENTARIO: empresa de HOSTELERÍA. Tiene existencias perecederas: alimentos y bebidas (cta. 300). Rotación alta y cantidades variables. Incluye 2-3 productos representativos.${activityNote}`,
        invoiceNote: `FACTURAS: empresa de HOSTELERÍA — vende servicios de alojamiento y/o restauración.${activityNote}
  - Facturas de VENTA (type:"sale"): servicios coherentes con la actividad del negocio. Cuenta: 705 (Prestaciones de servicios hosteleros).
    journalNote: "705 → 477 + 430/570 (efectivo o cliente)"; accountDebits: [430]; accountCredits: [705, 477]
  - Facturas de COMPRA (type:"purchase"): compra de alimentos, bebidas y suministros propios de la actividad. Cuenta: 600 (Compras de mercaderías — alimentación), con ${tax} al tipo reducido donde aplique.
    journalNote: "600 → 472 + 400"; accountDebits: [600, 472]; accountCredits: [400]`,
        saleAccount: { code: "705", name: "Prestaciones de servicios hosteleros" },
        purchaseAccount: { code: "600", name: "Compras de mercaderías (alimentación)" },
        purchaseSuppliersLabel: "proveedores de alimentos, bebidas y suministros",
        clientsLabel: "clientes individuales, empresas para eventos y agencias",
      };
    default: // Comercio
      return {
        inventoryNote: `INVENTARIO: empresa COMERCIAL. Compra y revende mercaderías (cta. 300). Incluye 2-3 líneas de productos representativos de la actividad.${activityNote}`,
        invoiceNote: `FACTURAS: empresa COMERCIAL — compra bienes para revenderlos.${activityNote}
  - Facturas de VENTA (type:"sale"): venta de mercaderías coherentes con la actividad a clientes. Cuenta: 700 (Ventas de mercaderías).
    journalNote: "700 → 477 + 430"; accountDebits: [430]; accountCredits: [700, 477]
  - Facturas de COMPRA (type:"purchase"): compra de mercaderías propias de la actividad a proveedores. Cuenta: 600 (Compras de mercaderías).
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
  const sectorCtx = getSectorContext(params.sector, params.taxRegime, params.activity);

  const prompt = `Genera el PERFIL COMERCIAL del universo contable usando este escenario:
${sc}

PERÍODO: ${periodStart} a ${periodEnd} (${numMonths} mes${numMonths > 1 ? "es" : ""})
RÉGIMEN FISCAL: ${params.taxRegime} (general ${rates.standard}%, reducido ${rates.reduced}%)
SECTOR: ${getActivityLabel(params)}

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

Importes realistas para ${getActivityLabel(params)}. Usa datos del escenario.`;

  return await callAI(client, model, prompt, 2500) as Record<string, unknown>;
}

// ─── CALL 2A-MONTHLY: MONTHLY BUNDLE (invoices + bank statement + card moves) ──
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

async function generateMonthlyBundle(
  params: GenerateParams,
  scenario: Record<string, unknown>,
  client: OpenAI,
  model: string,
  monthStart: string,
  monthEnd: string,
  monthLabel: string,
  invoicesPerMonth: number,
  invoiceStartNum: number,
  openingBalance: number,
): Promise<{ invoices: unknown[]; bankStatement: unknown; cardMovements: unknown[] }> {
  const rates = TAX_RATES[params.taxRegime];
  const sectorCtx = getSectorContext(params.sector, params.taxRegime, params.activity);

  const sectorSaleHint = params.sector === "Servicios"
    ? "servicios prestados (consultoría, diseño, formación), cta 705"
    : params.sector === "Industria"
    ? "productos fabricados, cta 701"
    : params.sector === "Hostelería"
    ? "hostelería/restauración, cta 705"
    : "mercaderías, cta 700";

  const sectorBuyHint = params.sector === "Servicios"
    ? "subcontratación/software/telefonía/oficina, cuentas 62x"
    : params.sector === "Industria"
    ? "materias primas/componentes, cta 601"
    : "mercaderías o alimentos, cta 600";

  const nums = Array.from({ length: invoicesPerMonth }, (_, i) =>
    `F-${params.year}/${String(invoiceStartNum + i).padStart(3, "0")}`
  );

  const saleAcc = sectorCtx.saleAccount;
  const buyAcc = sectorCtx.purchaseAccount;
  const iva = rates.standard;

  const prompt = `Datos contables de ${monthLabel} para "${scenario.companyName}" (${getActivityLabel(params)}, ${params.taxRegime}). Banco: ${scenario.bankEntity}, cta ${scenario.bankAccount}.
IVA ${iva}%. Ventas→${sectorSaleHint}. Compras→${sectorBuyHint}.

JSON exacto:
{"invoices":[{"invoiceNumber":"${nums[0]}","date":"${monthStart.slice(0,7)}-10","type":"sale","partyName":"Cliente SA","partyNif":"A11111111","lines":[{"description":"Descripción venta","quantity":1,"unitPrice":1000,"discount":0,"subtotal":1000,"taxRate":${iva},"taxAmount":${iva * 10},"total":${1000 + iva * 10}}],"subtotal":1000,"taxBase":1000,"taxAmount":${iva * 10},"total":${1000 + iva * 10},"paymentMethod":"transfer","dueDate":"${monthEnd}","accountDebits":[{"accountCode":"430","accountName":"Clientes","amount":${1000 + iva * 10},"description":"Factura venta"}],"accountCredits":[{"accountCode":"${saleAcc.code}","accountName":"${saleAcc.name}","amount":1000,"description":"Venta"},{"accountCode":"477","accountName":"IVA repercutido","amount":${iva * 10},"description":"IVA"}]}],"bankStatement":{"bank":"${scenario.bankEntity}","accountNumber":"${scenario.bankAccount}","period":"${monthLabel}","openingBalance":${openingBalance},"closingBalance":${openingBalance + 500},"transactions":[{"date":"${monthStart.slice(0,7)}-05","concept":"Cobro cliente","debit":null,"credit":1210,"balance":${openingBalance + 1210}},{"date":"${monthStart.slice(0,7)}-20","concept":"Pago proveedor","debit":726,"credit":null,"balance":${openingBalance + 484}}]},"cardMovements":[{"date":"${monthStart.slice(0,7)}-15","description":"Gasto empresa","amount":150,"category":"Servicios","accountCode":"629","accountName":"Otros servicios"}]}

GENERA: ${invoicesPerMonth} facturas (mezcla compra/venta, al menos 1 de cada), 4-5 transacciones bancarias y 2-3 movimientos tarjeta. Todas las fechas entre ${monthStart} y ${monthEnd}. Usa números de factura: ${nums.join(", ")}. Ventas→cta ${saleAcc.code}. Compras→cta ${buyAcc.code}. Saldo cierre = apertura ± transacciones.`;

  const result = await callAI(client, model, prompt, 3500) as Record<string, unknown>;
  return {
    invoices: Array.isArray(result.invoices) ? result.invoices : [],
    bankStatement: result.bankStatement ?? null,
    cardMovements: Array.isArray(result.cardMovements) ? result.cardMovements : [],
  };
}

// ─── CALL 2B: INSURANCE & CASUALTY (annual, small) ────────────────────────────
async function generateInsuranceCasualty(
  params: GenerateParams,
  scenario: Record<string, unknown>,
  client: OpenAI,
  model: string,
) {
  const { periodStart, periodEnd } = getPeriodInfo(params);

  // Insurance: policy paid at period start, covers 12 months. The part beyond periodEnd goes to cta 480 (prepaid).
  // Example: policy Jan 2025 paid Jan 2025, covers Jan 2025–Dec 2025 → no prepaid if period is full year.
  // But typical multi-risk policy often starts in first month and covers 12 months straddling two fiscal years.
  // For FP exercises: policy startDate = 2 months into period, endDate = start + 12 months → generates 480.
  const [pInsY, pInsM] = periodStart.split("-").map(Number);
  const insStartM = ((pInsM - 1 + 1) % 12) + 1; // start 1 month into period
  const insStartY = pInsY + Math.floor((pInsM - 1 + 1) / 12);
  const insEndM = ((insStartM - 1 + 11) % 12) + 1; // end 11 months later (12-month policy)
  const insEndY = insStartY + Math.floor((insStartM - 1 + 11) / 12);
  const insStartStr = `${insStartY}-${String(insStartM).padStart(2,"0")}-01`;
  const insEndLastDay = new Date(insEndY, insEndM, 0).getDate();
  const insEndStr = `${insEndY}-${String(insEndM).padStart(2,"0")}-${insEndLastDay}`;
  // Months of policy within current period vs next
  const periodEndDate = new Date(periodEnd);
  const insEndDate = new Date(insEndStr);
  const insStartDate = new Date(insStartStr);
  const totalPolicyDays = (insEndDate.getTime() - insStartDate.getTime()) / 86400000 + 1;
  const daysInPeriod = Math.max(0, (Math.min(periodEndDate.getTime(), insEndDate.getTime()) - insStartDate.getTime()) / 86400000 + 1);
  const annualPremium = 1800;
  const expenseCurrentPeriod = Math.round(annualPremium * daysInPeriod / totalPolicyDays);
  const prepaidNextPeriod = annualPremium - expenseCurrentPeriod;

  const prompt = `Genera seguros y siniestro para "${scenario.companyName}" (${getActivityLabel(params)}), período ${periodStart}–${periodEnd}.

JSON exacto:
{"insurancePolicies":[{"policyNumber":"SEG-${params.year}-001","insurer":"Mapfre Seguros","type":"Seguro multirriesgo","annualPremium":${annualPremium}.00,"startDate":"${insStartStr}","endDate":"${insEndStr}","expenseCurrentPeriod":${expenseCurrentPeriod}.00,"prepaidNextPeriod":${prepaidNextPeriod}.00,"journalNote":"Póliza ${insStartStr}–${insEndStr}. Prima total ${annualPremium}€ pagada al contado. Parte corriente (${expenseCurrentPeriod}€) → cta 625 (Primas de seguros). Parte anticipada del próximo ejercicio (${prepaidNextPeriod}€) → cta 480 (Gastos anticipados). Ajuste de periodificación obligatorio por PGC.","accountDebits":[{"accountCode":"625","accountName":"Primas de seguros","amount":${expenseCurrentPeriod}.00,"description":"Prima seguro multirriesgo ${params.year}"},{"accountCode":"480","accountName":"Gastos anticipados","amount":${prepaidNextPeriod}.00,"description":"Parte prima ${params.year + 1} (periodificación)"}],"accountCredits":[{"accountCode":"572","accountName":"Bancos","amount":${annualPremium}.00,"description":"Pago prima seguro"}]}],"casualtyEvent":{"date":"${periodStart.slice(0,7)}-15","description":"Incendio parcial en almacén — daños en equipos informáticos","assetAffected":"Equipos para procesos de información","bookValue":5000.00,"insuranceCompensation":3500.00,"netLoss":1500.00,"journalNote":"Siniestro: baja del bien (cta 217 Equipos informáticos) y su amortización acumulada (2817). Pérdida neta → 678 (Pérdidas por siniestros). Indemnización aseguradora → 430 (Clientes, cobro pendiente) y 778 (Ingresos excepcionales) al haber.","accountDebits":[{"accountCode":"678","accountName":"Pérdidas procedentes del inmovilizado material","amount":1500.00,"description":"Pérdida neta siniestro"},{"accountCode":"2817","accountName":"Amort. acum. equipos informáticos","amount":3500.00,"description":"Amortización acumulada baja"},{"accountCode":"430","accountName":"Clientes — aseguradora","amount":3500.00,"description":"Indemnización a cobrar Mapfre"}],"accountCredits":[{"accountCode":"217","accountName":"Equipos para procesos de información","amount":5000.00,"description":"Baja por siniestro — valor contable bruto"},{"accountCode":"778","accountName":"Ingresos excepcionales","amount":3500.00,"description":"Indemnización seguro reconocida"}]}}

Adapta descripción y actividad ${getActivityLabel(params)}. 1-2 pólizas de seguro realistas con periodificación (cta 480).`;

  return await callAI(client, model, prompt, 2000) as Record<string, unknown>;
}

// ─── CALL 2C: EXTRAORDINARY EXPENSES ──────────────────────────────────────────
async function generateExtraordinaryExpenses(
  params: GenerateParams,
  scenario: Record<string, unknown>,
  client: OpenAI,
  model: string,
) {
  const { periodStart, periodEnd } = getPeriodInfo(params);

  const prompt = `Genera gastos e ingresos extraordinarios para "${scenario.companyName}" (${getActivityLabel(params)}), período ${periodStart}–${periodEnd}.

Genera 2-4 partidas extraordinarias variadas. Tipos posibles:
- "multa": Multas y sanciones administrativas (cta 678 "Gastos excepcionales")
- "donacion": Donaciones realizadas (cta 678 "Gastos excepcionales")  
- "perdida_inmovilizado": Pérdida por venta/baja de inmovilizado (cta 671 "Pérdidas del inmovilizado material")
- "ingreso_extraordinario": Ingreso extraordinario como subvención, premio, etc. (cta 778 "Ingresos excepcionales" o 771 "Beneficios del inmovilizado material")
- "otro": Otros gastos/ingresos no recurrentes

JSON exacto:
{"extraordinaryExpenses":[
  {
    "date": "YYYY-MM-DD (dentro del período)",
    "type": "multa",
    "description": "Descripción clara de la partida",
    "amount": 500.00,
    "accountCode": "678",
    "accountName": "Gastos excepcionales",
    "counterpartAccountCode": "572",
    "counterpartAccountName": "Bancos c/c",
    "journalNote": "Explicación del asiento contable",
    "accountDebits": [{"accountCode":"678","accountName":"Gastos excepcionales","amount":500.00,"description":"Multa por..."}],
    "accountCredits": [{"accountCode":"572","accountName":"Bancos c/c","amount":500.00,"description":"Pago multa"}]
  }
]}

REGLAS:
- Incluye al menos 1 gasto y 1 ingreso extraordinario
- Los importes deben ser realistas para ${getActivityLabel(params)}
- Cada asiento DEBE cuadrar (sum debits = sum credits)
- Para pérdidas de inmovilizado: incluye baja del bien (21x) y amortización acumulada (281x)
- Para ingresos extraordinarios: contrapartida puede ser 572 (cobro) o 440 (deudor)
- Fechas distribuidas a lo largo del período`;

  return await callAI(client, model, prompt, 2000) as Record<string, unknown>;
}

// ─── WAREHOUSE CARD COMPUTATION (from invoices + inventory) ───────────────────
function computeWarehouseCards(universe: Record<string, unknown>): unknown[] {
  const inventory = universe.inventory as {
    initialInventory: Array<{ code: string; description: string; quantity: number; unitCost?: number; totalCost?: number; accountCode: string }>;
    finalInventory: Array<{ code: string; description: string; quantity: number; unitCost?: number; totalCost?: number; accountCode: string }>;
  } | undefined;
  const invoices = universe.invoices as Array<{
    invoiceNumber: string; date: string; type: string;
    lines: Array<{ description: string; quantity: number; unitPrice: number; subtotal: number }>;
  }> | undefined;

  if (!inventory?.initialInventory?.length) return [];

  const cards: unknown[] = [];

  for (const item of inventory.initialInventory) {
    const finalItem = inventory.finalInventory?.find(f => f.code === item.code);
    const initQty = item.quantity || 0;
    const initCost = item.unitCost || (item.totalCost && initQty ? item.totalCost / initQty : 0);
    const initTotal = item.totalCost || initQty * initCost;

    const movements: Array<Record<string, unknown>> = [];

    movements.push({
      date: "Existencias iniciales",
      concept: "Saldo inicial",
      document: "INV-INICIAL",
      entryQty: initQty,
      entryUnitCost: round2(initCost),
      entryTotal: round2(initTotal),
      exitQty: 0, exitUnitCost: 0, exitTotal: 0,
      balanceQty: initQty,
      balanceUnitCost: round2(initCost),
      balanceTotal: round2(initTotal),
    });

    let balQty = initQty;
    let balTotal = initTotal;

    if (invoices?.length) {
      const purchases = invoices
        .filter(inv => inv.type === "purchase")
        .sort((a, b) => a.date.localeCompare(b.date));

      for (const inv of purchases) {
        for (const line of inv.lines) {
          const desc = line.description?.toLowerCase() || "";
          const itemDesc = item.description?.toLowerCase() || "";
          const words = itemDesc.split(/\s+/).filter(w => w.length > 3);
          const matches = words.some(w => desc.includes(w));
          if (!matches) continue;

          const qty = line.quantity || 0;
          const cost = line.unitPrice || 0;
          const total = line.subtotal || qty * cost;

          balQty += qty;
          balTotal += total;
          const pmp = balQty > 0 ? balTotal / balQty : 0;

          movements.push({
            date: inv.date,
            concept: `Compra: ${line.description}`,
            document: inv.invoiceNumber,
            entryQty: qty,
            entryUnitCost: round2(cost),
            entryTotal: round2(total),
            exitQty: 0, exitUnitCost: 0, exitTotal: 0,
            balanceQty: balQty,
            balanceUnitCost: round2(pmp),
            balanceTotal: round2(balTotal),
          });
        }
      }

      const sales = invoices
        .filter(inv => inv.type === "sale")
        .sort((a, b) => a.date.localeCompare(b.date));

      for (const inv of sales) {
        for (const line of inv.lines) {
          const desc = line.description?.toLowerCase() || "";
          const itemDesc = item.description?.toLowerCase() || "";
          const words = itemDesc.split(/\s+/).filter(w => w.length > 3);
          const matches = words.some(w => desc.includes(w));
          if (!matches) continue;

          const qty = Math.min(line.quantity || 0, balQty);
          if (qty <= 0) continue;
          const pmp = balQty > 0 ? balTotal / balQty : 0;
          const exitTotal = qty * pmp;

          balQty -= qty;
          balTotal -= exitTotal;

          movements.push({
            date: inv.date,
            concept: `Venta: ${line.description}`,
            document: inv.invoiceNumber,
            entryQty: 0, entryUnitCost: 0, entryTotal: 0,
            exitQty: qty,
            exitUnitCost: round2(pmp),
            exitTotal: round2(exitTotal),
            balanceQty: balQty,
            balanceUnitCost: round2(balQty > 0 ? balTotal / balQty : 0),
            balanceTotal: round2(balTotal),
          });
        }
      }
    }

    if (finalItem) {
      const finalQty = finalItem.quantity || 0;
      const finalCost = finalItem.unitCost || (finalItem.totalCost && finalQty ? finalItem.totalCost / finalQty : 0);
      const finalTotal = finalItem.totalCost || finalQty * finalCost;
      const adjQty = finalQty - balQty;
      if (Math.abs(adjQty) > 0) {
        if (adjQty > 0) {
          balQty += adjQty;
          const adjTotal = adjQty * finalCost;
          balTotal += adjTotal;
          movements.push({
            date: "Regularización",
            concept: "Ajuste inventario final (sobrante)",
            document: "REG-FINAL",
            entryQty: adjQty, entryUnitCost: round2(finalCost), entryTotal: round2(adjTotal),
            exitQty: 0, exitUnitCost: 0, exitTotal: 0,
            balanceQty: finalQty, balanceUnitCost: round2(finalCost), balanceTotal: round2(finalTotal),
          });
        } else {
          const exitQty = Math.abs(adjQty);
          const pmp = balQty > 0 ? balTotal / balQty : finalCost;
          const exitTotal = exitQty * pmp;
          balQty -= exitQty;
          balTotal -= exitTotal;
          movements.push({
            date: "Regularización",
            concept: "Ajuste inventario final (faltante/merma)",
            document: "REG-FINAL",
            entryQty: 0, entryUnitCost: 0, entryTotal: 0,
            exitQty: exitQty, exitUnitCost: round2(pmp), exitTotal: round2(exitTotal),
            balanceQty: finalQty, balanceUnitCost: round2(finalCost), balanceTotal: round2(finalTotal),
          });
        }
      }
    }

    if (movements.length > 1) {
      cards.push({
        productCode: item.code,
        productDescription: item.description,
        accountCode: item.accountCode || "300",
        valuationMethod: "PMP (Precio Medio Ponderado)",
        movements,
      });
    }
  }

  return cards;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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
    // Nómina: devengada último día del mes, pagada ese mismo día (o primero del siguiente)
    const { periodStart: ps } = getPeriodInfo(params);
    const [psy, psm] = ps.split("-").map(Number);
    const payLastDay = new Date(psy, psm, 0).getDate();
    const payDate = `${psy}-${String(psm).padStart(2,"0")}-${payLastDay}`;
    sections.push(`"payroll": {
    "month": "${midMonthLabel}",
    "paymentDate": "${payDate}",
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
    "journalNote": "Nómina devengada y pagada el ${payDate}. 640 (sueldos) y 642 (SS empresa) al debe; 465 cancelada con 572 (pago neto), 4751 (IRPF pendiente Mod.111), 476 (SS pendiente TC1) al haber.",
    "accountDebits": [{"accountCode":"640","accountName":"Sueldos y salarios","amount":X,"description":"Nómina ${midMonthLabel}"},{"accountCode":"642","accountName":"SS a cargo empresa","amount":X,"description":"Cuota patronal ${midMonthLabel}"}],
    "accountCredits": [{"accountCode":"465","accountName":"Remuneraciones pendientes","amount":X,"description":"Salario neto a pagar"},{"accountCode":"4751","accountName":"HP acreedora IRPF retenciones","amount":X,"description":"Retención IRPF Mod.111"},{"accountCode":"476","accountName":"Organismos SS acreedores","amount":X,"description":"SS total cuota ${midMonthLabel}"}]
  }`);
  }

  if (withSS) {
    // Build per-month SS schedule: SS for month N is paid by end of month N+1
    const { periodStart, periodEnd } = getPeriodInfo(params);
    const [sy, sm] = periodStart.split("-").map(Number);
    const [ey, em] = periodEnd.split("-").map(Number);
    const ssDates: Array<{ month: string; devengado: string; dueDate: string }> = [];
    let y = sy, m = sm;
    while (y < ey || (y === ey && m <= em)) {
      const monthName = MONTHS_ES[m - 1];
      // Due date: last day of month m+1
      const dueMonth = m === 12 ? 1 : m + 1;
      const dueYear = m === 12 ? y + 1 : y;
      const lastDay = new Date(dueYear, dueMonth, 0).getDate(); // day 0 of next month = last day of dueMonth
      const dueDateStr = `${dueYear}-${String(dueMonth).padStart(2, "0")}-${lastDay}`;
      ssDates.push({
        month: `${monthName} ${y}`,
        devengado: `${y}-${String(m).padStart(2, "0")}-01`,
        dueDate: dueDateStr,
      });
      if (m === 12) { m = 1; y++; } else { m++; }
    }

    const ssTemplate = ssDates.map(d =>
      `{"month":"${d.month}","devengado":"${d.devengado}","dueDate":"${d.dueDate}","employeeCount":X,"totalGross":X,"ssEmployeeAmount":X,"ssEmployerAmount":X,"totalPayment":X,"journalNote":"Pago TC1 ${d.month}: 476 al debe, 572 al haber.","accountDebits":[{"accountCode":"476","accountName":"Organismos SS acreedores","amount":X,"description":"TC1 ${d.month}"}],"accountCredits":[{"accountCode":"572","accountName":"Bancos c/c","amount":X,"description":"Pago domiciliado SS ${d.month}"}]}`
    ).join(",\n    ");

    sections.push(`"socialSecurityPayments": [
    ${ssTemplate}
  ]`);
  } else {
    sections.push(`"socialSecurityPayments": []`);
  }

  if (withTax) {
    // Build quarterly VAT/IGIC schedule based on the actual period
    const taxModel = params.taxRegime === "IGIC" ? "420" : "303";
    const taxName = params.taxRegime;
    const yr = params.year;

    // Quarters: [label, quarterStart YYYY-MM-DD, dueDate YYYY-MM-DD]
    const allQuarters: Array<{ label: string; start: string; end: string; dueDate: string }> = [
      // T4 of previous year — paid Jan 20 of current year (first liquidation)
      { label: `T4/${yr - 1}`, start: `${yr - 1}-10-01`, end: `${yr - 1}-12-31`, dueDate: `${yr}-01-20` },
      { label: `T1/${yr}`,     start: `${yr}-01-01`,     end: `${yr}-03-31`,     dueDate: `${yr}-04-20` },
      { label: `T2/${yr}`,     start: `${yr}-04-01`,     end: `${yr}-06-30`,     dueDate: `${yr}-07-20` },
      { label: `T3/${yr}`,     start: `${yr}-07-01`,     end: `${yr}-09-30`,     dueDate: `${yr}-10-20` },
      { label: `T4/${yr}`,     start: `${yr}-10-01`,     end: `${yr}-12-31`,     dueDate: `${yr + 1}-01-20` },
    ];

    // Only include quarters that overlap with the period
    const { periodStart, periodEnd } = getPeriodInfo(params);
    // A quarter overlaps if its dueDate falls within or just after the period
    // Rule: include T4 prev year (opens Jan 20 of year) + any quarter whose quarter.start <= periodEnd
    const relevantQuarters = allQuarters.filter(q => q.dueDate >= periodStart && q.start <= periodEnd);

    const quarterLines = relevantQuarters.map(q =>
      `    {
      "model": "${taxModel}", "period": "${q.label}",
      "quarterStart": "${q.start}", "quarterEnd": "${q.end}", "dueDate": "${q.dueDate}",
      "taxableBase": X, "outputTax": X, "inputTax": X, "result": X, "paymentType": "ingreso",
      "journalNote": "Liquidación Mod.${taxModel} ${taxName} ${q.label} (vencimiento ${q.dueDate}): 477 (repercutido) menos 472 (soportado) = cuota (4750). Pago domiciliado en Bancos (572).",
      "accountDebits": [{"accountCode":"477","accountName":"${taxName} repercutido","amount":X,"description":"${taxName} devengado ${q.label}"},{"accountCode":"472","accountName":"${taxName} soportado","amount":X,"description":"${taxName} deducible ${q.label}"}],
      "accountCredits": [{"accountCode":"4750","accountName":"HP acreedora por ${taxName}","amount":X,"description":"Cuota neta ${q.label}"},{"accountCode":"572","accountName":"Bancos c/c","amount":X,"description":"Pago Mod.${taxModel} ${q.label}"}]
    },
    {
      "model": "111", "period": "${q.label}",
      "quarterStart": "${q.start}", "quarterEnd": "${q.end}", "dueDate": "${q.dueDate}",
      "taxableBase": X, "outputTax": X, "inputTax": 0, "result": X, "paymentType": "ingreso",
      "journalNote": "Mod.111 IRPF retenciones ${q.label} (vencimiento ${q.dueDate}): liquidación de retenciones sobre rendimientos del trabajo (nóminas) e IRPF de administradores. 4751 al debe, 572 al haber.",
      "accountDebits": [{"accountCode":"4751","accountName":"HP acreedora IRPF retenciones","amount":X,"description":"Retenciones nóminas + admin ${q.label}"}],
      "accountCredits": [{"accountCode":"572","accountName":"Bancos c/c","amount":X,"description":"Pago Mod.111 ${q.label}"}]
    }`
    ).join(",\n");

    sections.push(`"taxLiquidations": [
${quarterLines},
    {
      "model": "IS", "period": "Annual", "dueDate": "${yr + 1}-07-25",
      "taxableBase": X, "outputTax": X, "inputTax": 0, "result": X, "paymentType": "ingreso",
      "journalNote": "IS ejercicio ${yr} (vencimiento ${yr + 1}-07-25, 6 meses tras cierre dic): tipo general 25%. Gasto (630) al debe, HP acreedora IS (4752) al haber.",
      "accountDebits": [{"accountCode":"630","accountName":"Impuesto sobre beneficios","amount":X,"description":"IS ejercicio ${yr}"}],
      "accountCredits": [{"accountCode":"4752","accountName":"HP acreedora IS","amount":X,"description":"Cuota IS ${yr}"}]
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
    "propertyDescription": "Local comercial ${getActivityLabel(params)}",
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
    // Póliza: empieza en Q2 del período y dura 6 meses (dentro siempre del período)
    const { periodStart: ps2 } = getPeriodInfo(params);
    const [psy2, psm2] = ps2.split("-").map(Number);
    // Start: 2 months into the period; End: 5 months after start (6-month policy)
    const polStartM = ((psm2 - 1 + 2) % 12) + 1;
    const polStartY = psy2 + Math.floor((psm2 - 1 + 2) / 12);
    const polEndM = ((polStartM - 1 + 5) % 12) + 1;
    const polEndY = polStartY + Math.floor((polStartM - 1 + 5) / 12);
    const polEndLastDay = new Date(polEndY, polEndM, 0).getDate();
    const polStartStr = `${polStartY}-${String(polStartM).padStart(2,"0")}-01`;
    const polEndStr = `${polEndY}-${String(polEndM).padStart(2,"0")}-${polEndLastDay}`;
    const polMonths = 6;
    sections.push(`"creditPolicy": {
    "entity": "${String(scenario.bankEntity ?? "Banco Ejemplo")}",
    "policyNumber": "POL-${params.year}-001",
    "limit": ${limit}, "drawnAmount": ${drawn}, "annualRate": 5.5,
    "openingCommission": 150.00, "unusedCommission": ${Math.round((limit - drawn) * 0.005)},
    "startDate": "${polStartStr}", "endDate": "${polEndStr}",
    "durationMonths": ${polMonths},
    "interestAmount": ${Math.round(drawn * 0.055 * polMonths / 12)},
    "totalSettlement": ${Math.round(drawn * 0.055 * polMonths / 12 + 150 + (limit - drawn) * 0.005)},
    "journalNote": "Póliza de crédito ${polStartStr}–${polEndStr}. Apertura: 5201 al haber (límite dispuesto), 572 al debe. Liquidación al vencimiento: 663 (intereses sobre saldo medio dispuesto) y 626 (comisión apertura + no disposición) al debe; 572 al haber.",
    "accountDebits": [{"accountCode":"663","accountName":"Intereses de deudas","amount":${Math.round(drawn * 0.055 * polMonths / 12)},"description":"Intereses saldo dispuesto ${polStartStr}–${polEndStr}"},{"accountCode":"626","accountName":"Servicios bancarios y similares","amount":${Math.round(150 + (limit - drawn) * 0.005)},"description":"Comisión apertura + no disposición"}],
    "accountCredits": [{"accountCode":"5201","accountName":"Deudas CP póliza de crédito","amount":${Math.round(drawn * 0.055 * polMonths / 12 + 150 + (limit - drawn) * 0.005)},"description":"Liquidación total póliza"}]
  }`);
  }

  if (withFixedAssets) {
    // Depreciation prorated to actual period length (not always 12 months)
    const mobCost = 8500, mobLife = 10;
    const eqCost = 4200, eqLife = 4;
    const mobAnnual = mobCost / mobLife;
    const eqAnnual = eqCost / eqLife;
    // Prorate by months in period
    const mobPeriod = Math.round(mobAnnual * numMonths / 12 * 100) / 100;
    const eqPeriod = Math.round(eqAnnual * numMonths / 12 * 100) / 100;
    const mobNBV = Math.round((mobCost - mobPeriod) * 100) / 100;
    const eqNBV = Math.round((eqCost - eqPeriod) * 100) / 100;
    const periodLabel2 = numMonths === 12 ? "ejercicio completo" : `${numMonths} meses`;
    sections.push(`"fixedAssets": [
    {
      "code": "AE-001", "description": "Mobiliario de oficina",
      "purchaseDate": "${periodStart}", "purchaseCost": ${mobCost}.00, "usefulLifeYears": ${mobLife},
      "annualDepreciation": ${mobAnnual.toFixed(2)}, "periodDepreciation": ${mobPeriod.toFixed(2)}, "periodMonths": ${numMonths},
      "accumulatedDepreciation": ${mobPeriod.toFixed(2)}, "netBookValue": ${mobNBV.toFixed(2)},
      "depreciationMethod": "Lineal",
      "assetAccountCode": "216", "accDepreciationCode": "2816", "depExpenseCode": "681",
      "journalNote": "Amortización lineal mobiliario: ${mobCost}€ / ${mobLife} años = ${mobAnnual.toFixed(2)}€/año × ${numMonths}/12 meses = ${mobPeriod.toFixed(2)}€ (${periodLabel2}). 681 al debe, 2816 al haber.",
      "accountDebits": [{"accountCode":"681","accountName":"Amortización inmovilizado material","amount":${mobPeriod.toFixed(2)},"description":"Dotación amortización mobiliario ${periodLabel2}"}],
      "accountCredits": [{"accountCode":"2816","accountName":"Amort. acum. mobiliario","amount":${mobPeriod.toFixed(2)},"description":"Amortización acumulada"}]
    },
    {
      "code": "AE-002", "description": "Equipos para procesos de información",
      "purchaseDate": "${periodStart}", "purchaseCost": ${eqCost}.00, "usefulLifeYears": ${eqLife},
      "annualDepreciation": ${eqAnnual.toFixed(2)}, "periodDepreciation": ${eqPeriod.toFixed(2)}, "periodMonths": ${numMonths},
      "accumulatedDepreciation": ${eqPeriod.toFixed(2)}, "netBookValue": ${eqNBV.toFixed(2)},
      "depreciationMethod": "Lineal",
      "assetAccountCode": "217", "accDepreciationCode": "2817", "depExpenseCode": "681",
      "journalNote": "Amortización lineal equipos informáticos: ${eqCost}€ / ${eqLife} años = ${eqAnnual.toFixed(2)}€/año × ${numMonths}/12 meses = ${eqPeriod.toFixed(2)}€ (${periodLabel2}). Vida útil fiscal máx. 4 años (tabla amortización TRLIS). 681 al debe, 2817 al haber.",
      "accountDebits": [{"accountCode":"681","accountName":"Amortización inmovilizado material","amount":${eqPeriod.toFixed(2)},"description":"Dotación amortización equipos ${periodLabel2}"}],
      "accountCredits": [{"accountCode":"2817","accountName":"Amort. acum. equipos informáticos","amount":${eqPeriod.toFixed(2)},"description":"Amortización acumulada"}]
    }
  ]`);
  } else {
    sections.push(`"fixedAssets": []`);
  }

  const prompt = `Genera el BLOQUE DE OPERACIONES del universo contable.

ESCENARIO (usa estos datos para coherencia):
${sc}

PERÍODO: ${periodStart} a ${periodEnd} | SECTOR: ${getActivityLabel(params)} | ${params.taxRegime} general ${rates.standard}%
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

  return await callAI(client, model, prompt, 6000) as Record<string, unknown>;
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
    const irpfOnDividends = Math.round(totalDividends * 0.19);
    const netDividendsAfterIrpf = totalDividends - irpfOnDividends;
    const perShare = fin.totalShares ? (totalDividends / fin.totalShares) : 0;
    // Junta General: hasta 6 meses tras cierre ejercicio. Cierre dic → máximo 30 junio.
    // Pago dividendos: 15 julio. Mod.123 (retención dividendos): trimestre Q3 → vence 20 octubre.
    sections.push(`"dividendDistribution": {
    "fiscalYear": ${params.year - 1},
    "approvalDate": "${params.year}-06-30",
    "paymentDate": "${params.year}-07-15",
    "mod123DueDate": "${params.year}-10-20",
    "totalNetProfit": ${netProfit},
    "legalReserve": ${legalReserve},
    "voluntaryReserve": ${voluntaryReserve},
    "totalDividends": ${totalDividends},
    "irpfWithholdingRate": 19,
    "irpfWithholdingAmount": ${irpfOnDividends},
    "netDividendPaid": ${netDividendsAfterIrpf},
    "dividendPerShare": ${perShare.toFixed(2)},
    "perShareholder": [GENERA para cada socio del escenario: name, percentage, grossDividend, irpfWithholdingRate(19), irpfWithholdingAmount, netDividend],
    "journalNote": "Distribución resultado ejercicio ${params.year - 1}: (1) Reserva Legal mín. 10% hasta alcanzar 20% capital social → cta 112; (2) Reservas voluntarias → cta 113; (3) Dividendos acordados en Junta General Ordinaria (${params.year}-06-30, plazo máx. 6 meses tras cierre) → cta 526 (Dividendo activo a pagar). PAGO ${params.year}-07-15: 526 al debe; 572 (neto pagado) y 4751 (retención IRPF 19%) al haber. Mod.123 retenciones dividendos → presentar antes del ${params.year}-10-20 (T3).",
    "accountDebits": [{"accountCode":"129","accountName":"Resultado del ejercicio","amount":${netProfit},"description":"Aplicación resultado ${params.year - 1}"}],
    "accountCredits": [{"accountCode":"112","accountName":"Reserva legal","amount":${legalReserve},"description":"Dotación reserva legal 10%"},{"accountCode":"113","accountName":"Reservas voluntarias","amount":${voluntaryReserve},"description":"Reserva voluntaria"},{"accountCode":"526","accountName":"Dividendo activo a pagar","amount":${totalDividends},"description":"Dividendos brutos aprobados Junta"}],
    "paymentEntry": {
      "date": "${params.year}-07-15",
      "journalNote": "Pago dividendos: 526 al debe; 572 (neto) y 4751 (retención 19% IRPF, Mod.123 T3) al haber.",
      "accountDebits": [{"accountCode":"526","accountName":"Dividendo activo a pagar","amount":${totalDividends},"description":"Dividendos brutos"}],
      "accountCredits": [{"accountCode":"572","accountName":"Bancos c/c","amount":${netDividendsAfterIrpf},"description":"Dividendo neto pagado"},{"accountCode":"4751","accountName":"HP acreedora IRPF retenciones","amount":${irpfOnDividends},"description":"Retención IRPF 19% Mod.123 T3"}]
    }
  }`);
  }

  if (sections.length === 0) return {};

  const prompt = `Genera el BLOQUE DE PATRIMONIO del universo contable.

ESCENARIO:
${sc}

PERÍODO: ${periodStart} a ${periodEnd} | RÉGIMEN: ${params.taxRegime} | SECTOR: ${getActivityLabel(params)}

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
  onProgress?: (msg: string) => void,
) {
  const { periodStart, periodEnd, numMonths } = getPeriodInfo(params);
  const opsPerMonth = params.operationsPerMonth ?? 8;
  const totalTarget = opsPerMonth * numMonths;
  const level = params.educationLevel ?? "Medio";

  const sc = JSON.stringify({
    companyName: scenario.companyName,
    sector: params.sector,
    taxRegime: params.taxRegime,
    year: params.year,
    bankEntity: scenario.bankEntity,
    bankAccount: scenario.bankAccount,
  }, null, 0);

  const sectorCtxJ = getSectorContext(params.sector, params.taxRegime, params.activity);
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

  const ENTRIES_PER_CHUNK = 20;
  const chunks: Array<{ start: string; end: string; count: number }> = [];

  if (totalTarget <= ENTRIES_PER_CHUNK) {
    chunks.push({ start: periodStart, end: periodEnd, count: totalTarget });
  } else {
    const numChunks = Math.ceil(totalTarget / ENTRIES_PER_CHUNK);
    const monthsPerChunk = Math.max(1, Math.floor(numMonths / numChunks));
    const startDate = new Date(periodStart);
    const endDateFull = new Date(periodEnd);
    let remaining = totalTarget;

    for (let i = 0; i < numChunks; i++) {
      const chunkStart = new Date(startDate);
      chunkStart.setMonth(chunkStart.getMonth() + i * monthsPerChunk);
      if (chunkStart > endDateFull) break;

      let chunkEnd: Date;
      if (i === numChunks - 1) {
        chunkEnd = endDateFull;
      } else {
        chunkEnd = new Date(startDate);
        chunkEnd.setMonth(chunkEnd.getMonth() + (i + 1) * monthsPerChunk);
        chunkEnd.setDate(chunkEnd.getDate() - 1);
        if (chunkEnd > endDateFull) chunkEnd = endDateFull;
      }

      const chunkCount = (i === numChunks - 1)
        ? remaining
        : Math.min(ENTRIES_PER_CHUNK, remaining);
      remaining -= chunkCount;

      chunks.push({
        start: chunkStart.toISOString().slice(0, 10),
        end: chunkEnd.toISOString().slice(0, 10),
        count: chunkCount,
      });
    }
  }

  console.log(`[journal] Total: ${totalTarget} asientos en ${chunks.length} lotes`);

  const basePrompt = (chunkStart: string, chunkEnd: string, count: number, startNum: number) =>
    `Genera el LIBRO DIARIO (journalEntries) del universo contable.

EMPRESA: ${sc}
PERÍODO DE ESTOS ASIENTOS: ${chunkStart} a ${chunkEnd}
NIVEL: ${level === "Superior" ? "FP Grado Superior (incluye periodificaciones, ajustes de ejercicio)" : "FP Grado Medio"}

SECTOR ${getActivityLabel(params).toUpperCase()} — CUENTAS OBLIGATORIAS:
- Ventas: cuenta ${sectorCtxJ.saleAccount.code} (${sectorCtxJ.saleAccount.name}) — NO usar 700 si el sector es Servicios o Hostelería
- Compras: cuenta ${sectorCtxJ.purchaseAccount.code} (${sectorCtxJ.purchaseAccount.name})
${params.sector === "Servicios" ? "- Esta empresa NO vende bienes físicos — los asientos de ventas deben reflejar servicios prestados (705)" : ""}

OPERACIONES: ${enabledOps.join(", ")}

Genera EXACTAMENTE ${count} asientos del ${chunkStart} al ${chunkEnd}. Numera desde ${startNum}.

JSON: {"journalEntries":[{"entryNumber":"${startNum}","date":"YYYY-MM-DD","concept":"Máx 6 palabras","document":"REF","debits":[{"accountCode":"XXX","accountName":"Cuenta PGC","amount":0.00}],"credits":[{"accountCode":"XXX","accountName":"Cuenta PGC","amount":0.00}],"totalAmount":0.00}]}

REGLAS:
- sum(débitos)=sum(créditos)=totalAmount en cada asiento
- Orden cronológico, cuentas PGC 3-4 dígitos
- Máx 2 líneas débito y 2 crédito por asiento
- NO campo "description" — solo accountCode, accountName, amount
- Conceptos breves (máx 6 palabras)`;

  const allEntries: unknown[] = [];
  let startNum = 1;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (onProgress) onProgress(`Libro diario: lote ${i + 1} de ${chunks.length} (asientos ${startNum}–${startNum + chunk.count - 1})`);
    console.log(`[journal] Lote ${i + 1}/${chunks.length}: ${chunk.start} a ${chunk.end}, ${chunk.count} asientos (desde #${startNum})`);
    const result = await callAI(client, model, basePrompt(chunk.start, chunk.end, chunk.count, startNum), 8192) as Record<string, unknown>;
    const entries = (result as { journalEntries?: unknown[] }).journalEntries;
    if (Array.isArray(entries)) {
      allEntries.push(...entries);
      startNum += entries.length;
    }
  }

  console.log(`[journal] Total generados: ${allEntries.length} asientos`);
  return { journalEntries: allEntries };
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

export type ProgressCallback = (message: string) => void;

export async function generateAccountingUniverse(params: GenerateParams, aiConfig: AiConfig, onProgress?: ProgressCallback): Promise<unknown> {
  const client = getClient(aiConfig);
  const model = getModel(aiConfig);
  const progress = onProgress ?? (() => {});

  progress("Generando escenario inicial...");
  const scenario = await generateScenario(params, client, model);
  progress("Escenario creado. Generando bloques contables...");

  const withEquity =
    params.includeShareholdersInfo !== false ||
    (params.includeInitialBalance !== false && params.isNewCompany !== true) ||
    params.includeShareholderAccounts !== false ||
    (params.includeDividends !== false && params.isNewCompany !== true);

  const opsPerMonth = params.operationsPerMonth ?? 8;
  const invoicesPerMonth = Math.max(2, Math.min(Math.ceil(opsPerMonth * 0.3), 4));

  const months = getMonthsInPeriod(params);
  let invoiceNum = 1;
  let rollingBalance = 20000;
  const monthlyBundlePromises = months.map((m) => {
    const startNum = invoiceNum;
    invoiceNum += invoicesPerMonth;
    const balance = rollingBalance;
    rollingBalance += Math.floor(Math.random() * 4000) - 1000;
    return generateMonthlyBundle(
      params, scenario, client, model,
      m.start, m.end, m.label,
      invoicesPerMonth, startNum, balance,
    ).then((r) => { progress(`Facturas ${m.label} completadas`); return r; });
  });

  const blockNames = ["Perfil comercial", "Seguros", "Extraordinarios", "Operaciones", "Libro diario"];
  const blockPromises: Promise<Record<string, unknown>>[] = [
    generateCommercialBlock(params, scenario, client, model).then((r) => { progress("Perfil comercial completado"); return r; }),
    generateInsuranceCasualty(params, scenario, client, model).then((r) => { progress("Seguros completados"); return r; }),
    generateExtraordinaryExpenses(params, scenario, client, model).then((r) => { progress("Extraordinarios completados"); return r; }),
    generateOperationsBlock(params, scenario, client, model).then((r) => { progress("Operaciones completadas"); return r; }),
    generateJournalBlock(params, scenario, client, model, progress).then((r) => { progress("Libro diario completado"); return r; }),
  ];
  if (withEquity) {
    blockPromises.push(generateEquityBlock(params, scenario, client, model).then((r) => { progress("Capital y socios completado"); return r; }));
  }

  const [blocks, monthlyResults] = await Promise.all([
    Promise.all(blockPromises),
    Promise.all(monthlyBundlePromises),
  ]);

  // Phase 3: Merge annual blocks
  const universe: Record<string, unknown> = {};
  for (const block of blocks) {
    if (block && typeof block === "object") {
      Object.assign(universe, block);
    }
  }

  if (universe.companyProfile && typeof universe.companyProfile === "object") {
    (universe.companyProfile as Record<string, unknown>).activity = params.activity || null;
  }

  // Merge monthly bundles
  const allInvoices: unknown[] = [];
  const allBankStatements: unknown[] = [];
  const allCardMovements: unknown[] = [];

  for (const result of monthlyResults) {
    if (result.invoices?.length) allInvoices.push(...result.invoices);
    if (result.bankStatement) allBankStatements.push(result.bankStatement);
    if (result.cardMovements?.length) allCardMovements.push(...result.cardMovements);
  }

  universe.invoices = allInvoices;
  universe.bankStatements = allBankStatements;

  // Build creditCardStatement from collected monthly movements
  const totalCardCharges = allCardMovements.reduce(
    (sum, m: unknown) => sum + ((m as Record<string, unknown>).amount as number || 0), 0
  );
  universe.creditCardStatement = {
    cardNumber: "**** **** **** 1234",
    entity: scenario.bankEntity,
    statementPeriod: `Ejercicio ${params.year}`,
    movements: allCardMovements,
    totalCharges: Math.round(totalCardCharges * 100) / 100,
    settlementDate: months[months.length - 1]?.end ?? `${params.year}-12-31`,
    journalNote: "Cada gasto con tarjeta: gasto (xxx) a deuda (5201). Al pago bancario: 5201 a 572.",
    accountDebits: [{ accountCode: "629", accountName: "Otros servicios", amount: totalCardCharges, description: "Gastos tarjeta ejercicio" }],
    accountCredits: [{ accountCode: "5201", accountName: "Deudas tarjeta crédito", amount: totalCardCharges, description: "Total liquidado" }],
  };

  // Phase 4: Build bank debit notes programmatically from all payment events
  universe.bankDebitNotes = buildBankDebitNotes(universe, scenario, params);

  // Phase 5: Compute warehouse cards (fichas de almacén) from invoices + inventory
  if (params.sector !== "Servicios") {
    const warehouseCards = computeWarehouseCards(universe);
    if (warehouseCards.length > 0) {
      universe.warehouseCards = warehouseCards;
    }
  }

  return universe;
}

// ─── BANK DEBIT NOTES BUILDER ─────────────────────────────────────────────────
function buildBankDebitNotes(
  universe: Record<string, unknown>,
  scenario: Record<string, unknown>,
  params: GenerateParams,
): unknown[] {
  const notes: Array<{
    id: string;
    date: string;
    concept: string;
    reference: string;
    beneficiary: string;
    amount: number;
    category: string;
    accountDebits: Array<{ accountCode: string; accountName: string; amount: number; description: string }>;
    accountCredits: Array<{ accountCode: string; accountName: string; amount: number; description: string }>;
    journalNote: string;
  }> = [];

  let seq = 1;
  const bankEntity = String(scenario.bankEntity ?? "Entidad Bancaria");
  const year = params.year;

  function nextRef(prefix: string) {
    return `NDC-${year}-${prefix}-${String(seq++).padStart(3, "0")}`;
  }

  // 1. SS / TC1 payments (one per month)
  const ssPayments = Array.isArray(universe.socialSecurityPayments) ? universe.socialSecurityPayments : [];
  for (const ss of ssPayments) {
    const s = ss as Record<string, unknown>;
    const amount = Number(s.totalPayment ?? 0);
    if (!amount) continue;
    notes.push({
      id: `ss-${s.month}`,
      date: String(s.dueDate ?? ""),
      concept: `Adeudo TC1 Seguridad Social — ${s.month}`,
      reference: nextRef("SS"),
      beneficiary: "Tesorería General de la Seguridad Social (TGSS)",
      amount,
      category: "Seguridad Social",
      accountDebits: [{ accountCode: "476", accountName: "Organismos SS acreedores", amount, description: `TC1 ${s.month}` }],
      accountCredits: [{ accountCode: "572", accountName: "Bancos c/c", amount, description: "Cargo domiciliado TGSS" }],
      journalNote: `Pago TC1 ${s.month}: cancelación deuda 476 (SS total empresa + trabajador) mediante adeudo bancario en cuenta corriente (572).`,
    });
  }

  // 2. Tax liquidations — IVA/IGIC (Mod.303/420) and IRPF (Mod.111)
  const taxLiqs = Array.isArray(universe.taxLiquidations) ? universe.taxLiquidations : [];
  for (const liq of taxLiqs) {
    const l = liq as Record<string, unknown>;
    const amount = Number(l.result ?? 0);
    if (!amount || amount <= 0) continue;
    const model = String(l.model ?? "");
    const period = String(l.period ?? "");
    if (model === "IS") {
      notes.push({
        id: `is-${year}`,
        date: String(l.dueDate ?? `${year + 1}-07-25`),
        concept: `Adeudo Mod.200 Impuesto sobre Sociedades ejercicio ${year}`,
        reference: nextRef("IS"),
        beneficiary: "Agencia Tributaria (AEAT)",
        amount,
        category: "Impuesto Sociedades",
        accountDebits: [{ accountCode: "4752", accountName: "HP acreedora IS", amount, description: `IS ejercicio ${year}` }],
        accountCredits: [{ accountCode: "572", accountName: "Bancos c/c", amount, description: "Pago Mod.200" }],
        journalNote: `Pago IS ejercicio ${year} (Mod.200): cancelación 4752 mediante adeudo en cuenta (572). Tipo general 25%.`,
      });
    } else if (model === "111") {
      notes.push({
        id: `irpf-${period}`,
        date: String(l.dueDate ?? ""),
        concept: `Adeudo Mod.111 IRPF retenciones rendimientos trabajo ${period}`,
        reference: nextRef("111"),
        beneficiary: "Agencia Tributaria (AEAT)",
        amount,
        category: "IRPF Mod.111",
        accountDebits: [{ accountCode: "4751", accountName: "HP acreedora IRPF retenciones", amount, description: `Retenciones nóminas ${period}` }],
        accountCredits: [{ accountCode: "572", accountName: "Bancos c/c", amount, description: `Pago Mod.111 ${period}` }],
        journalNote: `Pago Mod.111 ${period}: ingreso en Hacienda de las retenciones de IRPF practicadas sobre nóminas y administradores. 4751 al debe, 572 al haber.`,
      });
    } else {
      // IVA/IGIC Mod.303/420
      notes.push({
        id: `iva-${period}`,
        date: String(l.dueDate ?? ""),
        concept: `Adeudo Mod.${model} ${params.taxRegime} ${period}`,
        reference: nextRef(model),
        beneficiary: model === "420" ? "Hacienda Canaria (ACAT)" : "Agencia Tributaria (AEAT)",
        amount,
        category: `${params.taxRegime} Mod.${model}`,
        accountDebits: [{ accountCode: "4750", accountName: `HP acreedora por ${params.taxRegime}`, amount, description: `Cuota ${period}` }],
        accountCredits: [{ accountCode: "572", accountName: "Bancos c/c", amount, description: `Pago Mod.${model} ${period}` }],
        journalNote: `Pago Mod.${model} ${params.taxRegime} ${period}: liquidación trimestral. Cancelación 4750 mediante cargo bancario (572).`,
      });
    }
  }

  // 3. Bank loan installments (amortization table)
  const loan = universe.bankLoan as Record<string, unknown> | undefined;
  if (loan?.amortizationTable && Array.isArray(loan.amortizationTable)) {
    for (const row of loan.amortizationTable as Array<Record<string, unknown>>) {
      const installment = Number(row.installment ?? row.cuota ?? 0);
      const interest = Number(row.interest ?? row.intereses ?? 0);
      const principal = Number(row.principal ?? row.capital ?? 0);
      if (!installment) continue;
      notes.push({
        id: `loan-${row.period ?? row.period}`,
        date: String(row.date ?? ""),
        concept: `Cuota préstamo bancario — cuota ${row.period}`,
        reference: nextRef("PRE"),
        beneficiary: bankEntity,
        amount: installment,
        category: "Préstamo Bancario",
        accountDebits: [
          { accountCode: "170", accountName: "Deudas LP entidades crédito", amount: principal, description: "Amortización capital" },
          { accountCode: "662", accountName: "Intereses de deudas", amount: interest, description: "Intereses préstamo" },
        ],
        accountCredits: [{ accountCode: "572", accountName: "Bancos c/c", amount: installment, description: `Cuota ${row.period} préstamo` }],
        journalNote: `Cuota préstamo ${row.period}: amortización de capital (170/520) e intereses (662) al debe; 572 al haber. Cuota: ${installment}€ = capital ${principal}€ + intereses ${interest}€.`,
      });
    }
  }

  // 4. Mortgage installments
  const mortgage = universe.mortgage as Record<string, unknown> | undefined;
  if (mortgage?.amortizationTable && Array.isArray(mortgage.amortizationTable)) {
    for (const row of mortgage.amortizationTable as Array<Record<string, unknown>>) {
      const installment = Number(row.installment ?? row.cuota ?? 0);
      const interest = Number(row.interest ?? row.intereses ?? 0);
      const principal = Number(row.principal ?? row.capital ?? 0);
      if (!installment) continue;
      notes.push({
        id: `hip-${row.period}`,
        date: String(row.date ?? ""),
        concept: `Cuota hipoteca — cuota ${row.period}`,
        reference: nextRef("HIP"),
        beneficiary: bankEntity,
        amount: installment,
        category: "Hipoteca",
        accountDebits: [
          { accountCode: "170", accountName: "Deudas LP hipoteca", amount: principal, description: "Amortización capital" },
          { accountCode: "662", accountName: "Intereses hipoteca", amount: interest, description: "Intereses hipotecarios" },
        ],
        accountCredits: [{ accountCode: "572", accountName: "Bancos c/c", amount: installment, description: `Cuota ${row.period} hipoteca` }],
        journalNote: `Cuota hipoteca ${row.period}: capital (170/521) e intereses (662) al debe; 572 al haber. Total: ${installment}€ = capital ${principal}€ + intereses ${interest}€.`,
      });
    }
  }

  // 5. Insurance premium
  const insurances = Array.isArray(universe.insurancePolicies) ? universe.insurancePolicies : [];
  for (const ins of insurances) {
    const i = ins as Record<string, unknown>;
    const premium = Number(i.annualPremium ?? 0);
    if (!premium) continue;
    notes.push({
      id: `seg-${i.policyNumber}`,
      date: String(i.startDate ?? ""),
      concept: `Prima seguro ${i.type ?? "multirriesgo"} — póliza ${i.policyNumber}`,
      reference: nextRef("SEG"),
      beneficiary: String(i.insurer ?? "Compañía Aseguradora"),
      amount: premium,
      category: "Seguros",
      accountDebits: [
        { accountCode: "625", accountName: "Primas de seguros", amount: Number(i.expenseCurrentPeriod ?? premium), description: "Prima corriente ejercicio" },
        ...(Number(i.prepaidNextPeriod ?? 0) > 0 ? [{
          accountCode: "480", accountName: "Gastos anticipados", amount: Number(i.prepaidNextPeriod), description: "Periodificación ejercicio siguiente",
        }] : []),
      ],
      accountCredits: [{ accountCode: "572", accountName: "Bancos c/c", amount: premium, description: `Pago prima póliza ${i.policyNumber}` }],
      journalNote: `Pago prima seguro (póliza ${i.policyNumber}): ${premium}€. Parte corriente ${i.expenseCurrentPeriod ?? premium}€ → 625. Periodificación ${i.prepaidNextPeriod ?? 0}€ → 480 (gasto anticipado ejercicio siguiente).`,
    });
  }

  // 6. Credit policy settlement
  const policy = universe.creditPolicy as Record<string, unknown> | undefined;
  if (policy?.totalSettlement) {
    const amount = Number(policy.totalSettlement);
    notes.push({
      id: "poliza-liquidacion",
      date: String(policy.endDate ?? ""),
      concept: `Liquidación póliza de crédito — ${policy.policyNumber}`,
      reference: nextRef("POL"),
      beneficiary: bankEntity,
      amount,
      category: "Póliza de Crédito",
      accountDebits: [
        { accountCode: "663", accountName: "Intereses de deudas", amount: Number(policy.interestAmount ?? 0), description: "Intereses saldo dispuesto" },
        { accountCode: "626", accountName: "Servicios bancarios", amount: Number(policy.openingCommission ?? 0) + Number(policy.unusedCommission ?? 0), description: "Comisiones bancarias" },
      ],
      accountCredits: [{ accountCode: "572", accountName: "Bancos c/c", amount, description: "Liquidación póliza crédito" }],
      journalNote: `Liquidación póliza crédito ${policy.policyNumber} al vencimiento (${policy.endDate}). Intereses (663) + comisiones (626) al debe; adeudo total ${amount}€ en cuenta corriente (572) al haber.`,
    });
  }

  // 7. Payroll net payment
  const payroll = universe.payroll as Record<string, unknown> | undefined;
  if (payroll?.totalNetSalary) {
    const amount = Number(payroll.totalNetSalary);
    notes.push({
      id: "nomina-pago",
      date: String(payroll.paymentDate ?? ""),
      concept: `Pago nómina neta — ${payroll.month}`,
      reference: nextRef("NOM"),
      beneficiary: "Empleados (transferencia bancaria individual)",
      amount,
      category: "Nóminas",
      accountDebits: [{ accountCode: "465", accountName: "Remuneraciones pendientes de pago", amount, description: `Salario neto ${payroll.month}` }],
      accountCredits: [{ accountCode: "572", accountName: "Bancos c/c", amount, description: "Transferencia salario neto" }],
      journalNote: `Pago nómina ${payroll.month}: cancelación 465 (salario neto pendiente) mediante transferencias individuales a empleados. 465 al debe, 572 al haber. Importe total: ${amount}€.`,
    });
  }

  // 8. Dividend payment (net)
  const div = universe.dividendDistribution as Record<string, unknown> | undefined;
  if (div?.netDividendPaid) {
    const netAmount = Number(div.netDividendPaid);
    const grossAmount = Number(div.totalDividends ?? netAmount);
    const irpfAmount = Number(div.irpfWithholdingAmount ?? 0);
    notes.push({
      id: "dividendos-pago",
      date: String(div.paymentDate ?? ""),
      concept: `Pago dividendos netos ejercicio ${div.fiscalYear} — Mod.123`,
      reference: nextRef("DIV"),
      beneficiary: "Socios — transferencia bancaria",
      amount: netAmount,
      category: "Dividendos",
      accountDebits: [{ accountCode: "526", accountName: "Dividendo activo a pagar", amount: grossAmount, description: `Dividendos brutos ejercicio ${div.fiscalYear}` }],
      accountCredits: [
        { accountCode: "572", accountName: "Bancos c/c", amount: netAmount, description: "Importe neto a socios" },
        { accountCode: "4751", accountName: "HP acreedora IRPF retenciones", amount: irpfAmount, description: `Retención 19% IRPF — Mod.123 (vence ${div.mod123DueDate})` },
      ],
      journalNote: `Pago dividendos: ${grossAmount}€ brutos. Retención IRPF 19% (${irpfAmount}€) → 4751 (Mod.123 a presentar ${div.mod123DueDate}). Neto pagado a socios: ${netAmount}€ → 572.`,
    });
  }

  // Sort by date ascending
  notes.sort((a, b) => a.date.localeCompare(b.date));

  return notes;
}
