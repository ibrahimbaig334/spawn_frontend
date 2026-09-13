import { erc20Abi, type Address, type Hex, type PublicClient, type WalletClient } from "viem";
import { milestoneHookAbi, NATIVE_ETH, type PoolKey } from "@/lib/chain/abi";
import { buildV4SwapCall, type SwapCall } from "@/lib/chain/v4-swap";

/**
 * On-chain write helpers for trade execution and the permissionless protocol
 * actions (graduate, flush, claims). Every amount is raw wei/token units; the
 * quote that produces amountOutMinimum must come from the backend `/quote`
 * (which runs the real hook beforeSwap), never a client-side approximation.
 */

export function spawnPoolKey(token: Address, hook: Address, fee = 10_000, tickSpacing = 1): PoolKey {
  return { currency0: NATIVE_ETH, currency1: token, fee, tickSpacing, hooks: hook };
}

export interface ExecuteSwapArgs {
  token: Address;
  hook: Address;
  direction: "buy" | "sell";
  amountIn: bigint;
  amountOutMinimum: bigint;
  walletClient: WalletClient;
  publicClient: PublicClient;
  account: Address;
  routerAddress: Address;
  multicall3: Address;
}

/** Ensures the router may spend `amountIn` of the token (sells). No-op for buys. */
export async function ensureTokenAllowance(
  args: Pick<ExecuteSwapArgs, "token" | "routerAddress" | "walletClient" | "publicClient" | "account" | "amountIn">,
): Promise<Hex | null> {
  const allowance = (await args.publicClient.readContract({
    address: args.token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [args.account, args.routerAddress],
  })) as bigint;
  if (allowance >= args.amountIn) return null;
  return args.walletClient.writeContract({
    address: args.token,
    abi: erc20Abi,
    functionName: "approve",
    chain: args.walletClient.chain ?? null,
    args: [args.routerAddress, args.amountIn],
    account: args.account,
  });
}

export function buildSwapCall(args: ExecuteSwapArgs): SwapCall {
  return buildV4SwapCall({
    token: args.token,
    hook: args.hook,
    direction: args.direction,
    amountIn: args.amountIn,
    amountOutMinimum: args.amountOutMinimum,
    recipient: args.account,
    routerAddress: args.routerAddress,
    payerIsUser: true,
  });
}

/** Sends the swap. Approves first when selling. Returns the tx hash. */
export async function executeSwap(args: ExecuteSwapArgs): Promise<Hex> {
  if (args.direction === "sell") {
    await ensureTokenAllowance(args);
  }
  const call = buildSwapCall(args);
  return args.walletClient.sendTransaction({
    account: args.account,
    chain: args.walletClient.chain ?? null,
    to: call.to,
    data: call.data,
    value: call.value,
  });
}

/** Permissionless, idempotent graduation trigger. */
export async function graduatePool(args: {
  hook: Address;
  token: Address;
  walletClient: WalletClient;
  account: Address;
}): Promise<Hex> {
  return args.walletClient.writeContract({
    address: args.hook,
    abi: milestoneHookAbi,
    functionName: "graduate",
    chain: args.walletClient.chain ?? null,
    account: args.account,
    args: [spawnPoolKey(args.token, args.hook)],
  });
}

/** flushTo keeps the 1% tip at the caller unless tipTo is provided. */
export async function flushPool(args: {
  hook: Address;
  poolId: Hex;
  tipTo: Address;
  walletClient: WalletClient;
  account: Address;
}): Promise<Hex> {
  return args.walletClient.writeContract({
    address: args.hook,
    abi: milestoneHookAbi,
    functionName: "flushTo",
    chain: args.walletClient.chain ?? null,
    account: args.account,
    args: [args.poolId, args.tipTo],
  });
}

export async function claimCreator(args: {
  hook: Address;
  poolId: Hex;
  walletClient: WalletClient;
  account: Address;
}): Promise<Hex> {
  return args.walletClient.writeContract({
    address: args.hook,
    abi: milestoneHookAbi,
    functionName: "claimCreator",
    chain: args.walletClient.chain ?? null,
    account: args.account,
    args: [args.poolId],
  });
}

/** Self-flushes the pot then pays the current RevenueNFT holder. */
export async function claimCreatorPath(args: {
  hook: Address;
  poolId: Hex;
  walletClient: WalletClient;
  account: Address;
}): Promise<Hex> {
  return args.walletClient.writeContract({
    address: args.hook,
    abi: milestoneHookAbi,
    functionName: "claimCreatorPath",
    chain: args.walletClient.chain ?? null,
    account: args.account,
    args: [args.poolId],
  });
}

/** Collects accrued full-range fees (permissionless; no-op at zero). */
export async function collectFees(args: {
  hook: Address;
  token: Address;
  walletClient: WalletClient;
  account: Address;
}): Promise<Hex> {
  return args.walletClient.writeContract({
    address: args.hook,
    abi: milestoneHookAbi,
    functionName: "collectFees",
    chain: args.walletClient.chain ?? null,
    account: args.account,
    args: [spawnPoolKey(args.token, args.hook)],
  });
}
