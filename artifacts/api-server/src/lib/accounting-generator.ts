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
  accountDigits?: number | null;
}

interface AiConfig {
  provider: string;
  deepseekApiKey?: string;
  deepseekBaseUrl?: string;
  deepseekModel?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
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
  const isReasoningModel = model.startsWith("gpt-5") || model.startsWith("o1") || model.startsWith("o3") || model.startsWith("o4");
  const effectiveTokens = isReasoningModel ? maxTokens * 4 : maxTokens;
  const tokenParam = isReasoningModel
    ? { max_completion_tokens: effectiveTokens }
    : { max_tokens: maxTokens };
  const response = await client.chat.completions.create({
    model,
    ...tokenParam,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Eres un experto contable español especializado en el Plan General Contable (PGC). Responde ÚNICAMENTE con JSON válido, sin texto adicional. PROHIBIDO usar bloques de código markdown (```). Empieza directamente con { y termina con }.",
      },
      { role: "user", content: prompt },
    ],
  });

  const choice = response.choices[0];
  const finishReason = choice?.finish_reason;
  const content = choice?.message?.content;
  console.log(`[callAI] model=${model}, finish_reason=${finishReason}, content_length=${content?.length ?? 0}, refusal=${(choice?.message as any)?.refusal ?? 'none'}`);
  if (!content || content.trim() === "") {
    const refusal = (choice?.message as any)?.refusal;
    console.error(`[callAI] Empty content. Full response:`, JSON.stringify(response, null, 2).slice(0, 1000));
    throw new Error(refusal ? `La IA rechazó la solicitud: ${refusal}` : "La IA no devolvió contenido. Verifica tu API key y modelo.");
  }

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
    "postalCode": "(del escenario)",
    "phone": "(del escenario)",
    "email": "(del escenario)",
    "sector": "${params.sector}",
    "taxRegime": "${params.taxRegime}",
    "fiscalYear": ${params.year},
    "description": "(del escenario)",
    "companyType": "SL",
    "legalForm": "(del escenario)",
    "registrationInfo": "Inscrita en el Registro Mercantil de (ciudad), Tomo ..., Folio ..., Hoja ..."
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
): Promise<{ invoices: unknown[]; cardMovements: unknown[] }> {
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

  const prompt = `Datos contables de ${monthLabel} para "${scenario.companyName}" (${getActivityLabel(params)}, ${params.taxRegime}).
IVA ${iva}%. Ventas→${sectorSaleHint}. Compras→${sectorBuyHint}.

JSON exacto:
{"invoices":[{"invoiceNumber":"${nums[0]}","date":"${monthStart.slice(0,7)}-10","type":"sale","partyName":"Cliente SA","partyNif":"A11111111","lines":[{"description":"Descripción venta","quantity":1,"unitPrice":1000,"discount":0,"subtotal":1000,"taxRate":${iva},"taxAmount":${iva * 10},"total":${1000 + iva * 10}}],"subtotal":1000,"taxBase":1000,"taxAmount":${iva * 10},"total":${1000 + iva * 10},"paymentMethod":"transfer","dueDate":"${monthEnd}","accountDebits":[{"accountCode":"430","accountName":"Clientes","amount":${1000 + iva * 10},"description":"Factura venta"}],"accountCredits":[{"accountCode":"${saleAcc.code}","accountName":"${saleAcc.name}","amount":1000,"description":"Venta"},{"accountCode":"477","accountName":"IVA repercutido","amount":${iva * 10},"description":"IVA"}]}],"cardMovements":[{"date":"${monthStart.slice(0,7)}-15","description":"Gasto empresa","amount":150,"category":"Servicios","accountCode":"629","accountName":"Otros servicios"}]}

GENERA: ${invoicesPerMonth} facturas (mezcla compra/venta, al menos 1 de cada) y 2-3 movimientos tarjeta. Todas las fechas entre ${monthStart} y ${monthEnd}. Usa números de factura: ${nums.join(", ")}. Ventas→cta ${saleAcc.code}. Compras→cta ${buyAcc.code}. NO generes extracto bancario (se construye automáticamente).`;

  const result = await callAI(client, model, prompt, 3500) as Record<string, unknown>;
  return {
    invoices: Array.isArray(result.invoices) ? result.invoices : [],
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
{"insurancePolicies":[{"policyNumber":"SEG-${params.year}-001","insurer":"Mapfre Seguros","type":"Seguro multirriesgo","annualPremium":${annualPremium}.00,"startDate":"${insStartStr}","endDate":"${insEndStr}","expenseCurrentPeriod":${expenseCurrentPeriod}.00,"prepaidNextPeriod":${prepaidNextPeriod}.00,"journalNote":"Póliza ${insStartStr}–${insEndStr}. Prima total ${annualPremium}€ pagada al contado. Parte corriente (${expenseCurrentPeriod}€) → cta 625 (Primas de seguros). Parte anticipada del próximo ejercicio (${prepaidNextPeriod}€) → cta 480 (Gastos anticipados). Ajuste de periodificación obligatorio por PGC.","accountDebits":[{"accountCode":"625","accountName":"Primas de seguros","amount":${expenseCurrentPeriod}.00,"description":"Prima seguro multirriesgo ${params.year}"},{"accountCode":"480","accountName":"Gastos anticipados","amount":${prepaidNextPeriod}.00,"description":"Parte prima ${params.year + 1} (periodificación)"}],"accountCredits":[{"accountCode":"572","accountName":"Bancos","amount":${annualPremium}.00,"description":"Pago prima seguro"}]}],"casualtyEvent":{"date":"${periodStart.slice(0,7)}-15","description":"Incendio parcial en almacén — daños en equipos informáticos","assetAffected":"Equipos para procesos de información","bookValue":5000.00,"insuranceCompensation":3500.00,"netLoss":1500.00,"journalNote":"Siniestro: baja del bien (217 Equipos informáticos) y su amortización acumulada (2817). Pérdida neta → 671 (Pérdidas procedentes del inmovilizado material). Indemnización aseguradora → 440 (Deudores varios) al debe; si supera valor neto contable, diferencia a 778 (Ingresos excepcionales) al haber.","accountDebits":[{"accountCode":"671","accountName":"Pérdidas procedentes del inmovilizado material","amount":1500.00,"description":"Pérdida neta por siniestro"},{"accountCode":"2817","accountName":"Amort. acum. equipos informáticos","amount":3500.00,"description":"Amortización acumulada baja siniestro"},{"accountCode":"440","accountName":"Deudores varios","amount":3500.00,"description":"Indemnización a cobrar aseguradora"}],"accountCredits":[{"accountCode":"217","accountName":"Equipos para procesos de información","amount":5000.00,"description":"Baja por siniestro — valor contable bruto"},{"accountCode":"778","accountName":"Ingresos excepcionales","amount":3500.00,"description":"Indemnización seguro reconocida"}]}}

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

  const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  function matchLine(lineDesc: string, itemDesc: string, itemCode: string): boolean {
    const ld = normalize(lineDesc);
    const id = normalize(itemDesc);
    const ic = normalize(itemCode);
    if (ld.includes(id) || id.includes(ld)) return true;
    if (ic && ld.includes(ic)) return true;
    const words = id.split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return false;
    const matchCount = words.filter(w => ld.includes(w)).length;
    return matchCount >= Math.max(1, Math.ceil(words.length * 0.5));
  }

  const cards: unknown[] = [];
  const invArr = invoices ?? [];

  for (const item of inventory.initialInventory) {
    const finalItem = inventory.finalInventory?.find(f => f.code === item.code);
    const initQty = item.quantity || 0;
    const initCost = item.unitCost || (item.totalCost && initQty ? item.totalCost / initQty : 0);
    const initTotal = item.totalCost || initQty * initCost;

    const allOps: Array<{
      date: string; type: "purchase" | "sale"; lineDesc: string;
      invoiceNumber: string; qty: number; unitCost: number; total: number;
    }> = [];

    for (const inv of invArr) {
      if (inv.type !== "purchase" && inv.type !== "sale") continue;
      for (const line of inv.lines) {
        if (!matchLine(line.description || "", item.description, item.code)) continue;
        allOps.push({
          date: inv.date,
          type: inv.type as "purchase" | "sale",
          lineDesc: line.description,
          invoiceNumber: inv.invoiceNumber,
          qty: line.quantity || 0,
          unitCost: line.unitPrice || 0,
          total: line.subtotal || (line.quantity || 0) * (line.unitPrice || 0),
        });
      }
    }

    allOps.sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      if (dc !== 0) return dc;
      return a.type === "purchase" ? -1 : 1;
    });

    const movements: Array<Record<string, unknown>> = [];
    let balQty = initQty;
    let balTotal = round2(initTotal);

    movements.push({
      date: "Existencias iniciales",
      concept: "Saldo inicial",
      document: "INV-INICIAL",
      entryQty: initQty,
      entryUnitCost: round2(initCost),
      entryTotal: round2(initTotal),
      exitQty: 0, exitUnitCost: 0, exitTotal: 0,
      balanceQty: balQty,
      balanceUnitCost: round2(initCost),
      balanceTotal: round2(balTotal),
    });

    for (const op of allOps) {
      if (op.type === "purchase") {
        balQty += op.qty;
        balTotal = round2(balTotal + op.total);
        const pmp = balQty > 0 ? balTotal / balQty : 0;
        movements.push({
          date: op.date,
          concept: `Compra: ${op.lineDesc}`,
          document: op.invoiceNumber,
          entryQty: op.qty,
          entryUnitCost: round2(op.unitCost),
          entryTotal: round2(op.total),
          exitQty: 0, exitUnitCost: 0, exitTotal: 0,
          balanceQty: balQty,
          balanceUnitCost: round2(pmp),
          balanceTotal: round2(balTotal),
        });
      } else {
        const qty = Math.min(op.qty, balQty);
        if (qty <= 0) continue;
        const pmp = balQty > 0 ? balTotal / balQty : 0;
        const exitTotal = round2(qty * pmp);
        balQty -= qty;
        balTotal = round2(balTotal - exitTotal);
        movements.push({
          date: op.date,
          concept: `Venta: ${op.lineDesc}`,
          document: op.invoiceNumber,
          entryQty: 0, entryUnitCost: 0, entryTotal: 0,
          exitQty: qty,
          exitUnitCost: round2(pmp),
          exitTotal: exitTotal,
          balanceQty: balQty,
          balanceUnitCost: round2(balQty > 0 ? balTotal / balQty : 0),
          balanceTotal: round2(balTotal),
        });
      }
    }

    if (finalItem) {
      const finalQty = finalItem.quantity || 0;
      const finalCost = finalItem.unitCost || (finalItem.totalCost && finalQty ? finalItem.totalCost / finalQty : 0);
      const finalTotal = finalItem.totalCost || finalQty * finalCost;
      const adjQty = finalQty - balQty;
      if (Math.abs(adjQty) > 0.001) {
        if (adjQty > 0) {
          balQty += adjQty;
          const adjTotal = round2(adjQty * finalCost);
          balTotal = round2(balTotal + adjTotal);
          movements.push({
            date: "Regularización",
            concept: "Ajuste inventario final (sobrante)",
            document: "REG-FINAL",
            entryQty: adjQty, entryUnitCost: round2(finalCost), entryTotal: adjTotal,
            exitQty: 0, exitUnitCost: 0, exitTotal: 0,
            balanceQty: finalQty, balanceUnitCost: round2(finalCost), balanceTotal: round2(finalTotal),
          });
        } else {
          const exitQty = Math.abs(adjQty);
          const pmp = balQty > 0 ? balTotal / balQty : finalCost;
          const exitTotal = round2(exitQty * pmp);
          balQty -= exitQty;
          balTotal = round2(balTotal - exitTotal);
          movements.push({
            date: "Regularización",
            concept: "Ajuste inventario final (faltante/merma)",
            document: "REG-FINAL",
            entryQty: 0, entryUnitCost: 0, entryTotal: 0,
            exitQty: exitQty, exitUnitCost: round2(pmp), exitTotal: exitTotal,
            balanceQty: finalQty, balanceUnitCost: round2(finalCost), balanceTotal: round2(finalTotal),
          });
        }
      }
    }

    if (movements.length > 1) {
      const totalEntries = movements.reduce((s, m) => s + Number(m.entryQty ?? 0), 0) - initQty;
      const totalExits = movements.reduce((s, m) => s + Number(m.exitQty ?? 0), 0);
      const lastMov = movements[movements.length - 1];
      console.log(`[almacén] Ficha ${item.code} "${item.description}": `
        + `ini=${initQty} + entradas=${totalEntries} - salidas=${totalExits} = saldo=${lastMov.balanceQty} `
        + `(${movements.length - 1} movimientos de ${allOps.length} ops encontradas en facturas)`);

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

// ─── AMORTIZATION TABLE (French system) & LP/CP CLASSIFICATION ───────────────
interface AmortRow {
  period: number;
  date: string;
  installment: number;
  interest: number;
  principal: number;
  balance: number;
}

function buildFrenchAmortization(
  totalPrincipal: number,
  annualRate: number,
  termMonths: number,
  startDate: string,
): AmortRow[] {
  const monthlyRate = annualRate / 100 / 12;
  const installment = monthlyRate > 0
    ? round2(totalPrincipal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -termMonths)))
    : round2(totalPrincipal / termMonths);

  const rows: AmortRow[] = [];
  let balance = totalPrincipal;
  const [sy, sm, sd] = startDate.split("-").map(Number);

  for (let i = 1; i <= termMonths; i++) {
    const interest = round2(balance * monthlyRate);
    const principalPaid = round2(i === termMonths ? balance : installment - interest);
    balance = round2(balance - principalPaid);
    if (balance < 0) balance = 0;

    const payMonth = sm - 1 + i;
    const payYear = sy + Math.floor(payMonth / 12);
    const payM = (payMonth % 12) + 1;
    const lastDay = new Date(payYear, payM, 0).getDate();
    const payDay = Math.min(sd || 20, lastDay);

    rows.push({
      period: i,
      date: `${payYear}-${String(payM).padStart(2, "0")}-${String(payDay).padStart(2, "0")}`,
      installment: round2(principalPaid + interest),
      interest,
      principal: principalPaid,
      balance,
    });
  }
  return rows;
}

function classifyDebtLpCp(
  amortRows: AmortRow[],
  cutoffDate: string,
): { shortTermPrincipal: number; longTermPrincipal: number } {
  const cutoff = new Date(cutoffDate);
  const oneYearLater = new Date(cutoff);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

  let shortTermPrincipal = 0;
  for (const row of amortRows) {
    const rowDate = new Date(row.date);
    if (rowDate > cutoff && rowDate <= oneYearLater) {
      shortTermPrincipal += row.principal;
    }
  }
  shortTermPrincipal = round2(shortTermPrincipal);

  const totalRemaining = amortRows.length > 0
    ? round2(amortRows.filter(r => new Date(r.date) > cutoff).reduce((s, r) => s + r.principal, 0))
    : 0;
  const longTermPrincipal = round2(totalRemaining - shortTermPrincipal);

  return { shortTermPrincipal, longTermPrincipal };
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
    "journalNote": "Devengo nómina ${midMonthLabel}: DEBE 640 (bruto) + 642 (SS patronal ≈30.40%); HABER 476 (SS obrera 6.35% + SS patronal 30.40% = cuota total TC1), 4751 (retención IRPF), 465 (neto = bruto − SS obrera − IRPF). Pago: DEBE 465, HABER 572. Pago TC1 mes siguiente: DEBE 476, HABER 572. Pago Mod.111 trimestral: DEBE 4751, HABER 572.",
    "accountDebits": [{"accountCode":"640","accountName":"Sueldos y salarios","amount":"BRUTO_TOTAL","description":"Nómina ${midMonthLabel}"},{"accountCode":"642","accountName":"SS a cargo de la empresa","amount":"SS_PATRONAL (≈30.40% del bruto)","description":"Cuota patronal ${midMonthLabel}"}],
    "accountCredits": [{"accountCode":"476","accountName":"Organismos de la SS acreedores","amount":"SS_OBRERA + SS_PATRONAL (cuota total TC1)","description":"SS total ${midMonthLabel}"},{"accountCode":"4751","accountName":"HP acreedora por retenciones practicadas","amount":"IRPF_RETENIDO","description":"Retención IRPF Mod.111"},{"accountCode":"465","accountName":"Remuneraciones pendientes de pago","amount":"NETO (bruto − SS obrera − IRPF)","description":"Salario neto a pagar"}]
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
      "journalNote": "Liquidación Mod.${taxModel} ${taxName} ${q.label} (vencimiento ${q.dueDate}): DEBE 477 (repercutido), HABER 472 (soportado), HABER 4750 (cuota a ingresar = 477−472). Pago posterior: DEBE 4750, HABER 572.",
      "accountDebits": [{"accountCode":"477","accountName":"${taxName} repercutido","amount":X,"description":"Cancelar ${taxName} repercutido ${q.label}"}],
      "accountCredits": [{"accountCode":"472","accountName":"${taxName} soportado","amount":X,"description":"Cancelar ${taxName} soportado ${q.label}"},{"accountCode":"4750","accountName":"HP acreedora por ${taxName}","amount":X,"description":"Cuota neta ${q.label}"}]
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
    const loanStart = String(fin.loanStartDate ?? periodStart);
    const loanAmort = buildFrenchAmortization(p, r, t, loanStart);
    const loanMonthly = loanAmort[0]?.installment ?? 0;
    const { shortTermPrincipal: loanCP, longTermPrincipal: loanLP } = classifyDebtLpCp(loanAmort, loanStart);
    const loanAmortSlice = loanAmort.filter(row => row.date >= periodStart && row.date <= periodEnd);
    const loanAmortJson = JSON.stringify(loanAmortSlice.length > 0 ? loanAmortSlice : loanAmort.slice(0, 12));
    const loanReclassDate = `${params.year}-12-31`;
    const { shortTermPrincipal: loanCPReclass } = classifyDebtLpCp(loanAmort, loanReclassDate);
    const loanLPReclass = round2(loanAmort.filter(r => new Date(r.date) > new Date(loanReclassDate)).reduce((s, r) => s + r.principal, 0) - loanCPReclass);
    sections.push(`"bankLoan": {
    "entity": "${String(scenario.bankEntity ?? "Banco Ejemplo")}",
    "loanNumber": "PRE-${params.year}-001",
    "principal": ${p}, "annualRate": ${r}, "termMonths": ${t},
    "startDate": "${loanStart}",
    "monthlyInstallment": ${loanMonthly},
    "initialClassification": {"longTerm170": ${loanLP}, "shortTerm5200": ${loanCP}},
    "reclassification31Dec": {"date": "${loanReclassDate}", "longTerm170": ${loanLPReclass > 0 ? loanLPReclass : 0}, "shortTerm5200": ${loanCPReclass}},
    "amortizationTable": ${loanAmortJson},
    "journalNote": "FORMALIZACIÓN: DEBE 572 (${p}€ recibidos), HABER 170 Deudas a LP (${loanLP}€) + 5200 Préstamos a CP (${loanCP}€ = capital a devolver próximos 12 meses). PAGO CUOTA MENSUAL: DEBE 5200 (capital amortizado) + 662 (intereses devengados), HABER 572. RECLASIFICACIÓN 31/12: DEBE 170, HABER 5200 (traspasar de LP a CP el capital a devolver en los próximos 12 meses = ${loanCPReclass}€).",
    "formalizationEntry": {
      "accountDebits": [{"accountCode":"572","accountName":"Bancos c/c","amount":${p},"description":"Recepción préstamo bancario"}],
      "accountCredits": [{"accountCode":"170","accountName":"Deudas a LP con entidades de crédito","amount":${loanLP},"description":"Principal LP (vencimiento > 12 meses)"},{"accountCode":"5200","accountName":"Préstamos a CP de entidades de crédito","amount":${loanCP},"description":"Principal CP (vencimiento ≤ 12 meses)"}]
    },
    "installmentEntry": {
      "journalNote": "Cuota mensual (ejemplo cuota 1): DEBE 5200 (${loanAmort[0]?.principal ?? 0}€ capital) + 662 (${loanAmort[0]?.interest ?? 0}€ intereses), HABER 572 (${loanMonthly}€ total). Las proporciones varían cada mes según cuadro de amortización.",
      "accountDebits": [{"accountCode":"5200","accountName":"Préstamos a CP de entidades de crédito","amount":${loanAmort[0]?.principal ?? 0},"description":"Amortización capital (ej. cuota 1)"},{"accountCode":"662","accountName":"Intereses de deudas con entidades de crédito","amount":${loanAmort[0]?.interest ?? 0},"description":"Intereses devengados (ej. cuota 1)"}],
      "accountCredits": [{"accountCode":"572","accountName":"Bancos c/c","amount":${loanMonthly},"description":"Pago cuota préstamo"}]
    },
    "reclassificationEntry": {
      "journalNote": "Reclasificación al cierre 31/12: traspasar de LP (170) a CP (5200) el capital que vence en los próximos 12 meses.",
      "accountDebits": [{"accountCode":"170","accountName":"Deudas a LP con entidades de crédito","amount":${loanCPReclass},"description":"Reclasificación LP→CP próximos 12 meses"}],
      "accountCredits": [{"accountCode":"5200","accountName":"Préstamos a CP de entidades de crédito","amount":${loanCPReclass},"description":"Capital que vence en próximos 12 meses"}]
    }
  }`);
  }

  if (withMortgage) {
    const mp = fin.mortgagePrincipal ?? 180000;
    const mr = fin.mortgageRate ?? 3.2;
    const mt = fin.mortgageTermMonths ?? 240;
    const hipStart = String(fin.mortgageStartDate ?? periodStart);
    const hipAmort = buildFrenchAmortization(mp, mr, mt, hipStart);
    const hipMonthly = hipAmort[0]?.installment ?? 0;
    const { shortTermPrincipal: hipCP, longTermPrincipal: hipLP } = classifyDebtLpCp(hipAmort, hipStart);
    const hipAmortSlice = hipAmort.filter(row => row.date >= periodStart && row.date <= periodEnd);
    const hipAmortJson = JSON.stringify(hipAmortSlice.length > 0 ? hipAmortSlice : hipAmort.slice(0, 12));
    const hipReclassDate = `${params.year}-12-31`;
    const { shortTermPrincipal: hipCPReclass } = classifyDebtLpCp(hipAmort, hipReclassDate);
    const propertyValue = Math.round(mp * 1.4);
    const terreno = Math.round(propertyValue * 0.2);
    const construccion = propertyValue - terreno;
    const entrada = round2(propertyValue - hipLP - hipCP);
    sections.push(`"mortgage": {
    "entity": "${String(scenario.bankEntity ?? "CaixaBank")}",
    "loanNumber": "HIP-${params.year}-001",
    "propertyDescription": "Local comercial ${getActivityLabel(params)}",
    "propertyValue": ${propertyValue},
    "principal": ${mp}, "annualRate": ${mr}, "termMonths": ${mt},
    "startDate": "${hipStart}",
    "monthlyInstallment": ${hipMonthly},
    "initialClassification": {"longTerm170": ${hipLP}, "shortTerm5200": ${hipCP}},
    "reclassification31Dec": {"date": "${hipReclassDate}", "shortTerm5200": ${hipCPReclass}},
    "amortizationTable": ${hipAmortJson},
    "journalNote": "ADQUISICIÓN INMUEBLE CON HIPOTECA: (1) Alta activo: DEBE 220 Terrenos (${terreno}€) + 221 Construcciones (${construccion}€). HABER 170 Deudas LP (${hipLP}€) + 5200 Préstamos CP (${hipCP}€) + 572 Bancos (${entrada}€ entrada). (2) CUOTA MENSUAL: DEBE 5200 (capital) + 662 (intereses), HABER 572. (3) RECLASIFICACIÓN 31/12: DEBE 170, HABER 5200 (${hipCPReclass}€ = capital que vence próximos 12 meses).",
    "acquisitionEntry": {
      "accountDebits": [{"accountCode":"220","accountName":"Terrenos y bienes naturales","amount":${terreno},"description":"Terreno local comercial"},{"accountCode":"221","accountName":"Construcciones","amount":${construccion},"description":"Edificio local comercial"}],
      "accountCredits": [{"accountCode":"170","accountName":"Deudas a LP con entidades de crédito","amount":${hipLP},"description":"Hipoteca LP (vencimiento > 12 meses)"},{"accountCode":"5200","accountName":"Préstamos a CP de entidades de crédito","amount":${hipCP},"description":"Hipoteca CP (vencimiento ≤ 12 meses)"},{"accountCode":"572","accountName":"Bancos c/c","amount":${entrada},"description":"Entrada + gastos escritura"}]
    },
    "installmentEntry": {
      "journalNote": "Cuota mensual hipoteca (ejemplo cuota 1): DEBE 5200 (${hipAmort[0]?.principal ?? 0}€ capital) + 662 (${hipAmort[0]?.interest ?? 0}€ intereses), HABER 572 (${hipMonthly}€ total). Las proporciones varían cada mes según cuadro de amortización.",
      "accountDebits": [{"accountCode":"5200","accountName":"Préstamos a CP de entidades de crédito","amount":${hipAmort[0]?.principal ?? 0},"description":"Amortización capital hipoteca (ej. cuota 1)"},{"accountCode":"662","accountName":"Intereses de deudas con entidades de crédito","amount":${hipAmort[0]?.interest ?? 0},"description":"Intereses hipotecarios (ej. cuota 1)"}],
      "accountCredits": [{"accountCode":"572","accountName":"Bancos c/c","amount":${hipMonthly},"description":"Pago cuota hipoteca"}]
    },
    "reclassificationEntry": {
      "journalNote": "Reclasificación al cierre 31/12: traspasar de LP (170) a CP (5200) el capital hipotecario que vence en los próximos 12 meses.",
      "accountDebits": [{"accountCode":"170","accountName":"Deudas a LP con entidades de crédito","amount":${hipCPReclass},"description":"Reclasificación hipoteca LP→CP"}],
      "accountCredits": [{"accountCode":"5200","accountName":"Préstamos a CP de entidades de crédito","amount":${hipCPReclass},"description":"Capital hipoteca próximos 12 meses"}]
    }
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
    "journalNote": "Póliza de crédito ${polStartStr}–${polEndStr}. (1) Apertura y disposición: DEBE 572, HABER 5201 (saldo dispuesto). (2) Comisión apertura: DEBE 626, HABER 572. (3) Liquidación periódica intereses: DEBE 662 (intereses de deudas), HABER 572. (4) Comisión no disposición: DEBE 626, HABER 572. (5) Cancelación al vencimiento: DEBE 5201, HABER 572 (devolución saldo dispuesto).",
    "accountDebits": [{"accountCode":"572","accountName":"Bancos c/c","amount":${drawn},"description":"Disposición póliza crédito"}],
    "accountCredits": [{"accountCode":"5201","accountName":"Deudas a CP — póliza de crédito","amount":${drawn},"description":"Saldo dispuesto póliza"}]
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
    const priorYear = params.year - 1;
    sections.push(`"initialBalanceSheet": {
    "date": "${periodStart}",
    "priorYearEndDate": "${priorYear}-12-31",
    "priorYear": ${priorYear},
    "description": "Balance de Situación Final del ejercicio ${priorYear} — Base del asiento de apertura ${params.year}",
    "nonCurrentAssets": [{"accountCode":"XXX","accountName":"...","amount":X}],
    "currentAssets": [{"accountCode":"300","accountName":"Mercaderías","amount":X},{"accountCode":"430","accountName":"Clientes","amount":X},{"accountCode":"572","accountName":"Bancos c/c","amount":X}],
    "equity": [{"accountCode":"100","accountName":"Capital social","amount":X},{"accountCode":"112","accountName":"Reserva legal","amount":X},{"accountCode":"129","accountName":"Resultado del ejercicio","amount":X}],
    "nonCurrentLiabilities": [{"accountCode":"170","accountName":"Deudas LP entidades crédito","amount":X}],
    "currentLiabilities": [{"accountCode":"400","accountName":"Proveedores","amount":X},{"accountCode":"477","accountName":"${params.taxRegime} repercutido","amount":X}],
    "totalAssets": X,
    "totalEquityAndLiabilities": X,
    "journalNote": "Asiento de apertura: reproduce el Balance de Situación Final a 31/12/${priorYear}. Se cargan (DEBE) todos los activos y se abonan (HABER) todos los pasivos y el patrimonio neto. Total Activo = Total Pasivo + PN.",
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
    "accountDebits": [{"accountCode":"640","accountName":"Sueldos y salarios","amount":1500.00,"description":"Retribución órgano de administración"}],
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
function buildDocumentSummary(universe: Record<string, unknown>): string {
  const sections: string[] = [];

  const invoices = Array.isArray(universe.invoices) ? universe.invoices : [];
  if (invoices.length > 0) {
    const invLines = ["FACTURAS GENERADAS:"];
    for (const inv of invoices) {
      const i = inv as Record<string, unknown>;
      const type = i.type === "sale" ? "Venta" : i.type === "rectificativa" ? "Rectificativa" : "Compra";
      invLines.push(`  ${i.invoiceNumber} | ${type} | ${i.date} | ${i.partyName ?? ""} | Base: ${i.taxBase}€ | Total: ${i.total}€`);
    }
    sections.push(invLines.join("\n"));
  }

  const bankStatements = Array.isArray(universe.bankStatements) ? universe.bankStatements : [];
  if (bankStatements.length > 0) {
    const bsLines = ["EXTRACTOS BANCARIOS:"];
    for (const bs of bankStatements) {
      const b = bs as Record<string, unknown>;
      const txns = Array.isArray(b.transactions) ? b.transactions : [];
      bsLines.push(`  ${b.period}: ${txns.length} movimientos, saldo final ${b.closingBalance}€`);
      for (const t of txns) {
        const tx = t as Record<string, unknown>;
        const amt = Number(tx.credit ?? 0) - Number(tx.debit ?? 0);
        bsLines.push(`    ${tx.date} | ${tx.concept} | ${amt >= 0 ? "+" : ""}${amt}€`);
      }
    }
    sections.push(bsLines.join("\n"));
  }

  const monthlyPayrolls = Array.isArray(universe.monthlyPayrolls) ? universe.monthlyPayrolls : [];
  if (monthlyPayrolls.length > 0) {
    const prLines = ["NÓMINAS MENSUALES:"];
    for (const mp of monthlyPayrolls) {
      const m = mp as Record<string, unknown>;
      prLines.push(`  ${m.monthLabel}: Bruto ${m.totalGross}€ | SS patronal ${m.totalSsEmployer}€ | Neto ${m.totalNetSalary}€ | Devengo: ${m.devDate} | Pago: ${m.payDate}`);
    }
    const firstPayroll = monthlyPayrolls[0] as Record<string, unknown>;
    const employees = Array.isArray(firstPayroll?.employees) ? firstPayroll.employees : [];
    if (employees.length > 0) {
      prLines.push("  Empleados:");
      for (const emp of employees) {
        const e = emp as Record<string, unknown>;
        prLines.push(`    ${e.name} | Bruto: ${e.grossSalary}€ | Neto: ${e.netSalary}€`);
      }
    }
    sections.push(prLines.join("\n"));
  } else {
    const payroll = universe.payroll as Record<string, unknown> | undefined;
    if (payroll) {
      const prLines = ["NÓMINA:"];
      const employees = Array.isArray(payroll.employees) ? payroll.employees : [];
      prLines.push(`  Mes: ${payroll.month} | Pago: ${payroll.paymentDate}`);
      for (const emp of employees) {
        const e = emp as Record<string, unknown>;
        prLines.push(`  ${e.name} | Bruto: ${e.grossSalary}€ | Neto: ${e.netSalary}€ | SS obrera: ${e.ssEmployeeAmount}€ | IRPF: ${e.irpfAmount}€`);
      }
      prLines.push(`  Totales: Bruto ${payroll.totalGross}€ | SS patronal ${payroll.totalSsEmployer}€ | Neto ${payroll.totalNetSalary}€`);
      sections.push(prLines.join("\n"));
    }
  }

  const ssPayments = Array.isArray(universe.socialSecurityPayments) ? universe.socialSecurityPayments : [];
  if (ssPayments.length > 0) {
    const ssLines = ["PAGOS TC1 SEGURIDAD SOCIAL:"];
    for (const s of ssPayments) {
      const ss = s as Record<string, unknown>;
      ssLines.push(`  ${ss.month} | Vto: ${ss.dueDate} | Total: ${ss.totalPayment}€`);
    }
    sections.push(ssLines.join("\n"));
  }

  const taxLiq = Array.isArray(universe.taxLiquidations) ? universe.taxLiquidations : [];
  if (taxLiq.length > 0) {
    const txLines = ["LIQUIDACIONES FISCALES:"];
    for (const t of taxLiq) {
      const tx = t as Record<string, unknown>;
      txLines.push(`  Mod.${tx.model} | ${tx.period} | Resultado: ${tx.result}€ | Vto: ${tx.dueDate}`);
    }
    sections.push(txLines.join("\n"));
  }

  const loan = universe.bankLoan as Record<string, unknown> | undefined;
  if (loan && Array.isArray(loan.amortizationTable)) {
    const lnLines = [`PRÉSTAMO BANCARIO: ${loan.loanNumber} | Principal: ${loan.principal}€ | Cuota mensual: ${loan.monthlyInstallment}€`];
    for (const row of loan.amortizationTable as Array<Record<string, unknown>>) {
      lnLines.push(`  ${row.date} | Capital: ${row.principal}€ | Intereses: ${row.interest}€ | Cuota: ${row.installment}€`);
    }
    sections.push(lnLines.join("\n"));
  }

  const mortgage = universe.mortgage as Record<string, unknown> | undefined;
  if (mortgage && Array.isArray(mortgage.amortizationTable)) {
    const mtLines = [`HIPOTECA: ${mortgage.loanNumber} | Principal: ${mortgage.principal}€ | Cuota mensual: ${mortgage.monthlyInstallment}€`];
    for (const row of mortgage.amortizationTable as Array<Record<string, unknown>>) {
      mtLines.push(`  ${row.date} | Capital: ${row.principal}€ | Intereses: ${row.interest}€ | Cuota: ${row.installment}€`);
    }
    sections.push(mtLines.join("\n"));
  }

  const creditPolicy = universe.creditPolicy as Record<string, unknown> | undefined;
  if (creditPolicy) {
    sections.push(`PÓLIZA DE CRÉDITO: ${creditPolicy.policyNumber} | Límite: ${creditPolicy.limit}€ | Dispuesto: ${creditPolicy.drawnAmount}€ | Período: ${creditPolicy.startDate} a ${creditPolicy.endDate}`);
  }

  const fixedAssets = Array.isArray(universe.fixedAssets) ? universe.fixedAssets : [];
  if (fixedAssets.length > 0) {
    const faLines = ["INMOVILIZADO:"];
    for (const fa of fixedAssets) {
      const a = fa as Record<string, unknown>;
      faLines.push(`  ${a.code} | ${a.description} | Cuenta: ${a.assetAccountCode} | Coste: ${a.purchaseCost}€ | Amort. período: ${a.periodDepreciation}€`);
    }
    sections.push(faLines.join("\n"));
  }

  const insurance = Array.isArray(universe.insurancePolicies) ? universe.insurancePolicies : [];
  if (insurance.length > 0) {
    const insLines = ["PÓLIZAS DE SEGURO:"];
    for (const ins of insurance) {
      const p = ins as Record<string, unknown>;
      insLines.push(`  ${p.policyNumber} | ${p.type} | Prima anual: ${p.annualPremium}€ | Inicio: ${p.startDate}`);
    }
    sections.push(insLines.join("\n"));
  }

  const casualty = universe.casualtyEvent as Record<string, unknown> | undefined;
  if (casualty) {
    sections.push(`SINIESTRO: ${casualty.date} | ${casualty.description} | Valor contable: ${casualty.bookValue}€ | Indemnización: ${casualty.insuranceCompensation}€ | Pérdida neta: ${casualty.netLoss}€`);
  }

  const cardStatement = universe.creditCardStatement as Record<string, unknown> | undefined;
  if (cardStatement && Array.isArray(cardStatement.movements)) {
    const cardLines = ["TARJETA DE CRÉDITO:"];
    for (const m of cardStatement.movements as Array<Record<string, unknown>>) {
      cardLines.push(`  ${m.date} | ${m.description} | ${m.amount}€ | Cuenta: ${m.accountCode}`);
    }
    cardLines.push(`  Total cargos: ${cardStatement.totalCharges}€ | Liquidación: ${cardStatement.settlementDate}`);
    sections.push(cardLines.join("\n"));
  }

  const debitNotes = Array.isArray(universe.bankDebitNotes) ? universe.bankDebitNotes : [];
  if (debitNotes.length > 0) {
    const dnLines = ["NOTAS DE CARGO BANCARIAS:"];
    for (const dn of debitNotes) {
      const n = dn as Record<string, unknown>;
      dnLines.push(`  ${n.date} | ${n.concept} | ${n.amount}€ | Ref: ${n.reference}`);
    }
    sections.push(dnLines.join("\n"));
  }

  const equity = universe.shareholdersInfo as Record<string, unknown> | undefined;
  if (equity) {
    sections.push(`CAPITAL SOCIAL: ${equity.shareCapital}€ | ${equity.totalShares} participaciones a ${equity.nominalValuePerShare}€`);
  }

  const dividends = universe.dividendDistribution as Record<string, unknown> | undefined;
  if (dividends) {
    sections.push(`DIVIDENDOS: Aprobación ${dividends.approvalDate} | Pago ${dividends.paymentDate} | Bruto: ${dividends.totalDividends}€ | Neto: ${dividends.netDividendPaid}€ | IRPF retenido: ${dividends.irpfWithholdingAmount}€`);
  }

  const initialBalance = universe.initialBalanceSheet as Record<string, unknown> | undefined;
  if (initialBalance) {
    sections.push(`BALANCE INICIAL: Fecha ${initialBalance.date} | Total activo: ${initialBalance.totalAssets}€ | Asiento de apertura al inicio del período`);
  }

  const shareholderAccts = universe.shareholderAccounts as Record<string, unknown> | undefined;
  if (shareholderAccts && Array.isArray(shareholderAccts.transactions)) {
    const saLines = ["CUENTAS CORRIENTES SOCIOS:"];
    for (const t of shareholderAccts.transactions as Array<Record<string, unknown>>) {
      const d = t.debit != null ? `Debe: ${t.debit}€` : "";
      const c = t.credit != null ? `Haber: ${t.credit}€` : "";
      saLines.push(`  ${t.date} | ${t.concept} | ${t.shareholderName} | ${d}${c} | Cta: ${t.accountCode}`);
    }
    sections.push(saLines.join("\n"));
  }

  const extraordinary = Array.isArray(universe.extraordinaryExpenses) ? universe.extraordinaryExpenses : [];
  if (extraordinary.length > 0) {
    const exLines = ["GASTOS/INGRESOS EXTRAORDINARIOS:"];
    for (const e of extraordinary) {
      const ex = e as Record<string, unknown>;
      exLines.push(`  ${ex.date} | ${ex.type} | ${ex.description} | ${ex.amount}€ | Cuenta: ${ex.accountCode} (${ex.accountName})`);
    }
    sections.push(exLines.join("\n"));
  }

  const svcInvoices = Array.isArray(universe.serviceInvoices) ? universe.serviceInvoices : [];
  if (svcInvoices.length > 0) {
    const siLines = ["FACTURAS DE SUMINISTROS Y SERVICIOS:"];
    for (const si of svcInvoices) {
      const s = si as Record<string, unknown>;
      siLines.push(`  ${s.invoiceNumber} | ${s.serviceType} | ${s.date} | ${s.provider} | Base: ${s.taxBase}€ | Total: ${s.total}€ | Cta: ${s.accountCode}`);
    }
    sections.push(siLines.join("\n"));
  }

  const pmtReceipts = Array.isArray(universe.paymentReceipts) ? universe.paymentReceipts : [];
  if (pmtReceipts.length > 0) {
    const prLines = ["RECIBOS DE COBRO/PAGO:"];
    for (const pr of pmtReceipts) {
      const r = pr as Record<string, unknown>;
      prLines.push(`  ${r.receiptNumber} | ${r.type} | ${r.date} | ${r.partyName} | ${r.amount}€ | Factura: ${r.relatedInvoice}`);
    }
    sections.push(prLines.join("\n"));
  }

  if (sections.length === 0) return "";

  let summary = "\n\nDOCUMENTOS REALES YA GENERADOS — CADA ASIENTO DEBE REFERENCIAR UNO DE ESTOS DOCUMENTOS:\n" + sections.join("\n\n");
  const MAX_DOC_CONTEXT_CHARS = 12000;
  if (summary.length > MAX_DOC_CONTEXT_CHARS) {
    const cutIdx = summary.lastIndexOf("\n", MAX_DOC_CONTEXT_CHARS);
    summary = summary.slice(0, cutIdx > 0 ? cutIdx : MAX_DOC_CONTEXT_CHARS) + "\n... (lista truncada por longitud — usa los documentos anteriores)";
  }
  return summary;
}

function buildValidDocumentRefs(universe: Record<string, unknown>): Set<string> {
  const refs = new Set<string>();

  const invoices = Array.isArray(universe.invoices) ? universe.invoices : [];
  for (const inv of invoices) {
    const i = inv as Record<string, unknown>;
    if (i.invoiceNumber) refs.add(String(i.invoiceNumber));
  }

  const svcInvoices = Array.isArray(universe.serviceInvoices) ? universe.serviceInvoices : [];
  for (const si of svcInvoices) {
    const s = si as Record<string, unknown>;
    if (s.invoiceNumber) refs.add(String(s.invoiceNumber));
  }

  const pmtReceipts = Array.isArray(universe.paymentReceipts) ? universe.paymentReceipts : [];
  for (const pr of pmtReceipts) {
    const r = pr as Record<string, unknown>;
    if (r.receiptNumber) refs.add(String(r.receiptNumber));
  }

  const monthlyPayrolls = Array.isArray(universe.monthlyPayrolls) ? universe.monthlyPayrolls : [];
  for (const mp of monthlyPayrolls) {
    const mpr = mp as Record<string, unknown>;
    const label = String(mpr.monthLabel ?? "");
    if (label) {
      refs.add(label);
      refs.add(`Nómina ${label}`);
      refs.add(`NOM-${label}`);
    }
  }
  const payroll = universe.payroll as Record<string, unknown> | undefined;
  if (payroll && monthlyPayrolls.length === 0) {
    const month = String(payroll.month ?? "");
    if (month) {
      refs.add(month);
      refs.add(`Nómina ${month}`);
      refs.add(`NOM-${month}`);
    }
  }

  const ssPayments = Array.isArray(universe.socialSecurityPayments) ? universe.socialSecurityPayments : [];
  for (const s of ssPayments) {
    const ss = s as Record<string, unknown>;
    const m = String(ss.month ?? "");
    if (m) {
      refs.add(`TC1-${m}`);
      refs.add(`TC1 ${m}`);
      refs.add(m);
    }
  }

  const taxLiq = Array.isArray(universe.taxLiquidations) ? universe.taxLiquidations : [];
  for (const t of taxLiq) {
    const tx = t as Record<string, unknown>;
    const model = String(tx.model ?? "");
    const period = String(tx.period ?? "");
    refs.add(`Mod.${model}-${period}`);
    refs.add(`Mod.${model} ${period}`);
    refs.add(`${model}-${period}`);
  }

  const loan = universe.bankLoan as Record<string, unknown> | undefined;
  if (loan) {
    if (loan.loanNumber) refs.add(String(loan.loanNumber));
    const table = Array.isArray(loan.amortizationTable) ? loan.amortizationTable : [];
    for (const row of table) {
      const r = row as Record<string, unknown>;
      if (r.date) refs.add(String(r.date));
    }
  }

  const mortgage = universe.mortgage as Record<string, unknown> | undefined;
  if (mortgage) {
    if (mortgage.loanNumber) refs.add(String(mortgage.loanNumber));
    const table = Array.isArray(mortgage.amortizationTable) ? mortgage.amortizationTable : [];
    for (const row of table) {
      const r = row as Record<string, unknown>;
      if (r.date) refs.add(String(r.date));
    }
  }

  const creditPolicy = universe.creditPolicy as Record<string, unknown> | undefined;
  if (creditPolicy) {
    if (creditPolicy.policyNumber) refs.add(String(creditPolicy.policyNumber));
  }

  const insurance = Array.isArray(universe.insurancePolicies) ? universe.insurancePolicies : [];
  for (const ins of insurance) {
    const p = ins as Record<string, unknown>;
    if (p.policyNumber) refs.add(String(p.policyNumber));
  }

  const casualty = universe.casualtyEvent as Record<string, unknown> | undefined;
  if (casualty) {
    refs.add("Siniestro");
    if (casualty.date) refs.add(String(casualty.date));
  }

  const card = universe.creditCardStatement as Record<string, unknown> | undefined;
  if (card) {
    if (card.cardNumber) refs.add(String(card.cardNumber));
    refs.add("Tarjeta");
    if (card.settlementDate) refs.add(String(card.settlementDate));
  }

  const fixedAssets = Array.isArray(universe.fixedAssets) ? universe.fixedAssets : [];
  for (const fa of fixedAssets) {
    const a = fa as Record<string, unknown>;
    if (a.code) refs.add(String(a.code));
  }

  const equity = universe.shareholdersInfo as Record<string, unknown> | undefined;
  if (equity) {
    refs.add("Capital social");
    refs.add("Constitución");
  }

  const dividends = universe.dividendDistribution as Record<string, unknown> | undefined;
  if (dividends) {
    refs.add("Dividendos");
    if (dividends.approvalDate) refs.add(String(dividends.approvalDate));
    if (dividends.paymentDate) refs.add(String(dividends.paymentDate));
  }

  const initialBalance = universe.initialBalanceSheet as Record<string, unknown> | undefined;
  if (initialBalance) {
    refs.add("Asiento apertura");
    refs.add("Balance inicial");
    if (initialBalance.date) refs.add(String(initialBalance.date));
  }

  const shareholderAccts = universe.shareholderAccounts as Record<string, unknown> | undefined;
  if (shareholderAccts && Array.isArray(shareholderAccts.transactions)) {
    for (const t of shareholderAccts.transactions as Array<Record<string, unknown>>) {
      if (t.date) refs.add(String(t.date));
    }
  }

  const extraordinary = Array.isArray(universe.extraordinaryExpenses) ? universe.extraordinaryExpenses : [];
  for (const e of extraordinary) {
    const ex = e as Record<string, unknown>;
    if (ex.date) refs.add(String(ex.date));
    if (ex.description) refs.add(String(ex.description));
  }

  const debitNotes = Array.isArray(universe.bankDebitNotes) ? universe.bankDebitNotes : [];
  for (const dn of debitNotes) {
    const n = dn as Record<string, unknown>;
    if (n.reference) refs.add(String(n.reference));
  }

  return refs;
}

function entryMatchesDocument(entry: Record<string, unknown>, validRefs: Set<string>): boolean {
  const doc = String(entry.document ?? "").trim();
  if (!doc) return false;
  if (validRefs.has(doc)) return true;
  const docLower = doc.toLowerCase();
  for (const ref of validRefs) {
    const refLower = ref.toLowerCase();
    if (docLower.includes(refLower) || refLower.includes(docLower)) return true;
  }
  const knownPatterns = [
    /^(F|FV|FC|FAC|FACT|INV|SVC|REC|NOM|TC1|MOD|SEG|POL|HIP|PREST|AMO|DIV|APE|SIN|TAR|EXT)/i,
    /^Mod\.\d{3}/i,
    /nómina|apertura|cierre|amortización|dividendo|siniestro|seguro|préstamo|hipoteca|póliza|tarjeta|capital/i,
    /^\d{4}-\d{2}-\d{2}$/,
  ];
  for (const pattern of knownPatterns) {
    if (pattern.test(doc)) return true;
  }
  return false;
}

function buildValidRefsList(universe: Record<string, unknown>): string {
  const refs: string[] = [];

  const invoices = Array.isArray(universe.invoices) ? universe.invoices : [];
  for (const inv of invoices) {
    const i = inv as Record<string, unknown>;
    refs.push(String(i.invoiceNumber));
  }

  const svcInvoices = Array.isArray(universe.serviceInvoices) ? universe.serviceInvoices : [];
  for (const si of svcInvoices) {
    refs.push(String((si as Record<string, unknown>).invoiceNumber));
  }

  const pmtReceipts = Array.isArray(universe.paymentReceipts) ? universe.paymentReceipts : [];
  for (const pr of pmtReceipts) {
    refs.push(String((pr as Record<string, unknown>).receiptNumber));
  }

  const payroll = universe.payroll as Record<string, unknown> | undefined;
  if (payroll && payroll.month) refs.push(`Nómina ${payroll.month}`);

  const ssPayments = Array.isArray(universe.socialSecurityPayments) ? universe.socialSecurityPayments : [];
  for (const s of ssPayments) {
    const ss = s as Record<string, unknown>;
    refs.push(`TC1-${ss.month}`);
  }

  const taxLiq = Array.isArray(universe.taxLiquidations) ? universe.taxLiquidations : [];
  for (const t of taxLiq) {
    const tx = t as Record<string, unknown>;
    refs.push(`Mod.${tx.model}-${tx.period}`);
  }

  const loan = universe.bankLoan as Record<string, unknown> | undefined;
  if (loan) refs.push(String(loan.loanNumber));

  const mortgage = universe.mortgage as Record<string, unknown> | undefined;
  if (mortgage) refs.push(String(mortgage.loanNumber));

  const creditPolicy = universe.creditPolicy as Record<string, unknown> | undefined;
  if (creditPolicy) refs.push(String(creditPolicy.policyNumber));

  const insurance = Array.isArray(universe.insurancePolicies) ? universe.insurancePolicies : [];
  for (const ins of insurance) refs.push(String((ins as Record<string, unknown>).policyNumber));

  if (universe.casualtyEvent) refs.push("Siniestro");

  const card = universe.creditCardStatement as Record<string, unknown> | undefined;
  if (card) refs.push("Tarjeta-liquidación");

  const fixedAssets = Array.isArray(universe.fixedAssets) ? universe.fixedAssets : [];
  for (const fa of fixedAssets) refs.push(`Amort-${(fa as Record<string, unknown>).code}`);

  if (universe.shareholdersInfo) refs.push("Capital social");
  if (universe.dividendDistribution) refs.push("Dividendos");
  if (universe.initialBalanceSheet) refs.push("Asiento apertura");

  const extraordinary = Array.isArray(universe.extraordinaryExpenses) ? universe.extraordinaryExpenses : [];
  for (const e of extraordinary) {
    const ex = e as Record<string, unknown>;
    refs.push(`${ex.type}-${ex.date}`);
  }

  return refs.length > 0 ? `\n\nREFERENCIAS DE DOCUMENTO VÁLIDAS (usar EXACTAMENTE estas en el campo "document"):\n${refs.join(", ")}` : "";
}

interface DocEntrySpec {
  ref: string;
  date: string;
  concept: string;
  debits: Array<{ accountCode: string; accountName: string; amount: number }>;
  credits: Array<{ accountCode: string; accountName: string; amount: number }>;
}

function buildRequiredDocEntries(universe: Record<string, unknown>): DocEntrySpec[] {
  const specs: DocEntrySpec[] = [];

  const invoices = Array.isArray(universe.invoices) ? universe.invoices : [];
  for (const inv of invoices) {
    const i = inv as Record<string, unknown>;
    const ref = String(i.invoiceNumber ?? "");
    const date = String(i.date ?? "");
    const type = String(i.type ?? "");
    const total = Number(i.total ?? 0);
    const taxBase = Number(i.taxBase ?? 0);
    const taxAmount = Number(i.taxAmount ?? 0);
    const irpfAmount = Number(i.irpfAmount ?? 0);
    const partyName = String(i.partyName ?? "");
    const isSale = type === "sale" || type === "emitida";
    const partyAccount = String(i.accountCode ?? (isSale ? "430" : "400"));
    const taxRegime = String((universe as any).companyProfile?.taxRegime ?? "IVA");

    const existingDebits = Array.isArray(i.accountDebits) ? (i.accountDebits as Array<Record<string, unknown>>) : null;
    const existingCredits = Array.isArray(i.accountCredits) ? (i.accountCredits as Array<Record<string, unknown>>) : null;

    if (existingDebits && existingCredits && existingDebits.length > 0 && existingCredits.length > 0) {
      specs.push({
        ref, date,
        concept: `${isSale ? "Venta" : "Compra"} ${partyName}`.substring(0, 40),
        debits: existingDebits.map(d => ({
          accountCode: String(d.accountCode ?? ""),
          accountName: String(d.accountName ?? ""),
          amount: Number(d.amount ?? 0),
        })),
        credits: existingCredits.map(c => ({
          accountCode: String(c.accountCode ?? ""),
          accountName: String(c.accountName ?? ""),
          amount: Number(c.amount ?? 0),
        })),
      });
    } else if (isSale) {
      specs.push({
        ref, date,
        concept: `Venta ${partyName}`.substring(0, 40),
        debits: [{ accountCode: partyAccount, accountName: `Clientes — ${partyName}`, amount: total }],
        credits: [
          { accountCode: "700", accountName: "Ventas de mercaderías", amount: taxBase },
          ...(taxAmount > 0 ? [{ accountCode: "477", accountName: `${taxRegime} repercutido`, amount: taxAmount }] : []),
        ],
      });
    } else {
      specs.push({
        ref, date,
        concept: `Compra ${partyName}`.substring(0, 40),
        debits: [
          { accountCode: String(i.expenseAccount ?? "600"), accountName: String(i.expenseAccountName ?? "Compras de mercaderías"), amount: taxBase },
          ...(taxAmount > 0 ? [{ accountCode: "472", accountName: `${taxRegime} soportado`, amount: taxAmount }] : []),
        ],
        credits: [
          { accountCode: partyAccount, accountName: `Proveedores — ${partyName}`, amount: total - irpfAmount },
          ...(irpfAmount > 0 ? [{ accountCode: "4751", accountName: "HP acreedora retenciones IRPF", amount: irpfAmount }] : []),
        ],
      });
    }
  }

  const svcInvoices = Array.isArray(universe.serviceInvoices) ? universe.serviceInvoices : [];
  for (const si of svcInvoices) {
    const s = si as Record<string, unknown>;
    const ref = String(s.invoiceNumber ?? "");
    const date = String(s.date ?? "");
    const total = Number(s.total ?? 0);
    const taxBase = Number(s.taxBase ?? 0);
    const taxAmount = Number(s.taxAmount ?? 0);
    const irpfAmount = Number(s.irpfAmount ?? 0);
    const provider = String(s.provider ?? "");
    const acctCode = String(s.accountCode ?? "410");
    const acctName = String(s.accountName ?? "Acreedores por prestaciones de servicios");
    const taxRegime = String((universe as any).companyProfile?.taxRegime ?? "IVA");

    const svcDebits = Array.isArray(s.accountDebits) ? (s.accountDebits as Array<Record<string, unknown>>) : null;
    const svcCredits = Array.isArray(s.accountCredits) ? (s.accountCredits as Array<Record<string, unknown>>) : null;

    if (svcDebits && svcCredits && svcDebits.length > 0 && svcCredits.length > 0) {
      specs.push({
        ref, date,
        concept: `Servicio ${provider}`.substring(0, 40),
        debits: svcDebits.map(d => ({
          accountCode: String(d.accountCode ?? ""),
          accountName: String(d.accountName ?? ""),
          amount: Number(d.amount ?? 0),
        })),
        credits: svcCredits.map(c => ({
          accountCode: String(c.accountCode ?? ""),
          accountName: String(c.accountName ?? ""),
          amount: Number(c.amount ?? 0),
        })),
      });
    } else {
      specs.push({
        ref, date,
        concept: `Servicio ${provider}`.substring(0, 40),
        debits: [
          { accountCode: String(s.expenseAccount ?? "629"), accountName: String(s.expenseAccountName ?? acctName), amount: taxBase },
          ...(taxAmount > 0 ? [{ accountCode: "472", accountName: `${taxRegime} soportado`, amount: taxAmount }] : []),
        ],
        credits: [
          { accountCode: acctCode, accountName: `${acctName} — ${provider}`, amount: total - irpfAmount },
          ...(irpfAmount > 0 ? [{ accountCode: "4751", accountName: "HP acreedora retenciones IRPF", amount: irpfAmount }] : []),
        ],
      });
    }
  }

  const pmtReceipts = Array.isArray(universe.paymentReceipts) ? universe.paymentReceipts : [];
  for (const pr of pmtReceipts) {
    const p = pr as Record<string, unknown>;
    const ref = String(p.receiptNumber ?? "");
    const date = String(p.date ?? "");
    const amount = Number(p.amount ?? 0);
    const party = String(p.partyName ?? "");
    const type = String(p.type ?? "cobro");
    const partyAccount = String(p.accountCode ?? (type === "cobro" ? "430" : "400"));
    const partyLabel = type === "cobro" ? "Clientes" : "Proveedores";

    if (type === "cobro") {
      specs.push({
        ref, date,
        concept: `Cobro ${party}`.substring(0, 40),
        debits: [{ accountCode: "572", accountName: "Bancos c/c", amount }],
        credits: [{ accountCode: partyAccount, accountName: `${partyLabel} — ${party}`, amount }],
      });
    } else {
      specs.push({
        ref, date,
        concept: `Pago ${party}`.substring(0, 40),
        debits: [{ accountCode: partyAccount, accountName: `${partyLabel} — ${party}`, amount }],
        credits: [{ accountCode: "572", accountName: "Bancos c/c", amount }],
      });
    }
  }

  const insurance = Array.isArray(universe.insurancePolicies) ? universe.insurancePolicies : [];
  for (const ins of insurance) {
    const pol = ins as Record<string, unknown>;
    const ref = String(pol.policyNumber ?? "");
    const date = String(pol.startDate ?? "");
    const premium = Number(pol.annualPremium ?? pol.premium ?? 0);
    if (premium > 0) {
      specs.push({
        ref, date,
        concept: `Seguro ${String(pol.type ?? "")}`.substring(0, 40),
        debits: [{ accountCode: "625", accountName: "Primas de seguros", amount: premium }],
        credits: [{ accountCode: "572", accountName: "Bancos c/c", amount: premium }],
      });
    }
  }

  const extraordinary = Array.isArray(universe.extraordinaryExpenses) ? universe.extraordinaryExpenses : [];
  for (const e of extraordinary) {
    const ex = e as Record<string, unknown>;
    const ref = `${ex.type}-${ex.date}`;
    const date = String(ex.date ?? "");
    const amount = Number(ex.amount ?? 0);
    if (amount > 0) {
      specs.push({
        ref, date,
        concept: `${String(ex.concept ?? ex.type ?? "Gasto extraordinario")}`.substring(0, 40),
        debits: [{ accountCode: String(ex.accountCode ?? "678"), accountName: String(ex.accountName ?? "Gastos excepcionales"), amount }],
        credits: [{ accountCode: "572", accountName: "Bancos c/c", amount }],
      });
    }
  }

  return specs;
}

function addMissingDocumentEntries(
  entries: unknown[],
  universe: Record<string, unknown>,
): unknown[] {
  const coveredRefs = new Set<string>();
  for (const e of entries) {
    const doc = String((e as Record<string, unknown>).document ?? "").trim();
    if (doc) coveredRefs.add(doc);
  }

  const required = buildRequiredDocEntries(universe);
  const missing = required.filter(spec => {
    if (!spec.ref || spec.ref.trim().length === 0) return false;
    if (coveredRefs.has(spec.ref)) return false;
    for (const covered of coveredRefs) {
      if (!covered) continue;
      if (covered === spec.ref) return false;
      if (covered.length >= 3 && spec.ref.length >= 3) {
        if (covered.includes(spec.ref) || spec.ref.includes(covered)) return false;
      }
    }
    return true;
  });

  if (missing.length === 0) return entries;

  console.log(`[journal] Añadiendo ${missing.length} asientos deterministas para documentos sin asiento`);

  const newEntries = missing.map(spec => ({
    entryNumber: "0",
    date: spec.date,
    concept: spec.concept,
    document: spec.ref,
    debits: spec.debits,
    credits: spec.credits,
    totalAmount: spec.debits.reduce((s, d) => s + d.amount, 0),
  }));

  const all = [...entries, ...newEntries];
  all.sort((a, b) => {
    const da = String((a as Record<string, unknown>).date ?? "");
    const db = String((b as Record<string, unknown>).date ?? "");
    return da.localeCompare(db);
  });

  let num = 1;
  for (const entry of all) {
    (entry as Record<string, unknown>).entryNumber = String(num);
    num++;
  }

  return all;
}

function buildDeterministicJournal(
  universe: Record<string, unknown>,
  params: GenerateParams,
): { journalEntries: unknown[] } {
  interface JEntry {
    entryNumber: string;
    date: string;
    concept: string;
    document: string;
    debits: Array<{ accountCode: string; accountName: string; amount: number }>;
    credits: Array<{ accountCode: string; accountName: string; amount: number }>;
    totalAmount: number;
  }
  const entries: JEntry[] = [];
  const r2 = (n: number) => Math.round(n * 100) / 100;

  const { periodStart, periodEnd } = getPeriodInfo(params);

  function isInPeriod(date: string): boolean {
    if (!date || date.length < 10) return false;
    return date >= periodStart && date <= periodEnd;
  }

  function clampDate(date: string): string {
    if (!date || date.length < 10) return periodEnd;
    if (date > periodEnd) return periodEnd;
    if (date < periodStart) return periodStart;
    return date;
  }

  function addEntry(rawDate: string, concept: string, doc: string,
    debits: Array<{ accountCode: string; accountName: string; amount: number }>,
    credits: Array<{ accountCode: string; accountName: string; amount: number }>) {
    let date = rawDate;
    if (!isInPeriod(date)) {
      date = clampDate(date);
    }
    const roundedDebits = debits.map(d => ({ ...d, amount: r2(d.amount) }));
    const roundedCredits = credits.map(c => ({ ...c, amount: r2(c.amount) }));
    const totalD = r2(roundedDebits.reduce((s, d) => s + d.amount, 0));
    const totalC = r2(roundedCredits.reduce((s, c) => s + c.amount, 0));
    if (totalD <= 0 || Math.abs(totalD - totalC) > 0.02) {
      console.warn(`[journal] Asiento descartado (descuadre): ${concept} [${doc}] D=${totalD} C=${totalC}`);
      return;
    }
    entries.push({ entryNumber: "0", date, concept, document: doc,
      debits: roundedDebits, credits: roundedCredits, totalAmount: totalD });
  }

  function copyEntry(date: string, concept: string, doc: string, src: Record<string, unknown>) {
    const debits = Array.isArray(src.accountDebits) ? (src.accountDebits as any[]).map((d: any) => ({
      accountCode: String(d.accountCode ?? ""), accountName: String(d.accountName ?? ""), amount: Number(d.amount ?? 0)
    })) : [];
    const credits = Array.isArray(src.accountCredits) ? (src.accountCredits as any[]).map((c: any) => ({
      accountCode: String(c.accountCode ?? ""), accountName: String(c.accountName ?? ""), amount: Number(c.amount ?? 0)
    })) : [];
    if (debits.length > 0 && credits.length > 0) {
      addEntry(date, concept, doc, debits, credits);
    }
  }

  const taxRegime = String((universe.companyProfile as any)?.taxRegime ?? "IVA");
  const taxAcctRep = taxRegime === "IGIC" ? "477" : "477";
  const taxAcctSop = taxRegime === "IGIC" ? "472" : "472";
  const taxName = taxRegime;

  const invoices = Array.isArray(universe.invoices) ? universe.invoices as Record<string, unknown>[] : [];
  for (const inv of invoices) {
    const ref = String(inv.invoiceNumber ?? "");
    const date = String(inv.date ?? "");
    const isSale = inv.type === "sale";

    if (Array.isArray(inv.accountDebits) && Array.isArray(inv.accountCredits)) {
      copyEntry(date, isSale ? `Venta ${String(inv.partyName ?? "").substring(0, 25)}` : `Compra ${String(inv.partyName ?? "").substring(0, 25)}`, ref, inv);
    } else {
      const total = Number(inv.total ?? 0);
      const taxBase = Number(inv.taxBase ?? 0);
      const taxAmount = Number(inv.taxAmount ?? 0);
      const irpfAmount = Number(inv.irpfAmount ?? 0);
      const party = String(inv.partyName ?? "");
      const partyAcct = isSale ? "430" : "400";

      if (isSale) {
        addEntry(date, `Venta ${party}`.substring(0, 40), ref,
          [{ accountCode: partyAcct, accountName: "Clientes", amount: total }],
          [
            { accountCode: "700", accountName: "Ventas de mercaderías", amount: taxBase },
            ...(taxAmount > 0 ? [{ accountCode: taxAcctRep, accountName: `${taxName} repercutido`, amount: taxAmount }] : []),
          ]);
      } else {
        addEntry(date, `Compra ${party}`.substring(0, 40), ref,
          [
            { accountCode: "600", accountName: "Compras de mercaderías", amount: taxBase },
            ...(taxAmount > 0 ? [{ accountCode: taxAcctSop, accountName: `${taxName} soportado`, amount: taxAmount }] : []),
          ],
          [
            { accountCode: partyAcct, accountName: "Proveedores", amount: total - irpfAmount },
            ...(irpfAmount > 0 ? [{ accountCode: "4751", accountName: "HP acreedora retenciones IRPF", amount: irpfAmount }] : []),
          ]);
      }
    }
  }

  const paymentReceipts = Array.isArray(universe.paymentReceipts) ? universe.paymentReceipts as Record<string, unknown>[] : [];
  for (const pr of paymentReceipts) {
    const ref = String(pr.receiptNumber ?? "");
    const date = String(pr.date ?? "");
    const type = String(pr.type ?? "cobro");
    const party = String(pr.partyName ?? "");
    const amount = Number(pr.amount ?? 0);

    if (Array.isArray(pr.accountDebits) && Array.isArray(pr.accountCredits)) {
      copyEntry(date, type === "cobro" ? `Cobro ${party}`.substring(0, 40) : `Pago ${party}`.substring(0, 40), ref, pr);
    } else {
      if (type === "cobro") {
        addEntry(date, `Cobro ${party}`.substring(0, 40), ref,
          [{ accountCode: "572", accountName: "Bancos c/c", amount }],
          [{ accountCode: "430", accountName: "Clientes", amount }]);
      } else {
        addEntry(date, `Pago ${party}`.substring(0, 40), ref,
          [{ accountCode: "400", accountName: "Proveedores", amount }],
          [{ accountCode: "572", accountName: "Bancos c/c", amount }]);
      }
    }
  }

  const svcInvoices = Array.isArray(universe.serviceInvoices) ? universe.serviceInvoices as Record<string, unknown>[] : [];
  for (const si of svcInvoices) {
    const ref = String(si.invoiceNumber ?? "");
    const date = String(si.date ?? "");
    const provider = String(si.provider ?? "");
    copyEntry(date, `Gasto ${provider}`.substring(0, 40), ref, si);
  }

  const insurance = Array.isArray(universe.insurancePolicies) ? universe.insurancePolicies as Record<string, unknown>[] : [];
  for (const pol of insurance) {
    const ref = String(pol.policyNumber ?? "");
    const date = String(pol.startDate ?? "");
    copyEntry(date, `Seguro ${String(pol.type ?? "")}`.substring(0, 40), ref, pol);
  }

  const casualty = universe.casualtyEvent as Record<string, unknown> | undefined;
  if (casualty && casualty.date) {
    copyEntry(String(casualty.date), "Siniestro", "Siniestro", casualty);
  }

  const extraordinary = Array.isArray(universe.extraordinaryExpenses) ? universe.extraordinaryExpenses as Record<string, unknown>[] : [];
  for (const ex of extraordinary) {
    const ref = `${ex.type}-${ex.date}`;
    const date = String(ex.date ?? "");
    copyEntry(date, String(ex.concept ?? ex.type ?? "Gasto extraordinario").substring(0, 40), ref, ex);
  }

  const monthlyPayrolls = Array.isArray(universe.monthlyPayrolls) ? universe.monthlyPayrolls as Record<string, unknown>[] : [];
  for (const mp of monthlyPayrolls) {
    const monthLabel = String(mp.monthLabel ?? "");
    const totalGross = Number(mp.totalGross ?? 0);
    const ssEmployer = Number(mp.totalSsEmployer ?? 0);
    const ssEmployee = Number(mp.totalSsEmployee ?? 0);
    const irpfTotal = Number(mp.totalIrpf ?? 0);
    const netPay = Number(mp.totalNetSalary ?? 0);
    const ssTotal = r2(ssEmployee + ssEmployer);
    const devDate = String(mp.devDate ?? "");
    const payDate = String(mp.payDate ?? "");

    if (totalGross > 0 && devDate) {
      addEntry(devDate, `Devengo nómina ${monthLabel}`, `Nómina ${monthLabel}`,
        [
          { accountCode: "640", accountName: "Sueldos y salarios", amount: totalGross },
          { accountCode: "642", accountName: "SS a cargo de la empresa", amount: ssEmployer },
        ],
        [
          { accountCode: "476", accountName: "Organismos SS acreedores", amount: ssTotal },
          ...(irpfTotal > 0 ? [{ accountCode: "4751", accountName: "HP acreedora retenciones IRPF", amount: irpfTotal }] : []),
          { accountCode: "465", accountName: "Remuneraciones pendientes de pago", amount: netPay },
        ]);

      addEntry(payDate, `Pago nómina ${monthLabel}`, `Nómina ${monthLabel}`,
        [{ accountCode: "465", accountName: "Remuneraciones pendientes de pago", amount: netPay }],
        [{ accountCode: "572", accountName: "Bancos c/c", amount: netPay }]);
    }
  }

  if (monthlyPayrolls.length === 0) {
    const payroll = universe.payroll as Record<string, unknown> | undefined;
    if (payroll) {
      const monthLabel = String(payroll.month ?? "");
      const totalGross = Number(payroll.totalGross ?? 0);
      const ssEmployer = Number(payroll.totalSsEmployer ?? payroll.ssEmployerAmount ?? 0);
      const ssEmployee = Number(payroll.totalSsEmployee ?? payroll.ssEmployeeAmount ?? 0);
      const irpfTotal = Number(payroll.totalIrpf ?? payroll.irpfAmount ?? 0);
      const netPay = Number(payroll.totalNetSalary ?? payroll.netPay ?? payroll.totalNet ?? 0);
      const ssTotal = r2(ssEmployee + ssEmployer);
      const paymentDate = String(payroll.paymentDate ?? "");

      if (totalGross > 0) {
        const devDate = paymentDate || `${params.year}-01-28`;
        const payDate = (() => {
          try {
            const d = new Date(devDate);
            d.setMonth(d.getMonth() + 1);
            d.setDate(1);
            return d.toISOString().slice(0, 10);
          } catch { return devDate; }
        })();

        addEntry(devDate, `Devengo nómina ${monthLabel}`, `Nómina ${monthLabel}`,
          [
            { accountCode: "640", accountName: "Sueldos y salarios", amount: totalGross },
            { accountCode: "642", accountName: "SS a cargo de la empresa", amount: ssEmployer },
          ],
          [
            { accountCode: "476", accountName: "Organismos SS acreedores", amount: ssTotal },
            ...(irpfTotal > 0 ? [{ accountCode: "4751", accountName: "HP acreedora retenciones IRPF", amount: irpfTotal }] : []),
            { accountCode: "465", accountName: "Remuneraciones pendientes de pago", amount: netPay },
          ]);

        addEntry(payDate, `Pago nómina ${monthLabel}`, `Nómina ${monthLabel}`,
          [{ accountCode: "465", accountName: "Remuneraciones pendientes de pago", amount: netPay }],
          [{ accountCode: "572", accountName: "Bancos c/c", amount: netPay }]);
      }
    }
  }

  const ssPayments = Array.isArray(universe.socialSecurityPayments) ? universe.socialSecurityPayments as Record<string, unknown>[] : [];
  for (const ss of ssPayments) {
    const ref = `TC1-${ss.month}`;
    const date = String(ss.dueDate ?? "");
    const total = Number(ss.totalPayment ?? 0);
    if (total > 0 && date) {
      if (Array.isArray(ss.accountDebits) && Array.isArray(ss.accountCredits)) {
        copyEntry(date, `Pago TC1 ${ss.month}`, ref, ss);
      } else {
        addEntry(date, `Pago TC1 ${ss.month}`, ref,
          [{ accountCode: "476", accountName: "Organismos SS acreedores", amount: total }],
          [{ accountCode: "572", accountName: "Bancos c/c", amount: total }]);
      }
    }
  }

  const taxLiq = Array.isArray(universe.taxLiquidations) ? universe.taxLiquidations as Record<string, unknown>[] : [];
  for (const tx of taxLiq) {
    const model = String(tx.model ?? "303");
    const period = String(tx.period ?? "");
    const ref = `Mod.${model}-${period}`;
    const date = String(tx.dueDate ?? tx.paymentDate ?? "");
    const taxCollected = Number(tx.taxCollected ?? tx.ivaRepercutido ?? 0);
    const taxDeducted = Number(tx.taxDeducted ?? tx.ivaSoportado ?? 0);
    const result = r2(taxCollected - taxDeducted);

    if (taxCollected > 0 || taxDeducted > 0) {
      if (result > 0) {
        addEntry(date, `Liquidación ${taxName} ${period}`, ref,
          [{ accountCode: "477", accountName: `${taxName} repercutido`, amount: taxCollected }],
          [
            { accountCode: "472", accountName: `${taxName} soportado`, amount: taxDeducted },
            { accountCode: "4750", accountName: `HP acreedora por ${taxName}`, amount: result },
          ]);
        const payDate = (() => {
          const d = new Date(date);
          d.setDate(d.getDate() + 5);
          return d.toISOString().slice(0, 10);
        })();
        addEntry(payDate, `Pago ${taxName} ${period}`, ref,
          [{ accountCode: "4750", accountName: `HP acreedora por ${taxName}`, amount: result }],
          [{ accountCode: "572", accountName: "Bancos c/c", amount: result }]);
      } else {
        addEntry(date, `Liquidación ${taxName} ${period}`, ref,
          [
            { accountCode: "477", accountName: `${taxName} repercutido`, amount: taxCollected },
            { accountCode: "4700", accountName: `HP deudora por ${taxName}`, amount: Math.abs(result) },
          ],
          [{ accountCode: "472", accountName: `${taxName} soportado`, amount: taxDeducted }]);
      }
    }

    if (model === "111") {
      const irpfAmount = Number(tx.irpfAmount ?? tx.totalIrpf ?? tx.amount ?? 0);
      if (irpfAmount > 0) {
        addEntry(date, `Liquidación IRPF ${period}`, ref,
          [{ accountCode: "4751", accountName: "HP acreedora retenciones IRPF", amount: irpfAmount }],
          [{ accountCode: "572", accountName: "Bancos c/c", amount: irpfAmount }]);
      }
    }
  }

  const loan = universe.bankLoan as Record<string, unknown> | undefined;
  if (loan) {
    const loanNum = String(loan.loanNumber ?? "");
    if (loan.formalizationEntry && typeof loan.formalizationEntry === "object") {
      const fe = loan.formalizationEntry as Record<string, unknown>;
      const feDate = String(fe.date ?? loan.startDate ?? "");
      copyEntry(feDate, "Formalización préstamo", loanNum, fe);
    }
    if (loan.installmentEntry && typeof loan.installmentEntry === "object") {
      const ie = loan.installmentEntry as Record<string, unknown>;
      const amortTable = Array.isArray(loan.amortizationTable) ? loan.amortizationTable as Record<string, unknown>[] : [];
      if (amortTable.length > 0) {
        for (const cuota of amortTable) {
          const date = String(cuota.date ?? cuota.paymentDate ?? "");
          const principal = Number(cuota.principal ?? 0);
          const interest = Number(cuota.interest ?? 0);
          const total = r2(principal + interest);
          if (date && total > 0) {
            addEntry(date, "Cuota préstamo", loanNum,
              [
                { accountCode: "5200", accountName: "Préstamos a CP de entidades de crédito", amount: principal },
                { accountCode: "662", accountName: "Intereses de deudas", amount: interest },
              ],
              [{ accountCode: "572", accountName: "Bancos c/c", amount: total }]);
          }
        }
      } else {
        const ieDate = String(ie.date ?? "");
        copyEntry(ieDate, "Cuota préstamo", loanNum, ie);
      }
    }
    if (loan.reclassificationEntry && typeof loan.reclassificationEntry === "object") {
      const re = loan.reclassificationEntry as Record<string, unknown>;
      const reDate = String(re.date ?? `${params.year}-12-31`);
      copyEntry(reDate, "Reclasificación LP→CP préstamo", loanNum, re);
    }
  }

  const mortgage = universe.mortgage as Record<string, unknown> | undefined;
  if (mortgage) {
    const mortNum = String(mortgage.loanNumber ?? "");
    const mortFormEntry = (mortgage.acquisitionEntry ?? mortgage.formalizationEntry) as Record<string, unknown> | undefined;
    if (mortFormEntry && typeof mortFormEntry === "object") {
      copyEntry(String(mortFormEntry.date ?? mortgage.startDate ?? ""), "Adquisición con hipoteca", mortNum, mortFormEntry);
    }
    const mortAmort = Array.isArray(mortgage.amortizationTable) ? mortgage.amortizationTable as Record<string, unknown>[] : [];
    if (mortAmort.length > 0) {
      for (const cuota of mortAmort) {
        const date = String(cuota.date ?? cuota.paymentDate ?? "");
        const principal = Number(cuota.principal ?? 0);
        const interest = Number(cuota.interest ?? 0);
        const total = r2(principal + interest);
        if (date && total > 0) {
          addEntry(date, "Cuota hipoteca", mortNum,
            [
              { accountCode: "5200", accountName: "Préstamos a CP de entidades de crédito", amount: principal },
              { accountCode: "662", accountName: "Intereses de deudas", amount: interest },
            ],
            [{ accountCode: "572", accountName: "Bancos c/c", amount: total }]);
        }
      }
    } else if (mortgage.installmentEntry && typeof mortgage.installmentEntry === "object") {
      copyEntry(String((mortgage.installmentEntry as any).date ?? ""), "Cuota hipoteca", mortNum, mortgage.installmentEntry as Record<string, unknown>);
    }
    if (mortgage.reclassificationEntry && typeof mortgage.reclassificationEntry === "object") {
      const re = mortgage.reclassificationEntry as Record<string, unknown>;
      copyEntry(String(re.date ?? `${params.year}-12-31`), "Reclasificación LP→CP hipoteca", mortNum, re);
    }
  }

  const creditPolicy = universe.creditPolicy as Record<string, unknown> | undefined;
  if (creditPolicy) {
    const cpRef = String(creditPolicy.policyNumber ?? "");
    const drawn = Number(creditPolicy.drawnAmount ?? creditPolicy.drawn ?? 0);
    const intRate = Number(creditPolicy.interestRate ?? 0);
    const startDate = String(creditPolicy.startDate ?? `${params.year}-01-15`);
    if (drawn > 0) {
      addEntry(startDate, "Disposición póliza crédito", cpRef,
        [{ accountCode: "572", accountName: "Bancos c/c", amount: drawn }],
        [{ accountCode: "5201", accountName: "Deudas a c/p por crédito dispuesto", amount: drawn }]);
      const interest = r2(drawn * (intRate / 100) * 0.25);
      const fee = r2(drawn * 0.0025);
      if (interest > 0 || fee > 0) {
        const liqDate = (() => {
          const d = new Date(startDate);
          d.setMonth(d.getMonth() + 3);
          return d.toISOString().slice(0, 10);
        })();
        addEntry(liqDate, "Liquidación intereses póliza", cpRef,
          [
            { accountCode: "662", accountName: "Intereses de deudas", amount: interest },
            ...(fee > 0 ? [{ accountCode: "626", accountName: "Servicios bancarios", amount: fee }] : []),
          ],
          [{ accountCode: "572", accountName: "Bancos c/c", amount: r2(interest + fee) }]);
      }
    }
  }

  const fixedAssets = Array.isArray(universe.fixedAssets) ? universe.fixedAssets as Record<string, unknown>[] : [];
  for (const fa of fixedAssets) {
    const code = String(fa.code ?? "");
    const ref = `Amort-${code}`;
    if (Array.isArray(fa.accountDebits) && Array.isArray(fa.accountCredits)) {
      copyEntry(`${params.year}-12-31`, `Amortización ${code}`, ref, fa);
    } else {
      const annualAmort = Number(fa.annualAmortization ?? fa.periodAmortization ?? 0);
      if (annualAmort > 0) {
        addEntry(`${params.year}-12-31`, `Amortización ${code}`, ref,
          [{ accountCode: "681", accountName: "Amortización inmovilizado material", amount: annualAmort }],
          [{ accountCode: String(fa.amortAccountCode ?? "281"), accountName: String(fa.amortAccountName ?? "Amort. acum. inmov. material"), amount: annualAmort }]);
      }
    }
  }

  const card = universe.creditCardStatement as Record<string, unknown> | undefined;
  if (card) {
    const movements = Array.isArray(card.movements) ? card.movements as Record<string, unknown>[] : [];
    for (const mov of movements) {
      const date = String(mov.date ?? "");
      const amount = Number(mov.amount ?? 0);
      const desc = String(mov.description ?? mov.category ?? "Gasto tarjeta");
      const acctCode = String(mov.accountCode ?? "629");
      const acctName = String(mov.accountName ?? "Otros servicios");
      if (amount > 0 && date) {
        addEntry(date, desc.substring(0, 40), "Tarjeta-liquidación",
          [{ accountCode: acctCode, accountName: acctName, amount }],
          [{ accountCode: "410", accountName: "Acreedores por prestaciones de servicios", amount }]);
      }
    }
    const totalCharges = Number(card.totalCharges ?? 0);
    const settlementDate = String(card.settlementDate ?? `${params.year}-12-31`);
    if (totalCharges > 0) {
      addEntry(settlementDate, "Liquidación tarjeta bancaria", "Tarjeta-liquidación",
        [{ accountCode: "410", accountName: "Acreedores por prestaciones de servicios", amount: totalCharges }],
        [{ accountCode: "572", accountName: "Bancos c/c", amount: totalCharges }]);
    }
  }

  // shareholdersInfo: NO genera asiento en el diario.
  // Los datos de socios/capital social son informativos y se reflejan
  // en el balance de apertura (initialBalanceSheet), no como asiento independiente.

  const initialBS = universe.initialBalanceSheet as Record<string, unknown> | undefined;
  if (initialBS) {
    if (!initialBS.accountDebits || !Array.isArray(initialBS.accountDebits) || (initialBS.accountDebits as unknown[]).length === 0) {
      const debits: Array<Record<string, unknown>> = [];
      const credits: Array<Record<string, unknown>> = [];
      for (const section of ["nonCurrentAssets", "currentAssets"]) {
        const items = initialBS[section] as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item.amount && Number(item.amount) > 0) {
              debits.push({ accountCode: String(item.accountCode ?? ""), accountName: String(item.accountName ?? ""), amount: Number(item.amount), description: "Activo en apertura" });
            }
          }
        }
      }
      for (const section of ["equity", "nonCurrentLiabilities", "currentLiabilities"]) {
        const items = initialBS[section] as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item.amount && Number(item.amount) > 0) {
              credits.push({ accountCode: String(item.accountCode ?? ""), accountName: String(item.accountName ?? ""), amount: Number(item.amount), description: "Pasivo/PN en apertura" });
            }
          }
        }
      }
      if (debits.length > 0 && credits.length > 0) {
        initialBS.accountDebits = debits;
        initialBS.accountCredits = credits;
      }
    }
    if (initialBS.accountDebits && (initialBS.accountDebits as unknown[]).length > 0) {
      copyEntry(`${params.year}-01-01`, "Asiento de apertura", "Asiento apertura", initialBS);
    }
  }

  const dividends = universe.dividendDistribution as Record<string, unknown> | undefined;
  if (dividends && dividends.accountDebits) {
    const date = String(dividends.date ?? dividends.approvalDate ?? `${params.year}-06-30`);
    copyEntry(date, "Distribución resultado ejercicio", "Dividendos", dividends);

    const payEntry = dividends.paymentEntry as Record<string, unknown> | undefined;
    if (payEntry && payEntry.accountDebits) {
      const payDate = String(payEntry.date ?? dividends.paymentDate ?? `${params.year}-07-15`);
      copyEntry(payDate, "Pago dividendos a socios", "Dividendos", payEntry);
    }
  }

  const shareholderAccts = universe.shareholderAccounts as Record<string, unknown> | undefined;
  if (shareholderAccts && shareholderAccts.accountDebits) {
    const transactions = Array.isArray(shareholderAccts.transactions) ? shareholderAccts.transactions as Record<string, unknown>[] : [];
    if (transactions.length > 0) {
      const firstDate = String(transactions[0].date ?? `${params.year}-01-15`);
      copyEntry(firstDate, "Retribución órgano de administración", "CC-Socios", shareholderAccts);
    }
  }

  entries.sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    const aIsApertura = a.document === "Asiento apertura" ? 0 : 1;
    const bIsApertura = b.document === "Asiento apertura" ? 0 : 1;
    return aIsApertura - bIsApertura;
  });
  let num = 1;
  for (const e of entries) {
    e.entryNumber = String(num++);
  }

  const entryDocs = new Set(entries.map(e => e.document).filter(Boolean));
  const allDocRefs: Array<{ ref: string; type: string; date: string }> = [];

  const addDocRefs = (items: unknown[] | undefined, type: string, refField: string, dateField: string) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      const i = item as Record<string, unknown>;
      const ref = String(i[refField] ?? "");
      const date = String(i[dateField] ?? "");
      if (ref) allDocRefs.push({ ref, type, date });
    }
  };
  addDocRefs(universe.invoices as unknown[] | undefined, "factura", "invoiceNumber", "date");
  addDocRefs(universe.paymentReceipts as unknown[] | undefined, "recibo", "receiptNumber", "date");
  addDocRefs(universe.serviceInvoices as unknown[] | undefined, "servicio", "invoiceNumber", "date");
  addDocRefs(universe.socialSecurityPayments as unknown[] | undefined, "TC1", "month", "dueDate");
  addDocRefs(universe.taxLiquidations as unknown[] | undefined, "liquidación", "model", "dueDate");
  if (Array.isArray(universe.monthlyPayrolls)) {
    for (const mp of universe.monthlyPayrolls as Record<string, unknown>[]) {
      const label = String(mp.monthLabel ?? "");
      const date = String(mp.devDate ?? "");
      if (label) allDocRefs.push({ ref: `Nómina ${label}`, type: "nómina", date });
    }
  }

  const insurancePolicies = Array.isArray(universe.insurancePolicies) ? universe.insurancePolicies as Record<string, unknown>[] : [];
  for (const pol of insurancePolicies) {
    const ref = String(pol.policyNumber ?? "");
    const date = String(pol.startDate ?? "");
    if (ref) allDocRefs.push({ ref, type: "seguro", date });
  }

  const casualtyEvt = universe.casualtyEvent as Record<string, unknown> | undefined;
  if (casualtyEvt && casualtyEvt.date) {
    allDocRefs.push({ ref: "Siniestro", type: "siniestro", date: String(casualtyEvt.date) });
  }

  const extraExpenses = Array.isArray(universe.extraordinaryExpenses) ? universe.extraordinaryExpenses as Record<string, unknown>[] : [];
  for (const ex of extraExpenses) {
    allDocRefs.push({ ref: `${ex.type}-${ex.date}`, type: "extraordinario", date: String(ex.date ?? "") });
  }

  const loanDoc = universe.bankLoan as Record<string, unknown> | undefined;
  if (loanDoc) {
    const lRef = String(loanDoc.loanNumber ?? "");
    if (lRef) {
      const startD = String(loanDoc.startDate ?? `${params.year}-01-01`);
      allDocRefs.push({ ref: lRef, type: "préstamo", date: startD });
      const amortT = Array.isArray(loanDoc.amortizationTable) ? loanDoc.amortizationTable as Record<string, unknown>[] : [];
      for (const cuota of amortT) {
        allDocRefs.push({ ref: lRef, type: "cuota-préstamo", date: String(cuota.date ?? cuota.paymentDate ?? "") });
      }
    }
  }

  const mortgageDoc = universe.mortgage as Record<string, unknown> | undefined;
  if (mortgageDoc) {
    const mRef = String(mortgageDoc.loanNumber ?? "");
    if (mRef) {
      const startD = String(mortgageDoc.startDate ?? `${params.year}-01-01`);
      allDocRefs.push({ ref: mRef, type: "hipoteca", date: startD });
      const amortT = Array.isArray(mortgageDoc.amortizationTable) ? mortgageDoc.amortizationTable as Record<string, unknown>[] : [];
      for (const cuota of amortT) {
        allDocRefs.push({ ref: mRef, type: "cuota-hipoteca", date: String(cuota.date ?? cuota.paymentDate ?? "") });
      }
    }
  }

  const creditPol = universe.creditPolicy as Record<string, unknown> | undefined;
  if (creditPol) {
    const cpRef = String(creditPol.policyNumber ?? "");
    if (cpRef) allDocRefs.push({ ref: cpRef, type: "póliza-crédito", date: String(creditPol.startDate ?? `${params.year}-01-15`) });
  }

  const cardDoc = universe.creditCardStatement as Record<string, unknown> | undefined;
  if (cardDoc) {
    const cardMovs = Array.isArray(cardDoc.movements) ? cardDoc.movements as Record<string, unknown>[] : [];
    for (const mov of cardMovs) {
      allDocRefs.push({ ref: "Tarjeta-liquidación", type: "tarjeta", date: String(mov.date ?? "") });
    }
  }

  const fixedAssetDocs = Array.isArray(universe.fixedAssets) ? universe.fixedAssets as Record<string, unknown>[] : [];
  for (const fa of fixedAssetDocs) {
    const code = String(fa.code ?? "");
    if (code) allDocRefs.push({ ref: `Amort-${code}`, type: "amortización", date: `${params.year}-12-31` });
  }

  if (initialBS && initialBS.accountDebits) {
    allDocRefs.push({ ref: "Asiento apertura", type: "apertura", date: `${params.year}-01-01` });
  }

  if (dividends && dividends.accountDebits) {
    const divDate = String(dividends.date ?? dividends.approvalDate ?? `${params.year}-06-30`);
    allDocRefs.push({ ref: "Dividendos", type: "dividendos", date: divDate });
    const divPayEntry = dividends.paymentEntry as Record<string, unknown> | undefined;
    if (divPayEntry) {
      allDocRefs.push({ ref: "Dividendos", type: "pago-dividendos", date: String(divPayEntry.date ?? dividends.paymentDate ?? `${params.year}-07-15`) });
    }
  }

  if (shareholderAccts && shareholderAccts.accountDebits) {
    allDocRefs.push({ ref: "CC-Socios", type: "cc-socios", date: `${params.year}-01-15` });
  }

  const docsWithoutEntry = allDocRefs.filter(d => {
    if (entryDocs.has(d.ref)) return false;
    for (const eDoc of entryDocs) {
      if (eDoc.includes(d.ref) || d.ref.includes(eDoc)) return false;
    }
    return true;
  });

  const entriesWithoutDoc = entries.filter(e => {
    if (!e.document) return true;
    const found = allDocRefs.some(d => d.ref === e.document || e.document.includes(d.ref) || d.ref.includes(e.document));
    return !found;
  });

  if (docsWithoutEntry.length > 0) {
    console.log(`[cobertura] ${docsWithoutEntry.length} documentos SIN asiento:`);
    const byType = new Map<string, number>();
    for (const d of docsWithoutEntry) {
      byType.set(d.type, (byType.get(d.type) ?? 0) + 1);
    }
    for (const [type, count] of byType) {
      console.log(`  - ${type}: ${count} docs sin asiento`);
      const examples = docsWithoutEntry.filter(d => d.type === type).slice(0, 3);
      for (const ex of examples) console.log(`    → ${ex.ref} (${ex.date})`);
    }
  }

  if (entriesWithoutDoc.length > 0) {
    const filtered = entriesWithoutDoc.filter(e => {
      const doc = e.document;
      return doc && !["Asiento apertura", "Dividendos", "Tarjeta-liquidación", "Siniestro", "CC-Socios"].includes(doc)
        && !doc.startsWith("Amort-") && !doc.startsWith("Mod.") && !doc.startsWith("TC1-")
        && !doc.startsWith("Nómina") && !doc.startsWith("POL-") && !doc.startsWith("SEG-");
    });
    if (filtered.length > 0) {
      console.log(`[cobertura] ${filtered.length} asientos SIN documento identificado:`);
      for (const e of filtered.slice(0, 10)) {
        console.log(`  - #${e.entryNumber} "${e.concept}" doc="${e.document}" (${e.date})`);
      }
    }
  }

  const monthlyMap = new Map<string, { docs: number; entries: number; types: Map<string, number> }>();
  for (const d of allDocRefs) {
    const m = d.date.slice(0, 7);
    if (!m || m.length < 7) continue;
    const v = monthlyMap.get(m) ?? { docs: 0, entries: 0, types: new Map() };
    v.docs++;
    v.types.set(d.type, (v.types.get(d.type) ?? 0) + 1);
    monthlyMap.set(m, v);
  }
  for (const e of entries) {
    const m = e.date.slice(0, 7);
    if (!m || m.length < 7) continue;
    const v = monthlyMap.get(m) ?? { docs: 0, entries: 0, types: new Map() };
    v.entries++;
    monthlyMap.set(m, v);
  }
  const sortedMonths = [...monthlyMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  console.log(`[cobertura] Cobertura mensual (docs/asientos):`);
  for (const [month, { docs, entries: ents, types }] of sortedMonths) {
    const status = docs === 0 && ents > 0 ? " ⚠️ asientos sin docs" : ents === 0 && docs > 0 ? " ⚠️ docs sin asientos" : "";
    const typeStr = [...types.entries()].map(([t, c]) => `${t}:${c}`).join(", ");
    console.log(`  ${month}: ${docs} docs → ${ents} asientos [${typeStr}]${status}`);
  }

  console.log(`[journal] Diario determinista: ${entries.length} asientos generados desde documentos reales`);
  return { journalEntries: entries };
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
function getClient(config: AiConfig): OpenAI {
  if (config.provider === "openai") {
    if (!config.apiKey) {
      throw new Error("No hay ninguna API Key de OpenAI configurada. Añade tu clave en Configuración.");
    }
    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || "https://api.openai.com/v1",
    });
  }
  if (!config.deepseekApiKey) {
    throw new Error("No hay ninguna API Key de DeepSeek configurada. Añade tu clave en Configuración o contacta al administrador.");
  }
  return new OpenAI({
    apiKey: config.deepseekApiKey,
    baseURL: config.deepseekBaseUrl || "https://api.deepseek.com",
  });
}

function getModel(config: AiConfig): string {
  if (config.provider === "openai") {
    return config.model || "gpt-4.1-mini";
  }
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
  const monthlyBundlePromises = months.map((m) => {
    const startNum = invoiceNum;
    invoiceNum += invoicesPerMonth;
    return generateMonthlyBundle(
      params, scenario, client, model,
      m.start, m.end, m.label,
      invoicesPerMonth, startNum,
    ).then((r) => { progress(`Facturas ${m.label} completadas`); return r; });
  });

  const blockPromises: Promise<Record<string, unknown>>[] = [
    generateCommercialBlock(params, scenario, client, model).then((r) => { progress("Perfil comercial completado"); return r; }),
    generateInsuranceCasualty(params, scenario, client, model).then((r) => { progress("Seguros completados"); return r; }),
    generateExtraordinaryExpenses(params, scenario, client, model).then((r) => { progress("Extraordinarios completados"); return r; }),
    generateOperationsBlock(params, scenario, client, model).then((r) => { progress("Operaciones completadas"); return r; }),
  ];
  if (withEquity) {
    blockPromises.push(generateEquityBlock(params, scenario, client, model).then((r) => { progress("Capital y socios completado"); return r; }));
  }

  const [blocks, monthlyResults] = await Promise.all([
    Promise.all(blockPromises),
    Promise.all(monthlyBundlePromises),
  ]);

  const universe: Record<string, unknown> = {};
  for (const block of blocks) {
    if (block && typeof block === "object") {
      Object.assign(universe, block);
    }
  }

  if (universe.companyProfile && typeof universe.companyProfile === "object") {
    (universe.companyProfile as Record<string, unknown>).activity = params.activity || null;
  }

  const allInvoices: unknown[] = [];
  const allCardMovements: unknown[] = [];

  for (const result of monthlyResults) {
    if (result.invoices?.length) allInvoices.push(...result.invoices);
    if (result.cardMovements?.length) allCardMovements.push(...result.cardMovements);
  }

  universe.invoices = allInvoices;

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
    journalNote: "Cada gasto con tarjeta: DEBE gasto (6xx según naturaleza), HABER 410 (Acreedores por prestaciones de servicios). Al pago/liquidación bancaria: DEBE 410, HABER 572.",
    accountDebits: [{ accountCode: "629", accountName: "Otros servicios", amount: totalCardCharges, description: "Gastos tarjeta ejercicio" }],
    accountCredits: [{ accountCode: "410", accountName: "Acreedores por prestaciones de servicios", amount: totalCardCharges, description: "Total liquidado tarjeta" }],
  };

  universe.monthlyPayrolls = buildMonthlyPayrolls(params, universe);
  universe.serviceInvoices = buildServiceInvoices(params, scenario);
  universe.bankDebitNotes = buildBankDebitNotes(universe, scenario, params);
  universe.paymentReceipts = buildPaymentReceipts(universe, scenario, params);
  universe.bankStatements = buildBankStatements(universe, scenario, params);

  progress("Construyendo libro diario desde documentos...");
  const journalBlock = buildDeterministicJournal(universe, params);
  if (journalBlock && typeof journalBlock === "object") {
    Object.assign(universe, journalBlock);
  }
  console.log(`[journal] Diario completado: ${(journalBlock.journalEntries || []).length} asientos`);
  progress("Libro diario completado");

  // Compute warehouse cards (fichas de almacén) from invoices + inventory
  if (params.sector !== "Servicios") {
    const warehouseCards = computeWarehouseCards(universe);
    if (warehouseCards.length > 0) {
      universe.warehouseCards = warehouseCards;
    }
  }

  if (params.accountDigits && params.accountDigits > 4) {
    progress("Asignando subcuentas...");
    assignSubAccounts(universe, params.accountDigits);
    progress("Subcuentas asignadas");
  }

  progress("Calculando cierre de ejercicio...");
  universe.yearEndClosing = computeYearEndClosing(universe);
  progress("Cierre de ejercicio completado");

  return universe;
}

// ─── SUB-ACCOUNT ASSIGNMENT ───────────────────────────────────────────────────

const SUBACCOUNT_BASES: Record<string, string> = {
  "400": "Proveedores",
  "401": "Proveedores, efectos comerciales a pagar",
  "410": "Acreedores por prestaciones de servicios",
  "411": "Acreedores, efectos comerciales a pagar",
  "430": "Clientes",
  "431": "Clientes, efectos comerciales a cobrar",
  "440": "Deudores",
  "441": "Deudores, efectos comerciales a cobrar",
  "460": "Anticipos de remuneraciones",
  "465": "Remuneraciones pendientes de pago",
  "470": "Hacienda Pública, deudora",
  "4700": "HP deudora por IVA",
  "471": "Organismos de la Seguridad Social, deudores",
  "472": "HP IVA soportado",
  "473": "HP retenciones y pagos a cuenta",
  "4750": "HP acreedora por IVA",
  "4751": "HP acreedora por retenciones practicadas",
  "475": "HP acreedora por conceptos fiscales",
  "476": "Organismos de la Seguridad Social, acreedores",
  "477": "HP IVA repercutido",
  "551": "Cuenta corriente con socios y administradores",
  "553": "Cuenta corriente con socios y administradores",
  "570": "Caja",
  "572": "Bancos e instituciones de crédito c/c",
  "520": "Deudas a corto plazo con entidades de crédito",
  "170": "Deudas a largo plazo con entidades de crédito",
  "171": "Deudas a largo plazo",
  "173": "Proveedores de inmovilizado a largo plazo",
  "523": "Proveedores de inmovilizado a corto plazo",
  "5200": "Préstamos a corto plazo de entidades de crédito",
  "5201": "Deudas a c/p por crédito dispuesto",
  "174": "Acreedores por arrendamiento financiero a l/p",
  "524": "Acreedores por arrendamiento financiero a c/p",
};

function padCode(baseCode: string, seq: number, targetDigits: number): string {
  const seqStr = String(seq);
  const padLen = targetDigits - baseCode.length;
  if (padLen <= 0) return baseCode;
  return baseCode + seqStr.padStart(padLen, "0");
}

interface SubAccountEntry {
  baseCode: string;
  subCode: string;
  entityName: string;
}

function assignSubAccounts(universe: Record<string, unknown>, digits: number): void {
  const entityMap = new Map<string, Map<string, SubAccountEntry>>();
  const counters = new Map<string, number>();

  function getOrCreate(baseCode: string, entityName: string): string {
    if (!entityName || entityName.trim().length === 0) return padCode(baseCode, 0, digits);
    const normBase = baseCode.replace(/^0+/, "") || baseCode;
    const normEntity = entityName.trim().toLowerCase();

    if (!entityMap.has(normBase)) entityMap.set(normBase, new Map());
    const map = entityMap.get(normBase)!;

    if (map.has(normEntity)) return map.get(normEntity)!.subCode;

    const counter = (counters.get(normBase) ?? 0) + 1;
    counters.set(normBase, counter);
    const subCode = padCode(baseCode, counter, digits);
    map.set(normEntity, { baseCode, subCode, entityName: entityName.trim() });
    return subCode;
  }

  function entityFromContext(accountCode: string, context?: string): string {
    return context || "";
  }

  const suppliers = (universe.suppliers ?? []) as Array<Record<string, unknown>>;
  for (const s of suppliers) {
    const name = String(s.name ?? "");
    const base = String(s.accountCode ?? "400");
    const sub = getOrCreate(base, name);
    s.accountCode = sub;
    s.accountName = `${SUBACCOUNT_BASES[base] || "Proveedores"} — ${name}`;
  }

  const clients = (universe.clients ?? []) as Array<Record<string, unknown>>;
  for (const c of clients) {
    const name = String(c.name ?? "");
    const base = String(c.accountCode ?? "430");
    const sub = getOrCreate(base, name);
    c.accountCode = sub;
    c.accountName = `${SUBACCOUNT_BASES[base] || "Clientes"} — ${name}`;
  }

  const bankEntity = (() => {
    const bs = (universe.bankStatements ?? []) as Array<Record<string, unknown>>;
    if (bs.length > 0) return String(bs[0].bank ?? "Banco");
    return "Banco principal";
  })();
  const bankSub = getOrCreate("572", bankEntity);

  const loanEntity = (() => {
    const loan = universe.bankLoan as Record<string, unknown> | undefined;
    return loan ? String(loan.entity ?? "Banco préstamo") : "";
  })();
  if (loanEntity) {
    getOrCreate("170", loanEntity);
    getOrCreate("5200", loanEntity);
    getOrCreate("520", loanEntity);
  }

  const mortEntity = (() => {
    const mort = universe.mortgage as Record<string, unknown> | undefined;
    return mort ? String(mort.entity ?? "Banco hipoteca") : "";
  })();
  if (mortEntity) {
    getOrCreate("170", mortEntity);
    getOrCreate("5200", mortEntity);
  }

  const creditEntity = (() => {
    const cp = universe.creditPolicy as Record<string, unknown> | undefined;
    return cp ? String(cp.entity ?? "Banco póliza") : "";
  })();
  if (creditEntity) {
    getOrCreate("5201", creditEntity);
  }

  const serviceProviders = (universe.serviceInvoices ?? []) as Array<Record<string, unknown>>;
  const providersByName = new Map<string, string>();
  for (const si of serviceProviders) {
    const name = String(si.provider ?? "");
    if (name && !providersByName.has(name.toLowerCase())) {
      providersByName.set(name.toLowerCase(), getOrCreate("410", name));
    }
  }

  const shareholders = (((universe as any).shareholdersInfo?.shareholders) ?? []) as Array<Record<string, unknown>>;
  for (const sh of shareholders) {
    const name = String(sh.name ?? "");
    if (name) {
      getOrCreate("551", name);
    }
  }

  function replaceInEntry(entry: Record<string, unknown>, entityHint: string) {
    const hintLower = entityHint.toLowerCase();

    const replaceLines = (lines: Array<Record<string, unknown>>) => {
      for (const line of lines) {
        if (line.accountName === undefined || line.accountName === null) {
          line.accountName = "";
        }
        if (line.accountCode === undefined || line.accountCode === null) {
          line.accountCode = "";
        }
        const code = String(line.accountCode).trim();

        if (!code || code === "undefined") {
          line.accountCode = "";
          continue;
        }

        let replaced = false;
        const candidates = new Set<string>();
        candidates.add(code);
        if (code.length >= 4) candidates.add(code.substring(0, 4));
        if (code.length >= 3) candidates.add(code.substring(0, 3));
        if (code.length >= 2) candidates.add(code.substring(0, 2));

        for (const base of candidates) {
          if (entityMap.has(base)) {
            const map = entityMap.get(base)!;

            let matched = false;
            for (const [, ent] of map) {
              const entLower = ent.entityName.toLowerCase();
              if (hintLower.includes(entLower) ||
                  (entLower.length >= 4 && entLower.includes(hintLower.substring(0, Math.min(12, hintLower.length))))) {
                line.accountCode = ent.subCode;
                const currentName = String(line.accountName || "");
                if (currentName && !currentName.includes(ent.entityName)) {
                  line.accountName = `${currentName} (${ent.entityName})`;
                }
                matched = true;
                replaced = true;
                break;
              }
            }
            if (!matched && map.size === 1) {
              const only = map.values().next().value!;
              line.accountCode = only.subCode;
              replaced = true;
            }
            if (replaced) break;
          }
        }

        if (!replaced && code.length < digits) {
          line.accountCode = code.padEnd(digits, "0");
        }
      }
    };

    const debits = (entry.debits ?? entry.accountDebits ?? []) as Array<Record<string, unknown>>;
    const credits = (entry.credits ?? entry.accountCredits ?? []) as Array<Record<string, unknown>>;
    replaceLines(debits);
    replaceLines(credits);
  }

  const invoices = (universe.invoices ?? []) as Array<Record<string, unknown>>;
  for (const inv of invoices) {
    const party = String(inv.partyName ?? "");
    replaceInEntry(inv, party);
  }

  const svcInvoices = (universe.serviceInvoices ?? []) as Array<Record<string, unknown>>;
  for (const si of svcInvoices) {
    const party = String(si.provider ?? "");
    replaceInEntry(si, party);
  }

  const paymentReceipts = (universe.paymentReceipts ?? []) as Array<Record<string, unknown>>;
  for (const pr of paymentReceipts) {
    replaceInEntry(pr, String(pr.partyName ?? ""));
  }

  const docToEntity = new Map<string, string>();
  for (const inv of invoices) {
    const ref = String(inv.invoiceNumber ?? "");
    const party = String(inv.partyName ?? "");
    if (ref && party) docToEntity.set(ref.toLowerCase(), party);
  }
  for (const si of svcInvoices) {
    const ref = String(si.invoiceNumber ?? "");
    const party = String(si.provider ?? "");
    if (ref && party) docToEntity.set(ref.toLowerCase(), party);
  }
  for (const pr of paymentReceipts) {
    const ref = String(pr.receiptNumber ?? "");
    const party = String(pr.partyName ?? "");
    if (ref && party) docToEntity.set(ref.toLowerCase(), party);
  }

  const journals = (universe.journalEntries ?? []) as Array<Record<string, unknown>>;
  for (const je of journals) {
    const concept = String(je.concept ?? "");
    const document = String(je.document ?? "").trim();
    let hint = concept + " " + document;

    if (document.length >= 2) {
      const docLower = document.toLowerCase();
      for (const [ref, entity] of docToEntity) {
        if (ref.length < 2) continue;
        if (docLower === ref || docLower.includes(ref) || ref.includes(docLower)) {
          hint = entity + " " + hint;
          break;
        }
      }
    }

    replaceInEntry(je, hint);
  }

  const subAccountList: SubAccountEntry[] = [];
  for (const [, map] of entityMap) {
    for (const [, entry] of map) {
      subAccountList.push(entry);
    }
  }
  subAccountList.sort((a, b) => a.subCode.localeCompare(b.subCode));
  universe.subAccounts = subAccountList;
  universe.accountDigits = digits;

  console.log(`[subAccounts] Asignadas ${subAccountList.length} subcuentas (${digits} dígitos)`);
}

// ─── MONTHLY PAYROLLS BUILDER ─────────────────────────────────────────────────
interface MonthlyPayrollItem {
  month: string;
  monthLabel: string;
  devDate: string;
  payDate: string;
  employees: Array<Record<string, unknown>>;
  totalGross: number;
  totalSsEmployer: number;
  totalSsEmployee: number;
  totalIrpf: number;
  totalNetSalary: number;
  totalLaborCost: number;
  accountDebits: Array<{ accountCode: string; accountName: string; amount: number; description: string }>;
  accountCredits: Array<{ accountCode: string; accountName: string; amount: number; description: string }>;
  journalNote: string;
}

function buildMonthlyPayrolls(
  params: GenerateParams,
  universe: Record<string, unknown>,
): MonthlyPayrollItem[] {
  const payroll = universe.payroll as Record<string, unknown> | undefined;
  if (!payroll) return [];
  const employees = Array.isArray(payroll.employees) ? payroll.employees as Record<string, unknown>[] : [];
  if (employees.length === 0) return [];

  const months = getMonthsInPeriod(params);
  const { periodEnd } = getPeriodInfo(params);
  const payrolls: MonthlyPayrollItem[] = [];

  for (const m of months) {
    const lastDay = m.end;
    const nextMonth1Raw = (() => {
      const d = new Date(lastDay);
      d.setMonth(d.getMonth() + 1);
      d.setDate(1);
      return d.toISOString().slice(0, 10);
    })();
    const nextMonth1 = nextMonth1Raw > periodEnd ? periodEnd : nextMonth1Raw;

    let totalGross = 0, totalSsEmployer = 0, totalSsEmployee = 0, totalIrpf = 0, totalNet = 0;
    const monthEmployees: Record<string, unknown>[] = [];

    for (const emp of employees) {
      const gross = round2(Number(emp.grossSalary ?? 0));
      const ssEmpRate = Number(emp.ssEmployeeRate ?? 6.35);
      const ssErRate = Number(emp.ssEmployerRate ?? 30.40);
      const irpfRate = Number(emp.irpfRate ?? 15);

      const ssEmployee = round2(gross * ssEmpRate / 100);
      const ssEmployer = round2(gross * ssErRate / 100);
      const irpf = round2(gross * irpfRate / 100);
      const net = round2(gross - ssEmployee - irpf);

      totalGross += gross;
      totalSsEmployer += ssEmployer;
      totalSsEmployee += ssEmployee;
      totalIrpf += irpf;
      totalNet += net;

      monthEmployees.push({
        ...emp,
        grossSalary: gross,
        ssEmployeeAmount: ssEmployee,
        ssEmployerAmount: ssEmployer,
        irpfAmount: irpf,
        netSalary: net,
      });
    }

    totalGross = round2(totalGross);
    totalSsEmployer = round2(totalSsEmployer);
    totalSsEmployee = round2(totalSsEmployee);
    totalIrpf = round2(totalIrpf);
    totalNet = round2(totalNet);
    const ssTotal = round2(totalSsEmployee + totalSsEmployer);

    payrolls.push({
      month: m.start.slice(0, 7),
      monthLabel: m.label,
      devDate: lastDay,
      payDate: nextMonth1,
      employees: monthEmployees,
      totalGross,
      totalSsEmployer,
      totalSsEmployee,
      totalIrpf,
      totalNetSalary: totalNet,
      totalLaborCost: round2(totalGross + totalSsEmployer),
      accountDebits: [
        { accountCode: "640", accountName: "Sueldos y salarios", amount: totalGross, description: `Nómina ${m.label}` },
        { accountCode: "642", accountName: "SS a cargo de la empresa", amount: totalSsEmployer, description: `Cuota patronal ${m.label}` },
      ],
      accountCredits: [
        { accountCode: "476", accountName: "Organismos SS acreedores", amount: ssTotal, description: `SS total ${m.label}` },
        ...(totalIrpf > 0 ? [{ accountCode: "4751", accountName: "HP acreedora retenciones IRPF", amount: totalIrpf, description: `Retención IRPF ${m.label}` }] : []),
        { accountCode: "465", accountName: "Remuneraciones pendientes de pago", amount: totalNet, description: `Neto a pagar ${m.label}` },
      ],
      journalNote: `Devengo nómina ${m.label}: DEBE 640 (${totalGross}€) + 642 (${totalSsEmployer}€); HABER 476 (${ssTotal}€), 4751 (${totalIrpf}€), 465 (${totalNet}€). Pago: DEBE 465, HABER 572.`,
    });
  }

  return payrolls;
}

// ─── SERVICE INVOICES BUILDER ──────────────────────────────────────────────────
interface ServiceInvoiceItem {
  invoiceNumber: string; date: string; serviceType: string; provider: string; providerNif: string;
  concept: string; taxBase: number; taxRate: number; taxAmount: number;
  irpfRate: number; irpfAmount: number; total: number;
  paymentMethod: string; accountCode: string; accountName: string;
  accountDebits: Array<{ accountCode: string; accountName: string; amount: number; description: string }>;
  accountCredits: Array<{ accountCode: string; accountName: string; amount: number; description: string }>;
  journalNote: string;
}

function buildServiceInvoices(
  params: GenerateParams,
  scenario: Record<string, unknown>,
): ServiceInvoiceItem[] {
  const rates = TAX_RATES[params.taxRegime];
  const iva = rates.standard;
  const year = params.year;
  const months = getMonthsInPeriod(params);
  const bankEntity = String(scenario.bankEntity ?? "Entidad Bancaria");
  const taxName = params.taxRegime;

  const services: Array<{
    type: string; provider: string; nif: string; concept: string;
    monthlyBase: number; accountCode: string; accountName: string;
    hasIrpf: boolean; irpfRate: number;
  }> = [
    { type: "electricidad", provider: "Iberdrola Clientes S.A.U.", nif: "A95758389", concept: "Suministro eléctrico", monthlyBase: 180, accountCode: "628", accountName: "Suministros", hasIrpf: false, irpfRate: 0 },
    { type: "agua", provider: "Canal de Isabel II S.A.", nif: "A82342841", concept: "Suministro de agua y saneamiento", monthlyBase: 45, accountCode: "628", accountName: "Suministros", hasIrpf: false, irpfRate: 0 },
    { type: "telefono_internet", provider: "Telefónica de España S.A.U.", nif: "A82018474", concept: "Telefonía e Internet empresarial", monthlyBase: 85, accountCode: "629", accountName: "Otros servicios", hasIrpf: false, irpfRate: 0 },
    { type: "alquiler", provider: "Inmobiliaria Gestión Integral S.L.", nif: "B12345678", concept: "Alquiler local comercial", monthlyBase: 900, accountCode: "621", accountName: "Arrendamientos y cánones", hasIrpf: true, irpfRate: 19 },
    { type: "limpieza", provider: "Limpiezas Profesionales S.L.", nif: "B87654321", concept: "Servicio de limpieza mensual", monthlyBase: 120, accountCode: "629", accountName: "Otros servicios", hasIrpf: false, irpfRate: 0 },
  ];

  const invoices: ServiceInvoiceItem[] = [];
  let seq = 1;

  for (const m of months) {
    const monthNum = m.start.slice(5, 7);
    for (const svc of services) {
      const base = round2(svc.monthlyBase * (0.95 + Math.random() * 0.1));
      const taxAmount = round2(base * iva / 100);
      const irpfAmount = svc.hasIrpf ? round2(base * svc.irpfRate / 100) : 0;
      const total = round2(base + taxAmount - irpfAmount);
      const invNum = `SUM-${year}/${String(seq++).padStart(4, "0")}`;
      const invDate = `${year}-${monthNum}-${String(Math.min(28, 5 + Math.floor(Math.random() * 10))).padStart(2, "0")}`;

      const debits: ServiceInvoiceItem["accountDebits"] = [
        { accountCode: svc.accountCode, accountName: svc.accountName, amount: base, description: `${svc.concept} ${m.label}` },
        { accountCode: "472", accountName: `${taxName} soportado`, amount: taxAmount, description: `${taxName} ${iva}% s/ ${base}€` },
      ];
      const credits: ServiceInvoiceItem["accountCredits"] = [
        { accountCode: "410", accountName: "Acreedores por prestaciones de servicios", amount: total, description: `${svc.provider} — ${m.label}` },
      ];
      if (svc.hasIrpf) {
        credits.push({ accountCode: "4751", accountName: "HP acreedora IRPF retenciones", amount: irpfAmount, description: `Retención IRPF ${svc.irpfRate}% alquiler` });
      }

      invoices.push({
        invoiceNumber: invNum,
        date: invDate,
        serviceType: svc.type,
        provider: svc.provider,
        providerNif: svc.nif,
        concept: `${svc.concept} — ${m.label}`,
        taxBase: base,
        taxRate: iva,
        taxAmount,
        irpfRate: svc.irpfRate,
        irpfAmount,
        total,
        paymentMethod: svc.type === "alquiler" ? "transferencia" : "domiciliación bancaria",
        accountCode: svc.accountCode,
        accountName: svc.accountName,
        accountDebits: debits,
        accountCredits: credits,
        journalNote: `Gasto ${svc.type} ${m.label}: ${svc.accountCode} (${base}€) + 472 ${taxName} soportado (${taxAmount}€)${svc.hasIrpf ? ` − retención IRPF ${svc.irpfRate}% (${irpfAmount}€) → 4751` : ""}. Contrapartida: 410 (${total}€).${svc.paymentMethod === "domiciliación bancaria" ? " Pago por domiciliación: 410 → 572." : " Pago por transferencia: 410 → 572."}`,
      });
    }
  }

  return invoices;
}

// ─── PAYMENT RECEIPTS BUILDER ──────────────────────────────────────────────────
interface PaymentReceiptItem {
  receiptNumber: string; date: string; type: string; partyName: string; partyNif: string;
  concept: string; amount: number; paymentMethod: string;
  relatedInvoice: string; bankAccount: string;
  accountDebits: Array<{ accountCode: string; accountName: string; amount: number; description: string }>;
  accountCredits: Array<{ accountCode: string; accountName: string; amount: number; description: string }>;
  journalNote: string;
}

function buildPaymentReceipts(
  universe: Record<string, unknown>,
  scenario: Record<string, unknown>,
  params?: GenerateParams,
): PaymentReceiptItem[] {
  const receipts: PaymentReceiptItem[] = [];
  const bankAccount = String(scenario.bankAccount ?? "ES00 0000 0000 0000 0000 0000");
  let seq = 1;

  const pEnd = params ? getPeriodInfo(params).periodEnd : "9999-12-31";
  const clamp = (d: string) => d > pEnd ? pEnd : d;

  const invoices = Array.isArray(universe.invoices) ? universe.invoices : [];
  for (const inv of invoices) {
    const i = inv as Record<string, unknown>;
    const invDate = String(i.date ?? "");
    const invTotal = Number(i.total ?? 0);
    if (!invDate || !invTotal) continue;

    const d = new Date(invDate);
    d.setDate(d.getDate() + Math.floor(Math.random() * 25) + 5);
    const payDate = clamp(d.toISOString().slice(0, 10));

    const isSale = i.type === "sale";
    const partyName = String(i.partyName ?? "Tercero");
    const partyNif = String(i.partyNif ?? "");
    const invNum = String(i.invoiceNumber ?? "");

    receipts.push({
      receiptNumber: `REC-${payDate.slice(0, 4)}/${String(seq++).padStart(4, "0")}`,
      date: payDate,
      type: isSale ? "cobro" : "pago",
      partyName,
      partyNif,
      concept: isSale ? `Cobro factura ${invNum}` : `Pago factura ${invNum}`,
      amount: invTotal,
      paymentMethod: "transferencia",
      relatedInvoice: invNum,
      bankAccount,
      accountDebits: isSale
        ? [{ accountCode: "572", accountName: "Bancos c/c", amount: invTotal, description: `Cobro ${invNum}` }]
        : [{ accountCode: "400", accountName: "Proveedores", amount: invTotal, description: `Pago ${invNum}` }],
      accountCredits: isSale
        ? [{ accountCode: "430", accountName: "Clientes", amount: invTotal, description: `Cancelación deuda ${invNum}` }]
        : [{ accountCode: "572", accountName: "Bancos c/c", amount: invTotal, description: `Pago ${invNum}` }],
      journalNote: isSale
        ? `Cobro cliente por factura ${invNum}: 572 (${invTotal}€) al debe, 430 al haber.`
        : `Pago proveedor factura ${invNum}: 400 (${invTotal}€) al debe, 572 al haber.`,
    });
  }

  const serviceInvoices = Array.isArray(universe.serviceInvoices) ? universe.serviceInvoices : [];
  for (const si of serviceInvoices) {
    const s = si as Record<string, unknown>;
    const invDate = String(s.date ?? "");
    const invTotal = Number(s.total ?? 0);
    if (!invDate || !invTotal) continue;

    const d = new Date(invDate);
    d.setDate(d.getDate() + Math.floor(Math.random() * 10) + 3);
    const payDate = clamp(d.toISOString().slice(0, 10));
    const invNum = String(s.invoiceNumber ?? "");
    const provider = String(s.provider ?? "Proveedor servicios");

    receipts.push({
      receiptNumber: `REC-${payDate.slice(0, 4)}/${String(seq++).padStart(4, "0")}`,
      date: payDate,
      type: "pago",
      partyName: provider,
      partyNif: String(s.providerNif ?? ""),
      concept: `Pago ${String(s.serviceType ?? "servicio")} — ${invNum}`,
      amount: invTotal,
      paymentMethod: String(s.paymentMethod ?? "domiciliación bancaria"),
      relatedInvoice: invNum,
      bankAccount,
      accountDebits: [{ accountCode: "410", accountName: "Acreedores por prestaciones de servicios", amount: invTotal, description: `Pago ${invNum}` }],
      accountCredits: [{ accountCode: "572", accountName: "Bancos c/c", amount: invTotal, description: `Pago ${provider}` }],
      journalNote: `Pago servicio ${s.serviceType} (${invNum}): 410 al debe (${invTotal}€), 572 al haber.`,
    });
  }

  return receipts;
}

// ─── BANK STATEMENTS BUILDER (deterministic from real operations) ─────────────

interface BankTransaction {
  date: string;
  concept: string;
  reference: string;
  debit: number | null;
  credit: number | null;
  balance: number;
}

interface BankStatementMonth {
  bank: string;
  accountNumber: string;
  period: string;
  openingBalance: number;
  closingBalance: number;
  transactions: BankTransaction[];
}

function buildBankStatements(
  universe: Record<string, unknown>,
  scenario: Record<string, unknown>,
  params: GenerateParams,
): BankStatementMonth[] {
  const bankEntity = String(scenario.bankEntity ?? "Entidad Bancaria");
  const bankAccount = String(scenario.bankAccount ?? "ES00 0000 0000 0000 0000 0000");

  const rawTxns: Array<{ date: string; concept: string; reference: string; amount: number; isCredit: boolean }> = [];

  const paymentReceipts = Array.isArray(universe.paymentReceipts) ? universe.paymentReceipts : [];
  for (const pr of paymentReceipts) {
    const r = pr as Record<string, unknown>;
    const amount = Number(r.amount ?? 0);
    if (!amount) continue;
    const isCobro = r.type === "cobro";
    rawTxns.push({
      date: String(r.date ?? ""),
      concept: String(r.concept ?? (isCobro ? "Cobro" : "Pago")),
      reference: String(r.receiptNumber ?? ""),
      amount,
      isCredit: isCobro,
    });
  }

  const ssPayments = Array.isArray(universe.socialSecurityPayments) ? universe.socialSecurityPayments : [];
  for (const ss of ssPayments) {
    const s = ss as Record<string, unknown>;
    const amount = Number(s.totalPayment ?? 0);
    if (!amount) continue;
    rawTxns.push({
      date: String(s.dueDate ?? ""),
      concept: `Adeudo TC1 Seguridad Social — ${s.month ?? ""}`,
      reference: `TC1-${s.month ?? ""}`,
      amount,
      isCredit: false,
    });
  }

  const taxLiqs = Array.isArray(universe.taxLiquidations) ? universe.taxLiquidations : [];
  for (const liq of taxLiqs) {
    const l = liq as Record<string, unknown>;
    const amount = Number(l.result ?? 0);
    if (!amount || amount <= 0) continue;
    const model = String(l.model ?? "");
    const period = String(l.period ?? "");
    rawTxns.push({
      date: String(l.dueDate ?? ""),
      concept: `Pago Mod.${model} ${period}`,
      reference: `MOD${model}-${period}`,
      amount,
      isCredit: false,
    });
  }

  const loan = universe.bankLoan as Record<string, unknown> | undefined;
  if (loan?.amortizationTable && Array.isArray(loan.amortizationTable)) {
    for (const row of loan.amortizationTable as Array<Record<string, unknown>>) {
      const installment = Number(row.installment ?? row.cuota ?? 0);
      if (!installment) continue;
      rawTxns.push({
        date: String(row.date ?? ""),
        concept: `Cuota préstamo — ${row.period ?? ""}`,
        reference: String(loan.loanNumber ?? "PREST") + `-${row.period ?? ""}`,
        amount: installment,
        isCredit: false,
      });
    }
  }

  const mortgage = universe.mortgage as Record<string, unknown> | undefined;
  if (mortgage?.amortizationTable && Array.isArray(mortgage.amortizationTable)) {
    for (const row of mortgage.amortizationTable as Array<Record<string, unknown>>) {
      const installment = Number(row.installment ?? row.cuota ?? 0);
      if (!installment) continue;
      rawTxns.push({
        date: String(row.date ?? ""),
        concept: `Cuota hipoteca — ${row.period ?? ""}`,
        reference: String(mortgage.loanNumber ?? "HIP") + `-${row.period ?? ""}`,
        amount: installment,
        isCredit: false,
      });
    }
  }

  const insurances = Array.isArray(universe.insurancePolicies) ? universe.insurancePolicies : [];
  for (const ins of insurances) {
    const i = ins as Record<string, unknown>;
    const premium = Number(i.annualPremium ?? 0);
    if (!premium) continue;
    rawTxns.push({
      date: String(i.startDate ?? ""),
      concept: `Prima seguro ${i.type ?? "multirriesgo"} — póliza ${i.policyNumber ?? ""}`,
      reference: `SEG-${i.policyNumber ?? ""}`,
      amount: premium,
      isCredit: false,
    });
  }

  const monthlyPayrolls = Array.isArray(universe.monthlyPayrolls) ? universe.monthlyPayrolls as Record<string, unknown>[] : [];
  if (monthlyPayrolls.length > 0) {
    for (const mp of monthlyPayrolls) {
      const netPay = Number(mp.totalNetSalary ?? 0);
      if (netPay > 0) {
        rawTxns.push({
          date: String(mp.payDate ?? ""),
          concept: `Pago nómina neta — ${mp.monthLabel ?? ""}`,
          reference: `NOM-${mp.monthLabel ?? ""}`,
          amount: netPay,
          isCredit: false,
        });
      }
    }
  } else {
    const payroll = universe.payroll as Record<string, unknown> | undefined;
    if (payroll?.totalNetSalary) {
      rawTxns.push({
        date: String(payroll.paymentDate ?? ""),
        concept: `Pago nómina neta — ${payroll.month ?? ""}`,
        reference: `NOM-${payroll.month ?? ""}`,
        amount: Number(payroll.totalNetSalary),
        isCredit: false,
      });
    }
  }

  const div = universe.dividendDistribution as Record<string, unknown> | undefined;
  if (div?.netDividendPaid) {
    rawTxns.push({
      date: String(div.paymentDate ?? ""),
      concept: `Pago dividendos netos ejercicio ${div.fiscalYear ?? ""}`,
      reference: `DIV-${div.fiscalYear ?? ""}`,
      amount: Number(div.netDividendPaid),
      isCredit: false,
    });
  }

  const policy = universe.creditPolicy as Record<string, unknown> | undefined;
  if (policy?.totalSettlement) {
    rawTxns.push({
      date: String(policy.endDate ?? ""),
      concept: `Liquidación póliza de crédito — ${policy.policyNumber ?? ""}`,
      reference: `POL-${policy.policyNumber ?? ""}`,
      amount: Number(policy.totalSettlement),
      isCredit: false,
    });
  }

  const fixedAssets = Array.isArray(universe.fixedAssets) ? universe.fixedAssets : [];
  for (const fa of fixedAssets) {
    const a = fa as Record<string, unknown>;
    const amount = Number(a.purchaseCost ?? a.acquisitionValue ?? 0);
    if (!amount) continue;
    rawTxns.push({
      date: String(a.purchaseDate ?? a.acquisitionDate ?? ""),
      concept: `Compra inmovilizado: ${a.description ?? "activo fijo"}`,
      reference: `INM-${a.code ?? a.assetCode ?? ""}`,
      amount,
      isCredit: false,
    });
  }

  const cardSettlement = universe.creditCardStatement as Record<string, unknown> | undefined;
  if (cardSettlement?.totalCharges) {
    rawTxns.push({
      date: String(cardSettlement.settlementDate ?? ""),
      concept: "Liquidación tarjeta de crédito",
      reference: "TRJ-LIQ",
      amount: Number(cardSettlement.totalCharges),
      isCredit: false,
    });
  }

  const bankLoan = universe.bankLoan as Record<string, unknown> | undefined;
  if (bankLoan?.principal) {
    const loanAmount = Number(bankLoan.principal);
    const loanDate = String(bankLoan.startDate ?? bankLoan.formalizationDate ?? "");
    if (loanAmount && loanDate) {
      rawTxns.push({
        date: loanDate,
        concept: `Formalización préstamo bancario — ${bankLoan.loanNumber ?? ""}`,
        reference: `PREST-FORM-${bankLoan.loanNumber ?? ""}`,
        amount: loanAmount,
        isCredit: true,
      });
    }
  }

  const creditPolicy = universe.creditPolicy as Record<string, unknown> | undefined;
  if (creditPolicy?.drawdownAmount || creditPolicy?.limit) {
    const drawdown = Number(creditPolicy.drawdownAmount ?? creditPolicy.limit ?? 0);
    const drawDate = String(creditPolicy.startDate ?? "");
    if (drawdown && drawDate) {
      rawTxns.push({
        date: drawDate,
        concept: `Disposición póliza de crédito — ${creditPolicy.policyNumber ?? ""}`,
        reference: `POL-DISP-${creditPolicy.policyNumber ?? ""}`,
        amount: drawdown,
        isCredit: true,
      });
    }
  }

  const shareholders = universe.shareholdersInfo as Record<string, unknown> | undefined;
  if (shareholders) {
    const capitalBank = Number(shareholders.bankContribution ?? shareholders.totalCapital ?? 0);
    const capDate = String(shareholders.constitutionDate ?? shareholders.date ?? "");
    if (capitalBank && capDate) {
      rawTxns.push({
        date: capDate,
        concept: "Aportación capital social — desembolso bancario",
        reference: "CAP-APORT",
        amount: capitalBank,
        isCredit: true,
      });
    }
  }

  if (mortgage?.principal) {
    const mortDate = String(mortgage.startDate ?? mortgage.formalizationDate ?? "");
    const mortPrincipal = Number(mortgage.principal);
    if (mortPrincipal && mortDate) {
      rawTxns.push({
        date: mortDate,
        concept: `Formalización hipoteca — ingreso préstamo hipotecario`,
        reference: `HIP-FORM`,
        amount: mortPrincipal,
        isCredit: true,
      });
    }
  }

  const extraExpenses = Array.isArray(universe.extraordinaryExpenses) ? universe.extraordinaryExpenses : [];
  for (const exp of extraExpenses) {
    const e = exp as Record<string, unknown>;
    const amount = Number(e.amount ?? 0);
    if (!amount) continue;
    const credits = Array.isArray(e.accountCredits) ? e.accountCredits : [];
    const debits = Array.isArray(e.accountDebits) ? e.accountDebits : [];
    const has572Credit = credits.some((c: unknown) => String((c as Record<string, unknown>).accountCode) === "572");
    const has572Debit = debits.some((d: unknown) => String((d as Record<string, unknown>).accountCode) === "572");
    if (has572Credit) {
      rawTxns.push({
        date: String(e.date ?? ""),
        concept: String(e.description ?? e.concept ?? "Gasto extraordinario"),
        reference: `EXT-${e.type ?? ""}`,
        amount,
        isCredit: false,
      });
    } else if (has572Debit) {
      rawTxns.push({
        date: String(e.date ?? ""),
        concept: String(e.description ?? e.concept ?? "Ingreso extraordinario"),
        reference: `EXT-${e.type ?? ""}`,
        amount,
        isCredit: true,
      });
    }
  }

  const validTxns = rawTxns.filter(t => t.date && t.amount > 0);
  validTxns.sort((a, b) => a.date.localeCompare(b.date));

  const monthMap = new Map<string, typeof validTxns>();
  for (const t of validTxns) {
    const monthKey = t.date.slice(0, 7);
    if (!monthMap.has(monthKey)) monthMap.set(monthKey, []);
    monthMap.get(monthKey)!.push(t);
  }

  const months = getMonthsInPeriod(params);
  const initialBalance = universe.initialBalanceSheet
    ? Number((universe.initialBalanceSheet as Record<string, unknown>).bankBalance ?? 20000)
    : 20000;

  let runningBalance = Math.round(initialBalance * 100) / 100;
  const statements: BankStatementMonth[] = [];

  for (const m of months) {
    const monthKey = m.start.slice(0, 7);
    const monthTxns = monthMap.get(monthKey) ?? [];
    const openingBalance = runningBalance;
    const transactions: BankTransaction[] = [];

    for (const t of monthTxns) {
      if (t.isCredit) {
        runningBalance += t.amount;
      } else {
        runningBalance -= t.amount;
      }
      runningBalance = Math.round(runningBalance * 100) / 100;

      transactions.push({
        date: t.date,
        concept: t.concept,
        reference: t.reference,
        debit: t.isCredit ? null : t.amount,
        credit: t.isCredit ? t.amount : null,
        balance: runningBalance,
      });
    }

    statements.push({
      bank: bankEntity,
      accountNumber: bankAccount,
      period: m.label,
      openingBalance: Math.round(openingBalance * 100) / 100,
      closingBalance: runningBalance,
      transactions,
    });
  }

  return statements;
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
          { accountCode: "5200", accountName: "Préstamos a CP de entidades de crédito", amount: principal, description: "Amortización capital" },
          { accountCode: "662", accountName: "Intereses de deudas con entidades de crédito", amount: interest, description: "Intereses préstamo" },
        ],
        accountCredits: [{ accountCode: "572", accountName: "Bancos c/c", amount: installment, description: `Cuota ${row.period} préstamo` }],
        journalNote: `Cuota préstamo ${row.period}: DEBE 5200 (capital amortizado ${principal}€) + 662 (intereses ${interest}€), HABER 572 (${installment}€).`,
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
          { accountCode: "5200", accountName: "Préstamos a CP de entidades de crédito", amount: principal, description: "Amortización capital hipoteca" },
          { accountCode: "662", accountName: "Intereses de deudas con entidades de crédito", amount: interest, description: "Intereses hipotecarios" },
        ],
        accountCredits: [{ accountCode: "572", accountName: "Bancos c/c", amount: installment, description: `Cuota ${row.period} hipoteca` }],
        journalNote: `Cuota hipoteca ${row.period}: DEBE 5200 (capital amortizado ${principal}€) + 662 (intereses ${interest}€), HABER 572 (${installment}€).`,
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
        { accountCode: "662", accountName: "Intereses de deudas", amount: Number(policy.interestAmount ?? 0), description: "Intereses saldo dispuesto" },
        { accountCode: "626", accountName: "Servicios bancarios", amount: Number(policy.openingCommission ?? 0) + Number(policy.unusedCommission ?? 0), description: "Comisiones bancarias" },
      ],
      accountCredits: [{ accountCode: "572", accountName: "Bancos c/c", amount, description: "Liquidación póliza crédito" }],
      journalNote: `Liquidación póliza crédito ${policy.policyNumber} al vencimiento (${policy.endDate}). Intereses (662) + comisiones (626) al debe; adeudo total ${amount}€ en cuenta corriente (572) al haber.`,
    });
  }

  // 7. Payroll net payments (monthly)
  const monthlyPayrolls = Array.isArray(universe.monthlyPayrolls) ? universe.monthlyPayrolls as Record<string, unknown>[] : [];
  if (monthlyPayrolls.length > 0) {
    for (const mp of monthlyPayrolls) {
      const amount = Number(mp.totalNetSalary ?? 0);
      if (amount > 0) {
        notes.push({
          id: `nomina-pago-${mp.month}`,
          date: String(mp.payDate ?? ""),
          concept: `Pago nómina neta — ${mp.monthLabel}`,
          reference: nextRef("NOM"),
          beneficiary: "Empleados (transferencia bancaria individual)",
          amount,
          category: "Nóminas",
          accountDebits: [{ accountCode: "465", accountName: "Remuneraciones pendientes de pago", amount, description: `Salario neto ${mp.monthLabel}` }],
          accountCredits: [{ accountCode: "572", accountName: "Bancos c/c", amount, description: "Transferencia salario neto" }],
          journalNote: `Pago nómina ${mp.monthLabel}: cancelación 465 (salario neto pendiente) mediante transferencias individuales a empleados. 465 al debe, 572 al haber. Importe total: ${amount}€.`,
        });
      }
    }
  } else {
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

// ─── YEAR-END CLOSING (deterministic from journal) ───────────────────────────

interface LedgerMovement {
  entryNumber: string;
  date: string;
  concept: string;
  debit: number;
  credit: number;
  balance: number;
}

interface LedgerAccount {
  accountCode: string;
  accountName: string;
  movements: LedgerMovement[];
  totalDebit: number;
  totalCredit: number;
  balance: number;
  balanceSide: "deudor" | "acreedor";
}

interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  sumDebit: number;
  sumCredit: number;
  balanceDebit: number;
  balanceCredit: number;
}

