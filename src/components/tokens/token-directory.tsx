"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { useTokenList } from "@/lib/queries";
import type { TokenListItem } from "@/lib/api/dto";
import {
  formatCompactEth,
  formatUsdApproxFromEthWei,
  phaseLabel,
  relativeTime,
  usdApproxFromEthWei,
  wei,
} from "@/lib/display";
import { formatSubscriptPrice } from "@/lib/format";
import { Button, SelectField, StatusRegion, StatusMessage } from "@/components/ui";
import { truncateAddress } from "@/services/ipfs-client";
import { WAD } from "@/protocol/constants";

const PAGE_WIDTH =
  "mx-auto w-full max-w-measure px-[max(1rem,calc((100vw-80rem)/2))]";

const GRADUATION_MCAP_WEI = WAD * 8n; // ~4x the 2 ETH opening valuation

type SortOption = "newest" | "volume" | "market_cap" | "graduated";

function curveProgressPercent(item: TokenListItem): number {
  if (item.status === "graduated") return 100;
  const mcap = wei(item.mcapEthWei);
  return Math.min(100, Math.max(0, Number((mcap * 100n) / GRADUATION_MCAP_WEI)));
}

function volumeEth(item: TokenListItem): string {
  return (wei(item.buyVolumeEth) + wei(item.sellVolumeEth)).toString();
}

function TokenAvatar({ item }: { item: TokenListItem }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#e9e7e0]/30 bg-[#14100d] text-sm font-black text-[#f5c518]">
      {item.symbol ? item.symbol.slice(0, 2).toUpperCase() : "?"}
    </span>
  );
}

