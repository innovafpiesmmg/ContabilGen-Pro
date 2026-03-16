import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import { db, settingsTable, appSettingsTable } from "@workspace/db";
import { UpdateSettingsBody } from "@workspace/api-zod";

const router: IRouter = Router();

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;
const wrap = (fn: AsyncHandler): AsyncHandler => (req, res, next) => fn(req, res, next).catch(next);

const SETTINGS_KEYS = ["provider", "deepseekApiKey", "deepseekBaseUrl", "deepseekModel"] as const;
const DEFAULTS: Record<string, string> = {
  provider: "deepseek",
  deepseekApiKey: "",
  deepseekBaseUrl: "https://api.deepseek.com",
  deepseekModel: "deepseek-chat",
};

async function getSharedDeepseekConfig(): Promise<{ enabled: boolean; apiKey: string; baseUrl: string; model: string }> {
  const rows = await db.select().from(appSettingsTable);
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return {
    enabled: map.shared_deepseek_enabled === "true" && !!map.shared_deepseek_api_key,
    apiKey: map.shared_deepseek_api_key ?? "",
    baseUrl: map.shared_deepseek_base_url ?? "https://api.deepseek.com",
    model: map.shared_deepseek_model ?? "deepseek-chat",
  };
}

async function getSettingsForUser(userId: string): Promise<Record<string, string>> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId));
  const map: Record<string, string> = { ...DEFAULTS };
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

router.get("/settings", wrap(async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  const [settings, shared] = await Promise.all([
    getSettingsForUser(req.user.id),
    getSharedDeepseekConfig(),
  ]);
  res.json({
    provider: settings.provider as "deepseek" | "shared_deepseek",
    deepseekApiKey: settings.deepseekApiKey || null,
    deepseekBaseUrl: settings.deepseekBaseUrl,
    deepseekModel: settings.deepseekModel,
    sharedDeepseekAvailable: shared.enabled,
    sharedDeepseekModel: shared.enabled ? shared.model : null,
  });
}));

router.put("/settings", wrap(async (req, res): Promise<void> => {
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

  const shared = await getSharedDeepseekConfig();
  res.json({
    provider: provider as "deepseek" | "shared_deepseek",
    deepseekApiKey: deepseekApiKey ?? null,
    deepseekBaseUrl,
    deepseekModel,
    sharedDeepseekAvailable: shared.enabled,
    sharedDeepseekModel: shared.enabled ? shared.model : null,
  });
}));

export { getSettingsForUser, getSharedDeepseekConfig };
export default router;
