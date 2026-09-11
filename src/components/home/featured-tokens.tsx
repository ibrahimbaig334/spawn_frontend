import Link from "next/link";
import { createSeedState } from "@/data/mock-seed";
import {
  deriveFdvEth,
  derivePhaseLabel,
  selectLaunches,
} from "@/domain/selectors";
import { formatEth } from "@/lib/format";

export function FeaturedTokens() {
  const state = createSeedState();
  const launches = selectLaunches(state).slice(0, 3);

  return (
    <section
      className="border-b border-rule bg-raised px-[max(1rem,calc((100vw-80rem)/2))] py-[clamp(4rem,8vw,7rem)] print:px-0"
      aria-labelledby="featured-title"
    >
      <div className="grid grid-cols-[minmax(18rem,1fr)_minmax(16rem,.55fr)_auto] items-end gap-x-[clamp(2rem,5vw,5rem)] gap-y-6 pb-8 max-[64rem]:grid-cols-2 max-[42rem]:grid-cols-1">
        <div>
          <p className="m-0 font-mono text-xs font-bold tracking-[0.08em] text-accent uppercase">
            Featured simulated tokens
          </p>
          <h2
            className="mt-2 mb-0 max-w-[15ch] text-[clamp(2rem,4.5vw,4.25rem)] leading-[0.97] tracking-[-0.045em]"
            id="featured-title"
          >
            Inspect the schedule behind each market.
          </h2>
        </div>
        <p className="m-0 text-ink-muted">
          Deterministic fixtures illustrate distinct lifecycle stages of the
          same protocol mechanics. They are not market observations.
        </p>
        <Link
          className="min-h-target whitespace-nowrap font-bold underline decoration-[0.1em] underline-offset-4 max-[64rem]:col-start-1 max-[42rem]:col-auto"
          href="/tokens"
        >
          View all tokens
        </Link>
      </div>
      <div className="border-t-2 border-ink">
        {launches.map((launch) => (
          <article
            className="grid min-w-0 grid-cols-[minmax(15rem,.8fr)_minmax(24rem,1.4fr)_auto] items-center gap-x-8 gap-y-4 border-b border-rule py-5 max-[64rem]:grid-cols-[1fr_auto] max-[42rem]:grid-cols-1"
            key={launch.poolId}
          >
            <div className="flex min-w-0 items-center gap-3.5">
              <span
                className="grid size-target shrink-0 place-items-center border border-ink font-mono text-xs font-bold text-accent-strong"
                aria-hidden="true"
              >
                {launch.symbol.slice(0, 2)}
              </span>
              <div>
                <h3 className="m-0 text-lg">
                  <Link
                    className="underline-offset-4"
                    href={`/tokens/${launch.slug}`}
                  >
                    {launch.name}
                  </Link>
                </h3>
                <p className="mt-1 mb-0 text-xs text-ink-muted">
                  ${launch.symbol} · ${launch.token}
                </p>
              </div>
            </div>
            <dl className="m-0 grid grid-cols-4 max-[64rem]:col-span-full max-[64rem]:row-start-2 max-[42rem]:col-auto max-[42rem]:row-auto max-[42rem]:grid-cols-2 [&>div]:min-w-0 [&>div]:px-3 max-[42rem]:[&>div]:py-2.5 max-[42rem]:[&>div]:px-0 [&>div+div]:border-l [&>div+div]:border-rule max-[42rem]:[&>div+div]:border-l-0 max-[42rem]:[&>div:nth-child(even)]:border-l max-[42rem]:[&>div:nth-child(even)]:pl-3 [&_dt]:text-[0.68rem] [&_dt]:text-ink-muted [&_dd]:mt-1 [&_dd]:mb-0 [&_dd]:overflow-wrap-anywhere [&_dd]:font-mono [&_dd]:text-xs [&_dd]:font-semibold">
              <div>
                <dt>Phase</dt>
                <dd>{derivePhaseLabel(launch)}</dd>
              </div>
              <div>
                <dt>FDV</dt>
                <dd>{formatEth(deriveFdvEth(launch), 0)}</dd>
              </div>
              <div>
                <dt>Harvested</dt>
                <dd>{launch.completedMilestones} milestones</dd>
              </div>
              <div>
                <dt>Fee</dt>
                <dd>1% static</dd>
              </div>
            </dl>
            <Link
              className="inline-flex min-h-target items-center gap-2 whitespace-nowrap font-bold underline-offset-4 max-[42rem]:justify-self-start"
              href={`/tokens/${launch.slug}`}
              aria-label={`Inspect ${launch.name}`}
            >
              Inspect token <span aria-hidden="true">→</span>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
