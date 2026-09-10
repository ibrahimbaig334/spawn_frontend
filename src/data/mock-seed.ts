import type { DemoDataV2, DemoState } from "@/types/demo";
import type {
  ActivityRecord,
  Comment,
  HoldingLedgerEntry,
  Launch,
  LaunchId,
  MarketHistoryPoint,
  Profile,
} from "@/types/launch";
import { demoTimestamp } from "@/domain/demo-time";
import { parseDecimal, formatDecimal } from "@/domain/economics";
import { PROTOCOL_TERMS } from "./protocol-terms";

const split = PROTOCOL_TERMS.defaultProceedsSplit;

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
    bio: "The browser-local participant used for deterministic comments and portfolio activity.",
    initials: "LD",
    visualSeed: 49,
    joinedAt: demoTimestamp(4),
    kind: "local-demo",
  },
];

const launchRows: Launch[] = [
  {
    id: "launch-paloma",
    slug: "paloma",
    creatorProfileId: "profile-atelier",
    name: "Paloma",
    symbol: "PLMA",
    description:
      "A public culture fund that releases capital as its market reaches disclosed targets.",
    stage: "milestones",
    supply: "1000000000",
    valuationEth: "712",
    progressBps: 8_820,
    completedMilestones: 7,
    additionalMilestones: 0,
    proceedsSplit: { ...split },
    creatorPurchase: { enabled: true, shareBps: 500, lockupMonths: 8 },
    liquidityEth: "43.20",
    removedTokens: "2840000",
    creatorClaimableEth: "14.40",
    createdSequence: 8,
    createdAt: demoTimestamp(8),
    source: "fixture",
    visualSeed: 101,
  },
  {
    id: "launch-afterglow",
    slug: "afterglow",
    creatorProfileId: "profile-atelier",
    name: "Afterglow",
    symbol: "AFTR",
    description:
      "An open creator network with a visible launch-wide allocation split.",
    stage: "milestones",
    supply: "500000000",
    valuationEth: "1092",
    progressBps: 3_600,
    completedMilestones: 9,
    additionalMilestones: 0,
    proceedsSplit: {
      creator: 6_500,
      buyback: 1_500,
      protocol: 500,
      liquidity: 1_500,
    },
    creatorPurchase: { enabled: false, shareBps: 0, lockupMonths: 0 },
    liquidityEth: "78.90",
    removedTokens: "6610000",
    creatorClaimableEth: "22.70",
    createdSequence: 7,
    createdAt: demoTimestamp(7),
    source: "fixture",
    visualSeed: 102,
  },
  {
    id: "launch-fieldnotes",
    slug: "field-notes",
    creatorProfileId: "profile-field",
    name: "Field Notes",
    symbol: "FIELD",
    description: "A publishing collective testing progressive public funding.",
    stage: "launch",
    supply: "250000000",
    valuationEth: "149",
    progressBps: 7_400,
    completedMilestones: 0,
    additionalMilestones: 0,
    proceedsSplit: { ...split },
    creatorPurchase: { enabled: false, shareBps: 0, lockupMonths: 0 },
    liquidityEth: "0",
    removedTokens: "0",
    creatorClaimableEth: "0",
    createdSequence: 6,
    createdAt: demoTimestamp(6),
    source: "fixture",
    visualSeed: 103,
  },
  {
    id: "launch-silt",
    slug: "silt",
    creatorProfileId: "profile-field",
    name: "Silt",
    symbol: "SILT",
    description:
      "A material research network with the default proceeds allocation.",
    stage: "milestones",
    supply: "800000000",
    valuationEth: "4814",
    progressBps: 5_500,
    completedMilestones: 16,
    additionalMilestones: 0,
    proceedsSplit: { ...split },
    creatorPurchase: { enabled: true, shareBps: 750, lockupMonths: 12 },
    liquidityEth: "212.50",
    removedTokens: "14900000",
    creatorClaimableEth: "61.20",
    createdSequence: 5,
    createdAt: demoTimestamp(5),
    source: "fixture",
    visualSeed: 104,
  },
  {
    id: "launch-hearth",
    slug: "hearth",
    creatorProfileId: "profile-civic",
    name: "Hearth",
    symbol: "HRTH",
    description:
      "A shared infrastructure fund with ten percent supporting ongoing trading.",
    stage: "milestones",
    supply: "100000000",
    valuationEth: "263",
    progressBps: 2_900,
    completedMilestones: 3,
    additionalMilestones: 0,
    proceedsSplit: {
      creator: 5_500,
      buyback: 2_500,
      protocol: 1_000,
      liquidity: 1_000,
    },
    creatorPurchase: { enabled: false, shareBps: 0, lockupMonths: 0 },
    liquidityEth: "18.30",
    removedTokens: "900000",
    creatorClaimableEth: "4.10",
    createdSequence: 4,
    createdAt: demoTimestamp(4),
    source: "fixture",
    visualSeed: 105,
  },
  {
    id: "launch-common",
    slug: "common-ground",
    creatorProfileId: "profile-civic",
    name: "Common Ground",
    symbol: "CMN",
    description:
      "A civic archive whose core milestone schedule is fully completed in this fixture.",
    stage: "core-complete",
    supply: "1200000000",
    valuationEth: "100910",
    progressBps: 2_000,
    completedMilestones: 30,
    additionalMilestones: 2,
    proceedsSplit: { ...split },
    creatorPurchase: { enabled: true, shareBps: 300, lockupMonths: 3 },
    liquidityEth: "942.10",
    removedTokens: "89400000",
    creatorClaimableEth: "128.70",
    createdSequence: 3,
    createdAt: demoTimestamp(3),
    source: "fixture",
    visualSeed: 106,
  },
];

