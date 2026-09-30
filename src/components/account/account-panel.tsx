"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";

type Account = {
  firstName: string;
  lastName: string;
  phoneDisplay: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
};

type Wash = {
  reference: string;
  status: string;
  window: string | null;
  packageName: string;
  addonNames: string[];
  totalLabel: string;
  address: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  pending: "Not paid",
  cancelled: "Cancelled",
};

type AccountReply = { account: Account | null; washes: Wash[] };

async function fetchAccount(): Promise<AccountReply> {
  try {
    const res = await fetch("/api/account", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    return {
      account: data?.account || null,
      washes: Array.isArray(data?.washes) ? data.washes : [],
    };
  } catch {
    return { account: null, washes: [] };
  }
}

/**
 * Sign-in and past washes. An account is optional — it only exists when the
 * customer typed a password while booking — so the signed-out state explains that
 * instead of pushing a sign-up form.
 */
export function AccountPanel() {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [washes, setWashes] = useState<Wash[]>([]);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAccount()
      .then((data) => {
        if (cancelled) return;
        setAccount(data.account);
        setWashes(data.washes);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.error || "That phone number and password do not match an account.",
        );
        return;
      }
      setPassword("");
      const data = await fetchAccount();
      setAccount(data.account);
      setWashes(data.washes);
    } catch {
      setError("Could not reach the account system. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/account/logout", { method: "POST" });
      setAccount(null);
      setWashes([]);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="text-silver" role="status">
        Loading your account…
      </p>
    );
  }

  if (!account) {
    return (
      <div className="space-y-8">
        <form
          className="rounded-xl bg-[#121216] p-6 ring-1 ring-white/10 sm:p-8"
          onSubmit={signIn}
        >
          <h2 className="font-heading text-2xl">Sign in</h2>
          <p className="mt-2 text-sm leading-relaxed text-silver">
            Use the phone number on your booking and the password you set when you
            booked.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="account-phone">Phone</Label>
              <Input
                id="account-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="864-555-0134"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-password">Password</Label>
              <Input
                id="account-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
              />
            </div>
          </div>
          {error ? (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            size="lg"
            className="mt-6 h-12 px-6"
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="rounded-xl border border-gold/30 bg-[#121216] p-6 sm:p-8">
          <h2 className="font-heading text-2xl">No account yet?</h2>
          <p className="mt-3 text-sm leading-relaxed text-silver">
            You never need one to book. If you want to see your washes here later,
            set a password on the details step while you book — it is the optional
            field under your email. If you already booked without one, call or text{" "}
            <a href={site.phoneTel} className="text-gold hover:text-foreground">
              {site.phone}
            </a>{" "}
            and we will pull up your history.
          </p>
          <Link
            href="/book"
            className={cn(buttonVariants({ size: "lg" }), "mt-5 h-11 px-5")}
          >
            See open windows
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl bg-[#121216] p-6 ring-1 ring-white/10 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.24em] text-gold uppercase">
              Signed in
            </p>
            <h2 className="font-heading mt-2 text-2xl">
              {account.firstName} {account.lastName}
            </h2>
            <p className="mt-2 text-sm text-silver">{account.phoneDisplay}</p>
            {account.email ? (
              <p className="mt-1 text-sm text-silver">{account.email}</p>
            ) : null}
            <p className="mt-1 text-sm text-silver">
              {[
                account.address,
                account.city,
                [account.state, account.zip].filter(Boolean).join(" "),
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10 px-4"
            disabled={busy}
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
        </div>
      </div>

      <div>
        <h2 className="font-heading text-2xl">Past washes</h2>
        {washes.length === 0 ? (
          <p className="mt-4 text-sm leading-relaxed text-silver">
            Nothing on this account yet. Washes show up here once a booking is
            paid.
          </p>
        ) : (
          <ul className="mt-5 space-y-4">
            {washes.map((wash) => (
              <li
                key={wash.reference}
                className="rounded-xl bg-[#121216] p-5 ring-1 ring-white/10"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-heading text-xl">
                    {wash.window || "No window scheduled"}
                  </p>
                  <span className="text-xs tracking-[0.18em] text-gold uppercase">
                    {STATUS_LABEL[wash.status] || wash.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-silver">
                  {wash.packageName}
                  {wash.addonNames.length
                    ? ` + ${wash.addonNames.join(", ")}`
                    : ""}{" "}
                  · {wash.totalLabel}
                </p>
                {wash.address ? (
                  <p className="mt-1 text-sm text-silver/80">{wash.address}</p>
                ) : null}
                <p className="mt-3 text-xs text-silver/70">
                  Reference <span className="font-mono">{wash.reference}</span>
                </p>
                {wash.status === "paid" ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/reschedule?ref=${encodeURIComponent(wash.reference)}`}
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "h-10 px-4",
                      )}
                    >
                      Move this booking
                    </Link>
                    <Link
                      href={`/cancel?ref=${encodeURIComponent(wash.reference)}`}
                      className={cn(
                        buttonVariants({ variant: "ghost" }),
                        "h-10 px-4",
                      )}
                    >
                      Cancel
                    </Link>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
