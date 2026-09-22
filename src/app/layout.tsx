import type { Metadata } from "next";
import { Cormorant_Garamond, Geist_Mono, Outfit } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { site } from "@/lib/site";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | Mobile Detailing in Simpsonville & Greenville`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  openGraph: {
    title: site.name,
    description: site.description,
    url: site.url,
    siteName: site.name,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${cormorant.variable} ${geistMono.variable} dark h-full`}
    >
      <body className="flex min-h-full flex-col antialiased">
        {/* Netlify Forms detection */}
        <form
          name="contact"
          data-netlify="true"
          data-netlify-honeypot="company"
          hidden
        >
          <input name="name" />
          <input name="phone" />
          <input name="location" />
          <input name="vehicle" />
          <input name="message" />
          <input name="intent" />
          <input name="company" />
        </form>
        <form name="waiver" data-netlify="true" hidden>
          <input name="name" />
          <input name="agreedAt" />
          <input name="packageName" />
          <input name="waiverText" />
        </form>
        <form name="other-fee" data-netlify="true" hidden>
          <input name="description" />
          <input name="amount" />
        </form>
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
