const steps = [
  {
    title: "Launch on the curve",
    body: "Every launch is pinned to 1,000,000,000 tokens and opens at the 2 ETH template FDV. The configuration — supply, payout plan, optional dev buy — is immutable the moment it lands, and the CREATE2 token address was knowable before the launch.",
  },
  {
    title: "Graduate at ~4x",
    body: "When the level reaches the curve top (13,862 levels above opening), the pool graduates: curve liquidity burns, proceeds split 20% LP seed / 70% creator / 10% protocol, and two code-locked positions take over — an ETH-limited full-range band with a hard floor plus a deep token-only wall.",
  },
  {
    title: "Climb the milestone ladder",
    body: "22 protocol-owned sell bands on a decaying schedule (2× first step, 1.2504× floor) stand above graduation, extendable by 30 fee-funded bands. Every crossed band is harvested into the payout pot — 10% service fee, 90% to the pot — and flushed to the launch's selected plugins and the creator path.",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-b border-rule px-[max(1rem,calc((100vw-80rem)/2))] print:px-0"
      aria-labelledby="how-it-works-title"
    >
      <div className="grid grid-cols-[minmax(8rem,.45fr)_minmax(18rem,1fr)_minmax(14rem,.65fr)] items-start gap-x-[clamp(1.5rem,5vw,5rem)] gap-y-4 py-[clamp(3rem,7vw,6rem)] max-[52rem]:grid-cols-1">
        <p className="m-0 font-mono text-xs font-bold tracking-[0.08em] text-accent-strong uppercase">
          How it works
        </p>
        <h2
          className="m-0 max-w-[14ch] text-[clamp(2.1rem,5vw,4.6rem)] leading-[0.96] tracking-[-0.05em]"
          id="how-it-works-title"
        >
          Three phases. One pool.
        </h2>
        <p className="mt-1 mb-0 text-ink-muted">
          A launch is one pool that morphs in place — no factory, no migration.
          Price climbs in level space; every user-facing number is a level.
        </p>
      </div>
      <ol className="m-0 list-none border-t-2 border-ink pb-[clamp(4rem,8vw,7rem)] p-0">
        {steps.map((step, index) => (
          <li
            className="grid grid-cols-[4rem_minmax(9rem,.55fr)_minmax(14rem,1fr)] gap-4 border-b border-rule py-6 max-[52rem]:grid-cols-[3rem_1fr]"
            key={step.title}
          >
            <span className="font-mono text-xs font-bold leading-6">
              0{index + 1}
            </span>
            <h3 className="m-0 text-base">{step.title}</h3>
            <p className="m-0 max-w-3xl text-ink-muted max-[52rem]:col-start-2">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
