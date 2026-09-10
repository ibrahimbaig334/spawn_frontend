const questions = [
  {
    question: "What happens if a launch does not progress?",
    answer:
      "The current concept has no deadline, minimum raise, cancellation path, or refund mechanism. Trading may continue without reaching the next milestone.",
  },
  {
    question: "Are milestones beyond the first 30 guaranteed?",
    answer:
      "No. Any additional milestones depend on enough token-denominated trading fees being collected. They are conditional and may never become available.",
  },
  {
    question: "Is a creator purchase locked?",
    answer:
      "Not necessarily. A creator purchase is optional and disclosed, but may state No lock-up. It is a purchase, not a free allocation.",
  },
  {
    question: "Does reaching a milestone prove lasting demand?",
    answer:
      "No. Markets can be manipulated, and temporary price moves may trigger modeled outcomes before reversing. A reached target is not proof of durable value.",
  },
  {
    question: "Has the system been audited or deployed?",
    answer:
      "No such claim is made. This interface presents a product concept with local demonstration data; it does not establish an audit, a live deployment, or transaction readiness.",
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
          Know what the model does not promise.
        </h2>
        <p className="mt-1 mb-0 text-ink-muted">
          These constraints are part of the concept, not edge-case fine print.
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