interface RegularizationEntry {
  entryNumber: string;
  date: string;
  concept: string;
  debits: Array<{ accountCode: string; accountName: string; amount: number }>;
  credits: Array<{ accountCode: string; accountName: string; amount: number }>;
  totalAmount: number;
}

interface ProfitLossSection {
  title: string;
  accounts: Array<{ accountCode: string; accountName: string; amount: number }>;
  subtotal: number;
}

interface BalanceSheetItem {
  accountCode: string;
  accountName: string;
  amount: number;
}

interface BalanceSheetSection {
  title: string;
  items: BalanceSheetItem[];
  subtotal: number;
}

interface YearEndClosing {
  ledger: LedgerAccount[];
  trialBalance: TrialBalanceRow[];
  regularizationEntries: RegularizationEntry[];
  profitAndLoss: {
    income: ProfitLossSection[];
    expenses: ProfitLossSection[];
    totalIncome: number;
    totalExpenses: number;
    netResult: number;
    resultType: "Beneficio" | "Pérdida";
  };
  finalBalanceSheet: {
    assets: BalanceSheetSection[];
    totalAssets: number;
    equity: BalanceSheetSection[];
    liabilities: BalanceSheetSection[];
    totalEquityAndLiabilities: number;
  };
  closingEntry: RegularizationEntry;
}

