import { PROTOCOL_TERMS } from "@/data/protocol-terms";
import type { DemoDataV2 } from "@/types/demo";
import type { LaunchStage } from "@/types/launch";

export const DEMO_STORAGE_KEY = "spawn.demo-state";
export const DEMO_STORAGE_VERSION = 2 as const;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type LegacySplit = {
  creator: number;
  removal: number;
  spawn: number;
  trading: number;
};
type LegacyActivity = {
  id: string;
  kind: "buy" | "sell" | "milestone" | "created";
  label: string;
  amountEth?: string;
  sequence: number;
};
type LegacyLaunch = {
  id: string;
  name: string;
  symbol: string;
  description: string;
  stage: LaunchStage;
  supply: string;
  valuationEth: string;
  progressBps: number;
  completedMilestones: number;
  additionalMilestones: number;
  proceedsSplit: LegacySplit;
  creatorPurchase: { enabled: boolean; shareBps: number; lockupMonths: number };
  liquidityEth: string;
  removedTokens: string;
  creatorClaimableEth: string;
  activity: LegacyActivity[];
  createdSequence: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decimal(value: unknown): value is string {
  return typeof value === "string" && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value);
}

function integer(
  value: unknown,
  maximum = Number.MAX_SAFE_INTEGER,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= maximum
  );
}

function id(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 160;
}

function iso(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  );
}

function unique(values: unknown): values is string[] {
  return (
    Array.isArray(values) &&
    values.every(id) &&
    new Set(values).size === values.length
  );
}

function validSplit(value: unknown, legacy = false): boolean {
  if (!isRecord(value)) return false;
  const keys = legacy
    ? ["creator", "removal", "spawn", "trading"]
    : ["creator", "buyback", "protocol", "liquidity"];
  const values = keys.map((key) => value[key]);
  if (!values.every((item) => integer(item, 10_000))) return false;
  if (values.reduce<number>((sum, item) => sum + Number(item), 0) !== 10_000)
    return false;
  return (
    Number(value.creator) <= PROTOCOL_TERMS.maxCreatorShareBps &&
    Number(value[legacy ? "removal" : "buyback"]) >=
      PROTOCOL_TERMS.minBuybackShareBps &&
    Number(value[legacy ? "spawn" : "protocol"]) >=
      PROTOCOL_TERMS.minProtocolShareBps
  );
}

function exactOrder(
  order: string[],
  records: Record<string, unknown>,
): boolean {
  const keys = Object.keys(records);
  return (
    order.length === keys.length && keys.every((key) => order.includes(key))
  );
}

function monotonic(
  order: string[],
  records: Record<string, unknown>,
  newestFirst: boolean,
): boolean {
  let previous: number | undefined;
  for (const key of order) {
    const row = records[key];
    if (!isRecord(row) || !integer(row.sequence)) return false;
    if (
      previous !== undefined &&
      (newestFirst ? row.sequence > previous : row.sequence < previous)
    )
      return false;
    previous = row.sequence;
  }
  return true;
}

function recordsWithinSequence(
  records: Record<string, unknown>,
  sequence: number,
): boolean {
  return Object.values(records).every(
    (row) => isRecord(row) && integer(row.sequence, sequence),
  );
}

