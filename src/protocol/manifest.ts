/**
 * Deployment manifest loader.
 *
 * START-HERE rule #1: no Spawn addresses exist yet. When deployment happens,
 * `script/Deploy.s.sol` writes `deployments/<chainId>.json` and every frontend
 * must consume addresses ONLY from that manifest — never hardcoded. Until a
 * manifest is provided at runtime, the client layer reports
 * `deployment: "unconfigured"` and the UI stays in local-simulation mode.
 *
 * The manifest shape below follows the handoff description: every address,
 * the hook salt, the canonical payout plan, and the template + economics
 * snapshot, with WAD-sized values as decimal strings (never JS numbers).
 */

export type HexAddress = `0x${string}`;
export type Hex32 = `0x${string}`;

export interface DeploymentManifest {
  chainId: number;
  /** MilestoneHook — the only stateful entry point; everything routes here. */
  hook: HexAddress;
  /** LaunchSupport — digests, validation, CREATE2 token prediction. */
  launchSupport: HexAddress;
  /** RevenueNFT — creator revenue claim right per launch (ERC-721). */
  revenueNFT: HexAddress;
  /** PayoutPluginRegistry — append-only, stable indices 0-255. */
  payoutPluginRegistry: HexAddress;
  /** ProtocolController — timelocked governance. */
  protocolController: HexAddress;
  /** Reference buyback-and-burn plugin (registry index 0). */
  buybackAndBurnPlugin: HexAddress;
  /** Hook salt + canonical payout plan snapshot. */
  hookSalt: Hex32;
  canonicalPayoutPlan: string;
  /** Uniswap v4 periphery on this chain (record once verified). */
  stateView?: HexAddress;
  v4Quoter?: HexAddress;
}

const KNOWN_MANIFEST_SOURCES = [
  "/deployments/manifest.json",
  "/spawn/deployments/manifest.json",
] as const;

function isHexAddress(value: unknown): value is HexAddress {
  return (
    typeof value === "string" &&
    /^0x[0-9a-fA-F]{40}$/.test(value)
  );
}

function isHex32(value: unknown): value is Hex32 {
  return (
    typeof value === "string" &&
    /^0x[0-9a-fA-F]{64}$/.test(value)
  );
}

function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

/** Structural validation: an invalid manifest must fail closed, never load. */
export function parseDeploymentManifest(
  raw: unknown,
): DeploymentManifest | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  if (
    typeof value.chainId !== "number" ||
    !Number.isSafeInteger(value.chainId) ||
    value.chainId <= 0
  )
    return null;
  if (
    !isHexAddress(value.hook) ||
    !isHexAddress(value.launchSupport) ||
    !isHexAddress(value.revenueNFT) ||
    !isHexAddress(value.payoutPluginRegistry) ||
    !isHexAddress(value.protocolController) ||
    !isHexAddress(value.buybackAndBurnPlugin) ||
    !isHex32(value.hookSalt) ||
    !isDecimalString(value.canonicalPayoutPlan)
  )
    return null;
  if (
    (value.stateView !== undefined && !isHexAddress(value.stateView)) ||
    (value.v4Quoter !== undefined && !isHexAddress(value.v4Quoter))
  )
    return null;
  return {
    chainId: value.chainId,
    hook: value.hook,
    launchSupport: value.launchSupport,
    revenueNFT: value.revenueNFT,
    payoutPluginRegistry: value.payoutPluginRegistry,
    protocolController: value.protocolController,
    buybackAndBurnPlugin: value.buybackAndBurnPlugin,
    hookSalt: value.hookSalt,
    canonicalPayoutPlan: value.canonicalPayoutPlan,
    stateView: value.stateView,
    v4Quoter: value.v4Quoter,
  };
}

/**
 * Fetch a manifest from the well-known runtime locations. Returns null when
 * no deployment exists yet (the expected state until the protocol ships).
 */
export async function loadDeploymentManifest(): Promise<DeploymentManifest | null> {
  for (const source of KNOWN_MANIFEST_SOURCES) {
    try {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) continue;
      const manifest = parseDeploymentManifest(await response.json());
      if (manifest) return manifest;
    } catch {
      // Network/parse failures just mean "no manifest here".
    }
  }
  return null;
}
