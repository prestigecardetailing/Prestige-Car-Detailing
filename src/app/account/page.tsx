import type { Metadata } from "next";
import { AccountPanel } from "@/components/account/account-panel";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Account",
  description: `Sign in to see your past ${site.name} washes.`,
};

export default function AccountPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
      <h1 className="font-heading text-4xl sm:text-5xl">Your account.</h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-silver">
        Sign in to see your past washes, move a booking, or cancel one. Accounts
        are optional — booking never requires one.
      </p>
      <div className="mt-10">
        <AccountPanel />
      </div>
    </div>
  );
}
