const supply = [
  [
    "25%",
    "Bonding curve",
    "One pool per launch: 32 just-in-time curve positions spanning two market-cap doublings (13,862 levels).",
  ],
  [
    "10%",
    "Milestone ladder",
    "22 protocol-owned sell bands on a decaying schedule (2× first step → 1.2504× floor), plus up to 30 fee-funded extensions.",
  ],
  [
    "65%",
    "Graduation backing",
    "~72.77M tokens in an ETH-limited full-range band (~$5,100 floor) plus a ~577.23M token-only wall across 880,000 levels — code-locked forever.",
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
          Every launch is pinned to 1,000,000,000 tokens opening at a 2 ETH
          fully-diluted valuation (~$5,000 at a $2,500 reference). That figure
          describes a valuation, not an amount raised or guaranteed.
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
          <p className={EYEBROW}>Graduation proceeds</p>
          <h3>20 / 70 / 10</h3>
          <p>
            20% seeds the code-locked full-range position, 70% accrues to the
            creator&apos;s direct ledger, and 10% to the global protocol ledger.
          </p>
        </div>
        <div>
          <p className={EYEBROW}>Trading fees (ETH side)</p>
          <h3>75 / 25</h3>
          <p>
            Post-graduation ETH-side fees route 75% to the creator and the
            exact remainder to the protocol. Governance can move the creator
            share up to 90%, prospectively.
          </p>
        </div>
        <div>
          <p className={EYEBROW}>Milestone harvests</p>
          <h3>10 / 90</h3>
          <p>
            Each harvested band pays a 10% service fee to the protocol and
            funds the payout pot with the exact remainder, which flushes to
            the launch&apos;s selected plugins.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(16rem,1fr)_minmax(18rem,.8fr)] gap-[clamp(2rem,7vw,7rem)] py-[clamp(3rem,6vw,5rem)] max-[52rem]:grid-cols-1">
        <div>
          <p className={EYEBROW}>Trading fee</p>
          <h3 className="mt-3 mb-3 max-w-[18ch] text-[clamp(1.6rem,3vw,2.7rem)] leading-tight">
            One percent. Forever.
          </h3>
          <p className="m-0 text-[color:color-mix(in_srgb,#e9e7e0_70%,transparent)] print:text-black">
            The fee is static for the pool&apos;s entire lifetime: no dynamic
            flag, no milestone schedule, no governance knob. Buys pay it in
            ETH; sells pay it in token.
          </p>
        </div>
        <table className="w-full border-collapse text-left text-sm">
          <caption className="absolute size-px overflow-hidden whitespace-nowrap [clip:rect(0,0,0,0)]">
            Static trading fee
          </caption>
          <thead>
            <tr className="border-b-2 border-[#e9e7e0] print:border-black">
              <th className="p-3 pl-0" scope="col">
                Pool property
              </th>
              <th className="p-3 pr-0 text-right" scope="col">
                Value
              </th>
            </tr>
          </thead>
          <tbody className="[&_tr]:border-b [&_tr]:border-[color:color-mix(in_srgb,#e9e7e0_35%,transparent)] print:[&_tr]:border-black [&_th]:p-3 [&_th]:pl-0 [&_th]:font-normal [&_td]:p-3 [&_td]:pr-0 [&_td]:text-right [&_td]:font-mono [&_td]:font-bold">
            <tr>
              <th scope="row">Trading fee</th>
              <td>1%</td>
            </tr>
            <tr>
              <th scope="row">Priced in</th>
              <td>ETH</td>
            </tr>
            <tr>
              <th scope="row">Outside funding</th>
              <td>Not accepted</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="m-0 border-l-4 border-accent bg-raised p-5 text-ink print:border-black">
        <strong>No free creator allocation.</strong> A creator can buy up to 10%
        of supply at launch on the same terms as everyone else — no discounts,
        no lockups.
      </p>
    </section>
  );
}
