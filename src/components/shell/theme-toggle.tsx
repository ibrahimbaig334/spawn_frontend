"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "spawn-theme";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setTheme(currentTheme()));
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => {
      try {
        if (window.localStorage.getItem(STORAGE_KEY)) return;
      } catch {
        // Storage may be unavailable; system preference still remains usable.
      }
      const nextTheme: Theme = media.matches ? "dark" : "light";
      document.documentElement.dataset.theme = nextTheme;
      setTheme(nextTheme);
    };
    const syncStoredTheme = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const nextTheme: Theme =
        event.newValue === "dark"
          ? "dark"
          : event.newValue === "light"
            ? "light"
            : media.matches
              ? "dark"
              : "light";
      document.documentElement.dataset.theme = nextTheme;
      setTheme(nextTheme);
    };

    media.addEventListener("change", syncSystemTheme);
    window.addEventListener("storage", syncStoredTheme);
    return () => {
      window.cancelAnimationFrame(frame);
      media.removeEventListener("change", syncSystemTheme);
      window.removeEventListener("storage", syncStoredTheme);
    };
  }, []);

  const dark = theme === "dark";

  return (
    <button
      className="inline-flex min-h-target min-w-target cursor-pointer items-center justify-center gap-2 border border-ink bg-transparent px-3 py-2 text-sm font-bold text-ink print:hidden"
      type="button"
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      aria-pressed={dark}
      onClick={() => {
        const nextTheme: Theme = dark ? "light" : "dark";
        document.documentElement.dataset.theme = nextTheme;
        try {
          window.localStorage.setItem(STORAGE_KEY, nextTheme);
        } catch {
          // The theme still applies for this document when storage is unavailable.
        }
        setTheme(nextTheme);
      }}
    >
      <span
        className="relative size-4 rounded-full border border-current after:absolute after:inset-[3px] after:rounded-full after:bg-current"
        aria-hidden="true"
      />
      <span>{dark ? "Light" : "Dark"}</span>
    </button>
  );
}
