"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ThemeToggle } from "./theme-toggle";

const PAGE_WIDTH =
  "mx-auto w-full max-w-measure px-[max(1rem,calc((100vw-80rem)/2))]";
const SEARCH =
  "grid grid-cols-[minmax(0,1fr)_auto] [&_input]:min-h-target [&_input]:min-w-0 [&_input]:border [&_input]:border-r-0 [&_input]:border-rule [&_input]:bg-raised [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-ink [&_button]:min-h-target [&_button]:cursor-pointer [&_button]:border [&_button]:border-ink [&_button]:bg-ink [&_button]:px-3 [&_button]:py-2.5 [&_button]:font-bold [&_button]:text-inverse";

const navigation = [
  { href: "/tokens", label: "Tokens" },
  { href: "/create", label: "Create" },
  { href: "/portfolio", label: "Portfolio" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SearchForm({
  className,
  id,
  onSubmit,
}: {
  className?: string;
  id: string;
  onSubmit?: () => void;
}) {
  return (
    <form
      className={className}
      action="/tokens"
      role="search"
      onSubmit={onSubmit}
    >
      <label
        className="absolute -m-px size-px overflow-hidden border-0 p-0 whitespace-nowrap [clip:rect(0,0,0,0)]"
        htmlFor={id}
      >
        Search demo tokens
      </label>
      <input id={id} name="q" type="search" placeholder="Search tokens" />
      <button type="submit">Search</button>
    </form>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((restoreFocus = true) => {
    setIsOpen(false);
    if (restoreFocus)
      window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'a[href], input, button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable?.[0];
    const last = focusable?.[focusable.length - 1];
    first?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "Tab" && first && last) {
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, isOpen]);

  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-paper [@media(max-height:35rem)]:static [@media(min-resolution:180dpi)]:static print:static">
      <div
        className={[
          PAGE_WIDTH,
          "grid min-h-[4.25rem] grid-cols-[auto_auto_minmax(14rem,1fr)_auto] items-center gap-[clamp(.75rem,2vw,1.5rem)] max-[60rem]:grid-cols-[auto_1fr_auto] max-[36rem]:flex",
        ].join(" ")}
      >
        <Link
          className="text-xl font-extrabold tracking-[-0.04em] no-underline"
          href="/"
          aria-label="Spawn home"
          aria-current={pathname === "/" ? "page" : undefined}
        >
          Spawn
        </Link>
        <nav
          className="flex items-center gap-[clamp(1rem,2.5vw,2rem)] max-[60rem]:hidden print:hidden [&_a]:text-sm [&_a]:font-semibold [&_a]:underline-offset-4 [&_a[aria-current=page]]:text-accent-strong [&_a[aria-current=page]]:underline [&_a[aria-current=page]]:decoration-2"
          aria-label="Primary navigation"
        >
          {navigation.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(pathname, href) ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <SearchForm
          className={[
            SEARCH,
            "w-[min(100%,26rem)] justify-self-end max-[60rem]:w-full max-[60rem]:justify-self-stretch max-[36rem]:hidden print:hidden",
          ].join(" ")}
          id="header-token-query"
        />
          <div className="flex items-center justify-end gap-2 max-[60rem]:col-start-3 max-[60rem]:row-start-1 max-[36rem]:ml-auto">
            <ThemeToggle />
            <button
              ref={triggerRef}
              className="hidden min-h-target min-w-target cursor-pointer border border-ink bg-transparent px-3 py-2 font-bold max-[60rem]:block print:hidden"
              type="button"
              aria-expanded={isOpen}
              aria-controls="mobile-navigation"
              onClick={() => setIsOpen(true)}
            >
              Menu
            </button>
          </div>
      </div>
      {isOpen ? (
        <div className="fixed inset-0 z-[100] grid justify-items-end print:hidden">
          <button
            className="absolute inset-0 w-full cursor-pointer border-0 bg-carbon/72 forced-colors:bg-[CanvasText] forced-colors:opacity-60"
            type="button"
            onClick={() => close()}
            aria-label="Close navigation"
          />
          <div
            id="mobile-navigation"
            ref={dialogRef}
            className="relative min-h-full w-[min(27rem,92vw)] border-l border-ink bg-paper p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-navigation-title"
          >
            <div className="flex items-center justify-between gap-4 border-b-2 border-ink pb-4">
              <h2 className="m-0 text-lg" id="mobile-navigation-title">
                Navigation
              </h2>
              <button
                className="min-h-target cursor-pointer border border-ink bg-transparent px-3 py-2"
                type="button"
                onClick={() => close()}
                aria-label="Close navigation"
              >
                Close
              </button>
            </div>
            <nav
              className="grid [&_a]:border-b [&_a]:border-rule [&_a]:py-4 [&_a]:text-2xl [&_a]:font-bold [&_a]:no-underline [&_a[aria-current=page]]:text-accent-strong"
              aria-label="Mobile navigation"
            >
              <Link
                href="/"
                aria-current={pathname === "/" ? "page" : undefined}
                onClick={() => close(false)}
              >
                Home
              </Link>
              {navigation.map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive(pathname, href) ? "page" : undefined}
                  onClick={() => close(false)}
                >
                  {label}
                </Link>
              ))}
            </nav>
            <SearchForm
              className={[SEARCH, "mt-6"].join(" ")}
              id="mobile-token-query"
              onSubmit={() => close(false)}
            />
            <p className="mt-8 font-mono text-[0.68rem] font-semibold leading-6 text-ink-muted uppercase">
              Fixed demonstration data · Browser-local interactions · No
              connected transaction
            </p>
          </div>
        </div>
      ) : null}
    </header>
  );
}