function validateV2(value: unknown): value is DemoDataV2 {
  if (
    !isRecord(value) ||
    value.version !== 2 ||
    !isRecord(value.entities) ||
    !isRecord(value.order)
  )
    return false;
  const entitiesValue = value.entities;
  const orderValue = value.order;
  const tables = [
    "launches",
    "profiles",
    "activities",
    "comments",
    "history",
    "ledger",
  ] as const;
  if (
    !tables.every(
      (table) => isRecord(entitiesValue[table]) && unique(orderValue[table]),
    )
  )
    return false;
  const entities = entitiesValue as Record<
    (typeof tables)[number],
    Record<string, unknown>
  >;
  const order = orderValue as Record<(typeof tables)[number], string[]>;
  if (!tables.every((table) => exactOrder(order[table], entities[table])))
    return false;

  const slugs = new Set<string>();
  for (const [key, row] of Object.entries(entities.launches)) {
    if (
      !isRecord(row) ||
      row.id !== key ||
      !id(row.slug) ||
      slugs.has(row.slug) ||
      !id(row.creatorProfileId)
    )
      return false;
    slugs.add(row.slug);
    if (!id(row.name) || !id(row.symbol) || typeof row.description !== "string")
      return false;
    if (!["launch", "milestones", "core-complete"].includes(String(row.stage)))
      return false;
    if (
      !decimal(row.supply) ||
      !decimal(row.valuationEth) ||
      !integer(row.progressBps, 10_000)
    )
      return false;
    if (
      !integer(row.completedMilestones, PROTOCOL_TERMS.coreMilestones) ||
      !integer(row.additionalMilestones, PROTOCOL_TERMS.maxAdditionalMilestones)
    )
      return false;
    if (!validSplit(row.proceedsSplit) || !isRecord(row.creatorPurchase))
      return false;
    if (
      typeof row.creatorPurchase.enabled !== "boolean" ||
      !integer(
        row.creatorPurchase.shareBps,
        PROTOCOL_TERMS.maxCreatorPurchaseBps,
      ) ||
      !integer(row.creatorPurchase.lockupMonths, PROTOCOL_TERMS.maxLockupMonths)
    )
      return false;
    if (
      !decimal(row.liquidityEth) ||
      !decimal(row.removedTokens) ||
      !decimal(row.creatorClaimableEth)
    )
      return false;
    if (
      !integer(row.createdSequence) ||
      !iso(row.createdAt) ||
      !["fixture", "local-simulation"].includes(String(row.source)) ||
      !integer(row.visualSeed)
    )
      return false;
  }

  for (const [key, row] of Object.entries(entities.profiles)) {
    if (
      !isRecord(row) ||
      row.id !== key ||
      !id(row.slug) ||
      !id(row.displayName) ||
      !id(row.handle) ||
      typeof row.bio !== "string" ||
      !id(row.initials) ||
      !integer(row.visualSeed) ||
      !iso(row.joinedAt) ||
      !["fictional-demo", "local-demo"].includes(String(row.kind))
    )
      return false;
  }
  const hasLaunch = (launchId: unknown) =>
    typeof launchId === "string" && Boolean(entities.launches[launchId]);
  const hasProfile = (profileId: unknown) =>
    typeof profileId === "string" && Boolean(entities.profiles[profileId]);
  if (
    !Object.values(entities.launches).every(
      (row) => isRecord(row) && hasProfile(row.creatorProfileId),
    )
  )
    return false;

  for (const [key, row] of Object.entries(entities.activities)) {
    if (
      !isRecord(row) ||
      row.id !== key ||
      !hasLaunch(row.launchId) ||
      (row.profileId !== undefined && !hasProfile(row.profileId)) ||
      !["buy", "sell", "milestone", "created"].includes(String(row.kind)) ||
      !integer(row.sequence) ||
      !iso(row.occurredAt) ||
      !["fixture", "local-simulation"].includes(String(row.source))
    )
      return false;
    if (row.amountEth !== undefined && !decimal(row.amountEth)) return false;
    if (row.tokenAmount !== undefined && !decimal(row.tokenAmount))
      return false;
  }
  for (const [key, row] of Object.entries(entities.comments)) {
    if (
      !isRecord(row) ||
      row.id !== key ||
      !hasLaunch(row.launchId) ||
      !hasProfile(row.authorProfileId) ||
      typeof row.body !== "string" ||
      !row.body.trim() ||
      row.body.length > 500 ||
      !integer(row.sequence) ||
      !iso(row.createdAt) ||
      !["fixture", "local-simulation"].includes(String(row.source))
    )
      return false;
  }
  for (const [key, row] of Object.entries(entities.history)) {
    if (
      !isRecord(row) ||
      row.id !== key ||
      !hasLaunch(row.launchId) ||
      !decimal(row.valuationEth) ||
      !integer(row.sequence) ||
      !iso(row.recordedAt) ||
      !["fixture", "local-simulation", "migration"].includes(String(row.source))
    )
      return false;
  }
  for (const [key, row] of Object.entries(entities.ledger)) {
    if (
      !isRecord(row) ||
      row.id !== key ||
      !hasLaunch(row.launchId) ||
      !["buy", "sell"].includes(String(row.side)) ||
      !decimal(row.tokenAmount) ||
      !decimal(row.grossEth) ||
      !decimal(row.feeEth) ||
      !decimal(row.netEth) ||
      !id(row.receiptId) ||
      !integer(row.sequence) ||
      !iso(row.occurredAt) ||
      !["fixture", "simulation"].includes(String(row.origin))
    )
      return false;
  }
  if (
    !unique(value.watchlist) ||
    !value.watchlist.every(hasLaunch) ||
    !isRecord(value.portfolio) ||
    !hasProfile(value.portfolio.accountProfileId) ||
    !decimal(value.portfolio.ethBalance) ||
    !integer(value.sequence)
  )
    return false;
  const sequence = value.sequence;
  const sequenced = ["activities", "comments", "history", "ledger"] as const;
  if (
    !sequenced.every((table) =>
      recordsWithinSequence(entities[table], sequence),
    )
  )
    return false;
  if (!monotonic(order.activities, entities.activities, true)) return false;
  if (!monotonic(order.comments, entities.comments, true)) return false;
  if (!monotonic(order.history, entities.history, true)) return false;
  if (!monotonic(order.ledger, entities.ledger, true)) return false;
  return true;
}

