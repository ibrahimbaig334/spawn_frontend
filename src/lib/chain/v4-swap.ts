import {
  type Address,
  type Hex,
  encodeAbiParameters,
  encodeFunctionData,
  concat,
  numberToHex,
  slice,
} from "viem";
import { NATIVE_ETH, POOL_KEY_TUPLE, universalRouterAbi, type PoolKey } from "@/lib/chain/abi";


/**
 * Uniswap v4 swap calldata for the Universal Router, built directly with viem.
 *
 * Spawn pools are ETH (currency0 = address(0)) vs token (currency1), 1% static
 * fee (fee = 10000 hundredths-of-a-bip), tickSpacing 1, MilestoneHook. Buys use
 * zeroForOne=true (ETH in, token out); sells zeroForOne=false.
 *
 * We emit the single V4_SWAP command whose sub-actions are
 * SWAP_EXACT_IN_SINGLE -> SETTLE (payerIsUser) -> TAKE (recipient), matching the
 * V4Planner output produced by @uniswap/v4-sdk for a native-exact-in swap.
 */

// V4Planner action bytes.
const ACTION_SWAP_EXACT_IN_SINGLE = 6;
const ACTION_SETTLE = 11;
const ACTION_TAKE = 14;
const COMMAND_V4_SWAP = 8; // V4Router.SWAP_* live under the V4_SWAP top command

const SWAP_EXACT_IN_SINGLE_STRUCT = {
  type: "tuple",
  components: [
    POOL_KEY_TUPLE,
    { name: "zeroForOne", type: "bool" },
    { name: "amountIn", type: "uint128" },
    { name: "amountOutMinimum", type: "uint128" },
    { name: "hookData", type: "bytes" },
  ],
} as const;

export interface BuildSwapParams {
  token: Address;
  hook: Address;
  /** ETH wei for buys; raw token units for sells. */
  amountIn: bigint;
  /** Slippage-adjusted minimum output (wei ETH or raw token units). */
  amountOutMinimum: bigint;
  direction: "buy" | "sell";
  recipient: Address;
  /** Validated Universal Router address (use routerAddress(); never raw env). */
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

function v4CommandByte(): Hex {
  return numberToHex(COMMAND_V4_SWAP, { size: 1 });
}

function actionByte(action: number): Hex {
  return numberToHex(action, { size: 1 });
}

/** ABI-encode a single V4 action's params blob (the `params[]` entries). */
function encodeSwapAction(p: {
  poolKey: PoolKey;
  zeroForOne: boolean;
  amountIn: bigint;
  amountOutMinimum: bigint;
}): Hex {
  return encodeAbiParameters([SWAP_EXACT_IN_SINGLE_STRUCT], [
    {
      key: p.poolKey,
      zeroForOne: p.zeroForOne,
      amountIn: p.amountIn,
      amountOutMinimum: p.amountOutMinimum,
      hookData: "0x" as Hex,
    },
  ]);
}

function encodeSettleAction(currency: Address, amount: bigint, payerIsUser: boolean): Hex {
  return encodeAbiParameters(
    [
      { name: "currency", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "payerIsUser", type: "bool" },
    ],
    [currency, amount, payerIsUser],
  );
}

function encodeTakeAction(currency: Address, recipient: Address, amount: bigint): Hex {
  return encodeAbiParameters(
    [
      { name: "currency", type: "address" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    [currency, recipient, amount],
  );
}

/**
 * Builds a single-hop V4Router exact-input swap executing through the Universal
 * Router. amount = 0 in SETTLE/TAKE means "settle/take the whole swap delta",
 * which is what a native single swap uses.
 */
export function buildV4SwapCall(params: BuildSwapParams): SwapCall {
  const zeroForOne = params.direction === "buy";
  const poolKey: PoolKey = {
    currency0: NATIVE_ETH,
    currency1: params.token,
    fee: params.fee ?? 10_000,
    tickSpacing: params.tickSpacing ?? 1,
    hooks: params.hook,
  };

  // For a buy the input currency is native ETH (currency0); the output is token.
  // For a sell the input is the token (currency1); output is native ETH.
  const inputCurrency = zeroForOne ? NATIVE_ETH : params.token;
  const outputCurrency = zeroForOne ? params.token : NATIVE_ETH;

  const actions = concat([
    actionByte(ACTION_SWAP_EXACT_IN_SINGLE),
    actionByte(ACTION_SETTLE),
    actionByte(ACTION_TAKE),
  ]);

  const encodedSwap = encodeSwapAction({
    poolKey,
    zeroForOne,
    amountIn: params.amountIn,
    amountOutMinimum: params.amountOutMinimum,
  });
  // amount 0 => router settles/takes the full swap delta against the user.
  const encodedSettle = encodeSettleAction(inputCurrency, 0n, params.payerIsUser);
  const encodedTake = encodeTakeAction(outputCurrency, params.recipient, 0n);

  const inputs = [encodedSwap, encodedSettle, encodedTake];

  // V4_SWAP sub-command wraps (actions, params[]) into a single `bytes` input for
  // the Universal Router execute() call.
  const v4SwapInput = encodeAbiParameters(
    [
      { name: "actions", type: "bytes" },
      { name: "params", type: "bytes[]" },
    ],
    [actions, inputs],
  );

  const data = encodeFunctionData({
    abi: universalRouterAbi,
    functionName: "execute",
    args: [v4CommandByte(), [v4SwapInput]],
  });

  return {
    to: params.routerAddress,
    data,
    // Buys carry the exact ETH input as value; sells carry none.
    value: zeroForOne ? params.amountIn : 0n,
  };
}

/** Commands/inputs helpers kept in case multi-action batches are needed later. */
export function decodeCommandByte(commands: Hex, index: number): number {
  const bytes = slice(commands, index, index + 1);
  return Number(bytes);
}

export { ACTION_SWAP_EXACT_IN_SINGLE, ACTION_SETTLE, ACTION_TAKE, COMMAND_V4_SWAP };
