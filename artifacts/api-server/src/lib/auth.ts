import crypto from "crypto";
import bcrypt from "bcryptjs";
import { type Request, type Response } from "express";
import { db, sessionsTable, usersTable, passwordResetTokensTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";

export const SESSION_COOKIE = "sid";
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface SessionUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
}

export interface SessionData {
  user: SessionUser;
}

// ─── Password ────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export function getSessionId(req: Request): string | null {
  return req.cookies?.[SESSION_COOKIE] ?? null;
}

export async function createSession(data: SessionData): Promise<string> {
  const sid = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    sid,
    sess: data as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + SESSION_TTL),
  });
  return sid;
}

export async function getSession(sid: string): Promise<SessionData | null> {
  const [row] = await db.select().from(sessionsTable).where(eq(sessionsTable.sid, sid));
  if (!row || row.expire < new Date()) {
    if (row) await deleteSession(sid);
    return null;
  }
  return row.sess as unknown as SessionData;
}

export async function deleteSession(sid: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

export async function clearSession(res: Response, sid: string | null): Promise<void> {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

// ─── Password Reset Tokens ───────────────────────────────────────────────────

export async function createPasswordResetToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await db.delete(passwordResetTokensTable)
    .where(eq(passwordResetTokensTable.userId, userId));

  await db.insert(passwordResetTokensTable).values({ userId, tokenHash, expiresAt });
  return rawToken;
}

export async function consumePasswordResetToken(rawToken: string): Promise<string | null> {
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const [row] = await db.select().from(passwordResetTokensTable)
    .where(and(
      eq(passwordResetTokensTable.tokenHash, tokenHash),
      gt(passwordResetTokensTable.expiresAt, new Date()),
    ));

  if (!row || row.usedAt) return null;

  await db.update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokensTable.id, row.id));

  return row.userId;
}

// ─── User lookup ─────────────────────────────────────────────────────────────

export async function findUserByEmail(email: string) {
  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()));
  return user ?? null;
}