function validateLegacy(
  value: unknown,
): value is Record<string, unknown> & {
  launches: Record<string, LegacyLaunch>;
  launchOrder: string[];
  watchlist: string[];
  ethBalance: string;
  sequence: number;
} {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !isRecord(value.launches) ||
    !unique(value.launchOrder) ||
    !unique(value.watchlist) ||
    !decimal(value.ethBalance) ||
    !integer(value.sequence)
  )
    return false;
  const launches = value.launches;
  if (
    !exactOrder(value.launchOrder, launches) ||
    !value.watchlist.every((launchId) => Boolean(launches[launchId]))
  )
    return false;
  return Object.entries(launches).every(
    ([key, row]) =>
      isRecord(row) &&
      row.id === key &&
      id(row.name) &&
      id(row.symbol) &&
      typeof row.description === "string" &&
      ["launch", "milestones", "core-complete"].includes(String(row.stage)) &&
      decimal(row.supply) &&
      decimal(row.valuationEth) &&
      integer(row.progressBps, 10_000) &&
      integer(row.completedMilestones, 30) &&
      integer(row.additionalMilestones, 30) &&
      validSplit(row.proceedsSplit, true) &&
      isRecord(row.creatorPurchase) &&
      typeof row.creatorPurchase.enabled === "boolean" &&
      integer(row.creatorPurchase.shareBps, 10_000) &&
      integer(row.creatorPurchase.lockupMonths, 12) &&
      decimal(row.liquidityEth) &&
      decimal(row.removedTokens) &&
      decimal(row.creatorClaimableEth) &&
      Array.isArray(row.activity) &&
      integer(row.createdSequence),
  );
}

function legacyTimestamp(sequence: number): string {
  return new Date(
    Date.UTC(2025, 0, 1, 12) + sequence * 21_600_000,
  ).toISOString();
}

