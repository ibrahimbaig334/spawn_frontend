import type { HTMLAttributes, ReactNode } from "react";

export type StatusTone = "neutral" | "success" | "warning" | "error";

export interface StatusMessageProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "title"
> {
  tone?: StatusTone;
  title?: ReactNode;
  children: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
}

const TONES: Readonly<Record<StatusTone, string>> = {
  neutral: "border-l-focus",
  success: "border-l-accent",
  warning: "border-l-protocol",
  error: "border-l-error",
};

const GLYPH_TONES: Readonly<Record<StatusTone, string>> = {
  neutral: "bg-focus",
  success: "bg-accent",
  warning: "bg-protocol",
  error: "bg-error",
};

const GLYPHS: Readonly<Record<StatusTone, string>> = {
  neutral: "i",
  success: "✓",
  warning: "!",
  error: "×",
};

export function StatusMessage({
  tone = "neutral",
  title,
  children,
  onDismiss,
  dismissLabel = "Dismiss message",
  className,
  ...props
}: StatusMessageProps) {
  return (
    <div
      className={[
        "grid max-w-[36rem] grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-3 rounded-sm border-2 border-l-[6px] border-ink bg-raised p-3.5 text-sm leading-[1.45] text-ink pointer-events-auto forced-colors:border-[CanvasText] print:border-black",
        TONES[tone],
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <span
        className={[
          "inline-flex size-6 items-center justify-center rounded-[2px] text-[0.8125rem] font-black leading-none text-inverse forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] print:border print:border-black print:bg-white print:text-black",
          GLYPH_TONES[tone],
        ].join(" ")}
        aria-hidden="true"
      >
        {GLYPHS[tone]}
      </span>
      <div className="min-w-0">
        {title ? <strong className="mb-0.5 block">{title}</strong> : null}
        <div>{children}</div>
      </div>
      {onDismiss ? (
        <button
          aria-label={dismissLabel}
          className="-my-2.5 -mr-2.5 inline-flex size-target cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent text-2xl leading-none text-ink hover:bg-surface-strong focus-visible:outline-3 focus-visible:-outline-offset-2 focus-visible:outline-focus print:hidden"
          onClick={onDismiss}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </div>
  );
}

export interface StatusRegionProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  assertive?: boolean;
  label?: string;
}

export function StatusRegion({
  children,
  assertive = false,
  label = "Status messages",
  className,
  ...props
}: StatusRegionProps) {
  return (
    <div
      aria-label={label}
      aria-live={assertive ? "assertive" : "polite"}
      aria-relevant="additions text"
      className={["grid gap-3 pointer-events-none", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      role={assertive ? "alert" : "status"}
      {...props}
    >
      {children}
    </div>
  );
}
