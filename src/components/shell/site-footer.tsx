import Link from "next/link";

const productLinks = [
  ["Tokens", "/tokens"],
  ["Create", "/create"],
  ["Portfolio", "/portfolio"],
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-ink bg-ink text-inverse print:bg-transparent print:text-black">
      <div className="mx-auto grid w-full max-w-measure grid-cols-[1.2fr_.55fr_.65fr_1fr] gap-[clamp(2rem,5vw,5rem)] px-[max(1rem,calc((100vw-80rem)/2))] py-12 max-[60rem]:grid-cols-2 max-[36rem]:grid-cols-1 [&_p]:mt-3 [&_p]:mb-0 [&_p]:max-w-lg [&_p]:text-inverse/75 print:[&_p]:text-black">
        <div>
          <Link
            className="text-xl font-extrabold tracking-[-0.04em] no-underline"
            href="/"
            aria-label="Spawn home"
          >
            Spawn
          </Link>
          <p>
            A milestone-based token launch protocol concept with terms declared
            before activity begins.
          </p>
        </div>
        <nav
          className="grid content-start gap-2.5 print:hidden [&_a]:text-sm [&_a]:font-semibold [&_a]:underline-offset-4"
          aria-label="Product navigation"
        >
          {productLinks.map(([label, href]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <nav
          className="grid content-start gap-2.5 print:hidden [&_a]:text-sm [&_a]:font-semibold [&_a]:underline-offset-4"
          aria-label="Concept information"
        >
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#economics">Economics</Link>
          <Link href="/#risks">Risks</Link>
        </nav>
        <p className="text-[0.82rem]">
          Fixed demonstration data. No wallet, contract, market feed, audit,
          deployment, or transaction is connected or claimed.
        </p>
      </div>
    </footer>
  );
}
