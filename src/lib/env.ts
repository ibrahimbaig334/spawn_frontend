/**
 * Runtime configuration. All values are NEXT_PUBLIC_* so the browser bundle
 * reads them directly; defaults match the local backend (API :3000/api/v1,
 * WS broadcaster :3001/ws) and Base mainnet.
 */

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
  /** Uniswap v4 Universal Router (canonical deployment; override per chain via env). */
  universalRouterAddress: required(
    "NEXT_PUBLIC_UNIVERSAL_ROUTER_ADDRESS",
    process.env.NEXT_PUBLIC_UNIVERSAL_ROUTER_ADDRESS,
    "0x6f3E82184dd8326224222466D586F30226284F69",
  ),
  explorerBase: required(
    "NEXT_PUBLIC_EXPLORER_BASE_URL",
    process.env.NEXT_PUBLIC_EXPLORER_BASE_URL,
    "https://basescan.org",
  ),
} as const;

export function explorerTx(hash: string): string {
  return `${APP_ENV.explorerBase}/tx/${hash}`;
}

export function explorerAddress(address: string): string {
  return `${APP_ENV.explorerBase}/address/${address}`;
}