function TokenGridCard({ item }: { item: TokenListItem }) {
  const progress = curveProgressPercent(item);
  return (
    <Link
      className="group grid content-start gap-3 rounded-xl border-2 border-ink bg-carbon p-4 text-[#e9e7e0] no-underline transition-transform hover:-translate-y-0.5"
      href={`/tokens/${item.poolId}`}
    >
      <div className="flex items-center gap-3">
        <TokenAvatar item={item} />
        <div className="min-w-0">
          <p className="m-0 truncate text-sm font-bold">{item.name ?? "Unnamed"}</p>
          <p className="m-0 font-mono text-xs text-[#e9e7e0]/60">
            {item.symbol ?? "—"} · {relativeTime(item.launchTime)}
          </p>
        </div>
        <span
          className={[
            "ml-auto shrink-0 rounded-full border px-2 py-0.5 font-mono text-[0.62rem] font-bold uppercase",
            item.status === "graduated"
              ? "border-[#3ecf6f] text-[#3ecf6f]"
              : "border-[#f5c518] text-[#f5c518]",
          ].join(" ")}
        >
          {item.status}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-lg font-black text-[#3ecf6f]">
          {item.priceEth ? `${formatSubscriptPrice(item.priceEth)} ETH` : "—"}
        </span>
        <span className="font-mono text-xs text-[#e9e7e0]/60">
          ≈ ${item.priceEth ? usdApproxFromEthWei(item.priceEth).toPrecision(2) : "0"}
        </span>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
        <div className="flex justify-between">
          <dt className="text-[#e9e7e0]/50">MC</dt>
          <dd className="m-0 font-bold">{formatUsdApproxFromEthWei(item.mcapEthWei)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#e9e7e0]/50">Vol</dt>
          <dd className="m-0 font-bold">{formatCompactEth(volumeEth(item))} ETH</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#e9e7e0]/50">Swaps</dt>
          <dd className="m-0 font-bold">{item.swapCount}</dd>
        </div>
      </dl>
      <div className="grid gap-1">
        <div className="flex items-center justify-between text-[0.68rem] font-bold uppercase tracking-wide text-[#e9e7e0]/60">
          <span>{phaseLabel(item.status)}</span>
          <span className="font-mono">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#e9e7e0]/15">
          <span
            className="block h-full rounded-full bg-[#f5c518]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

function TokenRow({ item }: { item: TokenListItem }) {
  const progress = curveProgressPercent(item);
  return (
    <Link
      className="grid grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))_7rem] items-center gap-4 border-b border-rule bg-transparent px-3 py-3 text-ink no-underline hover:bg-raised max-[64rem]:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] max-[64rem]:[&_.row-hide-sm]:hidden"
      href={`/tokens/${item.poolId}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <TokenAvatar item={item} />
        <span className="min-w-0">
          <span className="block truncate font-bold">{item.name ?? "Unnamed"}</span>
          <span className="block font-mono text-xs text-ink-muted">
            {item.symbol ?? "—"} · {truncateAddress(item.token)}
          </span>
        </span>
      </span>
      <span className="row-hide-sm font-mono text-sm font-bold text-ink-muted">
        {phaseLabel(item.status)}
      </span>
      <span className="font-mono text-sm font-bold">
        {item.priceEth ? `${formatSubscriptPrice(item.priceEth)} ETH` : "—"}
      </span>
      <span className="row-hide-sm font-mono text-sm">{formatUsdApproxFromEthWei(item.mcapEthWei)}</span>
      <span className="row-hide-sm font-mono text-sm">{formatCompactEth(volumeEth(item))} ETH</span>
      <span className="font-mono text-xs text-ink-muted">{relativeTime(item.launchTime)}</span>
      <span className="grid content-center gap-1">
        <span className="font-mono text-[0.62rem] font-bold text-ink-muted">{progress}%</span>
        <span className="h-1.5 overflow-hidden rounded-full bg-surface-strong">
          <span
            className="block h-full rounded-full bg-accent"
            style={{ width: `${progress}%` }}
          />
        </span>
      </span>
    </Link>
  );
}

export function TokenDirectory() {
  const params = useSearchParams();
  const query = useMemo(
    () => ({
      q: params.get("q") ?? undefined,
      phase: (params.get("phase") as "bonding" | "graduated" | null) ?? undefined,
      sort: (params.get("sort") as SortOption | null) ?? "newest",
    }),
    [params],
  );
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"grid" | "rows">("grid");
  const search = params.get("q") ?? "";

  const list = useTokenList({ ...query, page, limit: 24 });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams(params.toString());
    const q = String(form.get("q") ?? "").trim();
    if (q) next.set("q", q);
    else next.delete("q");
    window.location.search = next.toString();
  }

  const total = list.data?.meta.total ?? 0;
  const totalPages = list.data?.meta.totalPages ?? 1;

  return (
    <main className={`${PAGE_WIDTH} py-10`} id="main-content">
      <header className="mb-8 grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="m-0 text-4xl font-black tracking-[-0.03em] text-ink">Tokens</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Every launch on the protocol: bonding curve pools and graduated markets.
            </p>
          </div>
          <form className="flex w-full max-w-md items-stretch gap-0" onSubmit={onSubmit}>
            <input
              aria-label="Search tokens"
              className="min-h-target min-w-0 flex-1 rounded-l-sm border-2 border-r-0 border-ink bg-raised px-3 py-2 text-ink"
              defaultValue={search}
              name="q"
              placeholder="Search name or symbol"
              type="search"
            />
            <Button className="rounded-l-none rounded-r-sm" type="submit">
              Search
            </Button>
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <SelectField
            id="directory-phase"
            label="Phase"
            className="text-sm"
            aria-label="Filter by phase"
            value={query.phase ?? ""}
            onChange={(event) => {
              const next = new URLSearchParams(params.toString());
              if (event.target.value) next.set("phase", event.target.value);
              else next.delete("phase");
              window.location.search = next.toString();
            }}
          >
            <option value="">All phases</option>
            <option value="bonding">Bonding curve</option>
            <option value="graduated">Graduated</option>
          </SelectField>
          <SelectField
            id="directory-sort"
            label="Sort"
            className="text-sm"
            aria-label="Sort tokens"
            value={query.sort}
            onChange={(event) => {
              const next = new URLSearchParams(params.toString());
              next.set("sort", event.target.value);
              window.location.search = next.toString();
            }}
          >
            <option value="newest">Newest</option>
            <option value="volume">Volume</option>
            <option value="market_cap">Market cap</option>
            <option value="graduated">Graduated first</option>
          </SelectField>
          <div className="ml-auto flex items-center gap-2 pt-5">
            <Button
              variant={view === "grid" ? "primary" : "secondary"}
              onClick={() => setView("grid")}
            >
              Grid
            </Button>
            <Button
              variant={view === "rows" ? "primary" : "secondary"}
              onClick={() => setView("rows")}
            >
              Rows
            </Button>
          </div>
        </div>
      </header>

      <StatusRegion className="mb-4">
        {list.isError ? (
          <StatusMessage tone="error" title="Could not load tokens">
            {(list.error as Error).message}
          </StatusMessage>
        ) : null}
      </StatusRegion>

      {list.isLoading ? (
        <p className="py-16 text-center font-mono text-sm text-ink-muted">Loading market data…</p>
      ) : total === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-rule py-20 text-center">
          <p className="text-lg font-bold text-ink">No launches yet</p>
          <p className="mt-1 text-sm text-ink-muted">
            {query.q
              ? `Nothing matches "${query.q}" — try another name or symbol.`
              : "Be first: launch a token and it will appear here as soon as the indexer confirms it."}
          </p>
          <Link
            className="mt-4 inline-block rounded-sm border-2 border-ink bg-ink px-4 py-2 text-sm font-bold text-inverse no-underline"
            href="/create"
          >
            Create a token
          </Link>
        </div>
      ) : (
        <>
          {view === "grid" ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-5">
              {list.data?.data.map((item) => (
                <TokenGridCard key={item.poolId} item={item} />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border-2 border-ink">
              {list.data?.data.map((item) => <TokenRow key={item.poolId} item={item} />)}
            </div>
          )}
          <nav className="mt-8 flex items-center justify-center gap-4" aria-label="Pagination">
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <span className="font-mono text-sm text-ink-muted">
              Page {page} of {totalPages} · {total} pools
            </span>
            <Button
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </nav>
        </>
      )}
    </main>
  );
}
