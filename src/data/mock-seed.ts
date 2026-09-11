import { ProtocolSimulation } from "@/domain/protocol-simulator";
import { demoTimestamp } from "@/domain/demo-time";
import { CANONICAL_BUYBACK_TAKE_WAD } from "@/protocol/constants";
import type {
  BandView,
  PluginEntry,
} from "@/types/protocol-model";
import type { DemoDataV3, DemoState } from "@/types/demo";
import type { Profile } from "@/types/demo";

const profiles: Profile[] = [
  {
    id: "profile-atelier",
    slug: "atelier-north",
    displayName: "Atelier North",
    handle: "atelier-north",
    bio: "A fictional studio exploring public cultural infrastructure through transparent funding terms.",
    initials: "AN",
    visualSeed: 11,
    joinedAt: demoTimestamp(1),
    kind: "fictional-demo",
  },
  {
    id: "profile-civic",
    slug: "civic-practice",
    displayName: "Civic Practice",
    handle: "civic-practice",
    bio: "A fictional research collective publishing experiments in shared ownership and public archives.",
    initials: "CP",
    visualSeed: 23,
    joinedAt: demoTimestamp(2),
    kind: "fictional-demo",
  },
  {
    id: "profile-field",
    slug: "field-office",
    displayName: "Field Office",
    handle: "field-office",
    bio: "A fictional editorial practice for independent publishing and material research.",
    initials: "FO",
    visualSeed: 37,
    joinedAt: demoTimestamp(3),
    kind: "fictional-demo",
  },
  {
    id: "profile-local",
    slug: "local-participant",
    displayName: "Local demo participant",
    handle: "local-demo",
    bio: "The browser-local participant used for deterministic trades and portfolio activity.",
    initials: "LD",
    visualSeed: 49,
    joinedAt: demoTimestamp(4),
    kind: "local-demo",
  },
];

const SEED_REGISTRY: PluginEntry[] = [
  {
    index: 0,
    plugin: "0x0000000000000000000000000000000000000b07",
    takeWad: CANONICAL_BUYBACK_TAKE_WAD.toString(),
    gasLimit: 500_000,
    role: "payout",
    suspended: false,
    codeHash: `0x${"bb".repeat(32)}`,
  },
];

interface SeedLaunchSpec {
  slug: string;
  creatorProfileId: string;
  name: string;
  symbol: string;
  supply: string;
  /** Pre-seeded lifecycle: buys to push through the curve and bands. */
  buys: string[];
  description: string;
  socials: {
    website?: string;
    x?: string;
    telegram?: string;
  };
}

const SEED_SPECS: SeedLaunchSpec[] = [
  {
    slug: "atelier-north-token",
    creatorProfileId: "profile-atelier",
    name: "Atelier North",
    symbol: "AN",
    supply: "1000000000",
    buys: ["120", "180", "60", "140", "220"],
    description:
      "Public cultural infrastructure funded on transparent milestone terms.",
    socials: { website: "https://atelier-north.example", x: "https://x.com/ateliernorth" },
  },
  {
    slug: "civic-practice-token",
    creatorProfileId: "profile-civic",
    name: "Civic Practice",
    symbol: "CP",
    supply: "1000000000",
    buys: ["85", "260", "90", "310"],
    description:
      "Shared ownership experiments with revenue routed to the creator stream.",
    socials: { telegram: "https://t.me/civicpractice" },
  },
  {
    slug: "field-office-token",
    creatorProfileId: "profile-field",
    name: "Field Office",
    symbol: "FO",
    supply: "1000000000",
    buys: ["95", "130"],
    description:
      "Independent publishing and material research on a public milestone ladder.",
    socials: {},
  },
];

