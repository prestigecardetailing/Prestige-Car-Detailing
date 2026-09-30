import { NextResponse } from "next/server";
import { currentAccount } from "@/lib/account-session";
import { publicAccount } from "@/lib/accounts";
import { getBooking } from "@/lib/booking-store";
import { formatMoney } from "@/lib/catalog";

export const dynamic = "force-dynamic";

/**
 * GET /api/account — the signed-in customer and their past washes.
 *
 * Only ever reads bookings this account is already linked to, so one customer can
 * never see another's history. Answers 200 with `account: null` when nobody is
 * signed in; the /account page renders the sign-in form off that.
 */
export async function GET() {
  const account = await currentAccount();
  if (!account) {
    return NextResponse.json({ account: null, washes: [] });
  }

  const records = await Promise.all(
    [...account.bookingIds].reverse().map((id) => getBooking(id).catch(() => null)),
  );

  const washes = records.flatMap((record) => {
    if (!record) return [];
    return [
      {
        reference: record.id,
        status: record.status,
        window: record.slot?.label || null,
        start: record.slot?.start || null,
        packageName: record.packageName,
        addonNames: record.addonNames,
        totalLabel: formatMoney(record.totalCents),
        address: record.customer.location || null,
        waiverSignedAt: record.waiver?.agreedAt || null,
      },
    ];
  });

  return NextResponse.json({ account: publicAccount(account), washes });
}
