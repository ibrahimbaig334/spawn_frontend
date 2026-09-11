"use client";

import { useRef, useState } from "react";
import { useDemo } from "@/state/use-demo";
import { selectEthBalance, selectTokenBalance } from "@/domain/selectors";
import { Dialog } from "@/components/ui/dialog";
import type { LaunchRecord, TradePreview, TradeSide } from "@/services/launchpad-client";
import { deriveGraduationNext, derivePhaseLabel } from "@/domain/selectors";

interface TradeTicketProps {
  launch: LaunchRecord;
}
type Phase = "idle" | "previewing" | "ready" | "submitting" | "success";
const BUTTON =
  "min-h-target cursor-pointer border border-rule bg-raised px-3.5 py-2.5 font-bold text-ink disabled:cursor-not-allowed disabled:opacity-55";
const GRID =
  "my-3 grid grid-cols-2 gap-px bg-rule max-[25rem]:grid-cols-1 [&>div]:min-w-0 [&>div]:bg-raised [&>div]:p-3 [&_dt]:text-xs [&_dt]:text-ink-muted [&_dd]:mt-1 [&_dd]:mb-0 [&_dd]:overflow-wrap-anywhere [&_dd]:font-bold";

export function TradeTicket({ launch }: TradeTicketProps) {
  const { state, dispatch, client } = useDemo();
  const [side, setSide] = useState<TradeSide>("buy");
  const [amounts, setAmounts] = useState({ buy: "1", sell: "100" });
  const [preview, setPreview] = useState<TradePreview | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [receipt, setReceipt] = useState("");
  const submitLock = useRef(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const ethBalance = selectEthBalance(state);
  const tokenBalance = selectTokenBalance(state, launch.poolId);
  const amount = amounts[side];
  const graduationNext = deriveGraduationNext(launch);
  const phaseLabel = derivePhaseLabel(launch);

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
      const value = await client.previewTrade(launch, {
        side: nextSide,
        amount: nextAmount,
      });
      setPreview(value);
      setPhase("ready");
    } catch (reason) {
      setPreview(null);
      setError(
        reason instanceof Error
          ? reason.message
          : "A quote could not be prepared.",
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
      side === "buy" ? ethBalance : tokenBalance,
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
        state.data.sequence + 1,
      );
      const receiptId = `sim_${launch.poolId}_${state.data.sequence + 1}`;
      dispatch({
        type: "apply-launch-update",
        launch: result.launch,
        events: result.events,
        tokenBalance: result.tokenBalance,
        ethBalance: result.ethBalance,
      });
      setReceipt(receiptId);
      setPhase("success");
      setDialogOpen(false);
      setPreview(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The trade could not be completed.",
      );
      setPhase("ready");
    } finally {
      submitLock.current = false;
    }
  }

  return (
    <section
      className="mt-4 border-y-2 border-ink py-5 text-ink"
      aria-labelledby={`trade-${launch.poolId}`}
    >
      <header className="flex items-baseline justify-between gap-4 max-[25rem]:items-start max-[25rem]:flex-col">
        <h4 className="m-0 text-xl" id={`trade-${launch.poolId}`}>
          Trade
        </h4>
        <span className="font-mono text-[0.68rem] font-bold tracking-[0.07em] text-ink-muted uppercase">
          {phaseLabel} · 1% fee
        </span>
      </header>
      {graduationNext && (
        <p
          className="mt-3 mb-0 border-l-[3px] border-accent bg-raised px-3 py-2 text-sm"
          role="status"
        >
          <strong>Graduation on next trade.</strong> The curve top (2x the
          opening valuation) is at hand — the next buy auto-graduates the pool:
          curve burns, 40/55/5 splits, and the milestone ladder loads.
        </p>
      )}
      <div
        className="mt-4 flex [&_button+button]:border-l-0 [&_button[aria-pressed=true]]:border-ink [&_button[aria-pressed=true]]:bg-ink [&_button[aria-pressed=true]]:text-inverse"
        role="group"
        aria-label="Trade direction"
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
          Amount, {side === "buy" ? "ETH" : launch.symbol}
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
          aria-describedby={`trade-note-${launch.poolId}`}
        />
      </label>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-ink-muted">
        <span>
          {side === "buy"
            ? `Balance: ${Number(ethBalance).toFixed(4)} ETH`
            : `Balance: ${Number(tokenBalance).toFixed(2)} ${launch.symbol}`}
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
        id={`trade-note-${launch.poolId}`}
      >
        Simulation only. Buys pay the 1% fee in ETH, sells in token. Quotes are
        single-swap — re-quote on errors rather than padding.
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
                {Number(preview.estimatedOutput).toFixed(2)}{" "}
                {preview.outputUnit === "token" ? launch.symbol : "ETH"}
              </dd>
            </div>
            <div>
              <dt>Fee (1%, {preview.feeUnit === "ETH" ? "ETH" : "token"})</dt>
              <dd>{Number(preview.feeAmount).toFixed(2)}</dd>
            </div>
            <div>
              <dt>Level movement</dt>
              <dd>
                {preview.levelBefore} → {preview.levelAfter}
              </dd>
            </div>
            <div>
              <dt>Milestones completed</dt>
              <dd>{preview.milestonesCompleted}</dd>
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
          ? "Quoting…"
          : preview
            ? "Review trade"
            : "Get quote"}
      </button>
      {receipt && (
        <p
          className="mt-4 mb-0 border-l-4 border-focus bg-paper p-3 leading-snug"
          role="status"
        >
          <strong>Trade recorded.</strong>
          <br />
          Receipt {receipt}. No transaction occurred.
        </p>
      )}

      <Dialog
        open={dialogOpen && Boolean(preview)}
        onClose={() => {
          if (phase !== "submitting") setDialogOpen(false);
        }}
        title={`Review ${side}`}
        description="Records a deterministic result in the local protocol simulation. No transaction will be created."
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
              {phase === "submitting" ? "Submitting…" : "Confirm trade"}
            </button>
          </div>
        }
      >
        {preview && (
          <dl className={GRID}>
            <div>
              <dt>Input</dt>
              <dd>
                {Number(preview.inputAmount).toFixed(2)}{" "}
                {preview.inputUnit === "token" ? launch.symbol : "ETH"}
              </dd>
            </div>
            <div>
              <dt>Estimated output</dt>
              <dd>
                {Number(preview.estimatedOutput).toFixed(2)}{" "}
                {preview.outputUnit === "token" ? launch.symbol : "ETH"}
              </dd>
            </div>
            <div>
              <dt>Fee</dt>
              <dd>
                {Number(preview.feeAmount).toFixed(2)}{" "}
                {preview.feeUnit === "ETH" ? "ETH" : launch.symbol}
              </dd>
            </div>
            <div>
              <dt>Milestones completed</dt>
              <dd>{preview.milestonesCompleted}</dd>
            </div>
          </dl>
        )}
      </Dialog>
    </section>
  );
}

export default TradeTicket;
