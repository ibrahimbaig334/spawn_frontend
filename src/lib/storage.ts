import type { DemoDataV3 } from "@/types/demo";

export const DEMO_STORAGE_KEY = "spawn.demo-state";
export const DEMO_STORAGE_VERSION = 3 as const;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decimal(value: unknown): value is string {
  return (
    typeof value === "string" && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)
  );
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

const PHASES = ["none", "bonding-curve", "graduated"] as const;

function exactOrder(
  order: string[],
  records: Record<string, unknown>,
): boolean {
  const keys = Object.keys(records);
  return (
    order.length === keys.length && keys.every((key) => order.includes(key))
  );
}

const EVENT_KINDS = [
  "Launched",
  "LaunchConfigured",
  "DevBuyExecuted",
  "DevBuySkipped",
  "Graduated",
  "MilestoneHarvested",
  "PayoutPotFunded",
  "PayoutPotRedeemed",
  "PayoutTipPaid",
  "PluginPayoutDelivered",
  "PluginPayoutCarried",
  "PluginPayoutRedirected",
  "CreatorPathAccrued",
  "CreatorPathClaimed",
  "CreatorPathClaimFailed",
  "CreatorClaimed",
  "CreatorAccrued",
  "ProtocolAccrued",
  "ProtocolClaimed",
  "FeesCollected",
  "FeesRouted",
  "BandDeployed",
  "BandSkipped",
  "CurvePositionsDeployed",
  "EconomicConfigSet",
] as const;

function validEvent(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.kind === "string" &&
    (EVENT_KINDS as readonly string[]).includes(value.kind) &&
    typeof value.poolId !== "undefined"
  );
}

function validEvents(value: unknown): value is Record<string, unknown[]> {
  if (!isRecord(value)) return false;
  return Object.values(value).every(
    (list) => Array.isArray(list) && list.every(validEvent),
  );
}

/** Structural validation: invalid or legacy data fails closed to a fresh seed. */
function validateV3(value: unknown): value is DemoDataV3 {
  if (
    !isRecord(value) ||
    value.version !== 3 ||
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

  for (const [key, row] of Object.entries(entities.launches)) {
    if (
      !isRecord(row) ||
      row.poolId !== key ||
      !id(row.slug) ||
      !id(row.name) ||
      !id(row.symbol) ||
      typeof row.token !== "string" ||
      !decimal(row.totalSupplyWei) ||
      !PHASES.includes(row.phase as (typeof PHASES)[number]) ||
      !integer(row.level) ||
      !integer(row.openingLevel) ||
      !integer(row.farLevel) ||
      (row.graduationLevel !== undefined && !integer(row.graduationLevel)) ||
      !/^\d+$/.test(String(row.payoutPlan)) ||
      !decimal(row.payoutPotWei) ||
      !integer(row.completedMilestones, 60) ||
      !iso(row.createdAt)
    )
      return false;
    if (row.metadata !== undefined) {
      if (!isRecord(row.metadata)) return false;
      if (
        typeof row.metadata.description !== "string" ||
        row.metadata.description.length > 500
      )
        return false;
      if (
        row.metadata.logoUrl !== undefined &&
        (typeof row.metadata.logoUrl !== "string" ||
          row.metadata.logoUrl.length > 500)
      )
        return false;
      if (!isRecord(row.metadata.socials)) return false;
      const socials = row.metadata.socials as Record<string, unknown>;
      if (
        !Object.values(socials).every(
          (value) => typeof value === "string" && value.length <= 300,
        )
      )
        return false;
    }
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

  const ACTIVITY_KINDS = [
    "buy",
    "sell",
    "milestone",
    "created",
    "graduated",
    "flush",
    "claim",
  ] as const;
  for (const [key, row] of Object.entries(entities.activities)) {
    if (
      !isRecord(row) ||
      row.id !== key ||
      !hasLaunch(row.launchId) ||
      (row.profileId !== undefined && !hasProfile(row.profileId)) ||
      !ACTIVITY_KINDS.includes(row.kind as (typeof ACTIVITY_KINDS)[number]) ||
      !integer(row.sequence) ||
      !iso(row.occurredAt)
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
      !iso(row.createdAt)
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
      !decimal(row.grossInput) ||
      !decimal(row.feeAmount) ||
      !decimal(row.netOutput) ||
      !integer(row.levelAfter) ||
      !id(row.receiptId) ||
      !integer(row.sequence) ||
      !iso(row.occurredAt)
    )
      return false;
  }

  if (
    !unique(value.watchlist) ||
    !value.watchlist.every(hasLaunch) ||
    !isRecord(value.portfolio) ||
    !hasProfile(value.portfolio.accountProfileId) ||
    !decimal(value.portfolio.ethBalance) ||
    !isRecord(value.portfolio.tokenBalances) ||
    !Object.entries(value.portfolio.tokenBalances).every(
      ([launchId, balance]) => hasLaunch(launchId) && decimal(balance),
    ) ||
    !integer(value.sequence) ||
    !validEvents(value.events)
  )
    return false;
  return true;
}

export function parseStoredDemoState(raw: string | null): DemoDataV3 | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (validateV3(value)) return value;
    return null;
  } catch {
    return null;
  }
}

export function loadDemoState(storage?: StorageLike): DemoDataV3 | null {
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
  data: DemoDataV3,
  storage?: StorageLike,
): boolean {
  const target =
    storage ??
    (typeof window === "undefined" ? undefined : window.localStorage);
  if (!target || !validateV3(data)) return false;
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
