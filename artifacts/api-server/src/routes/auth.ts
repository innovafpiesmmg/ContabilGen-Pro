import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  createSession,
  clearSession,
  getSessionId,
  createPasswordResetToken,
  consumePasswordResetToken,
  findUserByEmail,
  SESSION_COOKIE,
  SESSION_TTL,
} from "../lib/auth";
import { sendPasswordResetEmail } from "../lib/email";

const router: IRouter = Router();

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;
const wrap = (fn: AsyncHandler): AsyncHandler => (req, res, next) => fn(req, res, next).catch(next);

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: process.env.SECURE_COOKIES !== "false",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

router.get("/auth/user", (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.json({ user: null });
  }
});

router.post("/auth/register", wrap(async (req: Request, res: Response): Promise<void> => {
  const { email, password, firstName, lastName } = req.body ?? {};

  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Correo electrónico inválido." });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres." });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    res.status(409).json({ error: "Ya existe una cuenta con ese correo electrónico." });
    return;
  }

  const [{ total }] = await db.select({ total: count() }).from(usersTable);
  const isFirstUser = total === 0;

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    email: normalizedEmail,
    passwordHash,
    firstName: firstName?.trim() || null,
    lastName: lastName?.trim() || null,
    isAdmin: isFirstUser,
  }).returning();

  const sid = await createSession({ user: { id: user.id, email: user.email, firstName: user.firstName ?? null, lastName: user.lastName ?? null, isAdmin: user.isAdmin } });
  setSessionCookie(res, sid);

  res.status(201).json({
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isAdmin: user.isAdmin },
  });
}));

router.post("/auth/login", wrap(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ error: "Correo y contraseña son obligatorios." });
    return;
  }

  const user = await findUserByEmail(email);
  if (!user) {
    res.status(401).json({ error: "Correo o contraseña incorrectos." });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Correo o contraseña incorrectos." });
    return;
  }

  const sid = await createSession({ user: { id: user.id, email: user.email, firstName: user.firstName ?? null, lastName: user.lastName ?? null, isAdmin: user.isAdmin } });
  setSessionCookie(res, sid);

  res.json({
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isAdmin: user.isAdmin },
  });
}));

router.post("/auth/logout", wrap(async (req: Request, res: Response): Promise<void> => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ success: true });
}));

router.post("/auth/forgot-password", wrap(async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body ?? {};
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Correo electrónico obligatorio." });
    return;
  }

  const user = await findUserByEmail(email);
  if (user) {
    try {
      const rawToken = await createPasswordResetToken(user.id);
      await sendPasswordResetEmail(user.email, rawToken, req.headers as Record<string, string | string[] | undefined>);
    } catch (emailErr) {
      console.error("[auth] Error enviando email de recuperación:", emailErr instanceof Error ? emailErr.message : emailErr);
    }
  }

  res.json({ message: "Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña." });
}));

router.post("/auth/reset-password", wrap(async (req: Request, res: Response): Promise<void> => {
  const { token, newPassword } = req.body ?? {};

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Token inválido." });
    return;
  }
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
    res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres." });
    return;
  }

  const userId = await consumePasswordResetToken(token);
  if (!userId) {
    res.status(400).json({ error: "El enlace ha caducado o ya fue utilizado." });
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, userId));

  res.json({ message: "Contraseña actualizada correctamente. Ya puedes iniciar sesión." });
}));

export default router;
