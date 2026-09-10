export function DemoBanner() {
  return (
    <aside
      className="border-b border-ink bg-surface-strong text-ink print:bg-transparent"
      aria-label="Product status"
    >
      <div className="mx-auto flex min-h-8 w-full max-w-measure items-center gap-4 px-[max(1rem,calc((100vw-80rem)/2))] font-mono text-[0.65rem] font-semibold tracking-[0.04em] uppercase max-[36rem]:gap-2 max-[36rem]:text-[0.59rem] [&_span]:border-l [&_span]:border-current [&_span]:pl-4 max-[36rem]:[&_span]:pl-2 max-[23rem]:[&_span:nth-child(2)]:hidden">
        <strong>Protocol concept</strong>
        <span>Fixed + browser-local data</span>
        <span>No wallet or transaction</span>
      </div>
    </aside>
  );
}
