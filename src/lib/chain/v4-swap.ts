import { type Address, type Hex, encodeFunctionData } from "viem";
import { NATIVE_ETH, swapRouterAbi, type PoolKey } from "@/lib/chain/abi";

/**
 * Spawn swap calldata for the per-chain SpawnSwapRouter
 * (`swapRouter` in deployments/<chainId>.json).
 *
 * Spawn pools are ETH (currency0 = address(0)) vs token (currency1), 1% static
 * fee (fee = 10000 hundredths-of-a-bip), tickSpacing 1. Buys use
 * zeroForOne=true (ETH in, token out); sells zeroForOne=false. The router
 * settles the input leg (native from msg.value, ERC-20 via allowance),
 * enforces the slippage guard, and sends output straight to the recipient.
 */

export interface BuildSwapParams {
  token: Address;
  hook: Address;
  /** ETH wei for buys; raw token units for sells. */
  amountIn: bigint;
  /** Slippage-adjusted minimum output (wei ETH or raw token units). */
  amountOutMinimum: bigint;
  direction: "buy" | "sell";
  recipient: Address;
  /** Validated swap router address (use routerAddress(); never raw env). */
  routerAddress: Address;
  /** The account spending; for sells the caller must have approved the router. */
  payerIsUser: boolean;
  /** fee (hundredths of a bip) and tickSpacing; default Spawn's 1% / 1. */
  fee?: number;
  tickSpacing?: number;
}

export interface SwapCall {
  to: Address;
  data: Hex;
  /** ETH to attach: the exact input on buys, 0 on sells. */
  value: bigint;
}

/** Builds the SpawnSwapRouter.swapExactIn call. */
export function buildV4SwapCall(params: BuildSwapParams): SwapCall {
  const zeroForOne = params.direction === "buy";
  const poolKey: PoolKey = {
    currency0: NATIVE_ETH,
    currency1: params.token,
    fee: params.fee ?? 10_000,
    tickSpacing: params.tickSpacing ?? 1,
    hooks: params.hook,
  };

  const data = encodeFunctionData({
    abi: swapRouterAbi,
    functionName: "swapExactIn",
    args: [poolKey, zeroForOne, params.amountIn, params.amountOutMinimum, params.recipient],
  });

  return {
    to: params.routerAddress,
    data,
    // Buys carry the exact ETH input as value; sells carry none.
    value: zeroForOne ? params.amountIn : 0n,
  };
}
