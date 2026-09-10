import type { Metadata } from "next";
import Script from "next/script";
import "@fontsource-variable/geologica";
import "@fontsource/commit-mono";
import { DemoBanner } from "@/components/shell/demo-banner";
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
    default: "Spawn — milestone-based token launch concept",
    template: "%s — Spawn",
  },
  description:
    "An interactive concept for milestone-based token launches, using demonstration data only.",
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
        <DemoBanner />
        <SiteHeader />
        <Providers>{children}</Providers>
        <SiteFooter />
      </body>
    </html>
  );
}
