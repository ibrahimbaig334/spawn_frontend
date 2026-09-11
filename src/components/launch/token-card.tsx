"use client";

import { useRef, useState, type DragEvent } from "react";
import {
  formatSignedPercent,
  formatUsdCompact,
  truncateDecimals,
} from "@/lib/format";
import { truncateAddress } from "@/services/ipfs-client";
import { ethPerTokenWei } from "@/protocol/level-math";

export interface TokenCardStats {
  /** USD price, or ETH price pre-chain — rendered with subscript notation. */
  price: string;
  /** Market cap in USD units. */
  marketCapUsd: string;
  /** 24h percent change, signed. */
  changePercent: number;
  /** 24h volume in USD units. */
  volumeUsd: string;
  /** Bonding curve progress 0-100. */
  bondingPercent: number;
  /** Comments count. */
  comments: number;
}

export interface TokenCardData {
  name: string;
  symbol: string;
  description: string;
  logoUrl?: string;
  /** Predicted/actual contract address for the CA bar. */
  contractAddress: string;
  stats: TokenCardStats;
  /** Created label, e.g. "just now". */
  createdLabel: string;
}

const CARD_WIDTH = "w-full max-w-[22rem]";
const FLIP_SCENE = "relative h-[30rem] [perspective:1200px]";
const FLIP_INNER =
  "absolute inset-0 transition-transform duration-700 [transform-style:preserve-3d] data-[flipped=true]:[transform:rotateY(180deg)]";
const FACE =
  "absolute inset-0 flex flex-col gap-3 overflow-hidden rounded-xl border-2 border-ink bg-carbon p-4 text-[#e9e7e0] [backface-visibility:hidden]";
const GOLD = "#f5c518";

export function TokenCardFront({ data }: { data: TokenCardData }) {
  return (
    <div className={`${FACE} [backface-visibility:hidden]`}>
      {/* Media / logo dropzone preview */}
      <div
        className="grid h-44 place-items-center overflow-hidden rounded-lg border-2 border-dashed border-[#e9e7e0]/40 bg-[#14100d]"
        data-testid="token-card-logo"
      >
        {data.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.logoUrl}
            alt={`${data.name || "Token"} logo`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid justify-items-center gap-1.5 p-4 text-center">
            <svg
              aria-hidden="true"
              fill="none"
              height="28"
              viewBox="0 0 24 24"
              width="28"
            >
              <path
                d="M12 16V4m0 0L8 8m4-4 4 4"
                stroke="#e9e7e0"
                strokeLinecap="square"
                strokeWidth="1.8"
              />
              <path
                d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"
                stroke="#e9e7e0"
                strokeLinecap="square"
                strokeWidth="1.8"
              />
            </svg>
            <span className="text-sm font-bold text-[#e9e7e0]">
              Upload Logo
            </span>
            <span className="text-xs text-[#e9e7e0]/60">
              PNG, JPEG, WEBP, or GIF under 4.3MB
            </span>
          </div>
        )}
      </div>

      {/* Token metadata */}
      <div className="flex min-h-8 items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-semibold">
          {data.name || "Name your token..."}
        </span>
        <span
          className="shrink-0 text-lg font-black uppercase"
          style={{ color: GOLD }}
        >
          {data.symbol || "SYMBOL"}
        </span>
      </div>

      {/* Price & stats bar */}
      <div className="flex items-center justify-between gap-2 rounded-lg border border-[#e9e7e0]/20 bg-[#14100d] px-3 py-2 font-mono text-xs font-bold">
        <span className="text-[#3ecf6f]">
          ${formatSmallPrice(data.stats.price)}
        </span>
        <span>MC: {formatUsdCompact(data.stats.marketCapUsd)}</span>
        <span className="text-[#3ecf6f]">
          {formatSignedPercent(data.stats.changePercent)}
        </span>
        <span>Vol: {formatUsdCompact(data.stats.volumeUsd)}</span>
      </div>

      {/* Bonding curve meter */}
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="flex items-center gap-1.5">
            <svg
              aria-hidden="true"
              fill="none"
              height="14"
              viewBox="0 0 20 20"
              width="14"
            >
              <path
                d="M2 16c3-9 6-9 9-6s4 4 7 1"
                stroke={GOLD}
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>
            Bonding
          </span>
          <span className="font-mono">{data.stats.bondingPercent}%</span>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-[#e9e7e0]/15"
          role="progressbar"
          aria-label="Bonding curve progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={data.stats.bondingPercent}
        >
          <span
            className="block h-full rounded-full"
            style={{
              width: `${Math.min(100, Math.max(0, data.stats.bondingPercent))}%`,
              background: GOLD,
            }}
          />
        </div>
      </div>

      {/* Footer row */}
      <div className="mt-auto flex items-center justify-between border-t border-[#e9e7e0]/20 pt-3 font-mono text-xs text-[#e9e7e0]/60">
        <span>{data.createdLabel}</span>
        <span className="flex items-center gap-1.5">
          <svg
            aria-hidden="true"
            fill="none"
            height="13"
            viewBox="0 0 20 20"
            width="13"
          >
            <circle cx="10" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M4 17c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5"
              stroke="currentColor"
              strokeWidth="1.6"
            />
          </svg>
          ------
        </span>
        <span className="flex items-center gap-1.5">
          <svg
            aria-hidden="true"
            fill="none"
            height="13"
            viewBox="0 0 20 20"
            width="13"
          >
            <path
              d="M10 4v9m0 0 3.5-3.5M10 13 6.5 9.5"
              stroke="currentColor"
              strokeLinecap="square"
              strokeWidth="1.6"
            />
            <path
              d="M4 15h12"
              stroke="currentColor"
              strokeLinecap="square"
              strokeWidth="1.6"
            />
          </svg>
          {truncateDecimals(data.stats.comments)}
        </span>
      </div>
    </div>
  );
}