function migrateV1(
  value: Record<string, unknown> & {
    launches: Record<string, LegacyLaunch>;
    launchOrder: string[];
    watchlist: string[];
    ethBalance: string;
    sequence: number;
  },
): DemoDataV2 {
  const profiles: DemoDataV2["entities"]["profiles"] = {
    "profile-legacy": {
      id: "profile-legacy",
      slug: "legacy-demo-creators",
      displayName: "Legacy demo creators",
      handle: "legacy-demo",
      bio: "Creator attribution supplied during local V1 migration.",
      initials: "LD",
      visualSeed: 71,
      joinedAt: legacyTimestamp(0),
      kind: "fictional-demo",
    },
    "profile-local": {
      id: "profile-local",
      slug: "local-participant",
      displayName: "Local demo participant",
      handle: "local-demo",
      bio: "The browser-local participant used for deterministic comments and portfolio activity.",
      initials: "LP",
      visualSeed: 72,
      joinedAt: legacyTimestamp(1),
      kind: "local-demo",
    },
  };
  const launches: DemoDataV2["entities"]["launches"] = {};
  const activities: DemoDataV2["entities"]["activities"] = {};
  const history: DemoDataV2["entities"]["history"] = {};
  const activityOrder: string[] = [];
  const historyOrder: string[] = [];
  for (const launchId of value.launchOrder) {
    const legacy = value.launches[launchId]!;
    launches[launchId] = {
      ...legacy,
      slug: legacy.id,
      creatorProfileId: "profile-legacy",
      proceedsSplit: {
        creator: legacy.proceedsSplit.creator,
        buyback: legacy.proceedsSplit.removal,
        protocol: legacy.proceedsSplit.spawn,
        liquidity: legacy.proceedsSplit.trading,
      },
      createdAt: legacyTimestamp(legacy.createdSequence),
      source: "local-simulation",
      visualSeed: legacy.createdSequence + 100,
    };
    delete (launches[launchId] as unknown as Record<string, unknown>).activity;
    for (const item of legacy.activity) {
      activities[item.id] = {
        id: item.id,
        launchId,
        kind: item.kind,
        amountEth: item.amountEth,
        sequence: item.sequence,
        occurredAt: legacyTimestamp(item.sequence),
        source: "local-simulation",
      };
      activityOrder.push(item.id);
    }
    const pointId = `${launchId}-migration-${value.sequence}`;
    history[pointId] = {
      id: pointId,
      launchId,
      valuationEth: legacy.valuationEth,
      sequence: value.sequence,
      recordedAt: legacyTimestamp(value.sequence),
      source: "migration",
    };
    historyOrder.push(pointId);
  }
  activityOrder.sort(
    (left, right) =>
      activities[right]!.sequence - activities[left]!.sequence ||
      left.localeCompare(right),
  );
  historyOrder.sort(
    (left, right) =>
      history[right]!.sequence - history[left]!.sequence ||
      left.localeCompare(right),
  );
  return {
    version: 2,
    entities: {
      launches,
      profiles,
      activities,
      comments: {},
      history,
      ledger: {},
    },
    order: {
      launches: [...value.launchOrder],
      profiles: Object.keys(profiles),
      activities: activityOrder,
      comments: [],
      history: historyOrder,
      ledger: [],
    },
    watchlist: [...value.watchlist],
    portfolio: {
      accountProfileId: "profile-local",
      ethBalance: value.ethBalance,
    },
    sequence: value.sequence,
  };
}

export function parseStoredDemoState(raw: string | null): DemoDataV2 | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (validateV2(value)) return value;
    if (validateLegacy(value)) return migrateV1(value);
    return null;
  } catch {
    return null;
  }
}

export function loadDemoState(storage?: StorageLike): DemoDataV2 | null {
  const target =
    storage ??
    (typeof window === "undefined" ? undefined : window.localStorage);
  if (!target) return null;
  try {
    return parseStoredDemoState(target.getItem(DEMO_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveDemoState(
  data: DemoDataV2,
  storage?: StorageLike,
): boolean {
  const target =
    storage ??
    (typeof window === "undefined" ? undefined : window.localStorage);
  if (!target || !validateV2(data)) return false;
  try {
    target.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearDemoState(storage?: StorageLike): boolean {
  const target =
    storage ??
    (typeof window === "undefined" ? undefined : window.localStorage);
  if (!target) return false;
  try {
    target.removeItem(DEMO_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