function historyFor(launch: Launch, index: number): MarketHistoryPoint[] {
  const latest = parseDecimal(launch.valuationEth) ?? 0n;
  const factors = [62, 68, 65, 73, 77, 75, 82, 88, 84, 91, 96, 100];
  const sequences = [
    120, 132, 144, 156, 168, 176, 184, 190, 194, 197, 199, 200,
  ].map((sequence) => sequence + index * 20);
  return factors.map((factor, pointIndex) => ({
    id: `${launch.id}-history-${pointIndex + 1}`,
    launchId: launch.id,
    valuationEth: formatDecimal((latest * BigInt(factor)) / 100n, 18, 6),
    sequence: sequences[pointIndex]!,
    recordedAt: demoTimestamp(sequences[pointIndex]!),
    source: "fixture" as const,
  }));
}

const histories = launchRows.flatMap(historyFor);

const activities: ActivityRecord[] = [
  {
    id: "activity-paloma-buy",
    launchId: "launch-paloma",
    profileId: "profile-local",
    kind: "buy",
    amountEth: "1.8",
    tokenAmount: "2500000",
    receiptId: "demo_fixture_paloma",
    sequence: 33,
    occurredAt: demoTimestamp(33),
    source: "fixture",
  },
  {
    id: "activity-paloma-m7",
    launchId: "launch-paloma",
    kind: "milestone",
    amountEth: "3.6",
    milestoneNumber: 7,
    sequence: 31,
    occurredAt: demoTimestamp(31),
    source: "fixture",
  },
  {
    id: "activity-after-m9",
    launchId: "launch-afterglow",
    kind: "milestone",
    amountEth: "5.2",
    milestoneNumber: 9,
    sequence: 38,
    occurredAt: demoTimestamp(38),
    source: "fixture",
  },
  {
    id: "activity-silt-m16",
    launchId: "launch-silt",
    kind: "milestone",
    amountEth: "8.4",
    milestoneNumber: 16,
    sequence: 44,
    occurredAt: demoTimestamp(44),
    source: "fixture",
  },
  {
    id: "activity-common-m32",
    launchId: "launch-common",
    kind: "milestone",
    amountEth: "18.8",
    milestoneNumber: 32,
    sequence: 51,
    occurredAt: demoTimestamp(51),
    source: "fixture",
  },
];

const comments: Comment[] = [
  {
    id: "comment-paloma-1",
    launchId: "launch-paloma",
    authorProfileId: "profile-civic",
    body: "The published allocation makes the next milestone easy to inspect.",
    sequence: 70,
    createdAt: demoTimestamp(70),
    source: "fixture",
  },
  {
    id: "comment-paloma-2",
    launchId: "launch-paloma",
    authorProfileId: "profile-field",
    body: "Interested in how the creator purchase is disclosed beside the market schedule.",
    sequence: 72,
    createdAt: demoTimestamp(72),
    source: "fixture",
  },
  {
    id: "comment-silt-1",
    launchId: "launch-silt",
    authorProfileId: "profile-atelier",
    body: "The lower demo fee after milestone 16 is visible in the current terms.",
    sequence: 74,
    createdAt: demoTimestamp(74),
    source: "fixture",
  },
];

const ledger: HoldingLedgerEntry[] = [
  {
    id: "ledger-paloma-buy",
    launchId: "launch-paloma",
    side: "buy",
    tokenAmount: "2500000",
    grossEth: "1.8",
    feeEth: "0.018",
    netEth: "1.782",
    receiptId: "demo_fixture_paloma",
    sequence: 33,
    occurredAt: demoTimestamp(33),
    origin: "fixture",
  },
  {
    id: "ledger-silt-buy",
    launchId: "launch-silt",
    side: "buy",
    tokenAmount: "140000",
    grossEth: "0.85",
    feeEth: "0.0085",
    netEth: "0.8415",
    receiptId: "demo_fixture_silt",
    sequence: 43,
    occurredAt: demoTimestamp(43),
    origin: "fixture",
  },
];

function recordById<T extends { id: string }>(rows: T[]): Record<string, T> {
  return Object.fromEntries(rows.map((row) => [row.id, row]));
}

function newestFirst<T extends { id: string; sequence: number }>(
  rows: T[],
): string[] {
  return [...rows]
    .sort(
      (left, right) =>
        right.sequence - left.sequence || left.id.localeCompare(right.id),
    )
    .map((row) => row.id);
}

export const createSeedData = (): DemoDataV2 => ({
  version: 2,
  entities: {
    launches: structuredClone(recordById(launchRows)),
    profiles: structuredClone(recordById(profiles)),
    activities: structuredClone(recordById(activities)),
    comments: structuredClone(recordById(comments)),
    history: structuredClone(recordById(histories)),
    ledger: structuredClone(recordById(ledger)),
  },
  order: {
    launches: launchRows.map((row) => row.id),
    profiles: profiles.map((row) => row.id),
    activities: newestFirst(activities),
    comments: newestFirst(comments),
    history: newestFirst(histories),
    ledger: newestFirst(ledger),
  },
  watchlist: ["launch-afterglow", "launch-silt"],
  portfolio: { accountProfileId: "profile-local", ethBalance: "25" },
  sequence: 300,
});

export const createSeedState = (): DemoState => ({
  data: createSeedData(),
  runtime: { hydration: "pending", persistence: "unknown" },
});

export const SEED_LAUNCHES = recordById(launchRows) as Record<LaunchId, Launch>;
export const SEED_PROFILES = recordById(profiles);
