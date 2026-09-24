import { FORMSUBMIT_AJAX_HASH } from "@/lib/site";

export type NotifyPayload = {
  subject?: string;
  message?: string;
  name?: string;
  phone?: string;
  vehicle?: string;
  location?: string;
  intent?: string;
  pdf?: string;
  pdfId?: string;
};

export type NotifyResult = { status: "sent" | "failed" | "skipped" };

export async function notifyOwnerFromBrowser(
  payload: NotifyPayload,
): Promise<NotifyResult> {
  const subject = payload.subject || "Prestige Car Wash site message";
  const message = payload.message || "";
  const name = payload.name || "Site visitor";
  const accessKey = (process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY || "").trim();

  if (accessKey) {
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: accessKey,
          subject,
          from_name: "Prestige Car Wash",
          name,
          phone: payload.phone || "",
          vehicle: payload.vehicle || "",
          location: payload.location || "",
          intent: payload.intent || "",
          message,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) return { status: "sent" };
    } catch {
      /* fall through to FormSubmit */
    }
  }

  const hash = FORMSUBMIT_AJAX_HASH.trim();
  const ajaxHash =
    hash &&
    !hash.includes("@") &&
    /^[a-zA-Z0-9_-]{8,128}$/.test(hash)
      ? hash
      : "";

  if (ajaxHash) {
    try {
      const res = await fetch(`https://formsubmit.co/ajax/${ajaxHash}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          _subject: subject,
          _template: "box",
          _captcha: "false",
          name,
          phone: payload.phone || "",
          vehicle: payload.vehicle || "",
          location: payload.location || "",
          message,
          ...(payload.pdf ? { pdf: payload.pdf } : {}),
          ...(payload.pdfId ? { pdfId: payload.pdfId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false && data.success !== "false") {
        return { status: "sent" };
      }
    } catch {
      return { status: "failed" };
    }
  }

  return accessKey || ajaxHash ? { status: "failed" } : { status: "skipped" };
}

/**
 * Same delivery path, callable from route handlers. Server env can hold a
 * non-public Web3Forms key; otherwise it falls back to the FormSubmit hash the
 * browser path already uses.
 */
export async function notifyOwnerFromServer(
  payload: NotifyPayload,
): Promise<NotifyResult> {
  // Escape hatch for local runs and preview deploys so test payments do not
  // email the shop.
  if ((process.env.PRESTIGE_NOTIFY_DISABLED || "").trim() === "1") {
    console.info("Owner notify skipped (PRESTIGE_NOTIFY_DISABLED)", payload.subject);
    return { status: "skipped" };
  }
  const subject = payload.subject || "Prestige Car Wash site message";
  const message = payload.message || "";
  const name = payload.name || "Prestige Car Wash site";
  const accessKey = (
    process.env.WEB3FORMS_ACCESS_KEY ||
    process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY ||
    ""
  ).trim();

  if (accessKey) {
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: accessKey,
          subject,
          from_name: "Prestige Car Wash",
          name,
          phone: payload.phone || "",
          vehicle: payload.vehicle || "",
          location: payload.location || "",
          intent: payload.intent || "",
          message,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) return { status: "sent" };
    } catch {
      /* fall through to FormSubmit */
    }
  }

  const hash = FORMSUBMIT_AJAX_HASH.trim();
  if (!hash || hash.includes("@") || !/^[a-zA-Z0-9_-]{8,128}$/.test(hash)) {
    return accessKey ? { status: "failed" } : { status: "skipped" };
  }

  try {
    const res = await fetch(`https://formsubmit.co/ajax/${hash}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        _subject: subject,
        _template: "box",
        _captcha: "false",
        name,
        phone: payload.phone || "",
        message,
        ...(payload.pdf ? { pdf: payload.pdf } : {}),
        ...(payload.pdfId ? { pdfId: payload.pdfId } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success !== false && data.success !== "false") {
      return { status: "sent" };
    }
  } catch {
    return { status: "failed" };
  }
  return { status: "failed" };
}
