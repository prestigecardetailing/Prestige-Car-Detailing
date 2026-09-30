import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { readDoc, writeDoc } from "@/lib/booking-store";

/**
 * Optional customer accounts. A booking never needs one — this exists so a
 * customer who typed a password at booking can come back to /account and see
 * their past washes.
 *
 * Records live in the same layered store the bookings use (Netlify Blobs, then
 * /tmp, then process memory), under `account/…` keys. The phone number is the
 * login handle, so `account-phone/…` maps a normalized phone to an account id.
 *
 * Passwords are stored as scrypt hashes with a per-account random salt. The
 * plain-text password is never written anywhere — not to the store, not to a log,
 * not to the hub.
 */

export type AccountRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  firstName: string;
  lastName: string;
  /** E.164, the login handle. */
  phone: string;
  phoneDisplay: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  /** Absent when the customer booked without choosing a password. */
  passwordHash?: string;
  passwordSalt?: string;
  /** Newest last. Bookings made before the account existed are not backfilled. */
  bookingIds: string[];
};

/** What the browser is allowed to see. Never includes the hash or the salt. */
export type PublicAccount = {
  id: string;
  firstName: string;
  lastName: string;
  phoneDisplay: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  hasPassword: boolean;
};

const SCRYPT_KEY_LENGTH = 64;

function accountKey(id: string) {
  return `account/${id}`;
}

function phoneKey(phoneE164: string) {
  return `account-phone/${phoneE164.replace(/\D+/g, "")}`;
}

function safeId(id: string) {
  const cleaned = (id || "").replace(/[^a-zA-Z0-9_-]/g, "");
  return cleaned && cleaned === id ? cleaned : "";
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return {
    passwordSalt: salt,
    passwordHash: scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex"),
  };
}

export function passwordMatches(account: AccountRecord, password: string) {
  if (!account.passwordHash || !account.passwordSalt) return false;
  const expected = Buffer.from(account.passwordHash, "hex");
  const actual = scryptSync(password, account.passwordSalt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function publicAccount(account: AccountRecord): PublicAccount {
  return {
    id: account.id,
    firstName: account.firstName,
    lastName: account.lastName,
    phoneDisplay: account.phoneDisplay,
    email: account.email,
    address: account.address,
    city: account.city,
    state: account.state,
    zip: account.zip,
    hasPassword: !!account.passwordHash,
  };
}

export async function getAccount(id: string): Promise<AccountRecord | null> {
  const key = safeId(id);
  if (!key) return null;
  return readDoc<AccountRecord>(accountKey(key));
}

export async function findAccountByPhone(
  phoneE164: string,
): Promise<AccountRecord | null> {
  const pointer = await readDoc<{ accountId: string }>(phoneKey(phoneE164));
  if (!pointer?.accountId) return null;
  return getAccount(pointer.accountId);
}

async function save(account: AccountRecord) {
  await writeDoc(accountKey(account.id), account);
  await writeDoc(phoneKey(account.phone), { accountId: account.id });
  return account;
}

export type AccountDetails = {
  firstName: string;
  lastName: string;
  phone: string;
  phoneDisplay: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
};

export type UpsertResult =
  | { ok: true; account: AccountRecord; created: boolean }
  | { ok: false; code: "wrong-password" };

/**
 * Create the account, or update the one already on this phone number.
 *
 * An existing account that has a password is only updated when the caller proves
 * it: without the right password, details are left alone. That keeps someone who
 * knows a phone number from overwriting a real customer's record at checkout.
 */
export async function upsertAccount(
  details: AccountDetails,
  password: string,
): Promise<UpsertResult> {
  const existing = await findAccountByPhone(details.phone);
  const now = new Date().toISOString();

  if (!existing) {
    const account: AccountRecord = {
      id: randomUUID().replace(/-/g, "").slice(0, 16),
      createdAt: now,
      updatedAt: now,
      ...details,
      ...(password ? hashPassword(password) : {}),
      bookingIds: [],
    };
    await save(account);
    return { ok: true, account, created: true };
  }

  if (existing.passwordHash && !(password && passwordMatches(existing, password))) {
    return { ok: false, code: "wrong-password" };
  }

  const account: AccountRecord = {
    ...existing,
    ...details,
    updatedAt: now,
    ...(password && !existing.passwordHash ? hashPassword(password) : {}),
  };
  await save(account);
  return { ok: true, account, created: false };
}

export async function attachBookingToAccount(accountId: string, bookingId: string) {
  const account = await getAccount(accountId);
  if (!account) return null;
  if (account.bookingIds.includes(bookingId)) return account;
  return save({
    ...account,
    bookingIds: [...account.bookingIds, bookingId].slice(-100),
    updatedAt: new Date().toISOString(),
  });
}
