import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, limit, ok, parseBody } from "@/lib/api";
import { issueCode, pruneSendLog, releaseSendSlot, takeSendSlot } from "@/lib/codes";
import { sendVerificationCode } from "@/lib/emails";
import { emailSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

const schema = z.object({ email: emailSchema });

// Sign in or register with an email code, step 1: email a 6-digit code to the address typed.
// Used at checkout ("Get OTP") and on the login page ("Email me a code").
export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if ("error" in parsed) return parsed.error;
  const { email } = parsed.data;

  const limited = await limit(req, "email-code", 6, 10 * 60_000, email);
  if (limited) return limited;

  // Store accounts (the owner's admin login) are not customers and never get a customer code.
  const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (existing && existing.role !== "CUSTOMER") return fail("This email belongs to a store account. Please use a different email.", 400);

  // At most 3 codes per email per hour (and a 30-second gap), counted in the database.
  const slot = await takeSendSlot(email, "CHECKOUT");
  if (!slot.ok) return NextResponse.json({ error: slot.error, retryAfterSec: slot.retryAfterSec }, { status: 429 });

  try {
    const code = await issueCode(email, "CHECKOUT");
    await sendVerificationCode(email, code, "CHECKOUT");
  } catch (e) {
    await releaseSendSlot(slot.id);
    throw e;
  }
  void pruneSendLog();
  return ok({ ok: true, remaining: slot.remaining });
}