const PGC_ACCOUNT_GROUPS: Record<string, string> = {
  "1": "Financiación básica",
  "2": "Activo no corriente",
  "3": "Existencias",
  "4": "Acreedores y deudores por operaciones comerciales",
  "5": "Cuentas financieras",
  "6": "Compras y gastos",
  "7": "Ventas e ingresos",
};

const EXPENSE_SECTIONS: Record<string, string> = {
  "60": "Compras",
  "61": "Variación de existencias",
  "62": "Servicios exteriores",
  "63": "Tributos",
  "64": "Gastos de personal",
  "65": "Otros gastos de gestión",
  "66": "Gastos financieros",
  "67": "Pérdidas procedentes de activos no corrientes y gastos excepcionales",
  "68": "Dotaciones para amortizaciones",
  "69": "Pérdidas por deterioro y otras dotaciones",
};

const INCOME_SECTIONS: Record<string, string> = {
  "70": "Ventas de mercaderías, de producción propia, de servicios, etc.",
  "71": "Variación de existencias de productos terminados y en curso",
  "73": "Trabajos realizados para la empresa",
  "74": "Subvenciones, donaciones y legados",
  "75": "Otros ingresos de gestión",
  "76": "Ingresos financieros",
  "77": "Beneficios procedentes de activos no corrientes e ingresos excepcionales",
  "79": "Excesos y aplicaciones de provisiones y de pérdidas por deterioro",
};

