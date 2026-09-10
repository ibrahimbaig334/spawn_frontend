import Link from "next/link";
import { PRODUCT_COPY } from "@/content/product-copy";

export function ClosingCta() {
  return (
    <section
      className="border-b border-rule bg-accent-strong px-[max(1rem,calc((100vw-80rem)/2))] py-[clamp(5rem,10vw,8rem)] text-inverse print:bg-transparent print:px-0 print:text-black"
      aria-labelledby="closing-title"
    >
      <p className="m-0 font-mono text-xs font-bold tracking-[0.08em] uppercase">
        Explore the protocol concept
      </p>
      <h2
        className="m-0 mt-3 max-w-[12ch] text-[clamp(2.6rem,6vw,5.7rem)] leading-[0.94] tracking-[-0.05em]"
        id="closing-title"
      >
        {PRODUCT_COPY.closingTitle}
      </h2>
      <p className="mt-5 mb-0 max-w-2xl text-lg">
        Inspect every modeled term before trying a browser-local action. Spawn
        does not connect to a wallet, contract, market feed, or transaction.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-5 max-[38rem]:items-stretch max-[38rem]:flex-col max-[38rem]:[&_a]:w-full">
        <Link
          className="inline-flex min-h-12 items-center justify-center border border-inverse bg-inverse px-4 py-3 font-bold text-ink no-underline hover:bg-paper"
          href="/tokens"
        >
          Explore demo tokens
        </Link>
        <Link
          className="inline-flex min-h-target items-center font-bold underline underline-offset-4"
          href="/create"
        >
          Build a demo launch
        </Link>
      </div>
    </section>
  );
}
