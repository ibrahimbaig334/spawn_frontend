"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PROTOCOL_TERMS } from "@/data/protocol-terms";
import {
  validateLaunchDraft,
  type LaunchDraft,
  type LaunchDraftErrors,
} from "@/domain/launch-validation";
import {
  clearLaunchDraft,
  loadLaunchDraft,
  saveLaunchDraft,
} from "@/lib/launch-draft-storage";
import { useDemo } from "@/state/use-demo";
import type { ProceedsSplit } from "@/types/protocol";

const INITIAL_DRAFT: LaunchDraft = {
  name: "",
  symbol: "",
  supply: "1000000000",
  description: "",
  split: { ...PROTOCOL_TERMS.defaultProceedsSplit },
  creatorPurchaseEnabled: false,
  creatorPurchaseBps: 500,
  lockupMonths: 6,
  acknowledged: false,
};
const STEPS = [
  "Identity",
  "Public split",
  "Creator purchase",
  "Review",
] as const;
const SPLIT_LABELS: Record<keyof ProceedsSplit, string> = {
  creator: "Creator earnings",
  buyback: "Token buyback and removal",
  protocol: "Protocol",
  liquidity: "Trading liquidity",
};
const ERROR_LABELS: Record<string, string> = {
  name: "Name",
  symbol: "Symbol",
  supply: "Total supply",
  description: "Description",
  split: "Proceeds allocation",
  creatorPurchaseBps: "Creator purchase",
  lockupMonths: "Lock-up",
  acknowledged: "Demo acknowledgement",
};
const ERROR_STEPS: Record<string, number> = {
  name: 0,
  symbol: 0,
  supply: 0,
  description: 0,
  split: 1,
  creatorPurchaseBps: 2,
  lockupMonths: 2,
  acknowledged: 3,
};
const percent = (bps: number) => `${bps / 100}%`;
const FIELD =
  "grid min-w-0 gap-1.5 [&>span:first-child]:text-sm [&>span:first-child]:font-bold [&_input]:min-h-target [&_input]:w-full [&_input]:min-w-0 [&_input]:border [&_input]:border-rule [&_input]:bg-raised [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-ink [&_input[aria-invalid=true]]:border-2 [&_input[aria-invalid=true]]:border-error [&_textarea]:min-h-24 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:border [&_textarea]:border-rule [&_textarea]:bg-raised [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea[aria-invalid=true]]:border-2 [&_textarea[aria-invalid=true]]:border-error [&_select]:min-h-target [&_select]:w-full [&_select]:border [&_select]:border-rule [&_select]:bg-raised [&_select]:px-3 [&_select]:py-2.5";
const ERROR = "m-0 text-sm font-bold text-error";
const INTRO = "mt-0 mb-6 text-ink-muted";

function restoredDraft(): LaunchDraft {
  if (typeof window === "undefined") return INITIAL_DRAFT;
  return loadLaunchDraft() ?? INITIAL_DRAFT;
}

