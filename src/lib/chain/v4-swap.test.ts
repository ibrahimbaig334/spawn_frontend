import { describe, expect, it } from "vitest";
import { decodeAbiParameters, decodeFunctionData } from "viem";
import { buildV4SwapCall } from "./v4-swap";
import { universalRouterAbi } from "./abi";

const TOKEN = "0x0000000000000000000000000000000000001234";
const HOOK = "0x0000000000000000000000000000000000000999";
const USER = "0x000000000000000000000000000000000000dead";
const ZERO = "0x0000000000000000000000000000000000000000";

const SWAP_PARAMS = [
  {
    type: "tuple" as const,
    components: [
      {
        type: "tuple" as const,
        name: "key",
        components: [
          { type: "address" as const, name: "currency0" },
          { type: "address" as const, name: "currency1" },
          { type: "uint24" as const, name: "fee" },
          { type: "int24" as const, name: "tickSpacing" },
          { type: "address" as const, name: "hooks" },
        ],
      },
      { type: "bool" as const, name: "zeroForOne" },
      { type: "uint128" as const, name: "amountIn" },
      { type: "uint128" as const, name: "amountOutMinimum" },
      { type: "bytes" as const, name: "hookData" },
    ],
  },
];

interface SwapDecoded {
  key: { currency0: string; currency1: string; fee: number; tickSpacing: number; hooks: string };
  zeroForOne: boolean;
  amountIn: bigint;
  amountOutMinimum: bigint;
}

function decode(call: { data: `0x${string}` }) {
  const fn = decodeFunctionData({ abi: universalRouterAbi, data: call.data });
  if (fn.functionName !== "execute") throw new Error("not execute");
  const commands = fn.args[0];
  const inputs = fn.args[1];
  const inner = decodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    inputs[0] as `0x${string}`,
  );
  const actions = inner[0];
  const params = inner[1];
  return { commands, actions, params };
}

function decodeSwap(param: `0x${string}`): SwapDecoded {
  const decoded = decodeAbiParameters(SWAP_PARAMS, param);
  return decoded[0] as unknown as SwapDecoded;
}

describe("v4 swap calldata", () => {
  it("buy: V4_SWAP command, exact-in settle from user, ETH value attached", () => {
    const amountIn = 10n ** 17n; // 0.1 ETH
    const minOut = 42n * 10n ** 18n;
    const call = buildV4SwapCall({
      token: TOKEN,
      hook: HOOK,
      direction: "buy",
      amountIn,
      amountOutMinimum: minOut,
      recipient: USER,
      payerIsUser: true,
    });
    expect(call.value).toBe(amountIn);
    const { commands, actions, params } = decode(call);
    expect(commands).toBe("0x08");
    expect(actions).toBe("0x060b0e"); // SWAP_EXACT_IN_SINGLE, SETTLE, TAKE
    expect(params.length).toBe(3);

    const swap = decodeSwap(params[0] as `0x${string}`);
    expect(swap.key.currency0).toBe(ZERO);
    expect(swap.key.currency1.toLowerCase()).toBe(TOKEN);
    expect(swap.key.fee).toBe(10_000); // 1% in hundredths of a bip
    expect(swap.key.tickSpacing).toBe(1);
    expect(swap.key.hooks.toLowerCase()).toBe(HOOK);
    expect(swap.zeroForOne).toBe(true);
    expect(swap.amountIn).toBe(amountIn);
    expect(swap.amountOutMinimum).toBe(minOut);

    const settle = decodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "bool" }],
      params[1] as `0x${string}`,
    );
    expect(settle[0]).toBe(ZERO);
    expect(settle[1]).toBe(0n);
    expect(settle[2]).toBe(true);

    const take = decodeAbiParameters(
      [{ type: "address" }, { type: "address" }, { type: "uint256" }],
      params[2] as `0x${string}`,
    );
    expect((take[0] as string).toLowerCase()).toBe(TOKEN);
    expect((take[1] as string).toLowerCase()).toBe(USER);
    expect(take[2]).toBe(0n);
  });

  it("sell: zeroForOne=false, settles token, takes native, no ETH value", () => {
    const call = buildV4SwapCall({
      token: TOKEN,
      hook: HOOK,
      direction: "sell",
      amountIn: 5n * 10n ** 18n,
      amountOutMinimum: 1n,
      recipient: USER,
      payerIsUser: true,
    });
    expect(call.value).toBe(0n);
    const { actions, params } = decode(call);
    expect(actions).toBe("0x060b0e");

    const swap = decodeSwap(params[0] as `0x${string}`);
    expect(swap.zeroForOne).toBe(false);

    const settle = decodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "bool" }],
      params[1] as `0x${string}`,
    );
    expect((settle[0] as string).toLowerCase()).toBe(TOKEN);

    const take = decodeAbiParameters(
      [{ type: "address" }, { type: "address" }, { type: "uint256" }],
      params[2] as `0x${string}`,
    );
    expect(take[0]).toBe(ZERO);
  });

  it("targets a valid router address", () => {
    const call = buildV4SwapCall({
      token: TOKEN,
      hook: HOOK,
      direction: "buy",
      amountIn: 1n,
      amountOutMinimum: 0n,
      recipient: USER,
      payerIsUser: true,
    });
    expect(call.to).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});
