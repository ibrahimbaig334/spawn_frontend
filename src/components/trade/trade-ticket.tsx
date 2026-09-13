"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther, parseEther, erc20Abi, type Address } from "viem";
import { Button, Dialog, SelectField, StatusMessage, StatusRegion } from "@/components/ui";
import { qk, usePrice, useQuote } from "@/lib/queries";
import { useWallet } from "@/lib/chain/wallet";
import { useProtocol } from "@/lib/chain/protocol-context";
import { executeSwap } from "@/lib/chain/trades";
import { applySlippBps, formatCompactEth, wei } from "@/lib/display";
import { formatSubscriptPrice, truncateDecimals } from "@/lib/format";
import { APP_ENV, explorerTx } from "@/lib/env";
import type { TokenStatus } from "@/lib/api/dto";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const SLIPPAGE_OPTIONS = [50, 100, 300] as const;

type Side = "buy" | "sell";

export interface TradeTicketProps {
  tokenRef: string;
  token: Address;
  symbol: string;
  status: TokenStatus;
  farLevel: number;
}

function humanPrice(priceEth: string | null): string {
  if (!priceEth) return "—";
  return `${formatSubscriptPrice(priceEth)} ETH`;
}

export function TradeTicket({ tokenRef, token, symbol, status, farLevel }: TradeTicketProps) {
  const wallet = useWallet();
  const protocol = useProtocol();
  const queryClient = useQueryClient();
  const [side, setSide] = useState<Side>("buy");
  const [amountText, setAmountText] = useState("");
  const [slippageBps, setSlippageBps] = useState<number>(100);
  const [confirming, setConfirming] = useState(false);
  const [phase, setPhase] = useState<"idle" | "approving" | "submitting" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const price = usePrice(tokenRef, 8_000);
  const graduationNext =
    status === "bonding" && !!price.data && price.data.level >= farLevel - 1;

  const amountInWei = useMemo(() => {
    try {
      return parseEther(amountText || "0");
    } catch {
      return null;
    }
  }, [amountText]);

  const amountValid = amountInWei !== null && amountInWei > 0n;

  const quote = useQuote(
    tokenRef,
    side === "buy" ? "BUY" : "SELL",
    amountInWei !== null ? amountInWei.toString() : "0",
    amountValid,
  );

  // Balances: ETH from wallet context; token balance from chain (authoritative).
  const tokenBalance = useQuery({
    queryKey: ["token-balance", token, wallet.address],
    queryFn: async () => {
      if (!wallet.address) return 0n;
      return (await wallet.publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet.address],
      })) as bigint;
    },
    enabled: Boolean(wallet.address),
    refetchInterval: 8_000,
  });

  const ethBalanceWei = wallet.ethBalance ? parseEther(wallet.ethBalance) : 0n;
  const balance = side === "buy" ? ethBalanceWei : wei(tokenBalance.data?.toString());
  const balanceLabel = side === "buy" ? `${truncateDecimals(wallet.ethBalance ?? "0")} ETH` : `${truncateDecimals(formatEther(balance))} ${symbol}`;
  const insufficient = amountValid && BigInt(amountInWei ?? 0n) > balance;

  const reset = useCallback(() => {
    setPhase("idle");
    setError(null);
    setTxHash(null);
  }, []);

  async function submit() {
    const addrs = protocol.addresses;
    if (!wallet.address || !wallet.walletClient || amountInWei === null || !quote.data || !addrs) return;
    if (!addrs.hook) {
      setError("The protocol is not deployed on this chain yet.");
      return;
    }
    reset();
    setConfirming(false);
    const amountOut = wei(quote.data.amountOut);
    const amountOutMinimum = applySlippBps(amountOut, slippageBps);
    try {
      setPhase(side === "sell" ? "approving" : "submitting");
      const hash = await executeSwap({
        token,
        hook: addrs.hook as Address,
        direction: side,
        amountIn: amountInWei,
        amountOutMinimum,
        walletClient: wallet.walletClient,
        publicClient: wallet.publicClient,
        account: wallet.address,
        routerAddress: APP_ENV.universalRouterAddress as Address,
        multicall3: addrs.multicall3 as Address,
      });
      setPhase("pending");
      setTxHash(hash);
      const receipt = await wallet.publicClient.waitForTransactionReceipt({
        hash,
        pollingInterval: 1_500,
        timeout: 240_000,
      });
      if (receipt.status !== "success") {
        setError("Transaction reverted on-chain (price moved or the hook rejected it). Re-quote and retry — do not pad slippage.");
        setPhase("idle");
      } else {
        setPhase("done");
        setAmountText("");
        void queryClient.invalidateQueries({ queryKey: ["token-balance", token, wallet.address] });
        void queryClient.invalidateQueries({ queryKey: qk.price(tokenRef) });
        void queryClient.invalidateQueries({ queryKey: ["tokens", tokenRef] });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Transaction failed.";
      setError(
        /user rejected|denied|rejected|cancelled/i.test(message)
          ? "You rejected the transaction in your wallet."
          : message,
      );
      setPhase("idle");
    }
  }

  // Auto-close success state
  useEffect(() => {
    if (phase !== "done") return;
    const id = setTimeout(reset, 6_000);
    return () => clearTimeout(id);
  }, [phase, reset]);

  const busy = phase === "approving" || phase === "submitting" || phase === "pending";
  const quoteOut = quote.data ? wei(quote.data.amountOut) : null;
  const effectiveQuote =
    quoteOut !== null && amountValid
      ? side === "buy"
        ? `≈ ${formatCompactEth(quoteOut.toString(), 0)} ${symbol} for ${truncateDecimals(amountText)} ETH`
        : `≈ ${truncateDecimals(formatEther(quoteOut))} ETH`
      : null;

  return (
    <section className="grid gap-4 rounded-lg border-2 border-ink bg-paper p-4" aria-label="Trade ticket">
      <div className="grid grid-cols-2 gap-1 rounded-sm border-2 border-ink p-1" role="tablist" aria-label="Trade direction">
        {(["buy", "sell"] as const).map((option) => (
          <button
            key={option}
            role="tab"
            aria-selected={side === option}
            type="button"
            className={[
              "min-h-10 cursor-pointer rounded-sm border-0 py-2 text-sm font-black uppercase tracking-wide",
              side === option
                ? option === "buy"
                  ? "bg-accent text-carbon"
                  : "bg-error text-inverse"
                : "bg-transparent text-ink-muted",
            ].join(" ")}
            onClick={() => {
              setSide(option);
              setAmountText("");
              reset();
            }}
          >
            {option === "buy" ? `Buy ${symbol}` : `Sell ${symbol}`}
          </button>
        ))}
      </div>

      <div className="grid gap-1.5">
        <label className="flex items-baseline justify-between text-sm font-bold text-ink" htmlFor="trade-amount">
          <span>{side === "buy" ? "Amount in ETH" : `Amount in ${symbol}`}</span>
          <span className="font-mono text-xs font-semibold text-ink-muted">
            Balance: {wallet.address ? balanceLabel : "—"}
          </span>
        </label>
        <div className="flex items-stretch rounded-sm border-2 border-ink-muted bg-raised focus-within:border-focus">
          <input
            id="trade-amount"
            inputMode="decimal"
            autoComplete="off"
            className="min-h-12 w-full min-w-0 border-0 bg-transparent px-3 text-lg font-bold text-ink outline-none"
            placeholder="0.0"
            type="text"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value.replace(/[^0-9.]/g, ""))}
          />
          <button
            className="mx-2 my-2 shrink-0 cursor-pointer rounded-sm border border-ink bg-transparent px-2 text-xs font-bold text-ink hover:bg-ink hover:text-inverse"
            type="button"
            onClick={() => {
              if (side === "buy") {
                setAmountText(formatEther((ethBalanceWei > 2_000_000_000_000_000n ? ethBalanceWei - 2_000_000_000_000_000n : 0n)));
              } else {
                setAmountText(formatEther(tokenBalance.data ?? 0n));
              }
            }}
          >
            MAX
          </button>
        </div>
        {side === "buy" ? (
          <div className="flex gap-1.5">
            {["0.1", "0.25", "0.5", "1"].map((value) => (
              <button
                key={value}
                type="button"
                className="min-h-8 cursor-pointer rounded-sm border border-rule bg-transparent px-2 font-mono text-xs font-bold text-ink-muted hover:border-ink hover:text-ink"
                onClick={() => setAmountText(value)}
              >
                {value} ETH
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {amountValid && quote.isFetching ? (
        <p className="font-mono text-xs text-ink-muted" role="status">Fetching on-chain quote…</p>
      ) : amountValid && quote.isError ? (
        <StatusMessage tone="error" title="Quote failed">
          {(quote.error as Error).message}
        </StatusMessage>
      ) : quoteOut !== null ? (
        <p className="font-mono text-sm font-bold text-ink">
          You receive ≈{" "}
          {side === "buy" ? (
            <>
              {formatCompactEth(quoteOut.toString(), 0)} {symbol}
            </>
          ) : (
            <>{truncateDecimals(formatEther(quoteOut))} ETH</>
          )}
        </p>
      ) : null}

      <SelectField
        id={`trade-slippage-${side}`}
        label="Slippage tolerance"
        value={String(slippageBps)}
        onChange={(event) => setSlippageBps(Number(event.target.value))}
      >
        {SLIPPAGE_OPTIONS.map((bps) => (
          <option key={bps} value={bps}>
            {bps / 100}%
          </option>
        ))}
      </SelectField>

      {graduationNext ? (
        <StatusMessage tone="warning" title="Graduation on next trade">
          The curve is full ({status}): this trade will trigger graduation into the
          permanent market. The quote above already accounts for it.
        </StatusMessage>
      ) : null}

      <StatusRegion>
        {insufficient && !busy ? (
          <StatusMessage tone="error" title="Insufficient balance">
            {side === "buy" ? "Your ETH balance is below this amount." : `You hold less than this amount of ${symbol}.`}
          </StatusMessage>
        ) : null}
        {error ? (
          <StatusMessage tone="error" title="Trade failed" onDismiss={reset}>
            {error}
          </StatusMessage>
        ) : null}
        {phase === "approving" ? (
          <StatusMessage tone="neutral" title="Approval">
            Approve the router to spend your {symbol} (sell only), then confirm the swap.
          </StatusMessage>
        ) : null}
        {phase === "pending" ? (
          <StatusMessage tone="neutral" title="Transaction pending">
            Waiting for confirmation{txHash ? (
              <>
                {" "}·{" "}
                <a className="underline" href={explorerTx(txHash)} rel="noreferrer" target="_blank">
                  view on explorer
                </a>
              </>
            ) : null}
          </StatusMessage>
        ) : null}
        {phase === "done" ? (
          <StatusMessage tone="success" title={`${side === "buy" ? "Bought" : "Sold"} — confirmed`} onDismiss={reset}>
            {effectiveQuote ?? "Your position updates within a few seconds."}
            {txHash ? (
              <>
                {" "}
                <a className="underline" href={explorerTx(txHash)} rel="noreferrer" target="_blank">
                  Explorer receipt
                </a>
              </>
            ) : null}
          </StatusMessage>
        ) : null}
      </StatusRegion>

      {!wallet.address ? (
        <Button fullWidth onClick={() => void wallet.connect().catch((cause) => setError((cause as Error).message))}>
          Connect wallet to trade
        </Button>
      ) : wallet.chainId !== wallet.targetChainId ? (
        <Button fullWidth variant="danger" onClick={() => void wallet.switchToTargetChain().catch((cause) => setError((cause as Error).message))}>
          Switch wallet to {wallet.targetChainId === 8453 ? "Base" : `chain ${wallet.targetChainId}`}
        </Button>
      ) : (
        <Button
          fullWidth
          variant={side === "buy" ? "primary" : "danger"}
          disabled={!amountValid || insufficient || busy || !quote.data || !protocol.addresses}
          onClick={() => setConfirming(true)}
        >
          {busy
            ? phase === "pending"
              ? "Confirming on chain…"
              : "Check your wallet…"
            : `${side === "buy" ? "Buy" : "Sell"} ${symbol}`}
        </Button>
      )}

      <p className="m-0 font-mono text-[0.68rem] leading-4 text-ink-muted">
        The 1% fee is protocol-owned — not a tip to LPs. Buys pay it in ETH, sells in {symbol}.
        Quotes run the real hook simulation; re-quote after errors instead of raising slippage.
      </p>

      <Dialog
        open={confirming}
        title={`Confirm ${side} — ${amountText} ${side === "buy" ? "ETH" : symbol}`}
        onClose={() => setConfirming(false)}
      >
        <div className="grid gap-3">
          <dl className="m-0 grid gap-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">You pay</dt>
              <dd className="m-0 font-mono font-bold">
                {truncateDecimals(amountText)} {side === "buy" ? "ETH" : symbol}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">You receive (quote)</dt>
              <dd className="m-0 font-mono font-bold">
                {quote.data
                  ? side === "buy"
                    ? `${formatCompactEth(quote.data.amountOut, 0)} ${symbol}`
                    : `${truncateDecimals(formatEther(wei(quote.data.amountOut)))} ETH`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Minimum after {slippageBps / 100}% slippage</dt>
              <dd className="m-0 font-mono font-bold">
                {quote.data
                  ? side === "buy"
                    ? `${formatCompactEth(applySlippBps(wei(quote.data.amountOut), slippageBps).toString(), 0)} ${symbol}`
                    : `${truncateDecimals(formatEther(applySlippBps(wei(quote.data.amountOut), slippageBps)))} ETH`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Price</dt>
              <dd className="m-0 font-mono font-bold">{humanPrice(price.data?.priceEth ?? null)} / {symbol}</dd>
            </div>
          </dl>
          {graduationNext ? (
            <p className="m-0 rounded-sm border-2 border-protocol bg-raised p-2 text-xs font-bold text-ink">
              This trade graduates the pool: the curve burns and the permanent market
              (full-range + wall) is seeded. Proceed only if you want graduation now.
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()}>{side === "buy" ? "Confirm buy" : "Confirm sell"}</Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