/** Advance a simulation deterministically to seed interesting pool states. */
function seedSimulation(
  simulation: ProtocolSimulation,
  specs: SeedLaunchSpec[],
): DemoDataV3 {
  const launches: DemoDataV3["entities"]["launches"] = {};
  const activities: DemoDataV3["entities"]["activities"] = {};
  const ledger: DemoDataV3["entities"]["ledger"] = {};
  const comments: DemoDataV3["entities"]["comments"] = {};
  const activityOrder: string[] = [];
  const ledgerOrder: string[] = [];
  const launchOrder: string[] = [];
  const events: DemoDataV3["events"] = {};
  let tokenBalances: Record<string, string> = {};
  let sequence = 10;

  for (const spec of specs) {
    const creator = "0x0000000000000000000000000000000000000001";
    const pool = simulation.createLaunch(
      {
        creator,
        name: spec.name,
        symbol: spec.symbol,
        totalSupply: spec.supply,
        devBuyShareWad: "0",
        payoutPlan: "1",
        deadline: Math.floor(Date.now() / 1000) + 86_400,
      },
      spec.slug,
    );
    // Off-chain metadata rides on the record (backend persists it later).
    pool.record.metadata = {
      description: spec.description,
      socials: spec.socials,
    };
    launches[pool.record.poolId] = pool.record;
    launchOrder.push(pool.record.poolId);
    events[pool.record.poolId] = [...(simulation.events[pool.record.poolId] ?? [])];
    const createdId = `activity-${pool.record.poolId}-created`;
    activities[createdId] = {
      id: createdId,
      launchId: pool.record.poolId,
      profileId: spec.creatorProfileId,
      kind: "created",
      sequence,
      occurredAt: demoTimestamp(sequence),
      source: "fixture",
    };
    activityOrder.unshift(createdId);
    sequence += 1;

    for (const buy of spec.buys) {
      try {
        const result = simulation.executeTrade(pool, {
          side: "buy",
          amount: buy,
        });
        launches[pool.record.poolId] = result.launch;
        events[pool.record.poolId] = [
          ...(simulation.events[pool.record.poolId] ?? []),
        ];
        const tradeId = `activity-${pool.record.poolId}-buy-${sequence}`;
        activities[tradeId] = {
          id: tradeId,
          launchId: pool.record.poolId,
          profileId: "profile-local",
          kind: "buy",
          amountEth: buy,
          tokenAmount: result.estimatedOutput,
          sequence,
          occurredAt: demoTimestamp(sequence),
          source: "fixture",
        };
        activityOrder.unshift(tradeId);
        const ledgerId = `ledger-${pool.record.poolId}-${sequence}`;
        ledger[ledgerId] = {
          id: ledgerId,
          launchId: pool.record.poolId,
          side: "buy",
          tokenAmount: result.estimatedOutput,
          grossInput: buy,
          feeAmount: result.feeAmount,
          netOutput: result.estimatedOutput,
          levelAfter: result.levelAfter,
          receiptId: `sim_${pool.record.poolId}_${sequence}`,
          sequence,
          occurredAt: demoTimestamp(sequence),
          origin: "fixture",
        };
        ledgerOrder.unshift(ledgerId);
        for (const event of result.events) {
          if (event.kind === "MilestoneHarvested") {
            const milestoneId = `activity-${pool.record.poolId}-milestone-${event.index}-${sequence}`;
            activities[milestoneId] = {
              id: milestoneId,
              launchId: pool.record.poolId,
              kind: "milestone",
              milestoneNumber: event.index + 1,
              amountEth: event.quoteProceeds,
              sequence,
              occurredAt: demoTimestamp(sequence),
              source: "fixture",
            };
            activityOrder.unshift(milestoneId);
          }
          if (event.kind === "Graduated") {
            const gradId = `activity-${pool.record.poolId}-graduated-${sequence}`;
            activities[gradId] = {
              id: gradId,
              launchId: pool.record.poolId,
              kind: "graduated",
              amountEth: event.quoteProceeds,
              sequence,
              occurredAt: demoTimestamp(sequence),
              source: "fixture",
            };
            activityOrder.unshift(gradId);
          }
        }
        sequence += 1;
      } catch {
        // A seed buy that over-funds simply stops advancing this pool.
      }
    }
    tokenBalances = {
      ...tokenBalances,
      [pool.record.poolId]: simulation.account.tokens[pool.record.poolId]
        ? String(simulation.account.tokens[pool.record.poolId])
        : "0",
    };
  }

  const commentsSeed: Array<[string, string, string]> = [
    [
      "atelier-north-token",
      "profile-local",
      "The milestone ladder is the clearest funding schedule I have seen.",
    ],
    [
      "civic-practice-token",
      "profile-local",
      "Creator revenue following the NFT is a strong design choice.",
    ],
    [
      "field-office-token",
      "profile-local",
      "The 125 ETH opening valuation keeps day-one pricing fair.",
    ],
  ];
  for (const [slug, author, body] of commentsSeed) {
    const pool = Object.values(launches).find((l) => l.slug === slug);
    if (!pool) continue;
    const commentId = `comment-${slug}-${sequence}`;
    comments[commentId] = {
      id: commentId,
      launchId: pool.poolId,
      authorProfileId: author,
      body,
      sequence,
      createdAt: demoTimestamp(sequence),
      source: "fixture",
    };
    sequence += 1;
  }

  return {
    version: 3,
    entities: {
      launches,
      profiles: Object.fromEntries(profiles.map((p) => [p.id, p])),
      activities,
      comments,
      ledger,
    },
    order: {
      launches: launchOrder,
      profiles: profiles.map((p) => p.id),
      activities: activityOrder,
      comments: Object.keys(comments),
      ledger: ledgerOrder,
    },
    watchlist: launchOrder.slice(0, 1),
    portfolio: {
      accountProfileId: "profile-local",
      ethBalance: String(simulation.account.ethBalance),
      tokenBalances,
    },
    events,
    sequence,
  };
}

export function createSeedState(): DemoState {
  const simulation = new ProtocolSimulation(SEED_REGISTRY);
  const data = seedSimulation(simulation, SEED_SPECS);
  return {
    data,
    runtime: { hydration: "pending", persistence: "unknown" },
  };
}

/** Fictional profiles for static route generation. */
export const SEED_PROFILES: Profile[] = profiles.filter(
  (profile) => profile.kind === "fictional-demo",
);

/** Deterministic seed slugs for static route generation. */
export const SEED_LAUNCH_SLUGS: string[] = SEED_SPECS.map(
  (spec) => spec.slug,
);

export { SEED_REGISTRY };
export type { BandView };
