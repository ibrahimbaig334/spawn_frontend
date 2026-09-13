import type { Metadata } from "next";
import Script from "next/script";
import "@fontsource-variable/geologica";
import "@fontsource/commit-mono";
import { ProtocolBanner } from "@/components/shell/protocol-banner";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";
import { Providers } from "./providers";
import "./globals.css";

const THEME_SCRIPT = `(() => {
  try {
    const saved = localStorage.getItem("spawn-theme");
    const theme = saved === "light" || saved === "dark"
      ? saved
      : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
})();`;

export const metadata: Metadata = {
  title: {
    default: "Spawn — milestone-based token launchpad",
    template: "%s — Spawn",
  },
  description:
    "Launch and trade milestone-backed tokens on Base: bonding curve to graduation, protocol-owned sell ladder, creator revenue streams.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="spawn-theme" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        <a
          className="fixed top-2 left-2 z-[1000] -translate-y-[180%] border-2 border-current bg-inverse px-4 py-3 font-bold text-ink focus:translate-y-0 print:hidden"
          href="#main-content"
        >
          Skip to main content
        </a>
        <Providers>
          <ProtocolBanner />
          <SiteHeader />
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
