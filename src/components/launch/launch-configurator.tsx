"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Hex } from "viem";
import { formatEther } from "viem";
import { Button, CheckboxField, InputField, StatusMessage, StatusRegion, TextareaField } from "@/components/ui";
import { useLogoDropzone } from "@/components/launch/token-card";
import { LOGO_TYPES, resolveImageUrl, uploadLogoToIPFS } from "@/services/ipfs-client";
import { useProtocol } from "@/lib/chain/protocol-context";
import { useWallet } from "@/lib/chain/wallet";
import { useLaunchRecord, usePrepareLaunch, useRelayLaunch } from "@/lib/queries";
import { newIdempotencyKey, ApiError } from "@/lib/api/client";
import { launchSupportAbi, milestoneHookAbi } from "@/lib/chain/abi";
import { computeLaunchDigest } from "@/lib/chain/launch-signature";
import type { LaunchPrepareResponse, TokenSocials } from "@/lib/api/dto";
import {
  FIXED_TOTAL_SUPPLY,
  MAX_DEV_BUY_SHARE_WAD,
  WAD,
} from "@/protocol/constants";
import {
  hasPlanBit,
  withoutPlanBit,
  withPlanBit,
  planIndices,
  planTakesSumWad,
} from "@/domain/payout-plan";
import { formatCompactEth, wei } from "@/lib/display";
import { parseDecimal } from "@/domain/economics";
import { formatSubscriptPrice, truncateDecimals } from "@/lib/format";
import { ethPerTokenWei } from "@/protocol/level-math";

const PAGE_WIDTH =
  "mx-auto w-full max-w-measure px-[max(1rem,calc((100vw-80rem)/2))]";
const STEPS = ["Identity", "Payout plan", "Dev buy", "Review & launch"] as const;

const DRAFT_KEY = "spawn.launch-draft.v5";

interface Draft {
  name: string;
  symbol: string;
  description: string;
  imageUri: string;
  website: string;
  x: string;
  telegram: string;
  discord: string;
  payoutPlan: string;
  /** Whole-token amount the creator buys at launch; "" skips the buy. */
  devBuyTokens: string;
}

const INITIAL_DRAFT: Draft = {
  name: "",
  symbol: "",
  description: "",
  imageUri: "",
  website: "",
  x: "",
  telegram: "",
  discord: "",
  payoutPlan: "1",
  devBuyTokens: "",
};

function loadDraft(): Draft {
  if (typeof window === "undefined") return INITIAL_DRAFT;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return INITIAL_DRAFT;
    const merged = { ...INITIAL_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) };
    // Object-URL previews don't survive reloads; force a fresh logo pick.
    if (typeof merged.imageUri === "string" && merged.imageUri.startsWith("blob:")) {
      merged.imageUri = "";
    }
    return merged;
  } catch {
    return INITIAL_DRAFT;
  }
}

/** takeWad is a WAD fraction (1e18 = 100%); render as a percent number. */
function formatTakePct(takeWad: bigint): string {
  return truncateDecimals(formatEther(takeWad * 100n));
}

/** Creator dev-buy cap: 10% of the pinned 1B supply, in whole tokens. */
const MAX_DEV_BUY_TOKENS = 100_000_000;

/** Parses the dev-buy token amount to token-wei; null = invalid, 0n = skipped. */
function parseDevBuyTokens(text: string): bigint | null {
  const trimmed = text.trim().replace(/,/g, "");
  if (trimmed === "") return 0n;
  return parseDecimal(trimmed, 18);
}

/** Human plugin name; registry internals (index, address, bits) stay hidden. */
function pluginLabel(entry: { plugin: string }, buyback: string | null): string {
  if (buyback && entry.plugin.toLowerCase() === buyback.toLowerCase()) return "Buyback & burn";
  return "Payout plugin";
}

