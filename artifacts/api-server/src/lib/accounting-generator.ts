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

function buildPrompt(params: GenerateParams): string {
  const rates = TAX_RATES[params.taxRegime];
  const companyHint = params.companyName ? `La empresa se llama "${params.companyName}".` : "Inventa un nombre de empresa realista para el sector.";
  const level = params.educationLevel ?? "Medio";
  const opsPerMonth = params.operationsPerMonth ?? 8;
  const withPayroll = params.includePayroll !== false;
  const withSS = params.includeSocialSecurity !== false && withPayroll;
  const withTax = params.includeTaxLiquidation !== false;
  const withLoan = params.includeBankLoan !== false;
  const withMortgage = params.includeMortgage === true;
  const withPolicy = params.includeCreditPolicy !== false;
  const withFixedAssets = params.includeFixedAssets !== false;
  const withShareholders = params.includeShareholdersInfo !== false;
  const isNew = params.isNewCompany === true;
  const withInitialBalance = params.includeInitialBalance !== false && !isNew;
  const withShareholderAccounts = params.includeShareholderAccounts !== false;
  const withDividends = params.includeDividends !== false;

  // Period calculation
  const hasCustomPeriod = !!(params.startDate && params.endDate);
  const periodStart = hasCustomPeriod ? params.startDate! : `${params.year}-01-01`;
  const periodEnd = hasCustomPeriod ? params.endDate! : `${params.year}-12-31`;
  const startParts = periodStart.split("-");
  const endParts = periodEnd.split("-");
  const startMonthNum = parseInt(startParts[1], 10);
  const endMonthNum = parseInt(endParts[1], 10);
  const startYearNum = parseInt(startParts[0], 10);
  const endYearNum = parseInt(endParts[0], 10);
  const numMonths = Math.max(1, (endYearNum - startYearNum) * 12 + (endMonthNum - startMonthNum) + 1);
  const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const periodLabel = hasCustomPeriod
    ? `del ${parseInt(startParts[2], 10)} de ${MONTHS_ES[startMonthNum - 1]} de ${startYearNum} al ${parseInt(endParts[2], 10)} de ${MONTHS_ES[endMonthNum - 1]} de ${endYearNum} (${numMonths} mes${numMonths > 1 ? "es" : ""})`
    : `ejercicio completo ${params.year} (12 meses)`;
  // A representative mid-period month for document examples
  const midMonthIdx = Math.floor((startMonthNum - 1 + numMonths / 2)) % 12;
  const midYear = startYearNum + Math.floor((startMonthNum - 1 + Math.floor(numMonths / 2)) / 12);
  const midMonthLabel = `${MONTHS_ES[midMonthIdx].charAt(0).toUpperCase() + MONTHS_ES[midMonthIdx].slice(1)} ${midYear}`;

  const levelNote = level === "Superior"
    ? "Nivel Superior (FP Grado Superior): incluye operaciones complejas como periodificaciones contables, ajustes de ejercicio, operaciones con efectos comerciales, factoring, leasing, y mayor detalle en impuestos."
    : "Nivel Medio (FP Grado Medio): operaciones claras y bien comentadas, enfocadas en facturas, nóminas, IVA trimestral y préstamos básicos.";

  const conditionalSections: string[] = [];

  if (withPayroll) {
    conditionalSections.push(`  "payroll": {
    "month": "${midMonthLabel}",
    "employees": [
      {
        "name": "María García López",
        "naf": "281234567890",
        "category": "Oficial de 1ª",
        "grossSalary": 2200.00,
        "irpfRate": 15,
        "irpfAmount": 330.00,
        "ssEmployeeRate": 6.35,
        "ssEmployeeAmount": 139.70,
        "netSalary": 1730.30,
        "ssEmployerRate": 30.40,
        "ssEmployerAmount": 668.80
      }
    ],
    "totalGross": 2200.00,
    "totalIrpf": 330.00,
    "totalSsEmployee": 139.70,
    "totalNetSalary": 1730.30,
    "totalSsEmployer": 668.80,
    "totalLaborCost": 2868.80,
    "journalNote": "La nómina genera: (1) Gasto en sueldos (640); (2) Gasto SS empresa (642); (3) Retenciones IRPF (4751); (4) Cuotas SS (476); (5) Salarios netos (465).",
    "accountDebits": [
      { "accountCode": "640", "accountName": "Sueldos y salarios", "amount": 2200.00, "description": "Salario bruto" },
      { "accountCode": "642", "accountName": "Seguridad Social a cargo de la empresa", "amount": 668.80, "description": "Cuota patronal SS" }
    ],
    "accountCredits": [
      { "accountCode": "465", "accountName": "Remuneraciones pendientes de pago", "amount": 1730.30, "description": "Salario neto a pagar" },
      { "accountCode": "4751", "accountName": "H.P. acreedora por retenciones practicadas", "amount": 330.00, "description": "IRPF retenido" },
      { "accountCode": "476", "accountName": "Organismos de la Seguridad Social acreedores", "amount": 808.50, "description": "SS empleado + SS empresa" }
    ]
  },`);
  }

  if (withSS) {
    conditionalSections.push(`  "socialSecurityPayments": [
    {
      "month": "Octubre ${params.year}",
      "dueDate": "${params.year}-11-30",
      "employeeCount": 2,
      "totalGross": 4000.00,
      "ssEmployeeAmount": 254.00,
      "ssEmployerAmount": 1216.00,
      "totalPayment": 1470.00,
      "journalNote": "Pago TC1 a la Seguridad Social. Se cancela la deuda con la SS (476) y se carga a bancos (572). Cubre las cuotas obrera y patronal del mes.",
      "accountDebits": [
        { "accountCode": "476", "accountName": "Organismos de la Seguridad Social acreedores", "amount": 1470.00, "description": "Cuota SS mes octubre" }
      ],
      "accountCredits": [
        { "accountCode": "572", "accountName": "Bancos e instituciones de crédito c/c", "amount": 1470.00, "description": "Pago domiciliado TC1" }
      ]
    }
  ],`);
  } else {
    conditionalSections.push(`  "socialSecurityPayments": [],`);
  }

  if (withTax) {
    conditionalSections.push(`  "taxLiquidations": [
    {
      "model": "${params.taxRegime === "IGIC" ? "420" : "303"}",
      "period": "T1",
      "dueDate": "${params.year}-04-20",
      "taxableBase": 25000.00,
      "outputTax": ${params.taxRegime === "IGIC" ? 1750 : 5250},
      "inputTax": ${params.taxRegime === "IGIC" ? 700 : 2100},
      "result": ${params.taxRegime === "IGIC" ? 1050 : 3150},
      "paymentType": "ingreso",
      "journalNote": "Liquidación trimestral Modelo ${params.taxRegime === "IGIC" ? "420 (IGIC)" : "303 (IVA)"}. La diferencia entre ${params.taxRegime} repercutido (477) y ${params.taxRegime} soportado (472) determina la cuota a ingresar en Hacienda (4750).",
      "accountDebits": [
        { "accountCode": "477", "accountName": "${params.taxRegime} repercutido", "amount": ${params.taxRegime === "IGIC" ? 1750 : 5250}, "description": "${params.taxRegime} devengado 1T" }
      ],
      "accountCredits": [
        { "accountCode": "472", "accountName": "${params.taxRegime} soportado", "amount": ${params.taxRegime === "IGIC" ? 700 : 2100}, "description": "${params.taxRegime} deducible 1T" },
        { "accountCode": "4750", "accountName": "H.P. acreedora por ${params.taxRegime}", "amount": ${params.taxRegime === "IGIC" ? 1050 : 3150}, "description": "Cuota a ingresar Mod.${params.taxRegime === "IGIC" ? "420" : "303"} 1T" }
      ]
    },
    {
      "model": "IS",
      "period": "Annual",
      "dueDate": "${params.year + 1}-07-25",
      "taxableBase": 45000.00,
      "outputTax": 10800.00,
      "inputTax": 0,
      "result": 10800.00,
      "paymentType": "ingreso",
      "journalNote": "Impuesto sobre Sociedades (IS) del ejercicio ${params.year}. Tipo general del 25% sobre el resultado contable ajustado. Se registra el gasto (630) y la deuda con Hacienda (4752).",
      "accountDebits": [
        { "accountCode": "630", "accountName": "Impuesto sobre beneficios", "amount": 10800.00, "description": "IS ejercicio ${params.year}" }
      ],
      "accountCredits": [
        { "accountCode": "4752", "accountName": "H.P. acreedora por Impuesto sobre Sociedades", "amount": 10800.00, "description": "Cuota IS a pagar" }
      ]
    }
  ],`);
  } else {
    conditionalSections.push(`  "taxLiquidations": [],`);
  }

  if (withLoan) {
    conditionalSections.push(`  "bankLoan": {
    "entity": "Banco Ejemplo",
    "loanNumber": "PRE-${params.year}-001",
    "principal": 50000.00,
    "annualRate": 4.5,
    "termMonths": 60,
    "startDate": "${params.year}-01-01",
    "monthlyInstallment": 929.27,
    "amortizationTable": [
      { "period": 1, "date": "${params.year}-02-01", "installment": 929.27, "interest": 187.50, "principal": 741.77, "balance": 49258.23 },
      { "period": 2, "date": "${params.year}-03-01", "installment": 929.27, "interest": 184.72, "principal": 744.55, "balance": 48513.68 },
      { "period": 3, "date": "${params.year}-04-01", "installment": 929.27, "interest": 181.93, "principal": 747.34, "balance": 47766.34 }
    ],
    "journalNote": "Contabilización del préstamo bancario. Al recibir el préstamo se abona la cuenta 170 (largo plazo). Cada cuota mensual se desglosa en amortización de capital (170/520) e intereses (662).",
    "accountDebits": [
      { "accountCode": "572", "accountName": "Bancos e instituciones de crédito c/c vista", "amount": 50000.00, "description": "Recepción del préstamo" }
    ],
    "accountCredits": [
      { "accountCode": "170", "accountName": "Deudas a largo plazo con entidades de crédito", "amount": 50000.00, "description": "Préstamo bancario concedido" }
    ]
  },`);
  }

  if (withMortgage) {
    conditionalSections.push(`  "mortgage": {
    "entity": "CaixaBank",
    "loanNumber": "HIP-${params.year}-001",
    "propertyDescription": "Local comercial en Calle Principal, 15 - ${params.year === 2024 ? "Madrid" : "Barcelona"}",
    "propertyValue": 250000.00,
    "principal": 180000.00,
    "annualRate": 3.2,
    "termMonths": 240,
    "startDate": "${params.year}-03-01",
    "monthlyInstallment": 1021.50,
    "amortizationTable": [
      { "period": 1, "date": "${params.year}-04-01", "installment": 1021.50, "interest": 480.00, "principal": 541.50, "balance": 179458.50 },
      { "period": 2, "date": "${params.year}-05-01", "installment": 1021.50, "interest": 478.56, "principal": 542.94, "balance": 178915.56 },
      { "period": 3, "date": "${params.year}-06-01", "installment": 1021.50, "interest": 477.10, "principal": 544.40, "balance": 178371.16 }
    ],
    "journalNote": "Hipoteca sobre local comercial. El inmueble se activa en el balance (cuenta 221/222). La hipoteca se divide en corto (521) y largo plazo (170). Cada cuota: intereses (662) + amortización de capital.",
    "accountDebits": [
      { "accountCode": "221", "accountName": "Construcciones", "amount": 250000.00, "description": "Valor de adquisición del local" }
    ],
    "accountCredits": [
      { "accountCode": "170", "accountName": "Deudas a largo plazo con entidades de crédito", "amount": 168000.00, "description": "Hipoteca a largo plazo" },
      { "accountCode": "521", "accountName": "Deudas a corto plazo con entidades de crédito", "amount": 12000.00, "description": "Vencimiento a corto plazo" },
      { "accountCode": "572", "accountName": "Bancos", "amount": 70000.00, "description": "Entrada pagada en efectivo" }
    ]
  },`);
  }

  if (withPolicy) {
    conditionalSections.push(`  "creditPolicy": {
    "entity": "Banco Ejemplo",
    "policyNumber": "POL-${params.year}-001",
    "limit": 30000.00,
    "drawnAmount": 18000.00,
    "annualRate": 5.5,
    "openingCommission": 150.00,
    "unusedCommission": 60.00,
    "startDate": "${params.year}-06-01",
    "endDate": "${params.year}-11-30",
    "interestAmount": 495.00,
    "totalSettlement": 705.00,
    "journalNote": "Liquidación de póliza de crédito. Intereses sobre el saldo dispuesto (663) y comisiones (626). Al cancelar, se carga la cuenta 5201.",
    "accountDebits": [
      { "accountCode": "663", "accountName": "Intereses de deudas", "amount": 495.00, "description": "Intereses sobre saldo dispuesto" },
      { "accountCode": "626", "accountName": "Servicios bancarios y similares", "amount": 210.00, "description": "Comisiones apertura y no disposición" }
    ],
    "accountCredits": [
      { "accountCode": "5201", "accountName": "Deudas a corto plazo por póliza de crédito", "amount": 705.00, "description": "Total a pagar en liquidación" }
    ]
  },`);
  }

  if (withFixedAssets) {
    conditionalSections.push(`  "fixedAssets": [
    {
      "code": "AE-001",
      "description": "Mobiliario de oficina",
      "purchaseDate": "${params.year}-01-15",
      "purchaseCost": 8500.00,
      "usefulLifeYears": 10,
      "annualDepreciation": 850.00,
      "accumulatedDepreciation": 850.00,
      "netBookValue": 7650.00,
      "depreciationMethod": "Lineal",
      "assetAccountCode": "216",
      "accDepreciationCode": "2816",
      "depExpenseCode": "681",
      "journalNote": "Amortización anual del mobiliario de oficina. Método lineal: coste/vida útil. Se carga la cuenta de gasto (681) y se abona la amortización acumulada (2816).",
      "accountDebits": [
        { "accountCode": "681", "accountName": "Amortización del inmovilizado material", "amount": 850.00, "description": "Dotación amortización mobiliario" }
      ],
      "accountCredits": [
        { "accountCode": "2816", "accountName": "Amortización acumulada del mobiliario", "amount": 850.00, "description": "Amortización acumulada año ${params.year}" }
      ]
    },
    {
      "code": "AE-002",
      "description": "Equipos informáticos",
      "purchaseDate": "${params.year}-03-01",
      "purchaseCost": 4200.00,
      "usefulLifeYears": 4,
      "annualDepreciation": 1050.00,
      "accumulatedDepreciation": 1050.00,
      "netBookValue": 3150.00,
      "depreciationMethod": "Lineal",
      "assetAccountCode": "217",
      "accDepreciationCode": "2817",
      "depExpenseCode": "681",
      "journalNote": "Amortización anual equipos informáticos. Vida útil fiscal máxima 4 años según tablas oficiales de amortización.",
      "accountDebits": [
        { "accountCode": "681", "accountName": "Amortización del inmovilizado material", "amount": 1050.00, "description": "Dotación amortización equipos" }
      ],
      "accountCredits": [
        { "accountCode": "2817", "accountName": "Amortización acumulada de equipos para procesos de información", "amount": 1050.00, "description": "Amortización acumulada año ${params.year}" }
      ]
    }
  ],`);
  } else {
    conditionalSections.push(`  "fixedAssets": [],`);
  }

  if (withShareholders) {
    conditionalSections.push(`  "shareholdersInfo": {
    "companyType": "SL",
    "legalForm": "Sociedad de Responsabilidad Limitada",
    "shareCapital": 10000.00,
    "nominalValuePerShare": 100.00,
    "totalShares": 100,
    "constitutionDate": "${params.year - 3}-06-15",
    "registryEntry": "Tomo 1234, Folio 56, Sección 8ª, Hoja M-123456",
    "shareholders": [
      {
        "name": "Ana Martínez Ruiz",
        "nif": "12345678A",
        "role": "socio_administrador",
        "participationPercentage": 60,
        "nominalValuePerShare": 100.00,
        "numberOfShares": 60,
        "totalCapitalAmount": 6000.00
      },
      {
        "name": "Carlos López Sánchez",
        "nif": "87654321B",
        "role": "socio",
        "participationPercentage": 40,
        "nominalValuePerShare": 100.00,
        "numberOfShares": 40,
        "totalCapitalAmount": 4000.00
      }
    ],
    "journalNote": "La cuenta 100 (Capital social) recoge las aportaciones de los socios. Cada socio tiene participaciones con valor nominal. Las reservas (112, 113) son beneficios no distribuidos de ejercicios anteriores.",
    "accountDebits": [
      { "accountCode": "572", "accountName": "Bancos e instituciones de crédito c/c", "amount": 10000.00, "description": "Desembolso del capital en cuenta bancaria" }
    ],
    "accountCredits": [
      { "accountCode": "100", "accountName": "Capital social", "amount": 10000.00, "description": "Capital suscrito y desembolsado" }
    ]
  },`);
  }

  if (withInitialBalance) {
    conditionalSections.push(`  "initialBalanceSheet": {
    "date": "${params.year}-01-01",
    "description": "Balance de situación a 1 de enero de ${params.year} - Asiento de apertura del ejercicio",
    "nonCurrentAssets": [
      { "accountCode": "216", "accountName": "Mobiliario", "amount": 8500.00, "note": "Valor contable neto" },
      { "accountCode": "217", "accountName": "Equipos informáticos", "amount": 3150.00, "note": "Valor contable neto" }
    ],
    "currentAssets": [
      { "accountCode": "300", "accountName": "Mercaderías", "amount": 12000.00, "note": "Existencias iniciales" },
      { "accountCode": "430", "accountName": "Clientes", "amount": 8500.00, "note": "Saldo clientes pendiente" },
      { "accountCode": "472", "accountName": "${params.taxRegime} soportado", "amount": 1200.00, "note": "${params.taxRegime} pendiente deducción" },
      { "accountCode": "572", "accountName": "Bancos c/c", "amount": 25000.00, "note": "Saldo banco IBAN ...7890" }
    ],
    "equity": [
      { "accountCode": "100", "accountName": "Capital social", "amount": 10000.00, "note": "Capital social escriturado" },
      { "accountCode": "112", "accountName": "Reserva legal", "amount": 1000.00, "note": "Reserva legal acumulada" },
      { "accountCode": "113", "accountName": "Reservas voluntarias", "amount": 2000.00, "note": "Reservas voluntarias" },
      { "accountCode": "129", "accountName": "Resultado del ejercicio anterior", "amount": 5000.00, "note": "Beneficio pendiente aplicación" }
    ],
    "nonCurrentLiabilities": [
      { "accountCode": "170", "accountName": "Deudas a largo plazo con entidades de crédito", "amount": 35000.00, "note": "Préstamo bancario vto. > 1 año" }
    ],
    "currentLiabilities": [
      { "accountCode": "400", "accountName": "Proveedores", "amount": 5350.00, "note": "Deuda proveedores pendiente" },
      { "accountCode": "477", "accountName": "${params.taxRegime} repercutido", "amount": 1050.00, "note": "${params.taxRegime} pendiente ingreso" }
    ],
    "totalAssets": 58350.00,
    "totalEquityAndLiabilities": 58350.00,
    "journalNote": "El asiento de apertura (1 de enero) regenera el balance del ejercicio anterior. Se cargan todos los activos y se abonan todos los pasivos y el patrimonio neto. Total Activo = Total Pasivo + PN.",
    "accountDebits": [
      { "accountCode": "216", "accountName": "Mobiliario", "amount": 8500.00, "description": "Inmovilizado material" },
      { "accountCode": "217", "accountName": "Equipos informáticos", "amount": 3150.00, "description": "Inmovilizado material" },
      { "accountCode": "300", "accountName": "Mercaderías", "amount": 12000.00, "description": "Existencias" },
      { "accountCode": "430", "accountName": "Clientes", "amount": 8500.00, "description": "Derechos de cobro" },
      { "accountCode": "472", "accountName": "${params.taxRegime} soportado", "amount": 1200.00, "description": "Hacienda deudora" },
      { "accountCode": "572", "accountName": "Bancos c/c", "amount": 25000.00, "description": "Tesorería" }
    ],
    "accountCredits": [
      { "accountCode": "100", "accountName": "Capital social", "amount": 10000.00, "description": "Patrimonio neto" },
      { "accountCode": "112", "accountName": "Reserva legal", "amount": 1000.00, "description": "Patrimonio neto" },
      { "accountCode": "113", "accountName": "Reservas voluntarias", "amount": 2000.00, "description": "Patrimonio neto" },
      { "accountCode": "129", "accountName": "Resultado del ejercicio anterior", "amount": 5000.00, "description": "Patrimonio neto" },
      { "accountCode": "170", "accountName": "Deudas a largo plazo c.e.c.", "amount": 35000.00, "description": "Pasivo no corriente" },
      { "accountCode": "400", "accountName": "Proveedores", "amount": 5350.00, "description": "Pasivo corriente" },
      { "accountCode": "477", "accountName": "${params.taxRegime} repercutido", "amount": 1050.00, "description": "Pasivo corriente" }
    ]
  },`);
  }

  if (withShareholderAccounts) {
    conditionalSections.push(`  "shareholderAccounts": {
    "description": "Cuenta corriente con socios y administradores - ejercicio ${params.year}",
    "transactions": [
      {
        "date": "${params.year}-03-15",
        "concept": "Anticipo a cuenta de dividendos futuros",
        "shareholderName": "Ana Martínez Ruiz",
        "accountCode": "553",
        "accountName": "Cuenta corriente con socios y administradores",
        "debit": null,
        "credit": 2000.00,
        "balance": -2000.00
      },
      {
        "date": "${params.year}-06-10",
        "concept": "Préstamo del socio Carlos López a la empresa",
        "shareholderName": "Carlos López Sánchez",
        "accountCode": "553",
        "accountName": "Cuenta corriente con socios y administradores",
        "debit": null,
        "credit": 5000.00,
        "balance": -7000.00
      },
      {
        "date": "${params.year}-09-01",
        "concept": "Devolución parcial préstamo socio",
        "shareholderName": "Carlos López Sánchez",
        "accountCode": "553",
        "accountName": "Cuenta corriente con socios y administradores",
        "debit": 3000.00,
        "credit": null,
        "balance": -4000.00
      },
      {
        "date": "${params.year}-10-20",
        "concept": "Retribución administrador pendiente de pago",
        "shareholderName": "Ana Martínez Ruiz",
        "accountCode": "551",
        "accountName": "Cuenta corriente con administradores",
        "debit": null,
        "credit": 1500.00,
        "balance": -1500.00
      }
    ],
    "closingBalance551": -1500.00,
    "closingBalance553": -4000.00,
    "journalNote": "Cuenta 551: operaciones con administradores (retribuciones, anticipos, préstamos). Cuenta 553: operaciones con socios. Saldo acreedor = empresa debe a socio/admin. Saldo deudor = socio/admin debe a empresa. Intereses según art. 18 LIS.",
    "accountDebits": [
      { "accountCode": "651", "accountName": "Retribución de administradores", "amount": 1500.00, "description": "Remuneración órgano administración" }
    ],
    "accountCredits": [
      { "accountCode": "551", "accountName": "Cuenta corriente con administradores", "amount": 1500.00, "description": "Retribución pendiente pago" }
    ]
  },`);
  }

  if (withDividends) {
    conditionalSections.push(`  "dividendDistribution": {
    "fiscalYear": ${params.year - 1},
    "approvalDate": "${params.year}-06-30",
    "paymentDate": "${params.year}-07-15",
    "totalNetProfit": 20000.00,
    "legalReserve": 2000.00,
    "voluntaryReserve": 3000.00,
    "totalDividends": 15000.00,
    "dividendPerShare": 150.00,
    "irpfWithholdingRate": 19,
    "perShareholder": [
      {
        "shareholderName": "Ana Martínez Ruiz",
        "participationPercentage": 60,
        "grossDividend": 9000.00,
        "irpfWithholdingRate": 19,
        "irpfWithholdingAmount": 1710.00,
        "netDividend": 7290.00
      },
      {
        "shareholderName": "Carlos López Sánchez",
        "participationPercentage": 40,
        "grossDividend": 6000.00,
        "irpfWithholdingRate": 19,
        "irpfWithholdingAmount": 1140.00,
        "netDividend": 4860.00
      }
    ],
    "journalNote": "Distribución del resultado: (1) Dotación Reserva Legal mín. 10% hasta 20% capital social (cta 112); (2) Reserva voluntaria (113); (3) Dividendos aprobados en Junta (526). Al pagar: 526 a 572 + retención IRPF 19% (4751). La retención se ingresa en Hacienda Mod.123.",
    "accountDebits": [
      { "accountCode": "129", "accountName": "Resultado del ejercicio", "amount": 20000.00, "description": "Aplicación del resultado ${params.year - 1}" }
    ],
    "accountCredits": [
      { "accountCode": "112", "accountName": "Reserva legal", "amount": 2000.00, "description": "Dotación reserva legal 10%" },
      { "accountCode": "113", "accountName": "Reservas voluntarias", "amount": 3000.00, "description": "Reserva voluntaria" },
      { "accountCode": "526", "accountName": "Dividendo activo a pagar", "amount": 15000.00, "description": "Dividendos aprobados en Junta" }
    ]
  },`);
  }

  const optionalSectionsText = conditionalSections.join("\n");

  return `Eres un experto contable español y debes generar un universo contable completo para prácticas de contabilidad.

PARÁMETROS:
- Sector económico: ${params.sector}
- Régimen fiscal: ${params.taxRegime} (Tipo general: ${rates.standard}%, Reducido: ${rates.reduced}%, Superreducido: ${rates.superreduced}%)
- Período del ejercicio: ${periodLabel}
- Todas las fechas DEBEN estar comprendidas entre ${periodStart} y ${periodEnd} inclusive.
- Año fiscal: ${params.year}
- Nivel educativo: ${levelNote}
- Operaciones en el libro diario: mínimo ${opsPerMonth} asientos por mes (total período: mínimo ${opsPerMonth * numMonths})
- ${companyHint}

TIPO DE EMPRESA:
- Empresa nueva (primer ejercicio): ${isNew ? "SÍ" : "NO"}
- Si NO es nueva, el tipo de sociedad es coherente con los socios y reservas existentes.

SECCIONES A INCLUIR:
- Facturas: SÍ (mínimo 6, mix compras y ventas)
- Nóminas: ${withPayroll ? "SÍ" : "NO"}
- Seguridad Social (TC1): ${withSS ? "SÍ (pagos mensuales de SS)" : "NO"}
- Liquidaciones fiscales (${params.taxRegime} trimestral + IS anual): ${withTax ? "SÍ" : "NO"}
- Préstamo bancario: ${withLoan ? "SÍ" : "NO"}
- Hipoteca: ${withMortgage ? "SÍ" : "NO"}
- Póliza de crédito: ${withPolicy ? "SÍ" : "NO"}
- Inmovilizado y amortizaciones: ${withFixedAssets ? "SÍ" : "NO"}
- Socios y capital social (shareholdersInfo): ${withShareholders ? "SÍ (incluye estructura de socios, participaciones, tipo de sociedad y asiento de constitución/aportación)" : "NO - omitir el campo shareholdersInfo del JSON"}
- Balance de apertura (initialBalanceSheet): ${withInitialBalance ? "SÍ (asiento de apertura a 1 enero con activos, pasivos y patrimonio neto coherentes con los socios)" : "NO - omitir el campo initialBalanceSheet del JSON"}
- Cuenta corriente con socios/administradores (shareholderAccounts): ${withShareholderAccounts ? "SÍ (operaciones con cuentas 551 y 553: anticipos, préstamos, retribuciones administrador)" : "NO - omitir el campo shareholderAccounts del JSON"}
- Reparto de dividendos (dividendDistribution): ${withDividends ? "SÍ (junta aprobación resultado, dotación reservas, dividendo con retención IRPF 19%)" : "NO - omitir el campo dividendDistribution del JSON"}
- Seguros: SÍ (2 pólizas)
- Siniestro/extraordinario: SÍ
- Extractos bancarios: SÍ
- Tarjeta de crédito: SÍ

INSTRUCCIONES CRÍTICAS:
1. Genera datos REALISTAS y COHERENTES para el sector ${params.sector}. Adapta productos, clientes, proveedores al sector.
2. Usa importes realistas para una empresa mediana española.
3. Los cálculos matemáticos deben ser CORRECTOS (cuadre de asientos, totales de facturas).
4. Fechas del año ${params.year} (salvo periodificaciones y vencimientos futuros).
5. Los asientos del libro diario deben CUADRAR (total debe = total haber).
6. El libro diario debe reflejar TODAS las operaciones anteriores (facturas, nóminas, SS, impuestos, préstamo, etc.).
7. GENERA AL MENOS ${opsPerMonth * 12} asientos en journalEntries distribuidos por todos los meses del año.
8. Incluye notas didácticas (journalNote) en TODOS los documentos explicando qué cuentas se usan y por qué.
9. Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin explicaciones.

El objeto JSON debe seguir EXACTAMENTE esta estructura:

{
  "companyProfile": {
    "name": "...",
    "nif": "B12345678",
    "address": "Calle Ejemplo, 10",
    "city": "Ciudad, Provincia",
    "sector": "${params.sector}",
    "taxRegime": "${params.taxRegime}",
    "fiscalYear": ${params.year},
    "description": "Descripción breve del negocio...",
    "companyType": "SL",
    "legalForm": "Sociedad de Responsabilidad Limitada"
  },
  "inventory": {
    "initialInventory": [
      { "code": "P001", "description": "...", "quantity": 100, "unitCost": 10.50, "totalCost": 1050.00, "accountCode": "300" }
    ],
    "finalInventory": [
      { "code": "P001", "description": "...", "quantity": 80, "unitCost": 10.50, "totalCost": 840.00, "accountCode": "300" }
    ],
    "initialTotal": 1050.00,
    "finalTotal": 840.00,
    "stockVariation": -210.00
  },
  "suppliers": [
    { "name": "Proveedor SA", "nif": "A11111111", "address": "Calle Proveedor, 5", "city": "Madrid", "accountCode": "400" }
  ],
  "clients": [
    { "name": "Cliente SL", "nif": "B33333333", "address": "Calle Cliente, 8", "city": "Valencia", "accountCode": "430" }
  ],
  "invoices": [
    {
      "invoiceNumber": "F-${params.year}/001",
      "date": "${params.year}-03-15",
      "type": "purchase",
      "partyName": "Proveedor SA",
      "partyNif": "A11111111",
      "lines": [
        { "description": "Mercaderías", "quantity": 50, "unitPrice": 20.00, "discount": 0, "subtotal": 1000.00, "taxRate": ${rates.standard}, "taxAmount": ${rates.standard * 10}, "total": ${1000 + rates.standard * 10} }
      ],
      "subtotal": 1000.00,
      "taxBase": 1000.00,
      "taxAmount": ${rates.standard * 10},
      "total": ${1000 + rates.standard * 10},
      "paymentMethod": "transfer",
      "dueDate": "${params.year}-04-15",
      "journalNote": "Compra de mercaderías. Se registra la deuda con el proveedor (400) y el ${params.taxRegime} soportado (472).",
      "accountDebits": [
        { "accountCode": "600", "accountName": "Compras de mercaderías", "amount": 1000.00, "description": "Mercaderías" },
        { "accountCode": "472", "accountName": "${params.taxRegime} soportado", "amount": ${rates.standard * 10}, "description": "${params.taxRegime} ${rates.standard}%" }
      ],
      "accountCredits": [
        { "accountCode": "400", "accountName": "Proveedores", "amount": ${1000 + rates.standard * 10}, "description": "Deuda Proveedor SA" }
      ]
    }
  ],
${optionalSectionsText}
  "creditCardStatement": {
    "cardNumber": "**** **** **** 1234",
    "entity": "Banco Ejemplo",
    "statementPeriod": "Octubre ${params.year}",
    "movements": [
      { "date": "${params.year}-10-05", "description": "Suministros oficina - Papelería", "amount": 85.50, "category": "Suministros", "accountCode": "629", "accountName": "Otros servicios" }
    ],
    "totalCharges": 505.49,
    "settlementDate": "${params.year}-11-05",
    "journalNote": "Cada gasto con tarjeta se registra cargando la cuenta de gasto y abonando la deuda (5201). Al cargo bancario: 5201 a 572.",
    "accountDebits": [
      { "accountCode": "629", "accountName": "Otros servicios", "amount": 505.49, "description": "Gastos tarjeta" }
    ],
    "accountCredits": [
      { "accountCode": "5201", "accountName": "Deudas a corto plazo por tarjeta de crédito", "amount": 505.49, "description": "Total pendiente" }
    ]
  },
  "insurancePolicies": [
    {
      "policyNumber": "SEG-${params.year}-001",
      "insurer": "Mapfre Seguros",
      "type": "Seguro multirriesgo del local",
      "annualPremium": 1800.00,
      "startDate": "${params.year}-09-01",
      "endDate": "${params.year + 1}-08-31",
      "prepaidExpense": 1200.00,
      "journalNote": "Seguro anual pagado en septiembre. Los meses de ${params.year + 1} se periodifican como gasto anticipado (480).",
      "accountDebits": [
        { "accountCode": "625", "accountName": "Primas de seguros", "amount": 600.00, "description": "4 meses año ${params.year}" },
        { "accountCode": "480", "accountName": "Gastos anticipados", "amount": 1200.00, "description": "8 meses año ${params.year + 1}" }
      ],
      "accountCredits": [
        { "accountCode": "572", "accountName": "Bancos", "amount": 1800.00, "description": "Pago prima anual" }
      ]
    }
  ],
  "casualtyEvent": {
    "date": "${params.year}-07-20",
    "description": "Incendio parcial en almacén que destruye mercancías y daña instalaciones.",
    "assetAffected": "Mercancías en almacén e instalaciones técnicas",
    "bookValue": 8500.00,
    "insuranceCompensation": 6000.00,
    "netLoss": 2500.00,
    "journalNote": "El siniestro genera una pérdida (678). La indemnización del seguro es ingreso extraordinario (778).",
    "accountDebits": [
      { "accountCode": "678", "accountName": "Gastos excepcionales", "amount": 8500.00, "description": "Valor contable bienes siniestrados" },
      { "accountCode": "430", "accountName": "Clientes (seguro)", "amount": 6000.00, "description": "Indemnización a cobrar" }
    ],
    "accountCredits": [
      { "accountCode": "300", "accountName": "Mercaderías", "amount": 5000.00, "description": "Baja existencias" },
      { "accountCode": "221", "accountName": "Instalaciones técnicas", "amount": 3500.00, "description": "Baja instalaciones" },
      { "accountCode": "778", "accountName": "Ingresos excepcionales", "amount": 6000.00, "description": "Indemnización seguro" }
    ]
  },
  "bankStatements": [
    {
      "bank": "Banco Ejemplo",
      "accountNumber": "ES12 1234 5678 9012 3456 7890",
      "period": "Octubre ${params.year}",
      "openingBalance": 25000.00,
      "closingBalance": 21340.00,
      "transactions": [
        { "date": "${params.year}-10-02", "concept": "Transferencia recibida - Cliente SL", "debit": null, "credit": 3500.00, "balance": 28500.00 },
        { "date": "${params.year}-10-05", "concept": "Pago nóminas octubre", "debit": 3200.00, "credit": null, "balance": 25300.00 }
      ]
    }
  ],
  "journalEntries": [
    {
      "entryNumber": "1",
      "date": "${params.year}-01-01",
      "concept": "Apertura de ejercicio",
      "document": "APE-${params.year}",
      "debits": [
        { "accountCode": "572", "accountName": "Bancos c/c", "amount": 25000.00, "description": "Saldo inicial banco" }
      ],
      "credits": [
        { "accountCode": "100", "accountName": "Capital social", "amount": 25000.00, "description": "Capital aportado" }
      ],
      "totalAmount": 25000.00
    }
  ]
}

RECUERDA: Adapta TODOS los datos al sector ${params.sector}. Los importes deben ser coherentes y los cálculos exactos. Genera un mínimo de ${opsPerMonth * numMonths} asientos en journalEntries repartidos en los meses del período (${periodStart} a ${periodEnd}). TODAS las fechas deben caer dentro de este intervalo.`;
}

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
  const prompt = buildPrompt(params);
  const client = getClient(aiConfig);
  const model = getModel(aiConfig);

  const response = await client.chat.completions.create({
    model,
    max_tokens: 8192,
    messages: [
      {
        role: "system",
        content: "Eres un experto contable español especializado en el Plan General Contable (PGC). Siempre respondes ÚNICAMENTE con JSON válido, sin texto adicional ni bloques de código.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No content returned from AI model");
  }

  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned);
  return parsed;
}
