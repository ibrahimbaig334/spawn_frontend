const steps = [
  {
    title: "Launch on the curve",
    body: "Every launch creates 1,000,000,000 tokens opening at a ≈ $5,000 market cap. The supply, payout split, and your optional opening buy are locked in the moment it goes live.",
  },
  {
    title: "Graduate at ~4x",
    body: "When the price reaches about 4x the opening price, the token graduates: graduation proceeds split 70% creator / 20% market funds / 10% protocol, and trading continues on the permanent market.",
  },
  {
    title: "Climb the milestones",
    body: "22 milestones stand above graduation, with more unlocking from trading fees. Every milestone hit pays out — 10% service fee, 90% shared between the token's plugins and its creator.",
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
          One market per token, from its first trade to its permanent home — no
          migrations, no surprises.
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
