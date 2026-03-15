import { openai } from "@workspace/integrations-openai-ai-server";

interface GenerateParams {
  taxRegime: "IVA" | "IGIC";
  sector: "Comercio" | "Servicios" | "Industria" | "Hostelería";
  complexity: "Avanzado";
  year: number;
  companyName?: string | null;
}

const TAX_RATES: Record<string, { standard: number; reduced: number; superreduced: number }> = {
  IVA: { standard: 21, reduced: 10, superreduced: 4 },
  IGIC: { standard: 7, reduced: 3, superreduced: 0 },
};

function buildPrompt(params: GenerateParams): string {
  const rates = TAX_RATES[params.taxRegime];
  const companyHint = params.companyName ? `La empresa se llama "${params.companyName}".` : "Inventa un nombre de empresa realista para el sector.";

  return `Eres un experto contable español y debes generar un universo contable completo para prácticas de contabilidad de Grado Medio.

PARÁMETROS:
- Sector económico: ${params.sector}
- Régimen fiscal: ${params.taxRegime} (Tipo general: ${rates.standard}%, Reducido: ${rates.reduced}%, Superreducido: ${rates.superreduced}%)
- Año fiscal: ${params.year}
- ${companyHint}

INSTRUCCIONES:
Genera un universo contable coherente y realista que incluya TODOS los elementos siguientes. Todos los importes deben ser coherentes entre sí y con el sector económico. Usa el Plan General Contable (PGC) español para los códigos de cuentas.

El objeto JSON debe seguir EXACTAMENTE esta estructura. No añadas campos extra. No incluyas texto fuera del JSON.

{
  "companyProfile": {
    "name": "...",
    "nif": "B12345678",
    "address": "Calle Ejemplo, 10",
    "city": "Ciudad, Provincia",
    "sector": "${params.sector}",
    "taxRegime": "${params.taxRegime}",
    "fiscalYear": ${params.year},
    "description": "Descripción breve del negocio..."
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
    { "name": "Proveedor SA", "nif": "A11111111", "address": "Calle Proveedor, 5", "city": "Madrid", "accountCode": "400" },
    { "name": "Suministros SL", "nif": "B22222222", "address": "Av. Industria, 20", "city": "Barcelona", "accountCode": "400" }
  ],
  "clients": [
    { "name": "Cliente SL", "nif": "B33333333", "address": "Calle Cliente, 8", "city": "Valencia", "accountCode": "430" },
    { "name": "Empresa Compradora SA", "nif": "A44444444", "address": "Paseo Principal, 15", "city": "Sevilla", "accountCode": "430" }
  ],
  "invoices": [
    {
      "invoiceNumber": "F-2024/001",
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
      "journalNote": "Registro de compra de mercaderías a proveedor. Se reconoce la deuda con el proveedor (cuenta 400) y el ${params.taxRegime} soportado deducible (cuenta 472).",
      "accountDebits": [
        { "accountCode": "600", "accountName": "Compras de mercaderías", "amount": 1000.00, "description": "Compra de mercaderías" },
        { "accountCode": "472", "accountName": "${params.taxRegime} soportado", "amount": ${rates.standard * 10}, "description": "${params.taxRegime} al ${rates.standard}%" }
      ],
      "accountCredits": [
        { "accountCode": "400", "accountName": "Proveedores", "amount": ${1000 + rates.standard * 10}, "description": "Deuda con Proveedor SA" }
      ]
    }
  ],
  "bankLoan": {
    "entity": "Banco Ejemplo",
    "loanNumber": "PRE-2024-001",
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
    "journalNote": "Contabilización del préstamo bancario. Al recibir el préstamo se abona la cuenta 170 (largo plazo) o 520 (corto plazo). Cada cuota se desglosa en capital (520) e intereses (662).",
    "accountDebits": [
      { "accountCode": "572", "accountName": "Bancos e instituciones de crédito c/c vista", "amount": 50000.00, "description": "Recepción del préstamo" }
    ],
    "accountCredits": [
      { "accountCode": "170", "accountName": "Deudas a largo plazo con entidades de crédito", "amount": 50000.00, "description": "Préstamo bancario concedido" }
    ]
  },
  "creditPolicy": {
    "entity": "Banco Ejemplo",
    "policyNumber": "POL-2024-001",
    "limit": 30000.00,
    "drawnAmount": 18000.00,
    "annualRate": 5.5,
    "openingCommission": 150.00,
    "unusedCommission": 60.00,
    "startDate": "${params.year}-06-01",
    "endDate": "${params.year}-11-30",
    "interestAmount": 495.00,
    "totalSettlement": 705.00,
    "journalNote": "Liquidación de póliza de crédito. Los intereses sobre el saldo dispuesto se cargan a la cuenta 663 (intereses de deudas) y las comisiones a la cuenta 626 (servicios bancarios).",
    "accountDebits": [
      { "accountCode": "663", "accountName": "Intereses de deudas", "amount": 495.00, "description": "Intereses sobre saldo dispuesto" },
      { "accountCode": "626", "accountName": "Servicios bancarios y similares", "amount": 210.00, "description": "Comisiones de apertura y no disposición" }
    ],
    "accountCredits": [
      { "accountCode": "5201", "accountName": "Deudas a corto plazo por póliza de crédito", "amount": 705.00, "description": "Total a pagar en liquidación" }
    ]
  },
  "creditCardStatement": {
    "cardNumber": "**** **** **** 1234",
    "entity": "Banco Ejemplo",
    "statementPeriod": "Octubre ${params.year}",
    "movements": [
      { "date": "${params.year}-10-05", "description": "Suministros oficina - Papelería Central", "amount": 85.50, "category": "Suministros", "accountCode": "629", "accountName": "Otros servicios" },
      { "date": "${params.year}-10-12", "description": "Gasolina - Estación BP", "amount": 120.00, "category": "Combustible", "accountCode": "628", "accountName": "Suministros" },
      { "date": "${params.year}-10-18", "description": "Cena de trabajo - Restaurante El Olivo", "amount": 245.00, "category": "Restauración", "accountCode": "629", "accountName": "Otros servicios" },
      { "date": "${params.year}-10-25", "description": "Suscripción software - Adobe Creative", "amount": 54.99, "category": "Software", "accountCode": "626", "accountName": "Servicios bancarios y similares" }
    ],
    "totalCharges": 505.49,
    "settlementDate": "${params.year}-11-05",
    "journalNote": "Cada gasto con tarjeta de crédito se registra individualmente cargando la cuenta de gasto correspondiente y abonando la cuenta 5201 (tarjeta de crédito - deuda a corto plazo). Al recibir el cargo bancario: cargo a 5201 y abono a 572.",
    "accountDebits": [
      { "accountCode": "629", "accountName": "Otros servicios", "amount": 330.50, "description": "Suministros y restauración" },
      { "accountCode": "628", "accountName": "Suministros", "amount": 120.00, "description": "Combustible" },
      { "accountCode": "626", "accountName": "Servicios bancarios y similares", "amount": 54.99, "description": "Software" }
    ],
    "accountCredits": [
      { "accountCode": "5201", "accountName": "Deudas a corto plazo por tarjeta de crédito", "amount": 505.49, "description": "Total pendiente de cargo" }
    ]
  },
  "insurancePolicies": [
    {
      "policyNumber": "SEG-2024-001",
      "insurer": "Mapfre Seguros",
      "type": "Seguro multirriesgo del local",
      "annualPremium": 1800.00,
      "startDate": "${params.year}-09-01",
      "endDate": "${params.year + 1}-08-31",
      "prepaidExpense": 1200.00,
      "journalNote": "El seguro anual pagado en septiembre cubre hasta agosto del año siguiente. Los meses de ${params.year + 1} (enero-agosto = 8 meses) se periodifican como gasto anticipado (cuenta 480). Solo se imputa como gasto del ejercicio la parte correspondiente a los meses del año actual (septiembre-diciembre = 4 meses).",
      "accountDebits": [
        { "accountCode": "625", "accountName": "Primas de seguros", "amount": 600.00, "description": "Gasto del ejercicio (4 meses)" },
        { "accountCode": "480", "accountName": "Gastos anticipados", "amount": 1200.00, "description": "Periodificación (8 meses año siguiente)" }
      ],
      "accountCredits": [
        { "accountCode": "572", "accountName": "Bancos", "amount": 1800.00, "description": "Pago de prima anual" }
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
    "journalNote": "El siniestro genera una pérdida extraordinaria (cuenta 678). La indemnización recibida del seguro se contabiliza como ingreso extraordinario (cuenta 778). La diferencia entre el valor contable del bien y la indemnización es la pérdida neta.",
    "accountDebits": [
      { "accountCode": "678", "accountName": "Gastos excepcionales", "amount": 8500.00, "description": "Valor contable de bienes siniestrados" },
      { "accountCode": "430", "accountName": "Clientes (seguro)", "amount": 6000.00, "description": "Indemnización a cobrar del seguro" }
    ],
    "accountCredits": [
      { "accountCode": "300", "accountName": "Mercaderías", "amount": 5000.00, "description": "Baja de existencias destruidas" },
      { "accountCode": "221", "accountName": "Instalaciones técnicas", "amount": 3500.00, "description": "Baja de instalaciones dañadas" },
      { "accountCode": "778", "accountName": "Ingresos excepcionales", "amount": 6000.00, "description": "Indemnización del seguro" }
    ]
  },
  "payroll": {
    "month": "Octubre ${params.year}",
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
      },
      {
        "name": "Carlos Martínez Ruiz",
        "naf": "281234567891",
        "category": "Auxiliar",
        "grossSalary": 1800.00,
        "irpfRate": 12,
        "irpfAmount": 216.00,
        "ssEmployeeRate": 6.35,
        "ssEmployeeAmount": 114.30,
        "netSalary": 1469.70,
        "ssEmployerRate": 30.40,
        "ssEmployerAmount": 547.20
      }
    ],
    "totalGross": 4000.00,
    "totalIrpf": 546.00,
    "totalSsEmployee": 254.00,
    "totalNetSalary": 3200.00,
    "totalSsEmployer": 1216.00,
    "totalLaborCost": 5216.00,
    "journalNote": "La nómina genera: (1) Gasto en sueldos (640) por el salario bruto total; (2) Gasto en Seguridad Social a cargo de la empresa (642); (3) Retenciones de IRPF a ingresar a Hacienda (4751); (4) Cuotas de SS a ingresar (476); (5) Salarios netos a pagar a empleados (465).",
    "accountDebits": [
      { "accountCode": "640", "accountName": "Sueldos y salarios", "amount": 4000.00, "description": "Salario bruto total empleados" },
      { "accountCode": "642", "accountName": "Seguridad Social a cargo de la empresa", "amount": 1216.00, "description": "Cuota patronal SS" }
    ],
    "accountCredits": [
      { "accountCode": "465", "accountName": "Remuneraciones pendientes de pago", "amount": 3200.00, "description": "Salarios netos a pagar" },
      { "accountCode": "4751", "accountName": "H.P. acreedora por retenciones practicadas", "amount": 546.00, "description": "IRPF retenido" },
      { "accountCode": "476", "accountName": "Organismos de la Seguridad Social acreedores", "amount": 1470.00, "description": "SS empleados + SS empresa" }
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
        { "date": "${params.year}-10-05", "concept": "Pago nóminas octubre", "debit": 3200.00, "credit": null, "balance": 25300.00 },
        { "date": "${params.year}-10-10", "concept": "Cuota préstamo bancario", "debit": 929.27, "credit": null, "balance": 24370.73 },
        { "date": "${params.year}-10-15", "concept": "Pago proveedor FA-2024/001", "debit": 2150.00, "credit": null, "balance": 22220.73 },
        { "date": "${params.year}-10-20", "concept": "Transferencia a Hacienda - IRPF", "debit": 546.00, "credit": null, "balance": 21674.73 },
        { "date": "${params.year}-10-25", "concept": "Ingreso venta efectivo", "debit": null, "credit": 1200.00, "balance": 22874.73 },
        { "date": "${params.year}-10-31", "concept": "Cargo tarjeta crédito octubre", "debit": 505.49, "credit": null, "balance": 22369.24 },
        { "date": "${params.year}-10-31", "concept": "Comisión mantenimiento cuenta", "debit": 15.00, "credit": null, "balance": 22354.24 }
      ]
    }
  ],
  "journalEntries": [
    {
      "entryNumber": "1",
      "date": "${params.year}-01-01",
      "concept": "Apertura de ejercicio - Préstamo bancario",
      "document": "PRE-2024-001",
      "debits": [
        { "accountCode": "572", "accountName": "Bancos c/c", "amount": 50000.00, "description": "Ingreso del préstamo en cuenta" }
      ],
      "credits": [
        { "accountCode": "170", "accountName": "Deudas a largo plazo con entidades de crédito", "amount": 50000.00, "description": "Préstamo concedido" }
      ],
      "totalAmount": 50000.00
    },
    {
      "entryNumber": "2",
      "date": "${params.year}-03-15",
      "concept": "Compra de mercaderías a Proveedor SA",
      "document": "F-2024/001",
      "debits": [
        { "accountCode": "600", "accountName": "Compras de mercaderías", "amount": 1000.00, "description": "Mercaderías compradas" },
        { "accountCode": "472", "accountName": "${params.taxRegime} soportado", "amount": ${rates.standard * 10}, "description": "${params.taxRegime} ${rates.standard}%" }
      ],
      "credits": [
        { "accountCode": "400", "accountName": "Proveedores", "amount": ${1000 + rates.standard * 10}, "description": "Deuda con proveedor" }
      ],
      "totalAmount": ${1000 + rates.standard * 10}
    }
  ]
}

IMPORTANTE:
1. Genera datos REALISTAS y COHERENTES para el sector ${params.sector}. Adapta los productos, clientes, proveedores y gastos al sector.
2. Usa importes realistas (ni muy pequeños ni exagerados) para una empresa mediana española.
3. Asegúrate de que los cálculos matemáticos sean CORRECTOS (totales de facturas, amortizaciones, etc.).
4. Las fechas deben ser del año ${params.year} (salvo periodificaciones).
5. Los asientos deben cuadrar (total debe = total haber).
6. Genera al menos 4-5 facturas (mix de compras y ventas), 2 pólizas de seguro, y 2 empleados en nómina.
7. Responde ÚNICAMENTE con el JSON, sin texto adicional, sin markdown, sin explicaciones.`;
}

export async function generateAccountingUniverse(params: GenerateParams): Promise<unknown> {
  const prompt = buildPrompt(params);

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
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