export function LaunchConfigurator() {
  const { state, dispatch, client } = useDemo();
  const router = useRouter();
  const [draft, setDraft] = useState<LaunchDraft>(restoredDraft);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<LaunchDraftErrors>({});
  const [status, setStatus] = useState(() =>
    typeof window !== "undefined" && loadLaunchDraft()
      ? "Saved local draft restored. Review all demo data before continuing."
      : "",
  );
  const [saving, setSaving] = useState(false);
  const [draftReady] = useState(() => typeof window !== "undefined");
  const panelRef = useRef<HTMLDivElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!draftReady) return;
    const timeout = window.setTimeout(() => {
      saveLaunchDraft(draft);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [draft, draftReady]);

  const setField = <K extends keyof LaunchDraft>(
    key: K,
    value: LaunchDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setStatus("");
  };

  function stepErrors(): LaunchDraftErrors {
    const all = validateLaunchDraft(draft, step === 3);
    if (step === 0)
      return {
        name: all.name,
        symbol: all.symbol,
        supply: all.supply,
        description: all.description,
      };
    if (step === 1) return { split: all.split };
    if (step === 2)
      return {
        creatorPurchaseBps: all.creatorPurchaseBps,
        lockupMonths: all.lockupMonths,
      };
    return all;
  }

  function continueStep() {
    const nextErrors = Object.fromEntries(
      Object.entries(stepErrors()).filter(([, value]) => value),
    ) as LaunchDraftErrors;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    setStep((current) => Math.min(3, current + 1));
    window.requestAnimationFrame(() => panelRef.current?.focus());
  }

  async function createDemo() {
    const finalErrors = validateLaunchDraft(draft, true);
    setErrors(finalErrors);
    if (Object.keys(finalErrors).length || saving) {
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      const result = await client.createLaunch(draft, state.data.sequence + 1);
      dispatch({ type: "add-launch", result });
      clearLaunchDraft();
      router.push(`/tokens/${result.launch.slug}`);
    } catch (reason) {
      setStatus(
        reason instanceof Error
          ? reason.message
          : "The demo launch could not be created.",
      );
    } finally {
      setSaving(false);
    }
  }

  const splitTotal = Object.values(draft.split).reduce(
    (sum, value) => sum + value,
    0,
  );
  const activeErrors = Object.entries(errors).filter(
    (entry): entry is [string, string] => Boolean(entry[1]),
  );

  return (
    <section
      id="launch"
      className="border-b border-rule px-[max(1rem,calc((100vw-80rem)/2))] py-[clamp(3rem,7vw,7rem)] print:px-0"
      aria-labelledby="configure-title"
    >
      <header className="grid grid-cols-[minmax(0,1fr)_minmax(16rem,.4fr)] items-end gap-8 max-[47.5rem]:grid-cols-1">
        <div>
          <p className="m-0 font-mono text-xs font-bold tracking-[0.08em] uppercase">
            Create · Simulation only
          </p>
          <h1
            className="mt-2 mb-0 max-w-[13ch] text-[clamp(2.2rem,5.5vw,5rem)] leading-[0.98] tracking-[-0.045em]"
            id="configure-title"
          >
            Set the split once. Make it public.
          </h1>
        </div>
        <p className="m-0 text-ink-muted">
          Build a four-step launch using Demo data. The result stays in this
          browser; no wallet, asset, or transaction is involved.
        </p>
      </header>
      <div className="mt-10 grid grid-cols-[minmax(12rem,.32fr)_minmax(0,1fr)] gap-[clamp(1.5rem,4vw,4rem)] border-t-2 border-ink pt-6 max-[47.5rem]:grid-cols-1">
        <ol
          className="m-0 list-none p-0 max-[47.5rem]:grid max-[47.5rem]:grid-cols-4"
          aria-label="Launch creation steps"
        >
          {STEPS.map((label, index) => (
            <li
              className="grid grid-cols-[2rem_1fr] gap-2 border-b border-rule py-3 text-ink-muted before:font-mono before:text-xs before:font-bold before:content-[attr(data-number)] data-[active=true]:border-ink data-[active=true]:font-bold data-[active=true]:text-ink max-[47.5rem]:grid-cols-1 max-[47.5rem]:pr-1 max-[47.5rem]:text-xs max-[32.5rem]:[&_span]:sr-only"
              key={label}
              data-number={`0${index + 1}`}
              data-active={step === index}
              aria-current={step === index ? "step" : undefined}
            >
              <span>{label}</span>
            </li>
          ))}
        </ol>
        <form
          className="min-w-0"
          onSubmit={(event) => {
            event.preventDefault();
            if (step < 3) continueStep();
            else void createDemo();
          }}
          noValidate
        >
          <div
            className="min-h-[25rem] max-[47.5rem]:min-h-0 [&>h3]:mt-0 [&>h3]:mb-2 [&>h3]:text-[clamp(1.7rem,3.5vw,2.7rem)]"
            ref={panelRef}
            tabIndex={-1}
          >
            {activeErrors.length ? (
              <div
                className="mb-5 border-2 border-error bg-raised p-4"
                ref={errorSummaryRef}
                role="alert"
                tabIndex={-1}
              >
                <h3 className="mb-2! text-base!">
                  Review{" "}
                  {activeErrors.length === 1 ? "this issue" : "these issues"}
                </h3>
                <ul className="m-0 pl-5">
                  {activeErrors.map(([key, message]) => (
                    <li key={key}>
                      <button
                        className="cursor-pointer border-0 bg-transparent py-1 text-left text-error underline underline-offset-3"
                        type="button"
                        onClick={() => {
                          setStep(ERROR_STEPS[key] ?? step);
                          window.requestAnimationFrame(() =>
                            panelRef.current
                              ?.querySelector<HTMLElement>(
                                "[aria-invalid='true']",
                              )
                              ?.focus(),
                          );
                        }}
                      >
                        {ERROR_LABELS[key] ?? key}: {message}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="m-0 font-mono text-xs font-bold tracking-[0.08em] uppercase">
              Step {step + 1} of 4 · {STEPS[step]}
            </p>
            {step === 0 && (
              <IdentityStep draft={draft} errors={errors} setField={setField} />
            )}
            {step === 1 && (
              <>
                <h3>Publish the proceeds routes</h3>
                <p className={INTRO}>
                  These values apply to every completed demo allocation and must
                  total exactly 100%.
                </p>
                <div className="grid gap-4">
                  {(Object.keys(draft.split) as Array<keyof ProceedsSplit>).map(
                    (key) => (
                      <div
                        className="grid grid-cols-[minmax(10rem,1fr)_6rem] items-center gap-x-4 gap-y-2 max-[34rem]:grid-cols-1"
                        key={key}
                      >
                        <label
                          className="text-sm font-bold"
                          htmlFor={`split-${key}`}
                        >
                          {SPLIT_LABELS[key]}
                        </label>
                        <input
                          className="min-h-target w-full border border-rule bg-raised px-3 py-2.5 font-mono text-ink aria-invalid:border-2 aria-invalid:border-error max-[34rem]:row-start-2"
                          id={`split-${key}`}
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={draft.split[key] / 100}
                          aria-invalid={Boolean(errors.split)}
                          onChange={(event) =>
                            setField("split", {
                              ...draft.split,
                              [key]: Math.round(
                                Number(event.target.value) * 100,
                              ),
                            })
                          }
                        />
                        <div
                          className="col-span-full h-2 overflow-hidden bg-surface-strong max-[34rem]:row-start-3"
                          aria-hidden="true"
                        >
                          <span
                            className="block h-full bg-accent forced-colors:bg-[Highlight]"
                            style={{
                              width: `${Math.min(100, Math.max(0, draft.split[key] / 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ),
                  )}
                </div>
                <div className="mt-5 flex items-center justify-between border-y-2 border-ink py-3 font-mono font-bold">
                  <span>Total</span>
                  <span
                    className={
                      splitTotal === 10000 ? "text-accent-strong" : "text-error"
                    }
                  >
                    {splitTotal / 100}%
                  </span>
                </div>
                <button
                  className="mt-4 min-h-target cursor-pointer border border-ink bg-transparent px-3 py-2 font-bold"
                  type="button"
                  onClick={() =>
                    setField("split", {
                      ...PROTOCOL_TERMS.defaultProceedsSplit,
                    })
                  }
                >
                  Reset default split
                </button>
                {errors.split && (
                  <p className={`${ERROR} mt-3`} role="alert" tabIndex={-1}>
                    {errors.split}
                  </p>
                )}
              </>
            )}
            {step === 2 && (
              <>
                <h3>Declare a creator purchase</h3>
                <p className={INTRO}>
                  Optionally include a fixed creator purchase in this Demo
                  configuration.
                </p>
                <label className="inline-flex min-h-target cursor-pointer items-center gap-3 font-bold">
                  <input
                    className="size-5 accent-accent"
                    type="checkbox"
                    checked={draft.creatorPurchaseEnabled}
                    onChange={(event) =>
                      setField("creatorPurchaseEnabled", event.target.checked)
                    }
                  />
                  Include creator purchase
                </label>
                {draft.creatorPurchaseEnabled && (
                  <div className="mt-6 grid grid-cols-2 gap-5 border-l-[3px] border-accent pl-5 max-[34rem]:grid-cols-1">
                    <label className={FIELD}>
                      <span>Share of supply, %</span>
                      <input
                        type="number"
                        min="0.01"
                        max="10"
                        step="0.25"
                        value={draft.creatorPurchaseBps / 100}
                        aria-invalid={Boolean(errors.creatorPurchaseBps)}
                        onChange={(event) =>
                          setField(
                            "creatorPurchaseBps",
                            Math.round(Number(event.target.value) * 100),
                          )
                        }
                      />
                      {errors.creatorPurchaseBps && (
                        <span className={ERROR}>
                          {errors.creatorPurchaseBps}
                        </span>
                      )}
                    </label>
                    <label className={FIELD}>
                      <span>Lock-up, months</span>
                      <select
                        value={draft.lockupMonths}
                        aria-invalid={Boolean(errors.lockupMonths)}
                        onChange={(event) =>
                          setField("lockupMonths", Number(event.target.value))
                        }
                      >
                        {Array.from({ length: 13 }, (_, index) => (
                          <option key={index} value={index}>
                            {index === 0
                              ? "No lock-up"
                              : `${index} month${index === 1 ? "" : "s"}`}
                          </option>
                        ))}
                      </select>
                      {errors.lockupMonths && (
                        <span className={ERROR}>{errors.lockupMonths}</span>
                      )}
                    </label>
                  </div>
                )}
              </>
            )}
            {step === 3 && (
              <ReviewStep
                draft={draft}
                error={errors.acknowledged}
                onAcknowledge={(checked) => setField("acknowledged", checked)}
              />
            )}
          </div>
          {status && (
            <p
              className="mt-5 grid border-l-[3px] border-accent bg-raised px-4 py-3 text-sm text-ink-muted"
              role="status"
            >
              <strong className="text-ink">Demo status</strong>
              {status}
            </p>
          )}
          <p className="mt-4 mb-0 text-xs text-ink-muted">
            Drafts are stored locally in this browser when storage is available.
          </p>
          <div className="mt-6 flex justify-end gap-3 border-t border-rule pt-5 max-[34rem]:flex-col-reverse [&_button]:min-h-target [&_button]:cursor-pointer [&_button]:border [&_button]:border-ink [&_button]:px-4 [&_button]:py-2.5 [&_button]:font-bold [&_button]:disabled:cursor-not-allowed [&_button]:disabled:opacity-50 [&_button:last-child]:bg-ink [&_button:last-child]:text-inverse">
            {step > 0 && (
              <button
                className="bg-transparent text-ink"
                type="button"
                onClick={() => {
                  setErrors({});
                  setStep((current) => current - 1);
                }}
              >
                Back
              </button>
            )}
            <button type="submit" disabled={saving}>
              {step === 3
                ? saving
                  ? "Adding demo…"
                  : "Create demo launch"
                : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

interface IdentityProps {
  draft: LaunchDraft;
  errors: LaunchDraftErrors;
  setField: <K extends keyof LaunchDraft>(
    key: K,
    value: LaunchDraft[K],
  ) => void;
}
function IdentityStep({ draft, errors, setField }: IdentityProps) {
  return (
    <>
      <h3>Name the demo launch</h3>
      <p className={INTRO}>
        Use a clear identity and concise public description.
      </p>
      <div className="grid grid-cols-2 gap-5 max-[34rem]:grid-cols-1">
        <label className={FIELD}>
          <span>Name</span>
          <input
            value={draft.name}
            maxLength={40}
            aria-invalid={Boolean(errors.name)}
            onChange={(event) => setField("name", event.target.value)}
          />
          {errors.name && <span className={ERROR}>{errors.name}</span>}
        </label>
        <label className={FIELD}>
          <span>Symbol</span>
          <input
            value={draft.symbol}
            maxLength={8}
            aria-invalid={Boolean(errors.symbol)}
            onChange={(event) =>
              setField("symbol", event.target.value.toUpperCase())
            }
          />
          {errors.symbol && <span className={ERROR}>{errors.symbol}</span>}
        </label>
        <label className={FIELD}>
          <span>Total supply</span>
          <input
            inputMode="decimal"
            value={draft.supply}
            aria-invalid={Boolean(errors.supply)}
            onChange={(event) => setField("supply", event.target.value)}
          />
          {errors.supply && <span className={ERROR}>{errors.supply}</span>}
        </label>
        <label className={`${FIELD} col-span-full`}>
          <span>Description</span>
          <textarea
            value={draft.description}
            maxLength={140}
            aria-invalid={Boolean(errors.description)}
            onChange={(event) => setField("description", event.target.value)}
          />
          {errors.description && (
            <span className={ERROR}>{errors.description}</span>
          )}
          <span className="text-xs text-ink-muted">
            {draft.description.length} / 140 characters
          </span>
        </label>
      </div>
    </>
  );
}

function ReviewStep({
  draft,
  error,
  onAcknowledge,
}: {
  draft: LaunchDraft;
  error?: string;
  onAcknowledge: (checked: boolean) => void;
}) {
  return (
    <>
      <h3>Review the public demo terms</h3>
      <p className={INTRO}>
        Check every value before adding this launch to the Simulation dataset.
        These distinct flows do not replace one another.
      </p>
      <dl className="m-0 grid grid-cols-2 border-t-2 border-ink max-[38rem]:grid-cols-1 [&>div]:min-w-0 [&>div]:border-b [&>div]:border-rule [&>div]:p-3 [&>div:nth-child(even)]:border-l max-[38rem]:[&>div:nth-child(even)]:border-l-0 [&_dt]:text-xs [&_dt]:font-bold [&_dt]:text-ink-muted [&_dd]:mt-1 [&_dd]:mb-0 [&_dd]:overflow-wrap-anywhere">
        <div>
          <dt>Identity</dt>
          <dd>
            {draft.name} · ${draft.symbol}
          </dd>
        </div>
        <div>
          <dt>Total supply</dt>
          <dd>{draft.supply}</dd>
        </div>
        <div>
          <dt>Supply allocation</dt>
          <dd>25% initial market · 65% milestones · 10% ongoing trading</dd>
        </div>
        <div>
          <dt>Launch-target proceeds</dt>
          <dd>40% liquidity · 55% creator · 5% protocol</dd>
        </div>
        <div>
          <dt>Ongoing fee routing</dt>
          <dd>60% liquidity · 30% creator · 10% protocol</dd>
        </div>
        <div>
          <dt>Milestone split</dt>
          <dd>
            {percent(draft.split.creator)} creator ·{" "}
            {percent(draft.split.buyback)} buyback and removal ·{" "}
            {percent(draft.split.protocol)} protocol ·{" "}
            {percent(draft.split.liquidity)} liquidity
          </dd>
        </div>
        <div>
          <dt>Creator purchase</dt>
          <dd>
            {draft.creatorPurchaseEnabled
              ? `${percent(draft.creatorPurchaseBps)}, ${draft.lockupMonths === 0 ? "No lock-up" : `${draft.lockupMonths} months`}`
              : "Not included"}
          </dd>
        </div>
        <div>
          <dt>Fee steps</dt>
          <dd>1% initially · 0.75% after 8 · 0.5% after 16</dd>
        </div>
        <div>
          <dt>Opening valuation</dt>
          <dd>{PROTOCOL_TERMS.openingValuationEth} ETH</dd>
        </div>
        <div>
          <dt>Material risks</dt>
          <dd>
            Demo demand can reverse; reaching a target does not prove lasting
            demand or value.
          </dd>
        </div>
      </dl>
      <label className="mt-5 flex min-h-target cursor-pointer items-start gap-3 border border-rule bg-raised p-4 font-bold">
        <input
          className="mt-0.5 size-5 shrink-0 accent-accent"
          type="checkbox"
          checked={draft.acknowledged}
          aria-invalid={Boolean(error)}
          onChange={(event) => onAcknowledge(event.target.checked)}
        />
        <span>
          I understand this creates Demo data in a Simulation only. No wallet or
          transaction is connected.
        </span>
      </label>
      {error && (
        <p className={`${ERROR} mt-2`} role="alert" tabIndex={-1}>
          {error}
        </p>
      )}
    </>
  );
}

export default LaunchConfigurator;
