import type { CSSProperties } from "react";
import type { ProceedsSplit } from "@/types/protocol";
import {
  ROUTES,
  ROUTE_LABELS,
  type RouteName,
} from "@/components/ui/route-key";

const ROUTE_COLOR: Readonly<Record<RouteName, string>> = {
  creator: "bg-creator",
  buyback: "bg-buyback",
  protocol: "bg-protocol",
  liquidity: "bg-liquidity",
};

export type RoutingCutMode = "committed" | "approaching" | "completed";

export interface RoutingCutProps {
  split: ProceedsSplit;
  mode: RoutingCutMode;
  milestoneNumber?: number;
  amountEth?: string;
  title?: string;
  className?: string;
}

const MODE_COPY: Readonly<
  Record<RoutingCutMode, { glyph: string; label: string }>
> = {
  committed: { glyph: "■", label: "Routing committed at launch" },
  approaching: { glyph: "→", label: "Milestone approaching" },
  completed: { glyph: "✓", label: "Milestone completed and routed" },
};

function formatShare(value: number): string {
  const percent = value / 100;
  return `${Number.isInteger(percent) ? percent : Number(percent.toFixed(2))}%`;
}

export function RoutingCut({
  split,
  mode,
  milestoneNumber,
  amountEth,
  title = "Milestone routing",
  className,
}: RoutingCutProps) {
  const state = MODE_COPY[mode];
  const milestoneLabel = milestoneNumber
    ? `Milestone ${milestoneNumber}`
    : "Milestone proceeds";

  return (
    <figure
      className={[
        "m-0 border border-ink bg-raised p-[clamp(1rem,3vw,1.5rem)] text-ink print:break-inside-avoid print:border-black",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <figcaption className="mb-[clamp(1.5rem,4vw,2.5rem)] flex items-end justify-between gap-4 max-[36rem]:items-start max-[36rem]:flex-col">
        <div>
          <span className="mb-1.5 block text-xs font-extrabold tracking-[0.08em] text-ink-muted uppercase">
            {title}
          </span>
          <strong className="flex items-center gap-2 text-[clamp(1.125rem,3vw,1.5rem)] leading-[1.15] tracking-[-0.025em]">
            <span
              className="inline-flex size-6 shrink-0 items-center justify-center bg-ink text-xs text-inverse forced-colors:border-2 forced-colors:border-[CanvasText] forced-colors:bg-[Canvas] forced-colors:text-[CanvasText] print:border print:border-black print:bg-white print:text-black"
              aria-hidden="true"
            >
              {state.glyph}
            </span>
            {state.label}
          </strong>
        </div>
        {amountEth ? (
          <span className="grid text-right max-[36rem]:text-left">
            <strong className="text-lg">{amountEth} ETH</strong>
            <span className="mt-1 text-xs text-ink-muted">
              {milestoneLabel}
            </span>
          </span>
        ) : null}
      </figcaption>

      <div
        className="mb-6 grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-[clamp(.75rem,3vw,1.5rem)] max-[36rem]:grid-cols-[auto_auto_minmax(8rem,1fr)] max-[36rem]:gap-2"
        data-mode={mode}
        aria-hidden="true"
      >
        <div
          className={[
            "flex size-[3.25rem] items-center justify-center rounded-sm bg-ink text-base font-extrabold text-inverse forced-colors:border-2 forced-colors:border-[CanvasText] forced-colors:bg-[Canvas] forced-colors:text-[CanvasText] print:border print:border-black print:bg-white print:text-black",
            mode === "completed" ? "bg-accent-strong" : "",
          ].join(" ")}
        >
          <span>{milestoneNumber ? `M${milestoneNumber}` : "M"}</span>
        </div>
        <span
          className={[
            "text-2xl font-extrabold",
            mode === "approaching" ? "text-accent" : "text-ink-muted",
          ].join(" ")}
        >
          →
        </span>
        <div className="flex h-[3.25rem] min-w-0 gap-0.5">
          {ROUTES.map((route, index) => (
            <span
              className={[
                "flex min-w-7 basis-0 items-center justify-center text-xs font-extrabold text-inverse forced-colors:border-2 forced-colors:border-[CanvasText] forced-colors:bg-[Canvas] forced-colors:text-[CanvasText] print:border print:border-black print:bg-white print:text-black max-[36rem]:min-w-5",
                ROUTE_COLOR[route],
              ].join(" ")}
              data-route={route}
              key={route}
              style={{ flexGrow: split[route] } as CSSProperties}
            >
              {index + 1}
            </span>
          ))}
        </div>
      </div>

      <dl className="m-0 grid grid-cols-4 gap-0 border-t border-rule pt-4 max-[36rem]:grid-cols-2">
        {ROUTES.map((route, index) => (
          <div
            className="min-w-0 border-rule px-3 py-1 first:pl-0 not-first:border-l last:pr-0 max-[36rem]:border-b max-[36rem]:p-3 max-[36rem]:odd:pl-0 max-[36rem]:even:pr-0 max-[36rem]:nth-[3]:border-l-0 max-[36rem]:last:border-b-0"
            key={route}
          >
            <dt className="flex items-center gap-1.5 text-xs font-semibold leading-tight">
              <span
                className={[
                  "inline-flex size-4 shrink-0 items-center justify-center text-[0.625rem] text-inverse forced-colors:border-2 forced-colors:border-[CanvasText] forced-colors:bg-[Canvas] forced-colors:text-[CanvasText] print:border print:border-black print:bg-white print:text-black",
                  ROUTE_COLOR[route],
                ].join(" ")}
                data-route={route}
                aria-hidden="true"
              >
                {index + 1}
              </span>
              {ROUTE_LABELS[route]}
            </dt>
            <dd className="mt-1.5 mb-0 tabular-nums text-lg font-extrabold">
              {formatShare(split[route])}
            </dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}

export type { RouteName };
