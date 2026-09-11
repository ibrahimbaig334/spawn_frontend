const questions = [
  {
    question: "Can I provide liquidity to a Spawn pool?",
    answer:
      "No. The hook rejects every third-party deposit and withdrawal — the pool's liquidity (curve, then full-range plus ladder) is protocol-owned by design. Trading is the only pool interaction.",
  },
  {
    question: "When exactly does graduation happen?",
    answer:
      "When the live level reaches the curve top (2x the opening valuation), evaluated at call time: the next buy auto-graduates, or anyone can call graduate() deliberately. Touching the top and falling back does not graduate the pool.",
  },
  {
    question: "What does a milestone actually pay?",
    answer:
      "When a swap crosses a band's top, that band's tokens are sold into the pump: 10% service fee to the protocol, 90% funding the payout pot. The pot is flushed to the launch's plugins and the creator's revenue path — anyone can flush it and earn a 1% tip.",
  },
  {
    question: "My launch shows a band was bypassed — is something broken?",
    answer:
      "No. If the price outruns a band before it can deploy, the band is skipped and its tokens roll into the next rung. It is a specified outcome, not a failure.",
  },
  {
    question: "Can a relayer steal or alter my launch?",
    answer:
      "No. The signature covers every configuration field; any edit changes the digest and the protocol reverts with CreatorMismatch. A relayer also cannot trigger a dev buy on your behalf — relayed launches simply skip it.",
  },
  {
    question: "Does reaching a milestone prove lasting demand?",
    answer:
      "No. Markets can reverse, and a band harvested at its top may be the last. A reached target is not proof of durable value.",
  },
  {
    question: "Is the protocol deployed?",
    answer:
      "Deployments exist on testnet; addresses come only from the deployment manifest for the chain you are on. This interface runs a local protocol simulation — no wallet, asset, or transaction is connected.",
  },
] as const;

export function RiskFaq() {
  return (
    <section
      id="risks"
      className="border-b border-rule px-[max(1rem,calc((100vw-80rem)/2))] print:px-0"
      aria-labelledby="risks-title"
    >
      <div className="grid grid-cols-[minmax(8rem,.45fr)_minmax(18rem,1fr)_minmax(14rem,.65fr)] items-start gap-x-[clamp(1.5rem,5vw,5rem)] gap-y-4 py-[clamp(3rem,7vw,6rem)] max-[52rem]:grid-cols-1">
        <p className="m-0 font-mono text-xs font-bold tracking-[0.08em] text-accent-strong uppercase">
          Risk FAQ
        </p>
        <h2
          className="m-0 max-w-[14ch] text-[clamp(2.1rem,5vw,4.6rem)] leading-[0.96] tracking-[-0.05em]"
          id="risks-title"
        >
          Know what the protocol does not promise.
        </h2>
        <p className="mt-1 mb-0 text-ink-muted">
          These constraints are part of the design, not edge-case fine print.
        </p>
      </div>
      <div className="border-t-2 border-ink pb-[clamp(4rem,8vw,7rem)]">
        {questions.map(({ question, answer }) => (
          <details className="group border-b border-rule" key={question}>
            <summary className="relative cursor-pointer list-none py-5 pr-12 text-[clamp(1rem,2vw,1.25rem)] font-bold marker:hidden after:absolute after:top-4 after:right-1 after:font-mono after:text-2xl after:font-bold after:content-['+'] group-open:after:content-['−']">
              {question}
            </summary>
            <p className="m-0 max-w-3xl pr-12 pb-6 text-ink-muted">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
