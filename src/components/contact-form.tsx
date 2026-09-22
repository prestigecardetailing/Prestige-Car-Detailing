"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notifyOwnerFromBrowser } from "@/lib/notify-owner";
import { hostedOnNetlify } from "@/lib/site";

type FormStatus =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "sent"; storedOnly?: boolean }
  | { status: "error"; message: string }
  | { status: "not_configured" };

export function ContactForm() {
  const [state, setState] = useState<FormStatus>({ status: "idle" });
  const [intent, setIntent] = useState<"intake" | "message">("intake");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") || ""),
      phone: String(data.get("phone") || ""),
      vehicle: String(data.get("vehicle") || ""),
      location: String(data.get("location") || ""),
      message: String(data.get("message") || ""),
      intent,
      company: String(data.get("company") || ""),
    };

    if (payload.phone.replace(/\D/g, "").length < 10) {
      setState({
        status: "error",
        message: "Enter your phone number so we can call you back.",
      });
      return;
    }
    if (intent === "message" && payload.message.trim().length < 8) {
      setState({
        status: "error",
        message: "Add a short message, or choose request a visit.",
      });
      return;
    }

    setState({ status: "submitting" });
    try {
      let netlifyOk = false;
      if (hostedOnNetlify()) {
        const res = await fetch("/", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            "form-name": "contact",
            ...payload,
          }).toString(),
        }).catch(() => null);
        netlifyOk = !!res?.ok;
      }

      const apiRes = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const apiData = await apiRes.json().catch(() => ({}));
      const notify = await notifyOwnerFromBrowser({
        subject: `Prestige Car Wash contact from ${payload.name}`,
        name: payload.name,
        phone: payload.phone,
        vehicle: payload.vehicle,
        location: payload.location,
        intent: payload.intent,
        message: payload.message,
      });

      if ((apiRes.ok && apiData.delivered !== false) || notify.status === "sent") {
        form.reset();
        setState({ status: "sent" });
        return;
      }
      if (apiRes.status === 503 || apiData.delivered === false) {
        if (netlifyOk || hostedOnNetlify()) {
          form.reset();
          setState({ status: "sent", storedOnly: true });
          return;
        }
        setState({ status: "not_configured" });
        return;
      }
      if (!apiRes.ok) {
        setState({
          status: "error",
          message: apiData.error || "The message could not be sent.",
        });
        return;
      }
      form.reset();
      setState({ status: "sent" });
    } catch {
      setState({
        status: "error",
        message: "The message could not be sent. Try again.",
      });
    }
  }

  if (state.status === "sent") {
    return (
      <div
        className="rounded-xl bg-[#121216] px-6 py-10 ring-1 ring-white/10"
        role="status"
      >
        <p className="font-heading text-2xl">Request sent.</p>
        <p className="mt-3 text-silver">
          The shop has your name, phone, address, and vehicle. We will call the
          number you entered.
        </p>
        {state.storedOnly ? (
          <p className="mt-3 text-sm text-gold">
            Your request is stored. If you need the shop sooner, call the number
            on this page.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      name="contact"
      method="POST"
      action="/"
      onSubmit={onSubmit}
      className="relative space-y-5"
      noValidate
    >
      <input type="hidden" name="form-name" value="contact" />
      <input
        type="hidden"
        name="subject"
        value="Prestige Car Wash contact from %{formName}"
      />

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">What do you need?</legend>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="intent"
            value="intake"
            checked={intent === "intake"}
            onChange={() => setIntent("intake")}
            className="accent-[#d4af37]"
          />
          Request a visit
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="intent"
            value="message"
            checked={intent === "message"}
            onChange={() => setIntent("message")}
            className="accent-[#d4af37]"
          />
          Send a message
        </label>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          name="name"
          required
          autoComplete="name"
          maxLength={80}
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Your phone</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          required
          inputMode="tel"
          autoComplete="tel"
          placeholder="So we can call you back"
          maxLength={32}
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="location">Service address</Label>
        <Input
          id="location"
          name="location"
          required
          autoComplete="street-address"
          placeholder="Street, city, or neighborhood"
          maxLength={160}
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="vehicle">Vehicle</Label>
        <Input
          id="vehicle"
          name="vehicle"
          required
          placeholder="2019 Honda CR-V"
          maxLength={80}
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">
          Message{intent === "message" ? "" : " (optional)"}
        </Label>
        <Textarea
          id="message"
          name="message"
          required={intent === "message"}
          minLength={intent === "message" ? 8 : undefined}
          maxLength={2000}
          className="min-h-36"
        />
      </div>

      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor="company">Company</label>
        <input id="company" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      {state.status === "not_configured" ? (
        <p className="text-sm text-gold" role="status">
          Messaging is not connected yet. Your note was not sent to the shop.
          Call the number on this page, or book a time.
        </p>
      ) : null}
      {state.status === "error" ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="h-12 w-full sm:w-auto sm:px-8"
        disabled={state.status === "submitting"}
      >
        {state.status === "submitting" ? "Sending…" : "Send"}
      </Button>
    </form>
  );
}
