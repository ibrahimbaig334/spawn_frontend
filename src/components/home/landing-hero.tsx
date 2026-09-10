import Link from "next/link";
import { PRODUCT_COPY } from "@/content/product-copy";
import { PROTOCOL_TERMS } from "@/data/protocol-terms";
import { MilestoneOverview } from "@/components/visuals/milestone-overview";
import { RoutingCut } from "@/components/visuals/routing-cut";

const EYEBROW =
  "m-0 font-mono text-xs font-bold leading-5 tracking-[0.08em] text-accent uppercase";
const PRIMARY =
  "inline-flex min-h-12 items-center justify-center border border-ink bg-ink px-4 py-3 font-bold text-inverse no-underline hover:border-accent-strong hover:bg-accent-strong";

export function LandingHero() {
  return (
    <section
      className="grid min-h-[min(48rem,calc(100vh-6.5rem))] grid-cols-[minmax(0,1.05fr)_minmax(24rem,.95fr)] items-center gap-[clamp(3rem,8vw,8rem)] border-b border-rule px-[max(1rem,calc((100vw-80rem)/2))] py-[clamp(4rem,9vw,8rem)] max-[64rem]:min-h-0 max-[64rem]:grid-cols-1 print:min-h-0 print:px-0"
      aria-labelledby="page-title"
    >
      <div>
        <p className={EYEBROW}>{PRODUCT_COPY.heroEyebrow}</p>
        <h1
          className="my-3 mb-5 max-w-[10ch] text-[clamp(3.25rem,7vw,6.9rem)] leading-[0.92] tracking-[-0.058em] max-[42rem]:overflow-wrap-anywhere max-[42rem]:text-[clamp(2.8rem,15vw,4.8rem)]"
          id="page-title"
        >
          {PRODUCT_COPY.heroTitle}
        </h1>
        <p className="m-0 max-w-2xl text-[clamp(1.08rem,2vw,1.35rem)] text-ink-muted">
          {PRODUCT_COPY.heroBody}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link className={PRIMARY} href="/tokens">
            {PRODUCT_COPY.heroExplore}
          </Link>
          <Link
            className="inline-flex min-h-target items-center font-bold underline decoration-[0.1em] underline-offset-4"
            href="/create"
          >
            {PRODUCT_COPY.creatorCta}
          </Link>
        </div>
        <p className="mt-8 max-w-xl font-mono text-xs font-bold leading-5 tracking-[0.08em] text-ink-muted uppercase">
          Intended mechanics for a future deployment · Demonstration only
        </p>
      </div>
      <div className="grid max-w-[46rem] gap-6 border border-ink bg-raised p-[clamp(1rem,2.5vw,1.75rem)] print:break-inside-avoid">
        <div className="flex justify-between gap-4 border-b border-rule pb-4 max-[42rem]:items-start max-[42rem]:flex-col">
          <p className={EYEBROW}>Protocol schedule / fixed example</p>
          <span className="font-mono text-xs font-bold leading-5">
            Milestone 08 of 30
          </span>
        </div>
        <MilestoneOverview
          completedMilestones={7}
          progressBps={8_820}
          title="Core milestone schedule"
        />
        <dl className="m-0 grid grid-cols-3 border-y border-rule max-[42rem]:grid-cols-1 [&>div]:min-w-0 [&>div]:px-2.5 [&>div]:py-3.5 [&>div+div]:border-l [&>div+div]:border-rule max-[42rem]:[&>div+div]:border-t max-[42rem]:[&>div+div]:border-l-0 [&_dt]:text-xs [&_dt]:text-ink-muted [&_dd]:mt-1 [&_dd]:mb-0 [&_dd]:overflow-wrap-anywhere [&_dd]:font-mono [&_dd]:text-[0.82rem] [&_dd]:font-bold">
          <div>
            <dt>Opening valuation</dt>
            <dd>125 ETH</dd>
          </div>
          <div>
            <dt>Next public target</dt>
            <dd>735.10 ETH</dd>
          </div>
          <div>
            <dt>Current demo fee</dt>
            <dd>1%</dd>
          </div>
        </dl>
        <RoutingCut
          split={PROTOCOL_TERMS.defaultProceedsSplit}
          mode="approaching"
          milestoneNumber={8}
          title="Declared proceeds allocation"
        />
      </div>
    </section>
  );
}