export function LaunchConfigurator() {
  const router = useRouter();
  const wallet = useWallet();
  const protocol = useProtocol();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Logo file staged for upload: pinning happens when the launch is prepared,
  // not on selection (the draft only ever carries an ipfs:// URI or preview).
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<LaunchPrepareResponse | null>(null);
  // Silent safety check: the prepared digest is verified against the on-chain
  // view, but the result never surfaces in the UI. Mismatches log to console.
  const [, setDigestCheck] = useState<"unknown" | "ok" | "mismatch">("unknown");
  const [launchPhase, setLaunchPhase] = useState<"idle" | "prepared" | "relaying" | "submitting" | "pending" | "confirmed">("idle");
  const [relayError, setRelayError] = useState<string | null>(null);
  const relayKeyRef = useRef<string | null>(null);
  const prepareMutation = usePrepareLaunch();
  const relayMutation = useRelayLaunch();

  const [launchId, setLaunchId] = useState<string | null>(null);
  const record = useLaunchRecord(launchId, launchPhase === "relaying" || launchPhase === "pending");
  const { inputRef, labelProps, dragging } = useLogoDropzone((file) => void handleLogo(file));

  useEffect(() => {
    // Restore the saved draft only if the user hasn't typed yet: the timer
    // can otherwise land mid-fill (slow hydration) and wipe fresh input.
    const id = window.setTimeout(() => {
      setDraft((current) => (current === INITIAL_DRAFT ? loadDraft() : current));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        /* ignore */
      }
    }, 250);
    return () => clearTimeout(id);
  }, [draft]);

  const set = useCallback(
    <K extends keyof Draft>(key: K, value: Draft[K]) =>
      setDraft((current) => ({ ...current, [key]: value })),
    [],
  );

  function handleLogo(file: File) {
    if (!LOGO_TYPES.includes(file.type)) {
      setUploadError("Logos must be PNG, JPEG, WEBP, or GIF.");
      return;
    }
    if (file.size > 4.3 * 1024 * 1024) {
      setUploadError("Logo exceeds the 4.3MB upload limit.");
      return;
    }
    setUploadError(null);
    if (draft.imageUri.startsWith("blob:")) URL.revokeObjectURL(draft.imageUri);
    setLogoFile(file);
    set("imageUri", URL.createObjectURL(file));
  }

  const socials = useMemo(() => {
    const value: Record<string, string> = {};
    if (draft.website.trim()) value.website = draft.website.trim();
    if (draft.x.trim()) value.x = draft.x.trim();
    if (draft.telegram.trim()) value.telegram = draft.telegram.trim();
    if (draft.discord.trim()) value.discord = draft.discord.trim();
    return Object.keys(value).length ? value : undefined;
  }, [draft]);

  const selectedPlan = BigInt(draft.payoutPlan || "0");
  const selectablePlugins = protocol.plugins.filter(
    (entry) => entry.role === "PAYOUT" && !entry.suspended,
  );
  const buybackPlugin = protocol.addresses?.buybackAndBurnPlugin ?? null;
  const selectedEntries = selectablePlugins.filter((entry) =>
    hasPlanBit(selectedPlan, entry.registryIndex),
  );
  const planTakes = planTakesSumWad(
    selectedPlan,
    selectablePlugins.map((entry) => ({ index: entry.registryIndex, takeWad: wei(entry.takeWad) })),
  );
  const planTooWide = planIndices(selectedPlan).length > 8 || planTakes > WAD;

  const descriptionWords = draft.description.trim() ? draft.description.trim().split(/\s+/).length : 0;
  const trimmedName = draft.name.trim();
  const trimmedSymbol = draft.symbol.trim();
  // The launch API accepts any non-empty description; the logo is pinned to
  // IPFS at prepare time, so a staged file (or existing ipfs:// URI) counts.
  const logoReady = draft.imageUri.startsWith("ipfs://") || logoFile !== null;
  const identityValid =
    trimmedName.length >= 1 &&
    trimmedName.length <= 80 &&
    /^[A-Z0-9]{1,12}$/.test(trimmedSymbol) &&
    draft.description.trim().length >= 1 &&
    descriptionWords <= 100 &&
    logoReady;
  const nameError =
    draft.name && (trimmedName.length < 1 || trimmedName.length > 80)
      ? "Enter a token name (1–80 characters)."
      : null;
  const symbolError =
    draft.symbol && !/^[A-Z0-9]{1,12}$/.test(trimmedSymbol)
      ? "Use 1–12 characters, A–Z / 0–9."
      : null;
  const descriptionError =
    draft.description.trim() && descriptionWords > 100 ? "Keep it under 100 words." : null;
  const identityMissing = [
    trimmedName.length === 0 ? "a token name" : null,
    !/^[A-Z0-9]{1,12}$/.test(trimmedSymbol) ? "a valid symbol (A–Z / 0–9)" : null,
    draft.description.trim().length === 0 ? "a description" : null,
    !logoReady ? "a logo" : null,
  ].filter((item): item is string => item !== null);

  // Creator buy: a token amount in, WAD share out. Empty = no buy, which also
  // selects the automatic launch path (no wallet signature needed).
  const devBuyTokensWei = parseDevBuyTokens(draft.devBuyTokens);
  const wantsDevBuy = devBuyTokensWei !== null && devBuyTokensWei > 0n;
  const devBuyTokensWeiSafe = devBuyTokensWei ?? 0n;
  const devBuyShareWad = wantsDevBuy
    ? ((devBuyTokensWei * WAD) / FIXED_TOTAL_SUPPLY).toString()
    : "0";
  const devBuyWithinCap =
    devBuyTokensWei !== null &&
    devBuyTokensWei <= (FIXED_TOTAL_SUPPLY * MAX_DEV_BUY_SHARE_WAD) / WAD;
  const launchMode = wantsDevBuy ? "direct" : "relay";

  async function apiPrepare() {
    if (!wallet.address) throw new Error("Connect a wallet first.");
    // The staged logo is pinned now — selection only previews locally.
    let imageUri = draft.imageUri;
    if (logoFile) {
      setUploading(true);
      setUploadError(null);
      try {
        const { ipfsUri } = await uploadLogoToIPFS(logoFile);
        imageUri = ipfsUri;
        set("imageUri", ipfsUri);
        setLogoFile(null);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Logo upload failed.";
        setUploadError(message);
        throw new Error(message);
      } finally {
        setUploading(false);
      }
    }
    if (!imageUri.startsWith("ipfs://")) throw new Error("Select a logo first.");
    return prepareMutation.mutateAsync({
      creatorWalletAddress: wallet.address,
      name: draft.name.trim(),
      symbol: draft.symbol.trim().toUpperCase(),
      description: draft.description.trim(),
      imageUri,
      socials: socials as TokenSocials | undefined,
      totalSupply: FIXED_TOTAL_SUPPLY.toString(),
      devBuyShareWad,
      payoutPlan: draft.payoutPlan,
      // Fixed 24h window, set automatically — never shown in the UI.
      deadline: Math.floor(Date.now() / 1000) + 24 * 3600,
    });
  }

  async function prepare() {
    setError(null);
    try {
      const result = await apiPrepare();
      setPrepared(result);
      setLaunchId(result.launchId);
      setLaunchPhase("prepared");
      relayKeyRef.current = null;
      void crossCheckDigest(result);
    } catch (cause) {
      setError(describeApiError(cause));
    }
  }

  /**
   * Cross-check the backend digest against the on-chain LaunchSupport view and
   * our own viem EIP-712 computation (START-HERE fact #2).
   */
  async function crossCheckDigest(result: NonNullable<typeof prepared>) {
    try {
      const local = computeLaunchDigest(
        { chainId: result.chainId, verifyingContract: result.domain.verifyingContract as Hex },
        result.config,
      );
      if (local.toLowerCase() !== result.digest.toLowerCase()) {
        setDigestCheck("mismatch");
        return;
      }
      if (protocol.addresses) {
        const onchain = (await wallet.publicClient.readContract({
          address: protocol.addresses.launchSupport as Hex,
          abi: launchSupportAbi,
          functionName: "launchDigest",
          args: [
            {
              creator: result.config.creator as Hex,
              name: result.config.name,
              symbol: result.config.symbol,
              uri: result.config.uri,
              totalSupply: BigInt(result.config.totalSupply),
              devBuyShareWad: wei(result.config.devBuyShareWad),
              payoutPlan: BigInt(result.config.payoutPlan),
              deadline: BigInt(result.config.deadline),
            },
            protocol.addresses.hook as Hex,
          ],
        })) as Hex;
        setDigestCheck(onchain.toLowerCase() === result.digest.toLowerCase() ? "ok" : "mismatch");
      } else {
        setDigestCheck("ok");
      }
    } catch {
      setDigestCheck("unknown");
    }
  }

  async function relay() {
    if (!prepared) return;
    setError(null);
    setRelayError(null);
    setLaunchPhase("relaying");
    relayKeyRef.current ??= newIdempotencyKey();
    try {
      await relayMutation.mutateAsync({ launchId: prepared.launchId, idempotencyKey: relayKeyRef.current });
      setLaunchPhase("pending");
    } catch (cause) {
      setLaunchPhase("prepared");
      setRelayError(describeApiError(cause));
    }
  }

  async function directLaunch() {
    if (!prepared || !wallet.address || !wallet.walletClient || !protocol.addresses) return;
    setError(null);
    setLaunchPhase("submitting");
    try {
      const config = {
        creator: prepared.config.creator as Hex,
        name: prepared.config.name,
        symbol: prepared.config.symbol,
        uri: prepared.config.uri,
        totalSupply: BigInt(prepared.config.totalSupply),
        devBuyShareWad: wei(prepared.config.devBuyShareWad),
        payoutPlan: BigInt(prepared.config.payoutPlan),
        deadline: BigInt(prepared.config.deadline),
      };
      const value = prepared.devBuyQuote
        ? BigInt(prepared.devBuyQuote.suggestedMsgValueWithHeadroom)
        : 0n;
      const hash = await wallet.walletClient.writeContract({
        address: protocol.addresses.hook as Hex,
        abi: milestoneHookAbi,
        functionName: "launch",
        args: [config, "0x"],
        value,
        account: wallet.address,
        chain: wallet.walletClient.chain ?? null,
      });
      void wallet.publicClient.waitForTransactionReceipt({ hash, pollingInterval: 1_500, timeout: 240_000 }).then((receipt) => {
        if (receipt.status === "success") setLaunchPhase("pending");
        else {
          setLaunchPhase("prepared");
          setError("Launch didn't go through. Check your buy budget, then try again.");
        }
      });
      setLaunchPhase("pending");
    } catch (cause) {
      setLaunchPhase("prepared");
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(
        /rejected|denied|cancelled/i.test(message)
          ? "You rejected the transaction in your wallet."
          : `Launch failed: ${message}`,
      );
    }
  }

  const confirmedPoolId =
    record.data?.state === "CONFIRMED" ? (record.data.onchain?.poolId ?? null) : null;
  const recordFailed = record.data?.state === "FAILED";
  useEffect(() => {
    if (!confirmedPoolId) return;
    const timer = window.setTimeout(() => router.push(`/tokens/${confirmedPoolId}`), 1_500);
    return () => window.clearTimeout(timer);
  }, [confirmedPoolId, router]);
  const relayFailure =
    launchPhase === "pending" && recordFailed
      ? (record.data?.failureReason ?? "The relayed launch failed.")
      : null;
  const launchInFlight = (launchPhase === "relaying" || launchPhase === "pending") && !recordFailed;

  const stepValid = [
    identityValid,
    !planTooWide,
    devBuyWithinCap,
    Boolean(wallet.address),
  ][step];

  return (
    <main className={`${PAGE_WIDTH} py-12`} id="main-content">
      <header className="mb-8 border-b-2 border-ink pb-6">
        <p className="m-0 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-accent-strong">
          Launchpad
        </p>
        <h1 className="my-2 text-[clamp(2.2rem,5vw,3.5rem)] font-black tracking-[-0.04em]">
          Create a token
        </h1>
        <p className="m-0 max-w-2xl text-ink-muted">
          Supply is pinned to <strong>1,000,000,000</strong> tokens, every launch opens at a
          ≈ $5,000 market cap and graduates at ~4× onto Uniswap v4. Buying at launch sends one
          transaction from your wallet — otherwise your token launches without you signing anything.
        </p>
      </header>

      <nav className="mb-8 flex flex-wrap gap-2" aria-label="Launch steps">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            aria-current={step === index ? "step" : undefined}
            disabled={index > step && !stepValid}
            className={[
              "min-h-10 cursor-pointer rounded-sm border-2 px-4 py-2 text-sm font-bold",
              step === index
                ? "border-ink bg-ink text-inverse"
                : "border-rule text-ink-muted hover:border-ink hover:text-ink",
            ].join(" ")}
            onClick={() => setStep(index)}
          >
            {index + 1}. {label}
          </button>
        ))}
      </nav>

      <StatusRegion className="mb-6">
        {protocol.undeployed ? (
          <StatusMessage tone="warning" title="Protocol not deployed">
            The backend has no deployment manifest for chain {wallet.targetChainId} yet — launches
            return <code>PROTOCOL_NOT_DEPLOYED</code>. The wizard stays fully usable and will work
            the moment the deployment syncs.
          </StatusMessage>
        ) : null}
        {error ? <StatusMessage tone="error" onDismiss={() => setError(null)}>{error}</StatusMessage> : null}
      </StatusRegion>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] gap-[clamp(2rem,5vw,4rem)] items-start max-[68rem]:grid-cols-1">
        <div className="min-w-0">
          {step === 0 ? (
            <div className="grid gap-5">
              <InputField
                id="launch-name"
                label="Token name"
                hint="1–80 characters. Goes on-chain."
                error={nameError ?? undefined}
                value={draft.name}
                onChange={(event) => set("name", event.target.value)}
                maxLength={80}
              />
              <InputField
                id="launch-symbol"
                label="Ticker symbol"
                hint="1–12 characters, A–Z / 0–9. Goes on-chain."
                error={symbolError ?? undefined}
                value={draft.symbol}
                onChange={(event) => set("symbol", event.target.value.toUpperCase())}
                maxLength={12}
              />
              <TextareaField
                id="launch-description"
                label="Description"
                hint={`1–100 words (currently ${descriptionWords}). Stored off-chain on IPFS.`}
                error={descriptionError ?? undefined}
                value={draft.description}
                onChange={(event) => set("description", event.target.value)}
                rows={4}
              />
              <div className="grid gap-2">
                <span className="text-[0.9375rem] font-bold text-ink">Logo</span>
                <label
                  {...labelProps}
                  htmlFor="launch-logo-input"
                  className={[
                    "grid min-h-32 cursor-pointer place-items-center rounded-sm border-2 border-dashed p-6 text-center transition-colors",
                    dragging ? "border-focus bg-raised" : "border-ink-muted",
                  ].join(" ")}
                >
                  {draft.imageUri ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveImageUrl(draft.imageUri)} alt="Uploaded logo" className="max-h-36 object-contain" />
                  ) : uploading ? (
                    <span className="font-mono text-sm text-ink-muted">Uploading to IPFS…</span>
                  ) : (
                    <span className="text-sm text-ink-muted">
                      Drop an image or click to upload (PNG/JPEG/WEBP/GIF ≤ 4.3MB)
                    </span>
                  )}
                </label>
                <input
                  ref={inputRef}
                  id="launch-logo-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleLogo(file);
                  }}
                />
                {uploadError ? <span className="text-xs font-bold text-error">{uploadError}</span> : null}
                <p className="m-0 text-xs text-ink-muted">
                  {logoFile
                    ? `Selected: ${logoFile.name} — uploads to IPFS when you prepare the launch.`
                    : draft.imageUri.startsWith("ipfs://")
                      ? "Logo pinned to IPFS."
                      : "A logo is required — it uploads to IPFS when you prepare the launch."}
                </p>
              </div>
              <fieldset className="grid gap-4 border-0 p-0">
                <legend className="mb-1 p-0 text-[0.9375rem] font-bold text-ink">Socials (optional, https)</legend>
                <InputField id="launch-website" label="Website" optional value={draft.website} onChange={(event) => set("website", event.target.value)} placeholder="https://…" />
                <InputField id="launch-x" label="X / Twitter" optional value={draft.x} onChange={(event) => set("x", event.target.value)} placeholder="https://x.com/…" />
                <InputField id="launch-telegram" label="Telegram" optional value={draft.telegram} onChange={(event) => set("telegram", event.target.value)} placeholder="https://t.me/…" />
                <InputField id="launch-discord" label="Discord" optional value={draft.discord} onChange={(event) => set("discord", event.target.value)} placeholder="https://discord.gg/…" />
              </fieldset>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-5">
              <p className="m-0 text-sm text-ink-muted">
                When milestones pay out, each plugin below takes its cut first and whatever is
                left always goes to you, the creator. Select none and 100% flows to you.
              </p>
              {protocol.undeployed || selectablePlugins.length === 0 ? (
                <p className="border border-rule bg-raised p-4 text-sm text-ink-muted">
                  The plugin list is still syncing. The buyback-and-burn plugin is preselected and
                  validated against the live registry at prepare time.
                </p>
              ) : (
                selectablePlugins.map((entry) => (
                  <CheckboxField
                    key={entry.registryIndex}
                    id={`plugin-${entry.registryIndex}`}
                    checked={hasPlanBit(selectedPlan, entry.registryIndex)}
                    label={pluginLabel(entry, buybackPlugin)}
                    hint={`Takes ${formatTakePct(wei(entry.takeWad))}% of each payout`}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? withPlanBit(selectedPlan, entry.registryIndex)
                        : withoutPlanBit(selectedPlan, entry.registryIndex);
                      set("payoutPlan", next.toString());
                    }}
                  />
                ))
              )}
              <div className="border-2 border-ink bg-raised p-4 font-mono text-sm">
                <p className="m-0 font-bold uppercase text-ink-muted">Whole split</p>
                <ul className="mt-2 m-0 grid list-none gap-1 p-0">
                  {selectedEntries.map((entry) => (
                    <li key={entry.registryIndex} className="flex justify-between gap-2">
                      <span>{pluginLabel(entry, buybackPlugin)}</span>
                      <strong>{formatTakePct(wei(entry.takeWad))}%</strong>
                    </li>
                  ))}
                  <li className="flex justify-between gap-2">
                    <span>You (creator remainder)</span>
                    <strong>{formatTakePct(WAD - planTakes)}%</strong>
                  </li>
                </ul>
                {planTooWide ? (
                  <p className="m-0 mt-1 text-error">Select at most 8 plugins totaling no more than 100%.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-5">
              <p className="m-0 text-sm text-ink-muted">
                Optional: buy your own tokens at the opening price. If you buy anything, you
                send one transaction from your wallet at launch — otherwise the token launches
                without you signing anything.
              </p>
              <InputField
                id="devbuy-tokens"
                label={`How many ${draft.symbol || "tokens"} do you want to buy?`}
                hint={`Max ${MAX_DEV_BUY_TOKENS.toLocaleString("en-US")} (10% of supply). Leave empty to skip.`}
                optional
                value={draft.devBuyTokens}
                onChange={(event) => set("devBuyTokens", event.target.value.replace(/[^0-9.,]/g, ""))}
                inputMode="decimal"
                placeholder="0"
                error={
                  devBuyTokensWei === null
                    ? "Enter a token amount (numbers only)."
                    : !devBuyWithinCap
                      ? "Exceeds the 10% cap (100,000,000 tokens)."
                      : undefined
                }
              />
              {wantsDevBuy && devBuyWithinCap ? (
                <div className="border-2 border-ink bg-raised p-4 font-mono text-sm">
                  <p className="m-0">
                    You buy{" "}
                    <strong>
                      {formatCompactEth(devBuyTokensWeiSafe.toString(), 0)} {draft.symbol || "tokens"}
                    </strong>{" "}
                    at fresh-curve cost — the exact ETH is quoted at review and unused value is
                    refunded.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-5">
              {!wallet.address ? (
                <div className="border-2 border-ink bg-raised p-6 text-center">
                  <p className="m-0 mb-4 text-sm text-ink-muted">
                    Your wallet becomes the creator: it receives an earnings pass — the permanent
                    right to claim this token&apos;s creator earnings. Whoever holds the pass earns.
                  </p>
                  <Button onClick={() => void wallet.connect().catch((cause) => setError((cause as Error).message))}>
                    Connect wallet to continue
                  </Button>
                </div>
              ) : (
                <>
                  <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-rule py-4 text-sm max-[40rem]:grid-cols-1 [&_dt]:text-xs [&_dt]:text-ink-muted [&_dd]:m-0 [&_dd]:font-mono [&_dd]:font-bold">
                    <div>
                      <dt>Supply</dt>
                      <dd>1,000,000,000 {draft.symbol || "tokens"}</dd>
                    </div>
                    <div>
                      <dt>Your buy at launch</dt>
                      <dd>
                        {wantsDevBuy
                          ? `${formatCompactEth(devBuyTokensWeiSafe.toString(), 0)} ${draft.symbol || "tokens"}`
                          : "none"}
                      </dd>
                    </div>
                  </dl>

                  {!prepared ? (
                    <Button
                      disabled={prepareMutation.isPending || uploading}
                      onClick={() => void prepare()}
                      fullWidth
                    >
                      {uploading
                        ? "Uploading logo…"
                        : prepareMutation.isPending
                          ? "Getting your token ready…"
                          : "Create token"}
                    </Button>
                  ) : (
                    <div className="grid gap-4 border-2 border-ink bg-raised p-5">
                      <h2 className="m-0 text-xl">Ready to launch</h2>
                      <ul className="m-0 grid list-none gap-2 p-0 font-mono text-xs">
                        <li className="flex justify-between gap-2">
                          <span className="text-ink-muted">opening price</span>
                          <strong>{formatSubscriptPrice(formatEther(ethPerTokenWei(prepared.openingLevel)))} ETH</strong>
                        </li>
                        {prepared.devBuyQuote ? (
                          <li className="flex justify-between gap-2">
                            <span className="text-ink-muted">your buy costs</span>
                            <strong>{truncateDecimals(formatEther(BigInt(prepared.devBuyQuote.ethCost)))} ETH</strong>
                          </li>
                        ) : null}
                      </ul>

                      <StatusRegion>
                        {relayError || relayFailure ? (
                          <StatusMessage tone="error" onDismiss={() => setRelayError(null)}>
                            {relayError ?? relayFailure}
                          </StatusMessage>
                        ) : null}
                        {launchInFlight ? (
                          <StatusMessage tone="neutral" title="Launching…">
                            You&apos;ll be taken to your token&apos;s page the moment it&apos;s live.
                          </StatusMessage>
                        ) : null}
                        {confirmedPoolId ? (
                          <StatusMessage tone="success" title="Launched — opening your token page">
                            Taking you there now…
                          </StatusMessage>
                        ) : null}
                      </StatusRegion>

                      {launchMode === "relay" ? (
                        <Button
                          disabled={launchInFlight || relayMutation.isPending}
                          onClick={() => void relay()}
                          fullWidth
                        >
                          {launchInFlight
                            ? "Launching — waiting for the chain…"
                            : "Launch token"}
                        </Button>
                      ) : (
                        <Button
                          disabled={launchInFlight}
                          onClick={() => void directLaunch()}
                          fullWidth
                        >
                          {launchPhase === "submitting"
                            ? "Check your wallet…"
                            : launchPhase === "pending"
                              ? "Launch pending…"
                              : `Buy & launch from wallet${prepared.devBuyQuote ? ` (${truncateDecimals(formatEther(BigInt(prepared.devBuyQuote.suggestedMsgValueWithHeadroom)))} ETH)` : ""}`}
                        </Button>
                      )}
                      <Button
                        variant="quiet"
                        onClick={() => {
                          setPrepared(null);
                          setLaunchId(null);
                          setLaunchPhase("idle");
                        }}
                      >
                        Re-prepare
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : null}

          {step === 0 && identityMissing.length > 0 ? (
            <p className="mt-8 mb-0 text-sm text-ink-muted" role="status">
              To continue, add {identityMissing.join(", ")}.
            </p>
          ) : null}
          <div className="mt-8 flex justify-between">
            <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Back
            </Button>
            <Button
              disabled={step === STEPS.length - 1 || !stepValid}
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            >
              Next
            </Button>
          </div>
        </div>

        <aside className="sticky top-4 grid gap-4" aria-label="Launch preview">
          <div className="overflow-hidden rounded-xl border-2 border-ink bg-carbon text-[#e9e7e0]">
            <div className="grid h-40 place-items-center overflow-hidden bg-[#14100d]">
              {draft.imageUri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveImageUrl(draft.imageUri)} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-mono text-sm text-[#e9e7e0]/50">preview</span>
              )}
            </div>
            <div className="grid gap-2 p-4">
              <p className="m-0 text-sm font-bold">{draft.name || "Your token name"}</p>
              <p className="m-0 font-mono text-xs text-[#f5c518]">{draft.symbol || "SYMBOL"}</p>
              <p className="m-0 line-clamp-3 text-xs text-[#e9e7e0]/70">
                {draft.description || "Your description appears here."}
              </p>
            </div>
          </div>
          <div className="border border-rule bg-raised p-4 font-mono text-xs">
            <p className="m-0 font-bold uppercase text-ink-muted">Economics preview</p>
            <ul className="mt-2 m-0 grid gap-1 p-0">
              <li className="flex justify-between"><span className="text-ink-muted">opening MC</span><strong>≈ $5,000</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">graduation</span><strong>≈ $20,000 MC (≈4×)</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">curve / ladder / wall+LP</span><strong>250M / 100M / 650M</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">graduation split</span><strong>70% creator / 20% LP / 10% proto</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">trading fee</span><strong>1% static</strong></li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}

function describeApiError(cause: unknown): string {
  if (cause instanceof ApiError) {
    const fieldErrors = cause.fieldErrors.length
      ? ` ${cause.fieldErrors.map((e) => `${e.path}: ${e.message}`).join("; ")}`
      : "";
    const byCode: Record<string, string> = {
      SUPPLY_NOT_FIXED: "Total supply is pinned to 1,000,000,000 — it cannot be changed.",
      DEV_BUY_ABOVE_CAP: "Dev-buy exceeds the 10% cap (100,000,000 tokens).",
      PAYOUT_PLAN_TOO_MANY_PLUGINS: "A plan selects at most 8 payout plugins.",
      PAYOUT_PLAN_ENTRY_SUSPENDED: "A selected plugin is suspended by governance.",
      PAYOUT_PLAN_ENTRY_NOT_SELECTABLE: "A selected registry entry is not a PAYOUT plugin.",
      PAYOUT_TAKES_ABOVE_WAD: "Selected plugin takes total more than 100%.",
      OPENING_LEVEL_OUT_OF_RANGE: "The supply places the opening level outside usable tick space.",
      PROTOCOL_NOT_DEPLOYED: "The protocol is not deployed on this chain yet.",
      METADATA_UPLOAD_FAILED: "IPFS metadata upload failed — retry shortly.",
      OPERATOR_NOT_CONFIGURED: "Launching is temporarily unavailable — try again later.",
      RELAY_DISABLED: "Launching is temporarily unavailable — try again later.",
      LAUNCH_BROADCAST_FAILED: "The relayer failed to broadcast the launch.",
      REQUEST_IN_PROGRESS: "A previous request is still in flight — wait a moment.",
      IDEMPOTENCY_KEY_REUSED: "This launch was already relayed.",
      VALIDATION_FAILED: `Validation failed.${fieldErrors}`,
      RATE_LIMITED: `Rate limited${cause.retryAfterSeconds ? ` — retry after ${cause.retryAfterSeconds}s` : ""}.`,
      NETWORK_ERROR: "The API is unreachable — is the backend running?",
    };
    return `${byCode[cause.code] ?? `Launch API error (${cause.code})`}${cause.requestId ? ` [request ${cause.requestId.slice(0, 8)}]` : ""}`;
  }
  return cause instanceof Error ? cause.message : "Unexpected error.";
}
