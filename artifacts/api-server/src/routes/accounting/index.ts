import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
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
import crypto from "crypto";

const router: IRouter = Router();

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;
const wrap = (fn: AsyncHandler): AsyncHandler => (req, res, next) => fn(req, res, next).catch(next);

interface Job {
  status: "running" | "done" | "error";
  progress: string;
  result?: unknown;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, Job>();

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > 30 * 60 * 1000) jobs.delete(id);
  }
}, 60000);

function buildParams(d: any) {
  return {
    taxRegime: d.taxRegime, sector: d.sector, activity: d.activity ?? null,
    complexity: d.complexity, year: d.year, companyName: d.companyName ?? null,
    educationLevel: d.educationLevel ?? null, operationsPerMonth: d.operationsPerMonth ?? null,
    includePayroll: d.includePayroll ?? null, includeSocialSecurity: d.includeSocialSecurity ?? null,
    includeTaxLiquidation: d.includeTaxLiquidation ?? null, includeBankLoan: d.includeBankLoan ?? null,
    includeMortgage: d.includeMortgage ?? null, includeCreditPolicy: d.includeCreditPolicy ?? null,
    includeFixedAssets: d.includeFixedAssets ?? null, includeShareholdersInfo: d.includeShareholdersInfo ?? null,
    isNewCompany: d.isNewCompany ?? null, includeInitialBalance: d.includeInitialBalance ?? null,
    includeShareholderAccounts: d.includeShareholderAccounts ?? null, includeDividends: d.includeDividends ?? null,
    includeWarehouse: d.includeWarehouse ?? null, includeExtraordinary: d.includeExtraordinary ?? null,
    startDate: d.startDate ?? null, endDate: d.endDate ?? null,
  };
}

function resolveAiConfig(settings: any, shared?: any) {
  const provider = settings.provider ?? "deepseek";
  if (provider === "shared_deepseek" && shared?.enabled) {
    return {
      provider: "deepseek",
      deepseekApiKey: shared.apiKey,
      deepseekBaseUrl: shared.baseUrl,
      deepseekModel: shared.model,
    };
  }
  if (provider === "openai") {
    return {
      provider: "openai",
      apiKey: settings.openaiApiKey ?? "",
      baseUrl: "https://api.openai.com/v1",
      model: settings.openaiModel ?? "gpt-4.1-mini",
    };
  }
  return {
    provider: "deepseek",
    deepseekApiKey: settings.deepseekApiKey ?? "",
    deepseekBaseUrl: settings.deepseekBaseUrl ?? "https://api.deepseek.com",
    deepseekModel: settings.deepseekModel ?? "deepseek-chat",
  };
}

router.post("/accounting/generate", wrap(async (req, res): Promise<void> => {
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
  const provider = settings.provider ?? "deepseek";

  let aiConfig;
  if (provider === "shared_deepseek") {
    const shared = await getSharedDeepseekConfig();
    if (!shared.enabled) {
      res.status(400).json({ error: "La clave DeepSeek compartida no está disponible." });
      return;
    }
    aiConfig = resolveAiConfig(settings, shared);
  } else {
    aiConfig = resolveAiConfig(settings);
  }

  const jobId = crypto.randomUUID();
  const job: Job = { status: "running", progress: "Iniciando generación...", createdAt: Date.now() };
  jobs.set(jobId, job);

  res.json({ jobId });

  console.log(`[generate] jobId=${jobId}, provider=${aiConfig.provider}, model=${aiConfig.model ?? aiConfig.deepseekModel ?? '?'}`);
  generateAccountingUniverse(
    buildParams(d),
    aiConfig,
    (message: string) => { job.progress = message; },
  ).then((universe) => {
    job.status = "done";
    job.result = universe;
    job.progress = "Completado";
  }).catch((err: unknown) => {
    job.status = "error";
    job.error = err instanceof Error ? err.message : "Error desconocido";
    job.progress = "Error";
    console.error("[generate] Error:", job.error);
  });
}));

router.get("/accounting/generate/status/:jobId", wrap(async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Trabajo no encontrado" });
    return;
  }

  if (job.status === "done") {
    const result = job.result;
    jobs.delete(req.params.jobId);
    res.json({ status: "done", progress: job.progress, result });
  } else if (job.status === "error") {
    const error = job.error;
    jobs.delete(req.params.jobId);
    res.json({ status: "error", progress: job.progress, error });
  } else {
    res.json({ status: "running", progress: job.progress });
  }
}));

router.get("/accounting/generations", wrap(async (req, res): Promise<void> => {
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
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    })),
  );
}));

router.post("/accounting/generations", wrap(async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const parsed = SaveGenerationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { companyName, sector, taxRegime, fiscalYear, universeJson } = parsed.data;

  const [row] = await db
    .insert(generationsTable)
    .values({
      userId: req.user.id,
      companyName,
      sector,
      taxRegime,
      fiscalYear,
      universeJson,
    })
    .returning();

  res.status(201).json({
    id: row.id,
    companyName: row.companyName,
    sector: row.sector,
    taxRegime: row.taxRegime,
    fiscalYear: row.fiscalYear,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  });
}));

router.get("/accounting/generations/:id", wrap(async (req, res): Promise<void> => {
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
    .where(
      and(eq(generationsTable.id, params.data.id), eq(generationsTable.userId, req.user.id)),
    );

  if (!row) {
    res.status(404).json({ error: "Generación no encontrada" });
    return;
  }

  res.json({
    ...row,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  });
}));

router.delete("/accounting/generations/:id", wrap(async (req, res): Promise<void> => {
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
    .select({ id: generationsTable.id })
    .from(generationsTable)
    .where(
      and(eq(generationsTable.id, params.data.id), eq(generationsTable.userId, req.user.id)),
    );

  if (!row) {
    res.status(404).json({ error: "Generación no encontrada" });
    return;
  }

  await db
    .delete(generationsTable)
    .where(
      and(eq(generationsTable.id, params.data.id), eq(generationsTable.userId, req.user.id)),
    );

  res.json({ success: true });
}));

export default router;
