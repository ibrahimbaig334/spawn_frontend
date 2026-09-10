import type { ReactNode } from "react";

export const STATUS_PAGE_CLASS =
  "min-h-[58vh] border-b border-rule px-[max(1rem,calc((100vw-80rem)/2))] py-[clamp(4rem,10vw,8rem)] [&_h1]:my-3 [&_h1]:max-w-[16ch] [&_h1]:text-[clamp(2.4rem,7vw,5.8rem)] [&_h1]:leading-[0.96] [&_h1]:tracking-[-0.045em] [&_p:not([data-label])]:max-w-2xl [&_p:not([data-label])]:text-ink-muted";
export const STATUS_LABEL_CLASS =
  "m-0 font-mono text-xs font-bold leading-6 tracking-[0.08em] uppercase";
export const STATUS_ACTION_CLASS =
  "mt-6 inline-flex min-h-12 cursor-pointer items-center justify-center border border-ink bg-ink px-4 py-3 font-bold text-inverse no-underline hover:border-accent-strong hover:bg-accent-strong";
export const STATUS_LINK_CLASS =
  "mt-4 inline-flex min-h-target items-center font-bold underline decoration-[0.1em] underline-offset-4";
export const LOADING_MARK_CLASS =
  "mt-8 block h-2 w-[min(18rem,70vw)] origin-left animate-pulse bg-accent motion-reduce:animate-none forced-colors:bg-[Highlight] print:hidden";

interface StatusPageProps {
  label: string;
  title: string;
  children?: ReactNode;
  loading?: boolean;
  busy?: boolean;
}

export function StatusPage({
  label,
  title,
  children,
  loading = false,
  busy = false,
}: StatusPageProps) {
  return (
    <main
      id="main-content"
      className={STATUS_PAGE_CLASS}
      aria-busy={busy || undefined}
    >
      <p className={STATUS_LABEL_CLASS} data-label>
        {label}
      </p>
      <h1>{title}</h1>
      {children}
      {loading ? (
        <span className={LOADING_MARK_CLASS} aria-hidden="true" />
      ) : null}
    </main>
  );
}
