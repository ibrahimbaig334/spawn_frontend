"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/portfolio", label: "Overview" },
  { href: "/portfolio/activity", label: "Activity" },
  { href: "/portfolio/watchlist", label: "Watchlist" },
] as const;

export function PortfolioNav() {
  const pathname = usePathname();
  return (
    <nav
      className="flex border-b border-rule bg-raised px-[max(1rem,calc((100vw-80rem)/2))] max-[42rem]:overflow-x-auto max-[42rem]:px-0 print:hidden [&_a]:inline-flex [&_a]:min-h-target [&_a]:items-center [&_a]:border-x [&_a]:border-transparent [&_a]:px-4 [&_a]:py-2.5 [&_a]:font-mono [&_a]:text-xs [&_a]:font-bold [&_a]:text-ink-muted [&_a]:no-underline [&_a]:uppercase max-[42rem]:[&_a]:flex-1 max-[42rem]:[&_a]:shrink-0 max-[42rem]:[&_a]:justify-center [&_a[aria-current=page]]:border-rule [&_a[aria-current=page]]:border-b-paper [&_a[aria-current=page]]:bg-paper [&_a[aria-current=page]]:text-accent-strong"
      aria-label="Portfolio sections"
    >
      {items.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
