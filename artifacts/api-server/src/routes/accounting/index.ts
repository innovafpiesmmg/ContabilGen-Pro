import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, generationsTable } from "@workspace/db";
import {
  GenerateAccountingUniverseBody,
  SaveGenerationBody,
  GetGenerationParams,
  DeleteGenerationParams,
} from "@workspace/api-zod";
import { generateAccountingUniverse } from "../../lib/accounting-generator.js";

const router: IRouter = Router();

router.post("/accounting/generate", async (req, res): Promise<void> => {
  const parsed = GenerateAccountingUniverseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { taxRegime, sector, complexity, year, companyName } = parsed.data;

  const universe = await generateAccountingUniverse({
    taxRegime,
    sector,
    complexity,
    year,
    companyName: companyName ?? null,
  });

  res.json(universe);
});

router.get("/accounting/generations", async (_req, res): Promise<void> => {
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
    .orderBy(desc(generationsTable.createdAt));

  res.json(
    rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

router.post("/accounting/generations", async (req, res): Promise<void> => {
  const parsed = SaveGenerationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .insert(generationsTable)
    .values({
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
  const params = GetGenerationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(generationsTable)
    .where(eq(generationsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Generation not found" });
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
  const params = DeleteGenerationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .delete(generationsTable)
    .where(eq(generationsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Generation not found" });
    return;
  }

  res.json({ success: true });
});

export default router;