function computeYearEndClosing(universe: Record<string, unknown>): YearEndClosing {
  const entries = Array.isArray(universe.journalEntries) ? universe.journalEntries : [];

  const accountMap = new Map<string, { name: string; movements: LedgerMovement[]; totalDebit: number; totalCredit: number }>();

  function getAccount(code: string, name: string) {
    if (!accountMap.has(code)) {
      accountMap.set(code, { name, movements: [], totalDebit: 0, totalCredit: 0 });
    }
    const acc = accountMap.get(code)!;
    if (!acc.name || acc.name === code) acc.name = name;
    return acc;
  }

  for (const entry of entries) {
    const e = entry as Record<string, unknown>;
    const entryNum = String(e.entryNumber ?? "");
    const date = String(e.date ?? "");
    const concept = String(e.concept ?? "");

    const debits = Array.isArray(e.debits) ? e.debits : [];
    for (const d of debits) {
      const dd = d as Record<string, unknown>;
      const code = String(dd.accountCode ?? "");
      const name = String(dd.accountName ?? code);
      const amount = Number(dd.amount ?? 0);
      if (!code || !amount) continue;
      const acc = getAccount(code, name);
      acc.totalDebit += amount;
      const runBal = acc.totalDebit - acc.totalCredit;
      acc.movements.push({ entryNumber: entryNum, date, concept, debit: amount, credit: 0, balance: Math.round(runBal * 100) / 100 });
    }

    const credits = Array.isArray(e.credits) ? e.credits : [];
    for (const c of credits) {
      const cc = c as Record<string, unknown>;
      const code = String(cc.accountCode ?? "");
      const name = String(cc.accountName ?? code);
      const amount = Number(cc.amount ?? 0);
      if (!code || !amount) continue;
      const acc = getAccount(code, name);
      acc.totalCredit += amount;
      const runBal = acc.totalDebit - acc.totalCredit;
      acc.movements.push({ entryNumber: entryNum, date, concept, debit: 0, credit: amount, balance: Math.round(runBal * 100) / 100 });
    }
  }

  const ledger: LedgerAccount[] = [];
  for (const [code, data] of accountMap) {
    const td = Math.round(data.totalDebit * 100) / 100;
    const tc = Math.round(data.totalCredit * 100) / 100;
    const bal = Math.round((td - tc) * 100) / 100;
    ledger.push({
      accountCode: code,
      accountName: data.name,
      movements: data.movements,
      totalDebit: td,
      totalCredit: tc,
      balance: Math.abs(bal),
      balanceSide: bal >= 0 ? "deudor" : "acreedor",
    });
  }
  ledger.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  const trialBalance: TrialBalanceRow[] = ledger.map((a) => ({
    accountCode: a.accountCode,
    accountName: a.accountName,
    sumDebit: a.totalDebit,
    sumCredit: a.totalCredit,
    balanceDebit: a.balanceSide === "deudor" ? a.balance : 0,
    balanceCredit: a.balanceSide === "acreedor" ? a.balance : 0,
  }));

  const expenseAccounts = ledger.filter((a) => a.accountCode.startsWith("6"));
  const incomeAccounts = ledger.filter((a) => a.accountCode.startsWith("7"));

  const regEntries: RegularizationEntry[] = [];
  const lastDate = (() => {
    let maxDate = "";
    for (const e of entries) {
      const d = String((e as Record<string, unknown>).date ?? "");
      if (d > maxDate) maxDate = d;
    }
    const year = maxDate.slice(0, 4) || "2025";
    return `${year}-12-31`;
  })();

  const nextEntryNum = (() => {
    let max = 0;
    for (const e of entries) {
      const n = parseInt(String((e as Record<string, unknown>).entryNumber ?? "0").replace(/\D/g, ""), 10);
      if (n > max) max = n;
    }
    return max + 1;
  })();

  let totalExpenses = 0;
  let totalIncome = 0;

  const regExpenseDebits: Array<{ accountCode: string; accountName: string; amount: number }> = [];
  const regExpenseCredits: Array<{ accountCode: string; accountName: string; amount: number }> = [];

  for (const acc of expenseAccounts) {
    if (acc.balance === 0) continue;
    if (acc.balanceSide === "deudor") {
      totalExpenses += acc.balance;
      regExpenseCredits.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount: acc.balance });
    } else {
      totalIncome += acc.balance;
      regExpenseDebits.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount: acc.balance });
    }
  }

  for (const acc of incomeAccounts) {
    if (acc.balance === 0) continue;
    if (acc.balanceSide === "acreedor") {
      totalIncome += acc.balance;
      regExpenseDebits.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount: acc.balance });
    } else {
      totalExpenses += acc.balance;
      regExpenseCredits.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount: acc.balance });
    }
  }

  totalExpenses = Math.round(totalExpenses * 100) / 100;
  totalIncome = Math.round(totalIncome * 100) / 100;
  const netResult = Math.round((totalIncome - totalExpenses) * 100) / 100;
  const isProfit = netResult >= 0;

  if (regExpenseCredits.length > 0 || regExpenseDebits.length > 0) {
    const regDebits = [...regExpenseDebits];
    const regCredits = [...regExpenseCredits];

    if (isProfit) {
      regCredits.push({ accountCode: "129", accountName: "Resultado del ejercicio", amount: Math.abs(netResult) });
    } else {
      regDebits.push({ accountCode: "129", accountName: "Resultado del ejercicio", amount: Math.abs(netResult) });
    }

    regDebits.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    regCredits.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    const totalReg = Math.round(regDebits.reduce((s, d) => s + d.amount, 0) * 100) / 100;

    regEntries.push({
      entryNumber: String(nextEntryNum),
      date: lastDate,
      concept: "Regularización: cierre cuentas de gastos (grupo 6) e ingresos (grupo 7) — traspaso a Resultado del ejercicio (129)",
      debits: regDebits,
      credits: regCredits,
      totalAmount: totalReg,
    });
  }

  const expSections: ProfitLossSection[] = [];
  const expBySubgroup = new Map<string, Array<{ accountCode: string; accountName: string; amount: number }>>();
  for (const acc of expenseAccounts) {
    if (acc.balance === 0) continue;
    const sub = acc.accountCode.slice(0, 2);
    if (!expBySubgroup.has(sub)) expBySubgroup.set(sub, []);
    const amt = acc.balanceSide === "deudor" ? acc.balance : -acc.balance;
    expBySubgroup.get(sub)!.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount: Math.round(amt * 100) / 100 });
  }
  for (const [sub, accounts] of Array.from(expBySubgroup).sort(([a], [b]) => a.localeCompare(b))) {
    const subtotal = Math.round(accounts.reduce((s, a) => s + a.amount, 0) * 100) / 100;
    expSections.push({ title: EXPENSE_SECTIONS[sub] ?? `Grupo ${sub}`, accounts, subtotal });
  }

  const incSections: ProfitLossSection[] = [];
  const incBySubgroup = new Map<string, Array<{ accountCode: string; accountName: string; amount: number }>>();
  for (const acc of incomeAccounts) {
    if (acc.balance === 0) continue;
    const sub = acc.accountCode.slice(0, 2);
    if (!incBySubgroup.has(sub)) incBySubgroup.set(sub, []);
    const amt = acc.balanceSide === "acreedor" ? acc.balance : -acc.balance;
    incBySubgroup.get(sub)!.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount: Math.round(amt * 100) / 100 });
  }
  for (const [sub, accounts] of Array.from(incBySubgroup).sort(([a], [b]) => a.localeCompare(b))) {
    const subtotal = Math.round(accounts.reduce((s, a) => s + a.amount, 0) * 100) / 100;
    incSections.push({ title: INCOME_SECTIONS[sub] ?? `Grupo ${sub}`, accounts, subtotal });
  }

  const profitAndLoss = {
    income: incSections,
    expenses: expSections,
    totalIncome,
    totalExpenses,
    netResult,
    resultType: (isProfit ? "Beneficio" : "Pérdida") as "Beneficio" | "Pérdida",
  };

  const balanceAccounts = ledger.filter((a) => !a.accountCode.startsWith("6") && !a.accountCode.startsWith("7"));

  const resultAccount: LedgerAccount = {
    accountCode: "129",
    accountName: "Resultado del ejercicio",
    movements: [],
    totalDebit: isProfit ? 0 : Math.abs(netResult),
    totalCredit: isProfit ? Math.abs(netResult) : 0,
    balance: Math.abs(netResult),
    balanceSide: isProfit ? "acreedor" : "deudor",
  };

  const existing129 = balanceAccounts.find(a => a.accountCode === "129");
  if (existing129) {
    if (isProfit) {
      existing129.totalCredit += Math.abs(netResult);
    } else {
      existing129.totalDebit += Math.abs(netResult);
    }
    const bal129 = existing129.totalDebit - existing129.totalCredit;
    existing129.balance = Math.abs(Math.round(bal129 * 100) / 100);
    existing129.balanceSide = bal129 >= 0 ? "deudor" : "acreedor";
  } else {
    balanceAccounts.push(resultAccount);
    balanceAccounts.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  }

  const assetItems: BalanceSheetItem[] = [];
  const equityItems: BalanceSheetItem[] = [];
  const liabilityItems: BalanceSheetItem[] = [];

  const CONTRA_ASSET_PREFIXES = ["28", "29", "39"];
  const PASIVO_GROUP1_PREFIXES = ["14", "15", "16", "17", "18", "19"];

  for (const acc of balanceAccounts) {
    if (acc.balance === 0) continue;
    const signedAmount = acc.balanceSide === "deudor" ? acc.balance : -acc.balance;
    const g = acc.accountCode.charAt(0);
    const sub2 = acc.accountCode.slice(0, 2);

    if (g === "2") {
      if (CONTRA_ASSET_PREFIXES.includes(sub2)) {
        assetItems.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount: signedAmount });
      } else {
        assetItems.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount: acc.balance });
      }
    } else if (g === "3") {
      if (sub2 === "39") {
        assetItems.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount: signedAmount });
      } else {
        assetItems.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount: acc.balance });
      }
    } else if (g === "4") {
      if (acc.balanceSide === "deudor") {
        assetItems.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount: acc.balance });
      } else {
        liabilityItems.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount: acc.balance });
      }
    } else if (g === "5") {
      if (acc.balanceSide === "deudor") {
        assetItems.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount: acc.balance });
      } else {
        liabilityItems.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount: acc.balance });
      }
    } else if (g === "1") {
      if (PASIVO_GROUP1_PREFIXES.includes(sub2)) {
        liabilityItems.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount: acc.balance });
      } else if (acc.accountCode === "129") {
        equityItems.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount: signedAmount });
      } else {
        equityItems.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount: acc.balance });
      }
    }
  }

  const buildSections = (items: BalanceSheetItem[]): BalanceSheetSection[] => {
    const grouped = new Map<string, BalanceSheetItem[]>();
    for (const item of items) {
      const g = item.accountCode.charAt(0);
      const label = PGC_ACCOUNT_GROUPS[g] ?? `Grupo ${g}`;
      if (!grouped.has(label)) grouped.set(label, []);
      grouped.get(label)!.push(item);
    }
    return Array.from(grouped).map(([title, items]) => ({
      title,
      items: items.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
      subtotal: Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100,
    }));
  };

  const assetSections = buildSections(assetItems);
  const equitySections = buildSections(equityItems);
  const liabilitySections = buildSections(liabilityItems);

  const totalAssets = Math.round(assetSections.reduce((s, sec) => s + sec.subtotal, 0) * 100) / 100;
  const totalEquityAndLiabilities = Math.round(
    (equitySections.reduce((s, sec) => s + sec.subtotal, 0) + liabilitySections.reduce((s, sec) => s + sec.subtotal, 0)) * 100
  ) / 100;

  const closingDebits: Array<{ accountCode: string; accountName: string; amount: number }> = [];
  const closingCredits: Array<{ accountCode: string; accountName: string; amount: number }> = [];

  for (const acc of balanceAccounts) {
    if (acc.balance === 0) continue;
    if (acc.balanceSide === "deudor") {
      closingCredits.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount: acc.balance });
    } else {
      closingDebits.push({ accountCode: acc.accountCode, accountName: acc.accountName, amount: acc.balance });
    }
  }
  closingDebits.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  closingCredits.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  const closingTotal = Math.round(closingDebits.reduce((s, d) => s + d.amount, 0) * 100) / 100;

  const closingEntry: RegularizationEntry = {
    entryNumber: String(nextEntryNum + regEntries.length),
    date: lastDate,
    concept: "Asiento de cierre del ejercicio — Se cierran todas las cuentas de balance (grupos 1 a 5) dejando saldos a cero.",
    debits: closingDebits,
    credits: closingCredits,
    totalAmount: closingTotal,
  };

  return {
    ledger,
    trialBalance,
    regularizationEntries: regEntries,
    profitAndLoss,
    finalBalanceSheet: {
      assets: assetSections,
      totalAssets,
      equity: equitySections,
      liabilities: liabilitySections,
      totalEquityAndLiabilities,
    },
    closingEntry,
  };
}
