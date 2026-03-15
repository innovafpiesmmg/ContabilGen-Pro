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

  const {
    taxRegime, sector, complexity, year, companyName,
    educationLevel, operationsPerMonth,
    includePayroll, includeSocialSecurity, includeTaxLiquidation,
    includeBankLoan, includeMortgage, includeCreditPolicy, includeFixedAssets,
    includeShareholdersInfo, isNewCompany, includeInitialBalance,
    includeShareholderAccounts, includeDividends,
    startDate, endDate,
  } = parsed.data;

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

  const universe = await generateAccountingUniverse(
    {
      taxRegime, sector, complexity, year,
      companyName: companyName ?? null,
      educationLevel: educationLevel ?? null,
      operationsPerMonth: operationsPerMonth ?? null,
      includePayroll: includePayroll ?? null,
      includeSocialSecurity: includeSocialSecurity ?? null,
      includeTaxLiquidation: includeTaxLiquidation ?? null,
      includeBankLoan: includeBankLoan ?? null,
      includeMortgage: includeMortgage ?? null,
      includeCreditPolicy: includeCreditPolicy ?? null,
      includeFixedAssets: includeFixedAssets ?? null,
      includeShareholdersInfo: includeShareholdersInfo ?? null,
      isNewCompany: isNewCompany ?? null,
      includeInitialBalance: includeInitialBalance ?? null,
      includeShareholderAccounts: includeShareholderAccounts ?? null,
      includeDividends: includeDividends ?? null,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
    },
    aiConfig,
  );

  res.json(universe);
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
