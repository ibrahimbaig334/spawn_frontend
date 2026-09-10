import type { ProceedsSplit } from "@/types/protocol";

export const ROUTES = ["creator", "buyback", "protocol", "liquidity"] as const;
export type RouteName = (typeof ROUTES)[number];

export const ROUTE_LABELS: Readonly<Record<RouteName, string>> = {
  creator: "Creator",
  buyback: "Buyback + removal",
  protocol: "Protocol",
  liquidity: "Trading liquidity",
};

const ROUTE_MARK: Readonly<Record<RouteName, string>> = {
  creator: "rounded-full border-solid bg-creator",
  buyback:
    "rounded-none border-dashed bg-buyback [clip-path:polygon(50%_5%,95%_95%,5%_95%)] forced-colors:[clip-path:none] print:[clip-path:none]",
  protocol: "rounded-none border-dotted bg-protocol",
  liquidity: "rounded-none border-double bg-liquidity",
};

export interface RouteKeyProps {
  split?: ProceedsSplit;
  compact?: boolean;
  className?: string;
  ariaLabel?: string;
}

function formatBps(value: number): string {
  const percent = value / 100;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

export function RouteKey({
  split,
  compact = false,
  className,
  ariaLabel = "Proceeds routes",
}: RouteKeyProps) {
  return (
    <ul
      aria-label={ariaLabel}
      className={[
        compact ? "grid gap-1.5" : "flex flex-wrap gap-x-5 gap-y-2.5",
        "m-0 list-none p-0",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {ROUTES.map((route, index) => (
        <li
          className={[
            "inline-grid min-h-6 min-w-0 grid-cols-[1.25rem_auto_auto] items-center gap-2 text-sm leading-tight text-ink",
            compact ? "w-full" : "",
          ].join(" ")}
          key={route}
        >
          <span
            className={[
              "inline-flex size-5 items-center justify-center border border-ink text-[0.6875rem] font-black leading-none text-inverse forced-colors:border-2 forced-colors:border-[CanvasText] forced-colors:bg-[Canvas] forced-colors:text-[CanvasText] print:border-black print:bg-white print:text-black",
              ROUTE_MARK[route],
            ].join(" ")}
            data-route={route}
            aria-hidden="true"
          >
            {index + 1}
          </span>
          <span className="font-semibold">{ROUTE_LABELS[route]}</span>
          {split ? (
            <span
              className={[
                "tabular-nums font-bold text-ink-muted",
                compact ? "ml-auto" : "",
              ].join(" ")}
            >
              {formatBps(split[route])}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
