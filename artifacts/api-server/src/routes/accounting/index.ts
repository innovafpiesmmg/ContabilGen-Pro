import { Router, type IRouter } from "express";
import { and, eq, desc } from "drizzle-orm";
import { db, generationsTable } from "@workspace/db";
import {
  GenerateAccountingUniverseBody,
  SaveGenerationBody,
  GetGenerationParams,
  DeleteGenerationParams,
} from "@workspace/api-zod";
import { generateAccountingUniverse } from "../../lib/accounting-generator.js";
import { getSettingsForUser, getSharedDeepseekConfig } from "../settings.js";

const router: IRouter = Router();

router.post("/accounting/generate", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const parsed = GenerateAccountingUniverseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data;

  const settings = await getSettingsForUser(req.user.id);
  const provider = settings.provider ?? "openai";

  let aiConfig: { provider: string; deepseekApiKey: string; deepseekBaseUrl: string; deepseekModel: string };

  if (provider === "shared_deepseek") {
    const shared = await getSharedDeepseekConfig();
    if (!shared.enabled) {
      res.status(400).json({ error: "La clave DeepSeek compartida no está disponible." });
      return;
    }
    aiConfig = {
      provider: "deepseek",
      deepseekApiKey: shared.apiKey,
      deepseekBaseUrl: shared.baseUrl,
      deepseekModel: shared.model,
    };
  } else {
    aiConfig = {
      provider,
      deepseekApiKey: settings.deepseekApiKey ?? "",
      deepseekBaseUrl: settings.deepseekBaseUrl ?? "https://api.deepseek.com",
      deepseekModel: settings.deepseekModel ?? "deepseek-chat",
    };
  }

  try {
    const universe = await generateAccountingUniverse(
      {
        taxRegime: d.taxRegime,
        sector: d.sector,
        activity: d.activity ?? null,
        complexity: d.complexity,
        year: d.year,
        companyName: d.companyName ?? null,
        educationLevel: d.educationLevel ?? null,
        operationsPerMonth: d.operationsPerMonth ?? null,
        includePayroll: d.includePayroll ?? null,
        includeSocialSecurity: d.includeSocialSecurity ?? null,
        includeTaxLiquidation: d.includeTaxLiquidation ?? null,
        includeBankLoan: d.includeBankLoan ?? null,
        includeMortgage: d.includeMortgage ?? null,
        includeCreditPolicy: d.includeCreditPolicy ?? null,
        includeFixedAssets: d.includeFixedAssets ?? null,
        includeShareholdersInfo: d.includeShareholdersInfo ?? null,
        isNewCompany: d.isNewCompany ?? null,
        includeInitialBalance: d.includeInitialBalance ?? null,
        includeShareholderAccounts: d.includeShareholderAccounts ?? null,
        includeDividends: d.includeDividends ?? null,
        includeWarehouse: d.includeWarehouse ?? null,
        includeExtraordinary: d.includeExtraordinary ?? null,
        startDate: d.startDate ?? null,
        endDate: d.endDate ?? null,
      },
      aiConfig,
    );

    res.json(universe);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido durante la generación";
    console.error("[generate] Error:", message);
    res.status(500).json({ error: message });
  }
});

router.get("/accounting/generations", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const rows = await db
    .select({
      id: generationsTable.id,
      companyName: generationsTable.companyName,
      sector: generationsTable.sector,
      taxRegime: generationsTable.taxRegime,
      fiscalYear: generationsTable.fiscalYear,
      createdAt: generationsTable.createdAt,
    })
    .from(generationsTable)
    .where(eq(generationsTable.userId, req.user.id))
    .orderBy(desc(generationsTable.createdAt));

  res.json(
    rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

router.post("/accounting/generations", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const parsed = SaveGenerationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .insert(generationsTable)
    .values({
      userId: req.user.id,
      companyName: parsed.data.companyName,
      sector: parsed.data.sector,
      taxRegime: parsed.data.taxRegime,
      fiscalYear: parsed.data.fiscalYear,
      universeJson: parsed.data.universeJson,
    })
    .returning();

  res.status(201).json({
    id: row.id,
    companyName: row.companyName,
    sector: row.sector,
    taxRegime: row.taxRegime,
    fiscalYear: row.fiscalYear,
    createdAt: row.createdAt.toISOString(),
  });
});

router.get("/accounting/generations/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const params = GetGenerationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(generationsTable)
    .where(and(eq(generationsTable.id, params.data.id), eq(generationsTable.userId, req.user.id)));

  if (!row) {
    res.status(404).json({ error: "Generación no encontrada" });
    return;
  }

  res.json({
    id: row.id,
    companyName: row.companyName,
    sector: row.sector,
    taxRegime: row.taxRegime,
    fiscalYear: row.fiscalYear,
    createdAt: row.createdAt.toISOString(),
    universeJson: row.universeJson,
  });
});

router.delete("/accounting/generations/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const params = DeleteGenerationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .delete(generationsTable)
    .where(and(eq(generationsTable.id, params.data.id), eq(generationsTable.userId, req.user.id)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Generación no encontrada" });
    return;
  }

  res.json({ success: true });
});

export default router;
