const questions = [
  {
    question: "Can I add funds to someone else's token market?",
    answer:
      "Not while it is on its starting curve — only the protocol provides funds there. After graduation the protocol's positions stay locked forever, and you can only fund your own separate position elsewhere.",
  },
  {
    question: "When exactly does a token graduate?",
    answer:
      "When the price climbs to about 4x the opening price, the next buy graduates it automatically — or anyone can graduate it deliberately. Touching the top and falling back does not graduate it.",
  },
  {
    question: "What does a milestone actually pay?",
    answer:
      "When the price crosses a milestone, that milestone's tokens are sold: a 10% service fee goes to the protocol and 90% funds the payout pot. The pot is then shared out to the token's plugins and its creator — anyone can trigger the share-out and earn a 1% tip.",
  },
  {
    question: "My token shows a milestone was skipped — is something broken?",
    answer:
      "No. If the price jumps past a milestone before it can pay out, it is skipped and its share rolls into the next one. That is normal, not a failure.",
  },
  {
    question: "Can anyone steal or alter my launch?",
    answer:
      "No. Every detail of your launch is locked in the moment it goes live — any edit would be rejected. And buying your own tokens at launch only happens through your own wallet.",
  },
  {
    question: "Does reaching a milestone prove lasting demand?",
    answer:
      "No. Markets can reverse, and a milestone paid out at its top may be the last. A reached target is not proof of lasting value.",
  },
  {
    question: "Is Spawn live on my network?",
    answer:
      "If launches fail, the protocol may not be live on your network yet — browsing and market data keep working regardless.",
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
