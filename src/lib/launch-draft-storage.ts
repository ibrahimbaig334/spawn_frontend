import { PROTOCOL_TERMS } from "@/data/protocol-terms";
import type { LaunchDraft } from "@/domain/launch-validation";
import type { ProceedsSplit } from "@/types/protocol";

export const LAUNCH_DRAFT_STORAGE_KEY = "spawn.launch-draft";
export const LAUNCH_DRAFT_STORAGE_VERSION = 2 as const;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type LegacySplit = {
  creator: number;
  removal: number;
  spawn: number;
  trading: number;
};

interface StoredDraftV2 {
  version: 2;
  draft: LaunchDraft;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function validSplit(value: unknown, keys: readonly string[]): boolean {
  if (!isRecord(value) || Object.keys(value).length !== keys.length)
    return false;
  const shares = keys.map((key) => value[key]);
  return (
    shares.every((share) => integer(share, 10_000)) &&
    shares.reduce<number>((sum, share) => sum + Number(share), 0) === 10_000
  );
}

function validDraft(
  value: unknown,
  splitKeys: readonly string[],
): value is Record<string, unknown> &
  Omit<LaunchDraft, "split"> & { split: ProceedsSplit | LegacySplit } {
  if (!isRecord(value) || !validSplit(value.split, splitKeys)) return false;
  return (
    typeof value.name === "string" &&
    typeof value.symbol === "string" &&
    typeof value.supply === "string" &&
    typeof value.description === "string" &&
    typeof value.creatorPurchaseEnabled === "boolean" &&
    integer(value.creatorPurchaseBps, PROTOCOL_TERMS.maxCreatorPurchaseBps) &&
    integer(value.lockupMonths, PROTOCOL_TERMS.maxLockupMonths) &&
    typeof value.acknowledged === "boolean"
  );
}

function withoutAcknowledgement(draft: LaunchDraft): LaunchDraft {
  return { ...draft, split: { ...draft.split }, acknowledged: false };
}

export function parseStoredLaunchDraft(raw: string | null): LaunchDraft | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || !isRecord(value.draft)) return null;
    const currentKeys = [
      "creator",
      "buyback",
      "protocol",
      "liquidity",
    ] as const;
    if (value.version === 2 && validDraft(value.draft, currentKeys)) {
      return withoutAcknowledgement(value.draft as LaunchDraft);
    }
    const legacyKeys = ["creator", "removal", "spawn", "trading"] as const;
    if (value.version === 1 && validDraft(value.draft, legacyKeys)) {
      const legacy = value.draft.split as LegacySplit;
      return withoutAcknowledgement({
        ...(value.draft as unknown as LaunchDraft),
        split: {
          creator: legacy.creator,
          buyback: legacy.removal,
          protocol: legacy.spawn,
          liquidity: legacy.trading,
        },
      });
    }
    return null;
  } catch {
    return null;
  }
}

export function loadLaunchDraft(storage?: StorageLike): LaunchDraft | null {
  const target =
    storage ??
    (typeof window === "undefined" ? undefined : window.localStorage);
  if (!target) return null;
  try {
    return parseStoredLaunchDraft(target.getItem(LAUNCH_DRAFT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveLaunchDraft(
  draft: LaunchDraft,
  storage?: StorageLike,
): boolean {
  const target =
    storage ??
    (typeof window === "undefined" ? undefined : window.localStorage);
  if (
    !target ||
    !validDraft(draft, ["creator", "buyback", "protocol", "liquidity"])
  )
    return false;
  const value: StoredDraftV2 = {
    version: LAUNCH_DRAFT_STORAGE_VERSION,
    draft: withoutAcknowledgement(draft),
  };
  try {
    target.setItem(LAUNCH_DRAFT_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearLaunchDraft(storage?: StorageLike): boolean {
  const target =
    storage ??
    (typeof window === "undefined" ? undefined : window.localStorage);
  if (!target) return false;
  try {
    target.removeItem(LAUNCH_DRAFT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
