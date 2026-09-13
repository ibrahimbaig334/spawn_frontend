import { describe, expect, it } from "vitest";
import { decodeFunctionData } from "viem";
import { buildV4SwapCall } from "./v4-swap";
import { swapRouterAbi } from "./abi";

const TOKEN = "0x0000000000000000000000000000000000001234";
const HOOK = "0x0000000000000000000000000000000000000999";
const USER = "0x000000000000000000000000000000000000dead";
const ROUTER = "0x000000000000000000000000000000000000bEEF";
const ZERO = "0x0000000000000000000000000000000000000000";

function decode(call: { data: `0x${string}` }) {
  const fn = decodeFunctionData({ abi: swapRouterAbi, data: call.data });
  if (fn.functionName !== "swapExactIn") throw new Error("not swapExactIn");
  const [key, zeroForOne, amountIn, amountOutMinimum, recipient] = fn.args as unknown as [
    { currency0: string; currency1: string; fee: number; tickSpacing: number; hooks: string },
    boolean,
    bigint,
    bigint,
    string,
  ];
  return { key, zeroForOne, amountIn, amountOutMinimum, recipient };
}

describe("swap calldata", () => {
  it("buy: ETH pool key, zeroForOne, ETH value attached", () => {
    const amountIn = 10n ** 17n; // 0.1 ETH
    const minOut = 42n * 10n ** 18n;
    const call = buildV4SwapCall({
      token: TOKEN,
      hook: HOOK,
      direction: "buy",
      amountIn,
      amountOutMinimum: minOut,
      recipient: USER,
      routerAddress: ROUTER,
      payerIsUser: true,
    });
    expect(call.value).toBe(amountIn);
    expect(call.to).toBe(ROUTER);
    const decoded = decode(call);
    expect(decoded.key.currency0).toBe(ZERO);
    expect(decoded.key.currency1.toLowerCase()).toBe(TOKEN);
    expect(decoded.key.fee).toBe(10_000); // 1% in hundredths of a bip
    expect(decoded.key.tickSpacing).toBe(1);
    expect(decoded.key.hooks.toLowerCase()).toBe(HOOK);
    expect(decoded.zeroForOne).toBe(true);
    expect(decoded.amountIn).toBe(amountIn);
    expect(decoded.amountOutMinimum).toBe(minOut);
    expect(decoded.recipient.toLowerCase()).toBe(USER);
  });

  it("sell: zeroForOne=false, token key, no ETH value", () => {
    const call = buildV4SwapCall({
      token: TOKEN,
      hook: HOOK,
      direction: "sell",
      amountIn: 5n * 10n ** 18n,
      amountOutMinimum: 1n,
      recipient: USER,
      routerAddress: ROUTER,
      payerIsUser: true,
    });
    expect(call.value).toBe(0n);
    expect(call.to).toBe(ROUTER);
    const decoded = decode(call);
    expect(decoded.zeroForOne).toBe(false);
    expect(decoded.amountIn).toBe(5n * 10n ** 18n);
    expect(decoded.recipient.toLowerCase()).toBe(USER);
  });
});
