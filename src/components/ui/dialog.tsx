"use client";

import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
} from "react";

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusableElements(node: HTMLElement): HTMLElement[] {
  return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) =>
      element.getAttribute("aria-hidden") !== "true" && !element.hidden,
  );
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeLabel = "Close dialog",
  initialFocusRef,
  className,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      const target =
        initialFocusRef?.current ??
        (panel ? focusableElements(panel)[0] : null) ??
        panel;
      target?.focus();
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    };
  }, [initialFocusRef, open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = focusableElements(panelRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      const panel = panelRef.current;
      if (!panel || panel.contains(event.target as Node)) return;
      (focusableElements(panel)[0] ?? panel).focus();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [close, open]);

  if (!open) return null;

  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close();
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-carbon/72 p-4 print:static print:block print:bg-transparent print:p-0"
      onMouseDown={handleBackdrop}
    >
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={[
          "m-auto max-h-[min(44rem,calc(100dvh-2rem))] w-full max-w-[38rem] overflow-y-auto rounded-none border-2 border-ink bg-raised text-ink outline-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus print:max-h-none print:max-w-none print:border-black",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="flex items-start justify-between gap-4 border-b-2 border-ink p-5 print:border-black">
          <div>
            <h2
              className="m-0 text-[clamp(1.25rem,3vw,1.75rem)] leading-[1.1] tracking-[-0.03em]"
              id={titleId}
            >
              {title}
            </h2>
            {description ? (
              <p
                className="mt-2 mb-0 leading-6 text-ink-muted"
                id={descriptionId}
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            aria-label={closeLabel}
            className="-mt-2 -mr-2 inline-flex size-target shrink-0 cursor-pointer items-center justify-center rounded-none border-2 border-transparent bg-transparent text-[1.75rem] leading-none text-ink hover:bg-surface-strong focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus print:hidden"
            onClick={close}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="p-5">{children}</div>
        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-rule bg-paper px-5 py-4 print:border-black print:bg-white">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
