import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Manrope } from "next/font/google";
import { AuthProvider } from "@/lib/AuthProvider";
import Analytics from "@/components/Analytics";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

// The site only has a light design. Declaring that stops phone browsers (Samsung Internet,
// Chrome "dark mode for web pages") from auto-darkening it, which turned the logo and
// orange buttons into muddy dark shades.
export const viewport: Viewport = {
  colorScheme: "only light",
  themeColor: "#FBFCFD",
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.iconfam.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "iConfam | Independent verification before your money moves",
    template: "%s | iConfam",
  },
  description:
    "Sending money home for a house, a build or a farm? iConfam sends a vetted field agent and licensed professionals to check the paperwork and the site, and you get a plain report before you pay.",
  applicationName: "iConfam",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "iConfam",
    url: "/",
    title: "Before you send that money home, confam am.",
    description:
      "Independent property, build and farm verification in Nigeria for the diaspora. We check the paperwork and the site before you pay.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Before you send that money home, confam am.",
    description:
      "Independent property, build and farm verification in Nigeria for the diaspora.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${manrope.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
