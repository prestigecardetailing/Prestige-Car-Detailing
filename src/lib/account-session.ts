import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getAccount, type AccountRecord } from "@/lib/accounts";

/**
 * Signed, httpOnly account session cookie. The value is
 * `<accountId>.<issuedAtMs>.<hmac>`, so nothing about the session can be forged
 * or extended from the browser side.
 *
 * `PRESTIGE_ACCOUNT_SECRET` is the signing key. When it is not set the process
 * generates a random one at boot: sessions then work but do not survive a
 * redeploy, which is the right failure mode — never a predictable key.
 */

const COOKIE_NAME = "pcw_account";
const MAX_AGE_SECONDS = 30 * 24 * 3600;

declare global {
  var __pcwSessionSecret: string | undefined;
}

function secret() {
  const fromEnv = (process.env.PRESTIGE_ACCOUNT_SECRET || "").trim();
  if (fromEnv) return fromEnv;
  if (!globalThis.__pcwSessionSecret) {
    globalThis.__pcwSessionSecret = randomBytes(32).toString("hex");
    console.warn(
      "PRESTIGE_ACCOUNT_SECRET is not set — account sessions are signed with a per-process key and will not survive a redeploy.",
    );
  }
  return globalThis.__pcwSessionSecret;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function verify(value: string): string | null {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [accountId, issuedAt, mac] = parts;
  const expected = sign(`${accountId}.${issuedAt}`);
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  const age = Date.now() - Number(issuedAt);
  if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_SECONDS * 1000) return null;
  return accountId;
}

export async function startSession(accountId: string) {
  const issuedAt = String(Date.now());
  const payload = `${accountId}.${issuedAt}`;
  const store = await cookies();
  store.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function currentAccount(): Promise<AccountRecord | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const accountId = verify(raw);
  if (!accountId) return null;
  return getAccount(accountId);
}
