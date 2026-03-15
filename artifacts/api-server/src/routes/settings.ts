import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
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

async function getSettingsForUser(userId: string): Promise<Record<string, string>> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId));
  const map: Record<string, string> = { ...DEFAULTS };
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

router.get("/settings", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  const settings = await getSettingsForUser(req.user.id);
  res.json({
    provider: settings.provider as "openai" | "deepseek",
    deepseekApiKey: settings.deepseekApiKey || null,
    deepseekBaseUrl: settings.deepseekBaseUrl,
    deepseekModel: settings.deepseekModel,
  });
});

router.put("/settings", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user.id;
  const { provider, deepseekApiKey, deepseekBaseUrl, deepseekModel } = parsed.data;

  const updates: Array<{ key: string; value: string }> = [
    { key: "provider", value: provider },
    { key: "deepseekApiKey", value: deepseekApiKey ?? "" },
    { key: "deepseekBaseUrl", value: deepseekBaseUrl },
    { key: "deepseekModel", value: deepseekModel },
  ];

  for (const { key, value } of updates) {
    const existing = await db.select().from(settingsTable)
      .where(and(eq(settingsTable.userId, userId), eq(settingsTable.key, key)));
    if (existing.length > 0) {
      await db.update(settingsTable)
        .set({ value, updatedAt: new Date() })
        .where(and(eq(settingsTable.userId, userId), eq(settingsTable.key, key)));
    } else {
      await db.insert(settingsTable).values({ userId, key, value });
    }
  }

  res.json({
    provider: provider as "openai" | "deepseek",
    deepseekApiKey: deepseekApiKey ?? null,
    deepseekBaseUrl,
    deepseekModel,
  });
});

export { getSettingsForUser };
export default router;
