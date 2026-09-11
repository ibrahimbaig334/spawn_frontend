"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  draftToConfig,
  draftToMetadata,
  hasPlanBit,
  INITIAL_DRAFT,
  planSummary,
  validateDraft,
  withPlanBit,
  withoutPlanBit,
  type LaunchDraft,
  type LaunchDraftErrors,
} from "@/domain/launch-draft";
import {
  clearLaunchDraft,
  loadLaunchDraft,
  saveLaunchDraft,
} from "@/lib/launch-draft-storage";
import { useDemo } from "@/state/use-demo";
import { formatEth } from "@/lib/format";
import { parseDecimal } from "@/domain/economics";
import { RichDescriptionField } from "./rich-description-field";
import {
  TokenCard,
  useLogoDropzone,
  type TokenCardData,
  type TokenCardStats,
} from "./token-card";
import {
  LOGO_TYPES,
  LOGO_TYPE_LABEL,
  uploadLogoToIPFS,
} from "@/services/ipfs-client";
import { SOCIAL_META } from "./social-icons";

const STEPS = ["Identity", "Payout plan", "Dev buy", "Review"] as const;
const FIELD =
  "grid min-w-0 gap-1.5 [&>span:first-child]:text-sm [&>span:first-child]:font-bold [&_input]:min-h-target [&_input]:w-full [&_input]:min-w-0 [&_input]:border [&_input]:border-rule [&_input]:bg-raised [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-ink [&_input[aria-invalid=true]]:border-2 [&_input[aria-invalid=true]]:border-error [&_select]:min-h-target [&_select]:w-full [&_select]:border [&_select]:border-rule [&_select]:bg-raised [&_select]:px-3 [&_select]:py-2.5";
const ERROR = "m-0 text-sm font-bold text-error";
const INTRO = "mt-0 mb-6 text-ink-muted";

const LOCAL_CREATOR = "0x000000000000000000000000000000000000000d" as const;

/** Mock USD price of ETH for preview stats only (no market feed pre-chain). */
const PREVIEW_ETH_USD = 3000;

/**
 * Live preview stats derived from the draft supply at the protocol's 125 ETH
 * opening FDV: price in USD subscript notation, MC, and flat new-token stats.
 */