/** Subscript price for the front stats bar: keeps the 0.0₄575 style. */
function formatSmallPrice(value: string): string {
  // strip a leading "$" if the caller included one; subscript notation is
  // added by the front face itself
  const raw = value.replace(/^\$/, "");
  const match = /^0\.(0*)(\d+)/.exec(raw);
  if (!match) return truncateDecimals(raw);
  const [, zeros = "", digits = ""] = match;
  const subscript = zeros
    .split("")
    .map((digit) => "₀₁₂₃₄₅₆₇₈₉"[Number(digit)] ?? digit)
    .join("");
  return `0.0${subscript}${digits.slice(0, 3)}`;
}

export function TokenCardBack({ data }: { data: TokenCardData }) {
  const [copied, setCopied] = useState(false);
  const address = data.contractAddress || "";

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={`${FACE} [backface-visibility:hidden] [transform:rotateY(180deg)]`}>
      {/* Header & thumbnail */}
      <div className="flex items-start justify-between gap-3">
        <div className="grid min-w-0 content-start gap-0.5">
          <span className="truncate text-sm font-semibold text-[#e9e7e0]/70">
            {data.name || "Name your token..."}
          </span>
          <span
            className="text-2xl font-black uppercase"
            style={{ color: GOLD }}
          >
            {data.symbol || "SYMBOL"}
          </span>
        </div>
        <span
          className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-dashed border-[#e9e7e0]/40 bg-[#14100d]"
          data-testid="token-card-thumbnail"
        >
          {data.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.logoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </span>
      </div>

      {/* Divider */}
      <hr className="m-0 border-0 border-t border-[#e9e7e0]/20" />

      {/* Description */}
      <p className="min-h-32 whitespace-pre-wrap text-sm leading-relaxed text-[#e9e7e0]/85">
        {data.description || "Describe your token here..."}
      </p>

      {/* CA bar */}
      <div className="mt-auto flex items-center gap-2 rounded-lg border border-[#e9e7e0]/20 bg-[#14100d] px-3 py-2 font-mono text-xs">
        <span className="font-bold text-[#e9e7e0]/60">CA:</span>
        <span className="min-w-0 flex-1 truncate text-[#e9e7e0]">
          {address ? truncateAddress(address) : "000000...000000"}
        </span>
        <a
          aria-label="View on explorer"
          className="grid size-6 shrink-0 cursor-pointer place-items-center text-[#e9e7e0]/60 hover:text-[#e9e7e0]"
          href={address ? `https://basescan.org/token/${address}` : undefined}
          rel="noreferrer"
          target="_blank"
          onClick={(event) => {
            if (!address) event.preventDefault();
          }}
        >
          <svg
            aria-hidden="true"
            fill="none"
            height="14"
            viewBox="0 0 20 20"
            width="14"
          >
            <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.7" />
            <path
              d="m13.2 13.2 3.3 3.3"
              stroke="currentColor"
              strokeLinecap="square"
              strokeWidth="1.7"
            />
          </svg>
        </a>
        <button
          aria-label={copied ? "Address copied" : "Copy contract address"}
          className="grid size-6 shrink-0 cursor-pointer place-items-center border-0 bg-transparent p-0 text-[#e9e7e0]/60 hover:text-[#e9e7e0]"
          type="button"
          onClick={() => void copyAddress()}
        >
          {copied ? "✓" : (
            <svg
              aria-hidden="true"
              fill="none"
              height="14"
              viewBox="0 0 20 20"
              width="14"
            >
              <rect height="9" width="9" rx="1.5" stroke="currentColor" strokeWidth="1.7" x="7.5" y="7.5" />
              <path
                d="M12.5 5.5v-1A1.5 1.5 0 0 0 11 3H5a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 5 12h1.5"
                stroke="currentColor"
                strokeWidth="1.7"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Action button */}
      <button
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-[#3ecf6f] px-4 py-2.5 text-sm font-black text-carbon hover:bg-[#37b862] disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
      >
        <span aria-hidden="true">⚡</span>
        <span aria-hidden="true">☰</span>
        <span>1</span>
      </button>
    </div>
  );
}

/**
 * The two-faced token card with a horizontal 3D flip between front (media,
 * stats, bonding meter) and back (description, CA bar, action).
 */
export function TokenCard({
  data,
  flipped: controlledFlipped,
  onFlipChange,
  className,
}: {
  data: TokenCardData;
  flipped?: boolean;
  onFlipChange?: (flipped: boolean) => void;
  className?: string;
}) {
  const [internalFlipped, setInternalFlipped] = useState(false);
  const flipped = controlledFlipped ?? internalFlipped;
  function toggle() {
    const next = !flipped;
    setInternalFlipped(next);
    onFlipChange?.(next);
  }
  return (
    <div className={className}>
      <div
        className={`${FLIP_SCENE} ${CARD_WIDTH} mx-auto`}
        data-testid="token-card"
      >
        <div className={FLIP_INNER} data-flipped={flipped}>
          <TokenCardFront data={data} />
          <TokenCardBack data={data} />
        </div>
      </div>
      <button
        className="mx-auto mt-4 flex min-h-target cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-ink bg-transparent px-4 py-2 text-sm font-bold text-ink hover:bg-raised"
        type="button"
        onClick={toggle}
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="16"
          viewBox="0 0 20 20"
          width="16"
        >
          <path
            d="M3 10a7 7 0 0 1 7-7c2.5 0 4.7 1.3 6 3.3M17 10a7 7 0 0 1-7 7c-2.5 0-4.7-1.3-6-3.3"
            stroke="currentColor"
            strokeLinecap="square"
            strokeWidth="1.8"
          />
          <path
            d="m16 2.5.5 4-4-.4M4 17.5l-.5-4 4 .4"
            stroke="currentColor"
            strokeLinecap="square"
            strokeWidth="1.8"
          />
        </svg>
        {flipped ? "Flip to Front" : "Flip to Back"}
      </button>
    </div>
  );
}

/**
 * Live stats for a launch record: the price from level space, curve
 * progress as the bonding meter. USD stat slots stay flat pre-chain.
 */
export function statsForLaunch(launch: {
  level: number;
  openingLevel: number;
  farLevel: number;
  phase: string;
  totalSupplyWei: string;
}): TokenCardStats {
  const price = ethPerTokenWei(launch.level);
  const bonding = Math.round(deriveCurveProgressFor(launch) * 100);
  return {
    price: String(Number(price) / 1e18),
    marketCapUsd: "0",
    changePercent: 0,
    volumeUsd: "0",
    bondingPercent: bonding,
    comments: 0,
  };
}

function deriveCurveProgressFor(launch: {
  level: number;
  openingLevel: number;
  farLevel: number;
  phase: string;
}): number {
  if (launch.phase !== "bonding-curve") return 1;
  const span = launch.farLevel - launch.openingLevel;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (launch.level - launch.openingLevel) / span));
}

/** Dropzone hook shared by the create form. */
export function useLogoDropzone(onFile: (file: File) => void) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  }
  return {
    dragging,
    inputRef,
    labelProps: {
      "data-dragging": dragging,
      onDragOver: (event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setDragging(true);
      },
      onDragLeave: () => setDragging(false),
      onDrop,
    },
  };
}

export default TokenCard;
