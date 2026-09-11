"use client";

import Link from "next/link";
import { formatDemoUtc } from "@/domain/demo-time";
import {
  deriveFdvEth,
  derivePhaseLabel,
  selectLaunchActivity,
  selectProfileBySlug,
  selectProfileLaunches,
} from "@/domain/selectors";
import { formatEth } from "@/lib/format";
import { useDemo } from "@/state/use-demo";

const UNAVAILABLE =
  "min-h-[60vh] px-[max(1rem,calc((100vw-80rem)/2))] py-[clamp(4rem,10vw,8rem)] [&>p:first-child]:font-mono [&>p:first-child]:text-xs [&>p:first-child]:font-bold [&>p:first-child]:text-accent-strong [&>p:first-child]:uppercase [&_h1]:max-w-[15ch] [&_h1]:text-[clamp(2.6rem,7vw,5.5rem)] [&_h1]:leading-[0.95]";

export function ProfilePage({ slug }: { slug: string }) {
  const { state } = useDemo();
  const profile = selectProfileBySlug(state, slug);
  if (!profile && state.runtime.hydration === "pending")
    return (
      <section className={UNAVAILABLE}>
        <p>Loading browser-local data</p>
        <h1>Preparing profile.</h1>
      </section>
    );
  if (!profile)
    return (
      <section className={UNAVAILABLE}>
        <p>Profile unavailable</p>
        <h1>This profile could not be found.</h1>
        <p>It may belong to browser-local data that is not available here.</p>
        <Link className="font-bold underline-offset-4" href="/tokens">
          Browse tokens
        </Link>
      </section>
    );
  const launches = selectProfileLaunches(state, profile.id);
  const activity = launches.flatMap((launch) =>
    selectLaunchActivity(state, launch.poolId),
  );
  return (
    <article className="px-[max(1rem,calc((100vw-80rem)/2))] pt-[clamp(3rem,7vw,6rem)] pb-[clamp(5rem,9vw,8rem)] print:px-0">
      <header className="grid grid-cols-[clamp(5rem,10vw,8rem)_minmax(0,1fr)] items-start gap-[clamp(1.5rem,4vw,3rem)] border-b-2 border-ink pb-[clamp(2rem,5vw,4rem)] max-[34rem]:grid-cols-1">
        <span
          className="grid aspect-square place-items-center border border-ink font-mono text-[clamp(1.2rem,3vw,2rem)] font-bold text-accent-strong max-[34rem]:w-20"
          aria-hidden="true"
        >
          {profile.initials}
        </span>
        <div>
          <p className="m-0 font-mono text-xs font-bold tracking-[0.08em] text-accent-strong uppercase">
            {profile.kind === "fictional-demo"
              ? "Fictional demo profile"
              : "Browser-local demo profile"}
          </p>
          <h1 className="my-1 text-[clamp(2.8rem,7vw,6rem)] leading-[0.95] tracking-[-0.05em]">
            {profile.displayName}
          </h1>
          <p className="m-0 font-mono text-xs text-ink-muted">
            @{profile.handle} · Joined {formatDemoUtc(profile.joinedAt)}
          </p>
          <p className="mt-4 mb-0 max-w-3xl text-lg text-ink-muted">
            {profile.bio}
          </p>
        </div>
      </header>
      <p className="mt-5 mb-0 border-l-[3px] border-accent bg-raised px-4 py-3 text-sm text-ink-muted">
        Profile attribution is fictional or browser-local. It does not represent
        signer identity, verification, wallet ownership, or current ownership of
        a revenue NFT.
      </p>
      <section
        className="border-b border-rule py-[clamp(2.5rem,6vw,5rem)]"
        aria-labelledby="profile-launches"
      >
        <header className="flex items-end justify-between gap-4">
          <h2
            className="m-0 text-[clamp(1.8rem,4vw,3rem)]"
            id="profile-launches"
          >
            Launches
          </h2>
          <span className="font-mono text-xs text-ink-muted">
            {launches.length}
          </span>
        </header>
        {launches.length ? (
          <div className="mt-4 border-t-2 border-ink">
            {launches.map((launch) => (
              <article
                className="grid grid-cols-[1fr_minmax(24rem,.8fr)] gap-8 border-b border-rule py-5 max-[48rem]:grid-cols-1"
                key={launch.poolId}
              >
                <div>
                  <p className="m-0 text-xs text-ink-muted">
                    ${launch.symbol}
                  </p>
                  <h3 className="my-1 text-xl">
                    <Link href={`/tokens/${launch.slug}`}>{launch.name}</Link>
                  </h3>
                  <p className="m-0 text-sm text-ink-muted">
                    Level {launch.level} · pot {formatEth(launch.payoutPotWei, 3)}
                  </p>
                </div>
                <dl className="m-0 grid grid-cols-3 max-[34rem]:grid-cols-1 [&>div]:px-3 [&>div]:py-2 [&>div+div]:border-l [&>div+div]:border-rule max-[34rem]:[&>div+div]:border-t max-[34rem]:[&>div+div]:border-l-0 [&_dt]:text-xs [&_dt]:text-ink-muted [&_dd]:mt-1 [&_dd]:mb-0 [&_dd]:font-mono [&_dd]:text-xs [&_dd]:font-bold">
                  <div>
                    <dt>FDV</dt>
                    <dd>{formatEth(deriveFdvEth(launch), 2)}</dd>
                  </div>
                  <div>
                    <dt>Phase</dt>
                    <dd>{derivePhaseLabel(launch)}</dd>
                  </div>
                  <div>
                    <dt>Harvested</dt>
                    <dd>{launch.completedMilestones}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <p className="border border-rule p-8 text-center text-ink-muted">
            No launches are attributed to this profile.
          </p>
        )}
      </section>
      <section
        className="border-b border-rule py-[clamp(2.5rem,6vw,5rem)]"
        aria-labelledby="profile-activity"
      >
        <header className="flex items-end justify-between gap-4">
          <h2
            className="m-0 text-[clamp(1.8rem,4vw,3rem)]"
            id="profile-activity"
          >
            Related activity
          </h2>
          <span className="font-mono text-xs text-ink-muted">
            Derived by launch attribution
          </span>
        </header>
        {activity.length ? (
          <ol className="mt-4 mb-0 list-none border-t border-rule p-0">
            {activity.map((record) => (
              <li
                className="grid grid-cols-[6rem_1fr_auto] gap-4 border-b border-rule py-3 max-[48rem]:grid-cols-1 max-[48rem]:gap-1"
                key={record.id}
              >
                <span className="font-mono text-xs font-bold text-accent-strong uppercase">
                  {record.kind}
                </span>
                <Link
                  href={`/tokens/${state.data.entities.launches[record.launchId]?.slug}`}
                >
                  {record.launchName}
                </Link>
                <time
                  className="font-mono text-xs text-ink-muted"
                  dateTime={record.occurredAt}
                >
                  {formatDemoUtc(record.occurredAt)}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="border border-rule p-8 text-center text-ink-muted">
            No related activity.
          </p>
        )}
      </section>
    </article>
  );
}
