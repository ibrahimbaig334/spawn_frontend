"use client";

import { useRef, useState } from "react";
import { useDemo } from "@/state/use-demo";
import { selectTokenBalance } from "@/domain/selectors";
import { Dialog } from "@/components/ui/dialog";
import type { Launch, TradePreview, TradeSide } from "@/types/launch";

interface TradeTicketProps {
  launch: Launch;
}
type Phase = "idle" | "previewing" | "ready" | "submitting" | "success";
const BUTTON =
  "min-h-target cursor-pointer border border-rule bg-raised px-3.5 py-2.5 font-bold text-ink disabled:cursor-not-allowed disabled:opacity-55";
const GRID =
  "my-3 grid grid-cols-2 gap-px bg-rule max-[25rem]:grid-cols-1 [&>div]:min-w-0 [&>div]:bg-raised [&>div]:p-3 [&_dt]:text-xs [&_dt]:text-ink-muted [&_dd]:mt-1 [&_dd]:mb-0 [&_dd]:overflow-wrap-anywhere [&_dd]:font-bold";

export function TradeTicket({ launch }: TradeTicketProps) {
  const { state, dispatch, client } = useDemo();
  const [side, setSide] = useState<TradeSide>("buy");
  const [amounts, setAmounts] = useState({ buy: "1", sell: "1" });
  const [preview, setPreview] = useState<TradePreview | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [receipt, setReceipt] = useState("");
  const submitLock = useRef(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const tokenBalance = selectTokenBalance(state, launch.id);
  const context = { ethBalance: state.data.portfolio.ethBalance, tokenBalance };
  const amount = amounts[side];

  async function updatePreview(
    nextSide = side,
    nextAmount = amounts[nextSide],
  ) {
    setSide(nextSide);
    setAmounts((current) => ({ ...current, [nextSide]: nextAmount }));
    setError("");
    setReceipt("");
    setPhase("previewing");
    try {
      const value = await client.previewTrade(
        launch,
        { side: nextSide, amount: nextAmount },
        context,
      );
      setPreview(value);
      setPhase("ready");
    } catch (reason) {
      setPreview(null);
      setError(
        reason instanceof Error
          ? reason.message
          : "A preview could not be prepared.",
      );
      setPhase("idle");
    }
  }

  function chooseSide(nextSide: TradeSide) {
    setSide(nextSide);
    setPreview(null);
    setPhase("idle");
    setReceipt("");
    setError("");
  }
  function setBalanceShortcut() {
    void updatePreview(
      side,
      side === "buy" ? context.ethBalance : context.tokenBalance,
    );
  }
  async function submit() {
    if (!preview || submitLock.current) return;
    submitLock.current = true;
    setPhase("submitting");
    setError("");
    try {
      const result = await client.executeTrade(
        launch,
        { side, amount },
        context,
        state.data.sequence + 1,
      );
      dispatch({ type: "apply-trade", result });
      setReceipt(result.receiptId);
      setPhase("success");
      setDialogOpen(false);
      setPreview(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The demo submission could not be completed.",
      );
      setPhase("ready");
    } finally {
      submitLock.current = false;
    }
  }

  return (
    <section
      className="mt-4 border-y-2 border-ink py-5 text-ink"
      aria-labelledby={`trade-${launch.id}`}
    >
      <header className="flex items-baseline justify-between gap-4 max-[25rem]:items-start max-[25rem]:flex-col">
        <h4 className="m-0 text-xl" id={`trade-${launch.id}`}>
          Trade simulation
        </h4>
        <span className="font-mono text-[0.68rem] font-bold tracking-[0.07em] text-ink-muted uppercase">
          Demo data · No transaction
        </span>
      </header>
      <div
        className="mt-4 flex [&_button+button]:border-l-0 [&_button[aria-pressed=true]]:border-ink [&_button[aria-pressed=true]]:bg-ink [&_button[aria-pressed=true]]:text-inverse"
        role="group"
        aria-label="Demo trade direction"
      >
        <button
          className={BUTTON}
          type="button"
          aria-pressed={side === "buy"}
          onClick={() => chooseSide("buy")}
        >
          Buy
        </button>
        <button
          className={BUTTON}
          type="button"
          aria-pressed={side === "sell"}
          onClick={() => chooseSide("sell")}
        >
          Sell
        </button>
      </div>
      <label className="mt-4 grid gap-1.5">
        <span className="text-sm font-bold">
          Simulation input, {side === "buy" ? "ETH" : launch.symbol}
        </span>
        <input
          className="min-h-target w-full border border-rule bg-raised px-3 py-2.5 text-ink"
          inputMode="decimal"
          value={amount}
          onChange={(event) => {
            setAmounts((current) => ({
              ...current,
              [side]: event.target.value,
            }));
            setPreview(null);
            setPhase("idle");
            setReceipt("");
          }}
          onBlur={() => void updatePreview()}
          aria-describedby={`trade-note-${launch.id}`}
        />
      </label>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-ink-muted">
        <span>
          {side === "buy"
            ? `Demo balance: ${context.ethBalance} ETH`
            : `Token balance: ${context.tokenBalance} ${launch.symbol}`}
        </span>
        <button
          className="cursor-pointer border-0 bg-transparent p-1 font-bold text-ink underline underline-offset-4"
          type="button"
          onClick={setBalanceShortcut}
        >
          Use available balance
        </button>
      </div>
      <p
        className="mt-4 mb-0 border-l-4 border-focus bg-paper p-3 leading-snug"
        id={`trade-note-${launch.id}`}
      >
        Simulation only. Estimates use deterministic demo data and do not quote
        or send a transaction.
      </p>
      {error && (
        <p className="mt-3 mb-0 font-bold text-error" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <div className="my-4" aria-live="polite">
          <dl className={GRID}>
            <div>
              <dt>Estimated output</dt>
              <dd>
                {preview.estimatedOutput}{" "}
                {preview.outputUnit === "token" ? launch.symbol : "ETH"}
              </dd>
            </div>
            <div>
              <dt>Simulation fee</dt>
              <dd>
                {preview.feeEth} ETH ({preview.feeBps / 100}%)
              </dd>
            </div>
            <div>
              <dt>Progress after</dt>
              <dd>{preview.afterProgressBps / 100}%</dd>
            </div>
            <div>
              <dt>Targets reached</dt>
              <dd>{preview.newlyCompleted}</dd>
            </div>
          </dl>
        </div>
      )}
      <button
        className="min-h-target w-full cursor-pointer border border-ink bg-ink px-4 py-2.5 font-bold text-inverse disabled:cursor-not-allowed disabled:opacity-55"
        type="button"
        disabled={phase === "previewing" || phase === "submitting"}
        onClick={() => (preview ? setDialogOpen(true) : void updatePreview())}
      >
        {phase === "previewing"
          ? "Updating preview…"
          : preview
            ? "Review simulation"
            : "Prepare simulation"}
      </button>
      {receipt && (
        <p
          className="mt-4 mb-0 border-l-4 border-focus bg-paper p-3 leading-snug"
          role="status"
        >
          <strong>Demo result recorded.</strong>
          <br />
          Receipt {receipt}. No transaction occurred.
        </p>
      )}

      <Dialog
        open={dialogOpen && Boolean(preview)}
        onClose={() => {
          if (phase !== "submitting") setDialogOpen(false);
        }}
        title={`Review demo ${side}`}
        description="This records a deterministic result in browser-local demo data. No transaction will be created."
        initialFocusRef={confirmRef}
        footer={
          <div className="flex w-full justify-end gap-2 max-[25rem]:items-stretch max-[25rem]:flex-col-reverse">
            <button
              className={BUTTON}
              type="button"
              disabled={phase === "submitting"}
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </button>
            <button
              className={`${BUTTON} border-ink bg-ink text-inverse`}
              ref={confirmRef}
              type="button"
              disabled={phase === "submitting"}
              onClick={() => void submit()}
            >
              {phase === "submitting" ? "Recording…" : "Record demo result"}
            </button>
          </div>
        }
      >
        {preview && (
          <dl className={GRID}>
            <div>
              <dt>Input</dt>
              <dd>
                {preview.inputAmount}{" "}
                {preview.inputUnit === "token" ? launch.symbol : "ETH"}
              </dd>
            </div>
            <div>
              <dt>Estimated output</dt>
              <dd>
                {preview.estimatedOutput}{" "}
                {preview.outputUnit === "token" ? launch.symbol : "ETH"}
              </dd>
            </div>
            <div>
              <dt>Progress</dt>
              <dd>
                {preview.beforeProgressBps / 100}% →{" "}
                {preview.afterProgressBps / 100}%
              </dd>
            </div>
            <div>
              <dt>Targets reached</dt>
              <dd>{preview.newlyCompleted}</dd>
            </div>
          </dl>
        )}
      </Dialog>
    </section>
  );
}

export default TradeTicket;
