import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy policy for ${site.name} and the Ask Jesus iOS app.`,
};

const sections: { title: string; body: string[] }[] = [
  {
    title: "Who operates this",
    body: [
      "Prestige Car Wash LLC (“Prestige,” “we,” “us”) is a South Carolina mobile detailing business. We also publish the Ask Jesus iOS app. Both are operated by the same owner. This policy covers prestigecarwashsc.com and the Ask Jesus app.",
      "The public shop phone for detailing is 864-619-4911. Privacy questions and deletion requests go to the email at the end of this page — not a personal cell number.",
    ],
  },
  {
    title: "What this policy covers",
    body: [
      "Website: booking, prepaid checkout, contact forms, and signed liability-waiver records for detailing jobs.",
      "Ask Jesus app: on-device King James Version (KJV) Bible reading, and optional Ask or Prayer prompt features that can call a cloud AI provider when you choose to use them.",
    ],
  },
  {
    title: "Information we may collect",
    body: [
      "Ask Jesus prompts. If you use Ask or a Prayer prompt, the text you type (and related conversation context needed to answer) may be sent to our AI provider so a response can be generated. We do not need your name to use those features.",
      "Device and app information. The app or store services may see device type, OS version, app version, language, and coarse diagnostics that help the app run.",
      "Crash and performance logs. If Apple, our hosting provider, or a crash reporter records a failure, that log can include device model, OS version, and the screen or action that failed. We do not use this to advertise to you.",
      "Website forms. Contact and waiver forms may include name, phone, address or service location, vehicle, message, and — for /pay — a typed legal name, sign time, and a copy of the signed waiver. Payment card numbers are entered on Square, not stored on this site.",
      "Technical website logs. Our host may log IP address, browser type, pages requested, and timestamps to operate the site and stop abuse.",
    ],
  },
  {
    title: "KJV Bible text on the device",
    body: [
      "Ask Jesus includes King James Version Bible text for reading and reference. Where the app stores or searches that text on your device, it stays on the device. Opening a verse or reading offline does not, by itself, send Bible text or your reading place to us or to an AI provider.",
      "A cloud request happens only if you use an optional Ask or Prayer prompt feature that needs a generated reply.",
    ],
  },
  {
    title: "Optional cloud AI (xAI / Grok)",
    body: [
      "Ask and Prayer prompt features are optional. When you submit a prompt, we may send that prompt to xAI (Grok) so the service can generate a response. xAI processes the request on its systems under its own terms and privacy policy.",
      "Do not put information in a prompt that you do not want a cloud provider to process (for example, another person’s full name, a street address, or a confession you want to keep only on the device).",
      "If you never use Ask or Prayer prompts, those features do not send prompt text to xAI.",
    ],
  },
  {
    title: "How we use information",
    body: [
      "To show Bible text and app screens on your device.",
      "To generate Ask or Prayer replies when you request them.",
      "To schedule, pay for, and perform mobile detailing, and to keep signed waiver records.",
      "To answer messages, prevent spam or abuse, fix crashes, and keep the site and app working.",
      "We do not use Ask Jesus prompts to sell you car-wash packages, and we do not sell personal data.",
    ],
  },
  {
    title: "We do not sell personal data",
    body: [
      "We do not sell, rent, or trade your personal information. We do not share Ask Jesus prompts with data brokers. We do not use them to build an advertising profile.",
      "We share information only with service providers that help us operate (for example xAI for optional prompts, Square for payments, and our website host and form/email delivery for the shop site), or if the law requires it.",
    ],
  },
  {
    title: "Third parties",
    body: [
      "xAI (Grok) — optional Ask / Prayer prompt generation in the Ask Jesus app.",
      "Apple — App Store distribution, in-app purchases if offered, and system services such as crash reporting that you enable at the OS level.",
      "Square — prepaid detailing checkout on prestigecarwashsc.com/pay.",
      "Netlify and form/email delivery — hosting the website and sending shop notifications from contact or waiver forms.",
      "Those companies process data under their own policies. We do not control how they secure their systems.",
    ],
  },
  {
    title: "Retention",
    body: [
      "On-device Bible text and local app state remain until you delete the app or clear that data on the device.",
      "Prompt text sent to xAI is retained by that provider according to its policy. We do not keep a separate marketing database of Ask Jesus prompts.",
      "Website contact messages and signed waivers are kept as business records for the job and for legal and insurance needs, then deleted when they are no longer required.",
      "Server and crash logs are kept only as long as needed to operate and debug, typically a short rolling window unless a specific incident requires longer review.",
    ],
  },
  {
    title: "Children’s privacy",
    body: [
      "Ask Jesus and prestigecarwashsc.com are not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 submitted a prompt or a form, email us and we will delete what we control.",
    ],
  },
  {
    title: "Your privacy rights (United States / California)",
    body: [
      "Depending on where you live, you may have the right to ask what personal information we have, request a copy, correct it, or ask us to delete it, and to opt out of “sale” or “sharing” of personal information. We do not sell personal information and we do not share it for cross-context behavioral advertising.",
      "To use these rights, email the address below. We will need enough detail to find your records (for example the Apple account email you used, or the name and phone on a detailing form). We will not discriminate against you for making a request.",
      "If we cannot verify a request, we will say so and explain what we need.",
    ],
  },
  {
    title: "How to contact us or request deletion",
    body: [
      "Privacy contact: mcelreath.intelligence@gmail.com. Use that address for access, correction, or deletion requests about Ask Jesus or this website.",
      "For a detailing booking or payment question, call the shop at 864-619-4911 or use the message form on this site.",
    ],
  },
  {
    title: "Changes",
    body: [
      "If this policy changes in a material way, we will update this page and the effective date. Continued use of the site or app after an update means you accept the revised policy.",
    ],
  },
  {
    title: "Privacy email",
    body: [
      "Send privacy questions and deletion requests to mcelreath.intelligence@gmail.com. Effective date: September 11, 2026.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
      <h1 className="font-heading text-4xl sm:text-5xl">Privacy Policy</h1>
      <p className="mt-5 text-lg leading-relaxed text-silver">
        How Prestige Car Wash LLC handles information for this website and the
        Ask Jesus iOS app. Effective September 11, 2026.
      </p>
      <div className="mt-12 space-y-10">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-heading text-2xl">{section.title}</h2>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-silver sm:text-base">
              {section.body.map((p) => (
                <p key={p.slice(0, 48)}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
