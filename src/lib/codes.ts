import { createHash, randomInt, timingSafeEqual } from "crypto";
import type { CodePurpose, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hash = (code: string, email: string) =>
  createHash("sha256").update(`${email}:${code}:${process.env.SESSION_SECRET ?? "dev"}`).digest("hex");

/** Creates a fresh 6-digit code for the email (replacing any earlier one). Returns the code to email. */
export async function issueCode(email: string, purpose: CodePurpose, data?: Prisma.InputJsonValue): Promise<string> {
  const code = randomInt(100000, 1000000).toString();
  await prisma.verificationCode.deleteMany({ where: { email, purpose } });
  await prisma.verificationCode.create({
    data: { email, purpose, codeHash: hash(code, email), data, expiresAt: new Date(Date.now() + TTL_MS) },
  });
  return code;
}

export type CodeResult = { ok: true; data: unknown } | { ok: false; error: string };

/** Checks and consumes a code. Codes expire after 10 minutes and lock after 5 wrong attempts. */
export async function consumeCode(email: string, purpose: CodePurpose, submitted: unknown): Promise<CodeResult> {
  const row = await prisma.verificationCode.findFirst({ where: { email, purpose }, orderBy: { createdAt: "desc" } });
  if (!row) return { ok: false, error: "No verification in progress. Please request a new code." };
  if (row.expiresAt < new Date()) {
    await prisma.verificationCode.delete({ where: { id: row.id } });
    return { ok: false, error: "This code has expired. Please request a new one." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await prisma.verificationCode.delete({ where: { id: row.id } });
    return { ok: false, error: "Too many incorrect attempts. Please request a new code." };
  }
  const a = Buffer.from(hash(String(submitted ?? "").trim(), email));
  const b = Buffer.from(row.codeHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await prisma.verificationCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "Invalid verification code." };
  }
  await prisma.verificationCode.delete({ where: { id: row.id } });
  return { ok: true, data: row.data };
}

/** At most this many codes can be emailed to one address in any rolling hour. */
export const CODES_PER_HOUR = 3;
const HOUR_MS = 60 * 60_000;
const COOLDOWN_MS = 30_000; // minimum gap between two codes to the same address

export type SendSlot = { ok: true; id: string; remaining: number } | { ok: false; error: string; retryAfterSec: number };

/**
 * Takes one of the address's 3-codes-per-hour slots before a code is emailed. It is counted from the database
 * (not server memory), so the limit holds even when many serverless instances answer at once. If the email then
 * fails to send, give the slot back with releaseSendSlot.
 */
export async function takeSendSlot(email: string, purpose: CodePurpose): Promise<SendSlot> {
  const now = Date.now();
  return prisma.$transaction(async (tx): Promise<SendSlot> => {
    // One request per address at a time, so two taps at once can't both slip under the limit.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${email + ":" + purpose}))`;
    const recent = await tx.codeSend.findMany({
      where: { email, purpose, createdAt: { gt: new Date(now - HOUR_MS) } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    if (recent.length >= CODES_PER_HOUR) {
      const ms = recent[0].createdAt.getTime() + HOUR_MS - now;
      const mins = Math.ceil(ms / 60_000);
      return {
        ok: false,
        error: `You've reached the limit of ${CODES_PER_HOUR} codes per hour for this email. Please try again in ${mins <= 1 ? "a minute" : `${mins} minutes`}.`,
        retryAfterSec: Math.ceil(ms / 1000),
      };
    }
    const last = recent[recent.length - 1];
    if (last && now - last.createdAt.getTime() < COOLDOWN_MS) {
      const secs = Math.ceil((COOLDOWN_MS - (now - last.createdAt.getTime())) / 1000);
      return { ok: false, error: `A code was just sent. You can ask for another in ${secs} seconds.`, retryAfterSec: secs };
    }
    const row = await tx.codeSend.create({ data: { email, purpose }, select: { id: true } });
    return { ok: true, id: row.id, remaining: CODES_PER_HOUR - recent.length - 1 };
  });
}

/** A code that was never delivered shouldn't use up one of the customer's 3. */
export async function releaseSendSlot(id: string): Promise<void> {
  await prisma.codeSend.delete({ where: { id } }).catch(() => {});
}

/** Housekeeping: the log is only needed for the last hour. */
export async function pruneSendLog(): Promise<void> {
  await prisma.codeSend.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * HOUR_MS) } } }).catch(() => {});
}
