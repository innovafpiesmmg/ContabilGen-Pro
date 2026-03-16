import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, usersTable, appSettingsTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { adminMiddleware } from "../middlewares/adminMiddleware";
import { hashPassword } from "../lib/auth";

const router: IRouter = Router();

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;
const wrap = (fn: AsyncHandler): AsyncHandler => (req, res, next) => fn(req, res, next).catch(next);

router.use(adminMiddleware);

// ─── Users ───────────────────────────────────────────────────────────────────

router.get("/admin/users", wrap(async (_req: Request, res: Response): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      isAdmin: usersTable.isAdmin,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt);
  res.json({ users });
}));

router.patch("/admin/users/:id", wrap(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { isAdmin, firstName, lastName, newPassword } = req.body ?? {};

  if (id === req.user!.id) {
    res.status(400).json({ error: "No puedes modificar tu propio rol desde el panel de administración." });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (typeof isAdmin === "boolean") updates.isAdmin = isAdmin;
  if (typeof firstName === "string") updates.firstName = firstName;
  if (typeof lastName === "string") updates.lastName = lastName;
  if (typeof newPassword === "string" && newPassword.length >= 8) {
    updates.passwordHash = await hashPassword(newPassword);
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No se proporcionaron campos para actualizar." });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, id))
    .returning({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      isAdmin: usersTable.isAdmin,
      createdAt: usersTable.createdAt,
    });

  if (!updated) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }

  res.json({ user: updated });
}));

router.delete("/admin/users/:id", wrap(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (id === req.user!.id) {
    res.status(400).json({ error: "No puedes eliminar tu propia cuenta desde el panel de administración." });
    return;
  }

  const deleted = await db.delete(usersTable).where(eq(usersTable.id, id)).returning({ id: usersTable.id });
  if (!deleted.length) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }

  res.json({ success: true });
}));

// ─── Email Config ─────────────────────────────────────────────────────────────

const EMAIL_KEYS = ["resend_api_key", "email_from"] as const;

router.get("/admin/email-config", wrap(async (_req: Request, res: Response): Promise<void> => {
  const rows = await db.select().from(appSettingsTable);
  const config: Record<string, string> = {};
  for (const row of rows) {
    if ((EMAIL_KEYS as readonly string[]).includes(row.key)) {
      config[row.key] = row.value;
    }
  }
  // Mask the API key
  if (config.resend_api_key) {
    const key = config.resend_api_key;
    config.resend_api_key_masked = key.length > 8
      ? `${key.slice(0, 4)}${"•".repeat(key.length - 8)}${key.slice(-4)}`
      : "•".repeat(key.length);
    config.resend_api_key_set = "true";
    delete config.resend_api_key;
  }
  res.json({ config });
}));

router.put("/admin/email-config", wrap(async (req: Request, res: Response): Promise<void> => {
  const { resend_api_key, email_from } = req.body ?? {};

  if (resend_api_key && typeof resend_api_key === "string") {
    await db
      .insert(appSettingsTable)
      .values({ key: "resend_api_key", value: resend_api_key })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: resend_api_key } });
  }

  if (email_from && typeof email_from === "string") {
    await db
      .insert(appSettingsTable)
      .values({ key: "email_from", value: email_from })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: email_from } });
  }

  res.json({ success: true });
}));

router.delete("/admin/email-config/key", wrap(async (_req: Request, res: Response): Promise<void> => {
  await db.delete(appSettingsTable).where(eq(appSettingsTable.key, "resend_api_key"));
  res.json({ success: true });
}));

// ─── Shared DeepSeek Config ───────────────────────────────────────────────────

const SHARED_DEEPSEEK_KEYS = [
  "shared_deepseek_enabled",
  "shared_deepseek_api_key",
  "shared_deepseek_base_url",
  "shared_deepseek_model",
] as const;

router.get("/admin/deepseek-config", wrap(async (_req: Request, res: Response): Promise<void> => {
  const rows = await db.select().from(appSettingsTable);
  const config: Record<string, string> = {};
  for (const row of rows) {
    if ((SHARED_DEEPSEEK_KEYS as readonly string[]).includes(row.key)) {
      config[row.key] = row.value;
    }
  }
  if (config.shared_deepseek_api_key) {
    const key = config.shared_deepseek_api_key;
    config.shared_deepseek_api_key_masked = key.length > 8
      ? `${key.slice(0, 4)}${"•".repeat(key.length - 8)}${key.slice(-4)}`
      : "•".repeat(key.length);
    config.shared_deepseek_api_key_set = "true";
    delete config.shared_deepseek_api_key;
  }
  res.json({ config });
}));

router.put("/admin/deepseek-config", wrap(async (req: Request, res: Response): Promise<void> => {
  const { enabled, api_key, base_url, model } = req.body ?? {};

  const upsert = async (key: string, value: string) => {
    await db
      .insert(appSettingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value } });
  };

  if (typeof enabled === "boolean") {
    await upsert("shared_deepseek_enabled", enabled ? "true" : "false");
  }
  if (api_key && typeof api_key === "string") {
    await upsert("shared_deepseek_api_key", api_key);
  }
  if (base_url && typeof base_url === "string") {
    await upsert("shared_deepseek_base_url", base_url);
  }
  if (model && typeof model === "string") {
    await upsert("shared_deepseek_model", model);
  }

  res.json({ success: true });
}));

router.delete("/admin/deepseek-config/key", wrap(async (_req: Request, res: Response): Promise<void> => {
  await db.delete(appSettingsTable).where(eq(appSettingsTable.key, "shared_deepseek_api_key"));
  await db.delete(appSettingsTable).where(eq(appSettingsTable.key, "shared_deepseek_enabled"));
  res.json({ success: true });
}));

export default router;
