import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import type { Db } from "./client.js";
import { appUser, passwordReset, session } from "./pg-schema.js";
import { AuthError } from "./auth.js";
import { sendEmail } from "./email.js";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function requestPasswordRecovery(
  db: Db,
  email: string,
  deliver = sendEmail,
) {
  const base = new URL(process.env.WEB_URL ?? "http://localhost:3010");
  if (process.env.NODE_ENV === "production" && base.protocol !== "https:") throw new Error("secure_web_url_required");
  const users = await db.select().from(appUser).where(eq(appUser.email, email.trim().toLowerCase())).limit(1);
  const user = users[0];
  if (!user) return;
  const token = randomBytes(32).toString("hex");
  const tokenHash = digest(token);
  // Serialize requests for one user and limit delivery to one message per minute.
  const issued = await db.transaction(async (tx) => {
    await tx.select({ id: appUser.id }).from(appUser).where(eq(appUser.id, user.id)).for("update");
    const recent = await tx.select().from(passwordReset).where(and(eq(passwordReset.userId, user.id), gt(passwordReset.createdAt, new Date(Date.now() - 60_000)))).limit(1);
    if (recent.length) return false;
    await tx.delete(passwordReset).where(eq(passwordReset.userId, user.id));
    await tx.insert(passwordReset).values({ tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 30 * 60_000) });
    return true;
  });
  if (!issued) return;
  // Fragment avoids leaking reset tokens into request URLs, server logs or referrers.
  const url = new URL("/reset-password", base);
  url.hash = `token=${token}`;
  try {
    await deliver({ to: user.email, subject: "Reset your GeoLens password", text: `Reset your password using this single-use link (expires in 30 minutes):\n\n${url}\n\nIf you did not request this, ignore this email.` });
  } catch {
    await db.delete(passwordReset).where(eq(passwordReset.tokenHash, tokenHash));
    throw new Error("email_delivery_failed");
  }
}

export async function completePasswordRecovery(db: Db, token: string, password: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new AuthError("invalid_reset_token", "Reset link is invalid or expired.");
  if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) throw new AuthError("weak_password", "Use at least 12 characters and at most 72 UTF-8 bytes.");
  const passwordHash = await bcrypt.hash(password, 12);
  await db.transaction(async (tx) => {
    const candidates = await tx.select().from(passwordReset).where(eq(passwordReset.tokenHash, digest(token))).limit(1);
    const candidate = candidates[0];
    if (!candidate) throw new AuthError("invalid_reset_token", "Reset link is invalid or expired.");
    await tx.select({ id: appUser.id }).from(appUser).where(eq(appUser.id, candidate.userId)).for("update");
    const used = await tx.delete(passwordReset).where(and(eq(passwordReset.tokenHash, digest(token)), gt(passwordReset.expiresAt, new Date()))).returning();
    if (!used.length) throw new AuthError("invalid_reset_token", "Reset link is invalid or expired.");
    await tx.update(appUser).set({ passwordHash }).where(eq(appUser.id, candidate.userId));
    await tx.delete(passwordReset).where(eq(passwordReset.userId, candidate.userId));
    await tx.delete(session).where(eq(session.userId, candidate.userId));
  });
}
