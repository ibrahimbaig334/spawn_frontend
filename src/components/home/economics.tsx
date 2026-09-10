const supply = [
  [
    "25%",
    "Initial trading inventory",
    "Available through the modeled opening market.",
  ],
  [
    "65%",
    "Milestone inventory",
    "Distributed evenly across the 30 initial targets.",
  ],
  [
    "10%",
    "Ongoing market liquidity",
    "Reserved for the modeled post-opening market.",
  ],
] as const;

const EYEBROW =
  "m-0 font-mono text-xs font-bold tracking-[0.08em] text-[#e9e7e0] uppercase";

export function Economics() {
  return (
    <section
      id="economics"
      className="border-b border-rule bg-carbon px-[max(1rem,calc((100vw-80rem)/2))] py-[clamp(4rem,8vw,7rem)] text-[#e9e7e0] print:bg-transparent print:px-0 print:text-black"
      aria-labelledby="economics-title"
    >
      <div className="grid grid-cols-[minmax(8rem,.45fr)_minmax(18rem,1fr)_minmax(14rem,.65fr)] items-start gap-x-[clamp(1.5rem,5vw,5rem)] gap-y-4 pb-[clamp(3rem,6vw,5rem)] max-[52rem]:grid-cols-1">
        <p className={EYEBROW}>Economics</p>
        <h2
          className="m-0 max-w-[14ch] text-[clamp(2.1rem,5vw,4.6rem)] leading-[0.96] tracking-[-0.05em]"
          id="economics-title"
        >
          A fixed supply schedule, made legible.
        </h2>
        <p className="mt-1 mb-0 text-[color:color-mix(in_srgb,#e9e7e0_70%,transparent)] print:text-black">
          The concept anchors the opening total-supply valuation at 125 ETH.
          That figure describes a valuation, not an amount raised or guaranteed.
        </p>
      </div>
      <dl className="m-0 grid grid-cols-3 border-y border-[color:color-mix(in_srgb,#e9e7e0_35%,transparent)] max-[52rem]:grid-cols-1 print:border-black [&>div]:p-[clamp(1.25rem,3vw,2rem)] [&>div+div]:border-l [&>div+div]:border-[color:color-mix(in_srgb,#e9e7e0_35%,transparent)] max-[52rem]:[&>div+div]:border-t max-[52rem]:[&>div+div]:border-l-0 print:[&>div+div]:border-black">
        {supply.map(([value, term, detail]) => (
          <div key={value}>
            <dt className="grid gap-2 text-sm font-bold">
              <span className="font-mono text-[clamp(2rem,5vw,4rem)] leading-none text-[#e9e7e0] print:text-black">
                {value}
              </span>
              {term}
            </dt>
            <dd className="mt-3 ml-0 max-w-sm text-sm text-[color:color-mix(in_srgb,#e9e7e0_70%,transparent)] print:text-black">
              {detail}
            </dd>
          </div>
        ))}
      </dl>
      <div className="grid grid-cols-3 border-b border-[color:color-mix(in_srgb,#e9e7e0_35%,transparent)] max-[52rem]:grid-cols-1 print:border-black [&>div]:py-7 [&>div]:pr-6 [&>div+div]:border-l [&>div+div]:border-[color:color-mix(in_srgb,#e9e7e0_35%,transparent)] [&>div+div]:pl-6 max-[52rem]:[&>div+div]:border-t max-[52rem]:[&>div+div]:border-l-0 max-[52rem]:[&>div+div]:pl-0 print:[&>div+div]:border-black [&_h3]:my-2 [&_h3]:font-mono [&_h3]:text-[clamp(1.5rem,3vw,2.4rem)] [&_p:last-child]:m-0 [&_p:last-child]:text-sm [&_p:last-child]:text-[color:color-mix(in_srgb,#e9e7e0_70%,transparent)] print:[&_p:last-child]:text-black">
        <div>
          <p className={EYEBROW}>Launch-target proceeds</p>
          <h3>40 / 55 / 5</h3>
          <p>
            40% seeds ongoing liquidity, 55% becomes creator proceeds, and 5%
            goes to the protocol.
          </p>
        </div>
        <div>
          <p className={EYEBROW}>Ongoing fee routing</p>
          <h3>60 / 30 / 10</h3>
          <p>
            60% supports liquidity, 30% accrues to the creator earnings right,
            and 10% goes to the protocol.
          </p>
        </div>
        <div>
          <p className={EYEBROW}>Milestone allocation</p>
          <h3>60 / 20 / 10 / 10</h3>
          <p>
            60% to the creator, 20% to token purchase and permanent removal, 10%
            to the protocol, and 10% to liquidity.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(16rem,1fr)_minmax(18rem,.8fr)] gap-[clamp(2rem,7vw,7rem)] py-[clamp(3rem,6vw,5rem)] max-[52rem]:grid-cols-1">
        <div>
          <p className={EYEBROW}>Trading fees</p>
          <h3 className="mt-3 mb-3 max-w-[18ch] text-[clamp(1.6rem,3vw,2.7rem)] leading-tight">
            Fees decrease after demonstrated progress.
          </h3>
          <p className="m-0 text-[color:color-mix(in_srgb,#e9e7e0_70%,transparent)] print:text-black">
            The modeled fee changes only at the stated completion counts.
          </p>
        </div>
        <table className="w-full border-collapse text-left text-sm">
          <caption className="absolute size-px overflow-hidden whitespace-nowrap [clip:rect(0,0,0,0)]">
            Modeled trading fee schedule
          </caption>
          <thead>
            <tr className="border-b-2 border-[#e9e7e0] print:border-black">
              <th className="p-3 pl-0" scope="col">
                Completed milestones
              </th>
              <th className="p-3 pr-0 text-right" scope="col">
                Fee
              </th>
            </tr>
          </thead>
          <tbody className="[&_tr]:border-b [&_tr]:border-[color:color-mix(in_srgb,#e9e7e0_35%,transparent)] print:[&_tr]:border-black [&_th]:p-3 [&_th]:pl-0 [&_th]:font-normal [&_td]:p-3 [&_td]:pr-0 [&_td]:text-right [&_td]:font-mono [&_td]:font-bold">
            <tr>
              <th scope="row">0–7</th>
              <td>1%</td>
            </tr>
            <tr>
              <th scope="row">8–15</th>
              <td>0.75%</td>
            </tr>
            <tr>
              <th scope="row">16 or more</th>
              <td>0.5%</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="m-0 border-l-4 border-accent bg-raised p-5 text-ink print:border-black">
        <strong>No free creator allocation.</strong> A creator may make a
        disclosed purchase under the same modeled market conditions as other
        participants.
      </p>
    </section>
  );
}