function previewStats(totalSupply: string): TokenCardStats {
  const supply = parseDecimal(totalSupply);
  if (supply === null || supply <= 0n) {
    return {
      price: "0",
      marketCapUsd: "0",
      changePercent: 0,
      volumeUsd: "0",
      bondingPercent: 0,
      comments: 0,
    };
  }
  const priceEth = 125 / Number(supply) * 1e18; // ETH per token at opening FDV
  const priceUsd = priceEth * PREVIEW_ETH_USD;
  return {
    price: String(priceUsd),
    marketCapUsd: String(125 * PREVIEW_ETH_USD),
    changePercent: 0,
    volumeUsd: "0",
    bondingPercent: 0,
    comments: 0,
  };
}

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
  const [registry, setRegistry] = useState<
    Awaited<ReturnType<typeof client.listPluginEntries>>
  >([]);
  const [predictedToken, setPredictedToken] = useState<string | null>(null);
  const [status, setStatus] = useState(() =>
    typeof window !== "undefined" && loadLaunchDraft()
      ? "Saved local draft restored. Review every value before continuing."
      : "",
  );
  const [saving, setSaving] = useState(false);
  const [draftReady] = useState(() => typeof window !== "undefined");
  const panelRef = useRef<HTMLDivElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void client.listPluginEntries().then(setRegistry).catch(() => undefined);
  }, [client]);

  useEffect(() => {
    if (!draftReady) return;
    const timeout = window.setTimeout(() => {
      saveLaunchDraft(draft);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [draft, draftReady]);

  const summary = useMemo(
    () => planSummary(draft, registry),
    [draft, registry],
  );

  useEffect(() => {
    if (step !== 0 && step !== 3) return;
    const config = draftToConfig(draft, LOCAL_CREATOR);
    const timeout = window.setTimeout(() => {
      void client
        .predictTokenAddress(config)
        .then((address) => setPredictedToken(address))
        .catch(() => setPredictedToken(null));
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [step, draft, client]);

  const setField = <K extends keyof LaunchDraft>(
    key: K,
    value: LaunchDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setStatus("");
  };

  function togglePlugin(index: number) {
    const plan = BigInt(draft.payoutPlan);
    const next = hasPlanBit(plan, index)
      ? withoutPlanBit(plan, index)
      : withPlanBit(plan, index);
    setField("payoutPlan", next.toString());
  }

  function stepErrors(): LaunchDraftErrors {
    const all = validateDraft(draft, registry);
    if (step === 0)
      return {
        name: all.name,
        symbol: all.symbol,
        totalSupply: all.totalSupply,
        description: all.description,
        socials: all.socials,
      };
    if (step === 1) return { payoutPlan: all.payoutPlan };
    if (step === 2) return { devBuyPercent: all.devBuyPercent };
    return { ...all, deadlineMinutes: all.deadlineMinutes };
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

  async function createLaunch() {
    const finalErrors = validateDraft(draft, registry);
    setErrors(finalErrors);
    if (Object.keys(finalErrors).length || saving) {
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      const config = draftToConfig(draft, LOCAL_CREATOR);
      const metadata = draftToMetadata(draft);
      const result = await client.createLaunch(
        config,
        state.data.sequence + 1,
        metadata,
      );
      dispatch({ type: "add-launch", result });
      clearLaunchDraft();
      router.push(`/tokens/${result.launch.slug}`);
    } catch (reason) {
      setStatus(
        reason instanceof Error
          ? reason.message
          : "The launch could not be created.",
      );
    } finally {
      setSaving(false);
    }
  }

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
            Create · Local simulation
          </p>
          <h1
            className="mt-2 mb-0 max-w-[13ch] text-[clamp(2.2rem,5.5vw,5rem)] leading-[0.98] tracking-[-0.045em]"
            id="configure-title"
          >
            Choose the plan once. Make it public.
          </h1>
        </div>
        <p className="m-0 text-ink-muted">
          Build the signed launch configuration: identity, payout plan, and an
          optional dev buy. Runs the protocol simulation in this browser; no
          wallet or transaction is involved yet.
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
            else void createLaunch();
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
                          const stepIndex =
                            key === "name" ||
                            key === "symbol" ||
                            key === "totalSupply" ||
                            key === "description" ||
                            key === "socials"
                              ? 0
                              : key === "payoutPlan"
                                ? 1
                                : key === "devBuyPercent"
                                  ? 2
                                  : 3;
                          setStep(stepIndex);
                          window.requestAnimationFrame(() =>
                            panelRef.current
                              ?.querySelector<HTMLElement>(
                                "[aria-invalid='true']",
                              )
                              ?.focus(),
                          );
                        }}
                      >
                        {key}: {message}
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
              <IdentityStep
                draft={draft}
                errors={errors}
                predictedToken={predictedToken}
                setField={setField}
              />
            )}
            {step === 1 && (
              <PlanStep
                draft={draft}
                registry={registry}
                summary={summary}
                error={errors.payoutPlan}
                onToggle={togglePlugin}
              />
            )}
            {step === 2 && (
              <DevBuyStep
                draft={draft}
                summary={summary}
                error={errors.devBuyPercent}
                setField={setField}
              />
            )}
            {step === 3 && (
              <ReviewStep
                draft={draft}
                registry={registry}
                summary={summary}
                predictedToken={predictedToken}
              />
            )}
          </div>
          {status && (
            <p
              className="mt-5 grid border-l-[3px] border-accent bg-raised px-4 py-3 text-sm text-ink-muted"
              role="status"
            >
              <strong className="text-ink">Status</strong>
              {status}
            </p>
          )}
          <p className="mt-4 mb-0 text-xs text-ink-muted">
            The payout plan is immutable after launch and part of the signed
            configuration. Drafts are stored locally in this browser.
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
                  ? "Launching…"
                  : "Launch (simulation)"
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
  predictedToken: string | null;
  setField: <K extends keyof LaunchDraft>(
    key: K,
    value: LaunchDraft[K],
  ) => void;
}

function IdentityStep({
  draft,
  errors,
  predictedToken,
  setField,
}: IdentityProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const dropzone = useLogoDropzone((file) => void handleFile(file));
  const inputRef = dropzone.inputRef;

  async function handleFile(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      const { url } = await uploadLogoToIPFS(file);
      setField("logoUrl", url);
    } catch (reason) {
      setUploadError(
        reason instanceof Error
          ? reason.message
          : "The logo could not be uploaded.",
      );
    } finally {
      setUploading(false);
    }
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    event.target.value = "";
  }

  function removeLogo() {
    setField("logoUrl", undefined);
  }

  const cardData: TokenCardData = {
    name: draft.name,
    symbol: draft.symbol,
    description: draft.description,
    logoUrl: draft.logoUrl,
    contractAddress: predictedToken ?? "",
    stats: previewStats(draft.totalSupply),
    createdLabel: "just now",
  };

  return (
    <>
      <h3>General</h3>
      <p className={INTRO}>
        Everything on the card updates live as you type. The configuration is
        signed in full — a relayer cannot alter a single field of what you
        enter here.
      </p>
      <div className="grid grid-cols-[minmax(18rem,.9fr)_minmax(15rem,22rem)] items-start gap-[clamp(2rem,5vw,5rem)] max-[56rem]:grid-cols-1">
        {/* Left column — General form */}
        <div className="grid content-start gap-5">
          <label className={FIELD}>
            <span>
              Name <span className="text-error">*</span>
            </span>
            <input
              value={draft.name}
              maxLength={40}
              placeholder="Name your token..."
              aria-invalid={Boolean(errors.name)}
              onChange={(event) => setField("name", event.target.value)}
            />
            {errors.name && <span className={ERROR}>{errors.name}</span>}
          </label>
          <label className={FIELD}>
            <span>
              Symbol <span className="text-error">*</span>
            </span>
            <input
              value={draft.symbol}
              maxLength={8}
              placeholder="EXAMPLE - BTC, SOL, DOGE..."
              aria-invalid={Boolean(errors.symbol)}
              onChange={(event) =>
                setField("symbol", event.target.value.toUpperCase())
              }
            />
            {errors.symbol && <span className={ERROR}>{errors.symbol}</span>}
          </label>
          <RichDescriptionField
            invalid={Boolean(errors.description)}
            value={draft.description}
            onChange={(next) => setField("description", next)}
          />
          {errors.description && (
            <p className={`${ERROR} -mt-3`} role="alert">
              {errors.description}
            </p>
          )}
          <label className={FIELD}>
            <span>Total supply</span>
            <input
              inputMode="decimal"
              value={draft.totalSupply}
              aria-invalid={Boolean(errors.totalSupply)}
              onChange={(event) => setField("totalSupply", event.target.value)}
            />
            {errors.totalSupply && (
              <span className={ERROR}>{errors.totalSupply}</span>
            )}
            <span className="text-xs text-ink-muted">
              Fixed at launch. Supply split: 25% curve · 65% milestone ladder ·
              10% full-range backing. Opens at the 125 ETH template FDV.
            </span>
          </label>

          {/* Socials */}
          <fieldset className="m-0 grid gap-4 border-0 p-0">
            <legend className="px-0 pb-1 text-sm font-bold">
              Socials{" "}
              <span className="font-normal text-ink-muted">
                (optional — shown on the token page)
              </span>
            </legend>
            <div className="grid grid-cols-2 gap-4 max-[34rem]:grid-cols-1">
              {(
                Object.keys(SOCIAL_META) as Array<keyof typeof SOCIAL_META>
              ).map((key) => {
                const meta = SOCIAL_META[key];
                const Icon = meta.icon;
                return (
                  <label className={FIELD} key={key}>
                    <span className="flex items-center gap-1.5">
                      <Icon className="text-ink-muted" height={14} width={14} />
                      {meta.label}
                    </span>
                    <input
                      inputMode="url"
                      placeholder={meta.placeholder}
                      value={draft.socials[key]}
                      aria-invalid={Boolean(errors.socials)}
                      onChange={(event) =>
                        setField("socials", {
                          ...draft.socials,
                          [key]: event.target.value,
                        })
                      }
                    />
                  </label>
                );
              })}
            </div>
            {errors.socials && (
              <p className={`${ERROR} -mt-2`} role="alert">
                {errors.socials}
              </p>
            )}
          </fieldset>
        </div>

        {/* Right column — Token card preview */}
        <div className="grid justify-items-center gap-3">
          <p className="m-0 font-mono text-xs font-bold tracking-[0.08em] text-ink-muted uppercase">
            Token card preview
          </p>
          <TokenCard data={cardData} className="w-full" />
          <div className="grid w-full max-w-[22rem] gap-2">
            <label
              className="grid cursor-pointer justify-items-center gap-1.5 border-2 border-dashed border-rule bg-raised px-4 py-4 text-center hover:border-ink data-[dragging=true]:border-accent data-[dragging=true]:bg-surface-strong"
              {...dropzone.labelProps}
            >
              <input
                accept={LOGO_TYPES.join(",")}
                className="sr-only"
                onChange={onPick}
                ref={inputRef}
                type="file"
              />
              {uploading ? (
                <span className="text-sm font-bold text-accent-strong">
                  Uploading to IPFS…
                </span>
              ) : draft.logoUrl ? (
                <span className="grid gap-1 text-sm font-bold">
                  Logo uploaded ✓
                  <span className="font-mono text-xs font-normal break-all text-ink-muted">
                    {draft.logoUrl}
                  </span>
                </span>
              ) : (
                <span className="grid gap-1">
                  <strong className="text-sm">Upload Logo</strong>
                  <span className="text-xs text-ink-muted">
                    {LOGO_TYPE_LABEL}
                  </span>
                </span>
              )}
            </label>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-ink-muted">
                Stored on IPFS via thirdweb; the URL is passed to the launch.
              </span>
              {draft.logoUrl ? (
                <button
                  className="cursor-pointer border-0 bg-transparent p-0 font-bold text-error underline underline-offset-3"
                  type="button"
                  onClick={removeLogo}
                >
                  Remove
                </button>
              ) : null}
            </div>
            {uploadError && (
              <p className="m-0 text-sm font-bold text-error" role="alert">
                {uploadError}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

interface PlanProps {
  draft: LaunchDraft;
  registry: Awaited<
    ReturnType<
      ReturnType<typeof useDemo>["client"]["listPluginEntries"]
    >
  >;
  summary: ReturnType<typeof planSummary>;
  error?: string;
  onToggle: (index: number) => void;
}

function PlanStep({ draft, registry, summary, error, onToggle }: PlanProps) {
  return (
    <>
      <h3>Select the payout plan</h3>
      <p className={INTRO}>
        A 256-bit plan selects registry plugins that share each milestone pot.
        You are the mandatory remainder — every unallocated wei (and any
        redirected plugin share) accrues to your creator path. The plan is
        immutable after launch.
      </p>
      {registry.length ? (
        <ul className="m-0 grid list-none gap-3 p-0">
          {registry.map((entry) => {
            const selected = hasPlanBit(BigInt(draft.payoutPlan), entry.index);
            const take = (BigInt(entry.takeWad) * 100n) / 10n ** 18n;
            return (
              <li key={entry.index}>
                <button
                  type="button"
                  aria-pressed={selected}
                  disabled={entry.suspended || entry.role !== "payout"}
                  onClick={() => onToggle(entry.index)}
                  className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border border-rule bg-raised px-4 py-3 text-left aria-pressed:border-ink aria-pressed:border-2 disabled:cursor-not-allowed disabled:opacity-50 max-[30rem]:grid-cols-1"
                >
                  <span className="grid gap-1">
                    <strong>
                      #{entry.index} · Buyback and burn
                      {entry.suspended ? " (suspended)" : ""}
                    </strong>
                    <span className="text-sm text-ink-muted">
                      Spends its pot share buying the launch token and burning
                      it. Registered take {take.toString()}%.
                    </span>
                  </span>
                  <span className="font-mono text-sm font-bold text-accent-strong">
                    {selected ? "Selected" : "Select"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-ink-muted">Registry entries are unavailable.</p>
      )}
      <div className="mt-5 grid gap-2 border-y-2 border-ink py-3 font-mono font-bold">
        <span className="flex justify-between">
          <span>Selected plugins</span>
          <span>{summary.selectedIndices.length} / 8</span>
        </span>
        <span className="flex justify-between">
          <span>Plugin takes</span>
          <span>{summary.takeSumPercent}%</span>
        </span>
        <span className="flex justify-between text-accent-strong">
          <span>Creator remainder</span>
          <span>{summary.creatorRemainderPercent}%</span>
        </span>
      </div>
      {error && (
        <p className={`${ERROR} mt-3`} role="alert" tabIndex={-1}>
          {error}
        </p>
      )}
    </>
  );
}

interface DevBuyProps {
  draft: LaunchDraft;
  summary: ReturnType<typeof planSummary>;
  error?: string;
  setField: <K extends keyof LaunchDraft>(
    key: K,
    value: LaunchDraft[K],
  ) => void;
}

function DevBuyStep({ draft, summary, error, setField }: DevBuyProps) {
  return (
    <>
      <h3>Declare a dev buy</h3>
      <p className={INTRO}>
        A creator-direct launch may buy up to 10% of supply on ordinary buyer
        terms — no vesting, no lockup: tokens transfer fully at launch. A
        relayed launch executes no dev buy and the share stays curve inventory.
      </p>
      <label className="inline-flex min-h-target cursor-pointer items-center gap-3 font-bold">
        <input
          className="size-5 accent-accent"
          type="checkbox"
          checked={draft.devBuyEnabled}
          onChange={(event) => setField("devBuyEnabled", event.target.checked)}
        />
        Include a dev buy
      </label>
      {draft.devBuyEnabled && (
        <div className="mt-6 grid grid-cols-2 gap-5 border-l-[3px] border-accent pl-5 max-[34rem]:grid-cols-1">
          <label className={FIELD}>
            <span>Share of supply, %</span>
            <input
              type="number"
              min="0.01"
              max="10"
              step="0.25"
              value={draft.devBuyPercent}
              aria-invalid={Boolean(error)}
              onChange={(event) =>
                setField("devBuyPercent", Number(event.target.value))
              }
            />
            {error && <span className={ERROR}>{error}</span>}
          </label>
          <div className="grid content-start gap-2 text-sm">
            <span className="font-bold">Pre-launch quote (pure math)</span>
            <span>
              Tokens received: {summary.devBuyTokens} {draft.symbol || "tokens"}
            </span>
            <span>ETH cost on the fresh curve: {summary.devBuyEthCost}</span>
            <span>
              Suggested msg.value (+5% headroom):{" "}
              {formatEth(summary.devBuyBudget, 3)}
            </span>
            <span className="text-xs text-ink-muted">
              Exact-input semantics bound the spend at the attached budget;
              unused ETH refunds automatically.
            </span>
          </div>
        </div>
      )}
    </>
  );
}

interface ReviewProps {
  draft: LaunchDraft;
  registry: Awaited<
    ReturnType<
      ReturnType<typeof useDemo>["client"]["listPluginEntries"]
    >
  >;
  summary: ReturnType<typeof planSummary>;
  predictedToken: string | null;
}

function ReviewStep({
  draft,
  registry,
  summary,
  predictedToken,
}: ReviewProps) {
  const selected = registry.filter((entry) =>
    hasPlanBit(BigInt(draft.payoutPlan), entry.index),
  );
  return (
    <>
      <h3>Review the launch terms</h3>
      <p className={INTRO}>
        Every value below enters the signed configuration. The deterministic
        token address is knowable before launch — derived from the config and
        your address, so nobody can front-run it.
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
          <dd>{draft.totalSupply}</dd>
        </div>
        <div>
          <dt>Opening valuation</dt>
          <dd>125 ETH FDV · far level at 2x</dd>
        </div>
        <div>
          <dt>Supply allocation</dt>
          <dd>25% bonding curve · 65% milestone ladder · 10% full-range</dd>
        </div>
        <div>
          <dt>Payout plan</dt>
          <dd>
            {selected.length
              ? selected
                  .map((entry) => `#${entry.index} buyback-and-burn`)
                  .join(" · ")
              : "Empty plan — creator path receives every pot"}
          </dd>
        </div>
        <div>
          <dt>Plan economics</dt>
          <dd>
            Plugins {summary.takeSumPercent}% · creator remainder{" "}
            {summary.creatorRemainderPercent}%
          </dd>
        </div>
        <div>
          <dt>Dev buy</dt>
          <dd>
            {draft.devBuyEnabled
              ? `${draft.devBuyPercent}% of supply (${summary.devBuyTokens} tokens), no lockup`
              : "Not included"}
          </dd>
        </div>
        <div>
          <dt>Signing deadline</dt>
          <dd>{draft.deadlineMinutes} minutes from now</dd>
        </div>
        <div>
          <dt>Description</dt>
          <dd>{draft.description.trim() || "—"}</dd>
        </div>
        <div>
          <dt>Logo &amp; socials</dt>
          <dd>
            {draft.logoUrl ? "Logo on IPFS ✓" : "No logo"}
            {Object.values(draft.socials).some((value) => value.trim())
              ? " · socials linked"
              : ""}
          </dd>
        </div>
        <div>
          <dt>Predicted token address</dt>
          <dd>{predictedToken ?? "Deriving…"}</dd>
        </div>
        <div>
          <dt>Graduation split</dt>
          <dd>40% locked LP · 55% creator · 5% protocol</dd>
        </div>
        <div>
          <dt>Trading fee</dt>
          <dd>1% static, forever (ETH side on buys, token side on sells)</dd>
        </div>
        <div>
          <dt>Harvest routing</dt>
          <dd>10% service fee · 90% payout pot · flush tip 1% of new pots</dd>
        </div>
      </dl>
      <p className="mt-5 border-l-[3px] border-accent bg-raised px-4 py-3 text-sm text-ink-muted">
        Launching records this configuration in the local protocol simulation.
        When the chain client connects, the same config is signed EIP-712 and
        submitted to the hook.
      </p>
    </>
  );
}

export default LaunchConfigurator;
