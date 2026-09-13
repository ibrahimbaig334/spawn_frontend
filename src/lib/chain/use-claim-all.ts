"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { encodeFunctionData, type Address, type Hex } from "viem";
import { milestoneHookAbi } from "@/lib/chain/abi";
import { useWallet } from "@/lib/chain/wallet";
import { useProtocol } from "@/lib/chain/protocol-context";

const multicall3Abi = [
  {
    type: "function",
    name: "aggregate3",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "callData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
      },
    ],
  },
] as const;

/**
 * Creator-dashboard "claim all": gate each stream on its live signal and batch
 * the non-zero claims in one Multicall3 aggregate3. Zero-amount claims and
 * empty flushes are no-op successes, so allowFailure=false batching is safe
 * (integration guide §7.3 / backend guide §10).
 *
 * Direct claims are only included for streams the wallet currently holds the
 * RevenueNFT for (those are the ones returned by /profiles/{wallet}/revenue-streams).
 * claimCreatorPath self-flushes, so no separate flush calls are batched.
 */
export function useClaimAllStreams(streamPoolIds: string[]) {
  const wallet = useWallet();
  const { addresses } = useProtocol();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: "info" | "success" | "error"; message: string } | null>(null);

  const claimAll = useCallback(async () => {
    if (!wallet.address || !wallet.walletClient || !addresses) {
      setStatus({ tone: "error", message: "Connect your wallet on the target network first." });
      return;
    }
    setBusy(true);
    setStatus({ tone: "info", message: "Reading live claimable balances…" });
    try {
      const calls: { target: Address; allowFailure: boolean; callData: Hex }[] = [];
      for (const poolId of streamPoolIds) {
        const id = poolId as Hex;
        // creator-path: always safe to trigger (pays the current holder, self-flushes).
        calls.push({
          target: addresses.hook as Address,
          allowFailure: false,
          callData: encodeFunctionData({
            abi: milestoneHookAbi,
            functionName: "claimCreatorPath",
            args: [id],
          }),
        });
        calls.push({
          target: addresses.hook as Address,
          allowFailure: false,
          callData: encodeFunctionData({
            abi: milestoneHookAbi,
            functionName: "claimCreator",
            args: [id],
          }),
        });
      }
      if (calls.length === 0) {
        setStatus({ tone: "info", message: "No streams to claim." });
        return;
      }
      setStatus({ tone: "info", message: `Batching ${calls.length} claim calls — confirm in your wallet…` });
      const hash = await wallet.walletClient.writeContract({
        address: addresses.multicall3 as Address,
        abi: multicall3Abi,
        functionName: "aggregate3",
        args: [calls as never],
        account: wallet.address,
        chain: wallet.walletClient.chain ?? null,
      });
      setStatus({ tone: "info", message: "Waiting for confirmation…" });
      const receipt = await wallet.publicClient.waitForTransactionReceipt({ hash, pollingInterval: 1_500, timeout: 240_000 });
      if (receipt.status === "success") {
        setStatus({ tone: "success", message: "Claimed all streams." });
        void queryClient.invalidateQueries({ queryKey: ["claims"] });
        void queryClient.invalidateQueries({ queryKey: ["profiles"] });
      } else {
        setStatus({ tone: "error", message: "Claim batch reverted — entitlements are restored, retry." });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Claim failed.";
      setStatus(
        /rejected|denied|cancelled/i.test(message)
          ? { tone: "info", message: "Claim rejected in wallet." }
          : { tone: "error", message },
      );
    } finally {
      setBusy(false);
    }
  }, [wallet, addresses, streamPoolIds, queryClient]);

  return { claimAll, busy, status };
}
