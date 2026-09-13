/**
 * Runtime configuration. All values are NEXT_PUBLIC_* so the browser bundle
 * reads them directly; defaults match the local backend (API :3000/api/v1,
 * WS broadcaster :3001/ws) and Base mainnet.
 */
import { getAddress, type Address } from "viem";

function required(name: string, value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export const APP_ENV = {
  apiBaseUrl: required(
    "NEXT_PUBLIC_API_BASE_URL",
    process.env.NEXT_PUBLIC_API_BASE_URL,
    "http://localhost:3000/api/v1",
  ),
  wsUrl: required(
    "NEXT_PUBLIC_WS_URL",
    process.env.NEXT_PUBLIC_WS_URL,
    "ws://localhost:3001/ws",
  ),
  chainId: Number(
    required("NEXT_PUBLIC_CHAIN_ID", process.env.NEXT_PUBLIC_CHAIN_ID, "8453"),
  ),
  rpcUrl: required(
    "NEXT_PUBLIC_RPC_URL",
    process.env.NEXT_PUBLIC_RPC_URL,
    "https://mainnet.base.org",
  ),
  /**
   * Uniswap v4 Universal Router for on-chain swaps. Empty unless explicitly
   * configured per chain: a mainnet default here would point at an address
   * with nothing deployed (and a wrong checksum crashes viem outright).
   */
  universalRouterAddress: required(
    "NEXT_PUBLIC_UNIVERSAL_ROUTER_ADDRESS",
    process.env.NEXT_PUBLIC_UNIVERSAL_ROUTER_ADDRESS,
    "",
  ),
  explorerBase: required(
    "NEXT_PUBLIC_EXPLORER_BASE_URL",
    process.env.NEXT_PUBLIC_EXPLORER_BASE_URL,
    "https://basescan.org",
  ),
  /** Gateway used to display `ipfs://` images (uploads are pinned via the backend). */
  ipfsGateway: required(
    "NEXT_PUBLIC_IPFS_GATEWAY",
    process.env.NEXT_PUBLIC_IPFS_GATEWAY,
    "https://gateway.pinata.cloud/ipfs",
  ),
} as const;

export function explorerTx(hash: string): string {
  return `${APP_ENV.explorerBase}/tx/${hash}`;
}

export function explorerAddress(address: string): string {
  return `${APP_ENV.explorerBase}/address/${address}`;
}

/**
 * Checksummed swap-router address, or null when none is configured (or the
 * configured value is malformed). Callers must gate on-chain swaps on null:
 * sending to an undeployed/mistyped router is what crashed viem outright.
 */
export function routerAddress(): Address | null {
  const raw = APP_ENV.universalRouterAddress.trim();
  if (!raw) return null;
  try {
    return getAddress(raw);
  } catch {
    return null;
  }
}
