import { NextRequest, NextResponse } from "next/server";
import { startSession } from "@/lib/account-session";
import { publicAccount, upsertAccount } from "@/lib/accounts";
import { PASSWORD_MIN_LENGTH, validateContact } from "@/lib/contact";
import { postToHub } from "@/lib/hub-ingest";

export const dynamic = "force-dynamic";

/**
 * POST /api/account/register
 *
 * Called from the booking details step when the customer typed a password. An
 * account is always optional: this route is never on the critical path to paying.
 *
 * If an account already exists on the phone number and it has a password, the
 * right password has to come with the request or the details are left alone —
 * knowing someone's phone number is not enough to take over their record.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const contact = validateContact({
    firstName: body.firstName,
    lastName: body.lastName,
    name: body.name,
    phone: body.phone,
    address: body.address,
    city: body.city,
    state: body.state,
    zip: body.zip,
    email: body.email,
    password: body.password,
  });

  if (!contact.ok) {
    return NextResponse.json(
      { error: "Check your details.", code: "contact-required", fields: contact.errors },
      { status: 400 },
    );
  }
  if (contact.value.password.length < PASSWORD_MIN_LENGTH) {
    return NextResponse.json(
      {
        error: `A password needs at least ${PASSWORD_MIN_LENGTH} characters.`,
        code: "contact-required",
        fields: { password: `Use at least ${PASSWORD_MIN_LENGTH} characters.` },
      },
      { status: 400 },
    );
  }

  const result = await upsertAccount(
    {
      firstName: contact.value.firstName,
      lastName: contact.value.lastName,
      phone: contact.value.phone,
      phoneDisplay: contact.value.phoneDisplay,
      email: contact.value.email,
      address: contact.value.address,
      city: contact.value.city,
      state: contact.value.state,
      zip: contact.value.zip,
    },
    contact.value.password,
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          "There is already an account on that phone number. Enter its password, or leave the password blank to book without an account.",
        code: "wrong-password",
        fields: { password: "That password does not match the existing account." },
      },
      { status: 409 },
    );
  }

  await startSession(result.account.id);
  await postToHub("account", result.account.id, {
    created: result.created,
    firstName: result.account.firstName,
    lastName: result.account.lastName,
    phone: result.account.phone,
    email: result.account.email,
    address: result.account.address,
    city: result.account.city,
    state: result.account.state,
    zip: result.account.zip,
    hasPassword: true,
  }).catch(() => null);

  return NextResponse.json({
    ok: true,
    created: result.created,
    account: publicAccount(result.account),
  });
}
