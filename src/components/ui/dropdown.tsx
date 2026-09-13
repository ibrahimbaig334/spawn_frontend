"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface DropdownOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Styled dropdown (button + popover menu) matching the Spawn design system.
 * Replaces native selects for user-facing filters: full keyboard support
 * (Enter/Space/Escape/arrows), outside-click close, no OS-styled menu.
 */
export function Dropdown({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() =>
    Math.max(0, options.findIndex((option) => option.value === value)),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0]!;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, options, value]);

  const choose = (next: string) => {
    setOpen(false);
    if (next !== value) onChange(next);
  };

  return (
    <div ref={rootRef} className="relative grid min-w-0 gap-1.5">
      <span
        className="text-[0.9375rem] font-bold leading-[1.3] text-ink"
        id={`${id}-label`}
      >
        {label}
      </span>
      <button
        id={id}
        type="button"
        aria-labelledby={`${id}-label ${buttonId}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!open) {
            setActive(Math.max(0, options.findIndex((option) => option.value === value)));
          }
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={[
          "flex min-h-target min-w-44 cursor-pointer items-center justify-between gap-3 rounded-sm border-2 bg-raised px-3 py-2.5 text-left text-ink",
          open ? "border-focus outline-3 outline-offset-1 outline-focus" : "border-ink-muted hover:border-ink",
        ].join(" ")}
      >
        <span id={buttonId} className="truncate text-sm font-bold">
          {selected.label}
        </span>
        <span
          aria-hidden="true"
          className={`shrink-0 text-xs text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          ⌄
        </span>
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="absolute inset-x-0 top-full z-30 m-0 mt-1 min-w-60 list-none overflow-hidden rounded-sm border-2 border-ink bg-raised p-1 shadow-[4px_4px_0_0_var(--color-ink)]"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => choose(option.value)}
                  onMouseEnter={() => setActive(index)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setActive((current) => Math.min(options.length - 1, current + 1));
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setActive((current) => Math.max(0, current - 1));
                    } else if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      choose(options[active]?.value ?? option.value);
                    }
                  }}
                  className={[
                    "grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-[2px] px-3 py-2.5 text-left",
                    index === active || isSelected ? "bg-ink text-inverse" : "bg-transparent text-ink",
                  ].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    className={`font-mono text-xs font-black ${isSelected ? "" : "opacity-0"}`}
                  >
                    ✓
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{option.label}</span>
                    {option.hint ? (
                      <span
                        className={`block truncate text-xs ${index === active || isSelected ? "opacity-70" : "text-ink-muted"}`}
                      >
                        {option.hint}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
