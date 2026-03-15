import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { UpdateSettingsBody } from "@workspace/api-zod";

const router: IRouter = Router();

const SETTINGS_KEYS = ["provider", "deepseekApiKey", "deepseekBaseUrl", "deepseekModel"] as const;
const DEFAULTS: Record<string, string> = {
  provider: "openai",
  deepseekApiKey: "",
  deepseekBaseUrl: "https://api.deepseek.com",
  deepseekModel: "deepseek-chat",
};

async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(settingsTable);
  const map: Record<string, string> = { ...DEFAULTS };
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

router.get("/settings", async (_req, res): Promise<void> => {
  const settings = await getAllSettings();
  res.json({
    provider: settings.provider as "openai" | "deepseek",
    deepseekApiKey: settings.deepseekApiKey || null,
    deepseekBaseUrl: settings.deepseekBaseUrl,
    deepseekModel: settings.deepseekModel,
  });
});

router.put("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { provider, deepseekApiKey, deepseekBaseUrl, deepseekModel } = parsed.data;

  const updates: Array<{ key: string; value: string }> = [
    { key: "provider", value: provider },
    { key: "deepseekApiKey", value: deepseekApiKey ?? "" },
    { key: "deepseekBaseUrl", value: deepseekBaseUrl },
    { key: "deepseekModel", value: deepseekModel },
  ];

  for (const { key, value } of updates) {
    const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
    if (existing.length > 0) {
      await db.update(settingsTable).set({ value, updatedAt: new Date() }).where(eq(settingsTable.key, key));
    } else {
      await db.insert(settingsTable).values({ key, value });
    }
  }

  res.json({
    provider: provider as "openai" | "deepseek",
    deepseekApiKey: deepseekApiKey ?? null,
    deepseekBaseUrl,
    deepseekModel,
  });
});

export { getAllSettings };
export default router;
