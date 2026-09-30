import { NextRequest, NextResponse } from "next/server";
import { startSession } from "@/lib/account-session";
import {
  findAccountByPhone,
  passwordMatches,
  publicAccount,
} from "@/lib/accounts";
import { normalizePhone } from "@/lib/contact";

export const dynamic = "force-dynamic";

/** Same answer for an unknown phone and a wrong password — no account probing. */
const REJECTION = {
  error: "That phone number and password do not match an account.",
  code: "bad-credentials",
} as const;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  const password = String(body.password || "");
  if (!phone || !password) {
    return NextResponse.json(REJECTION, { status: 401 });
  }

  const account = await findAccountByPhone(phone.e164);
  if (!account || !passwordMatches(account, password)) {
    return NextResponse.json(REJECTION, { status: 401 });
  }

  await startSession(account.id);
  return NextResponse.json({ ok: true, account: publicAccount(account) });
}
