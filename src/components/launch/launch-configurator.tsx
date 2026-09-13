"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Hex } from "viem";
import { formatEther } from "viem";
import { Button, CheckboxField, InputField, SelectField, StatusMessage, StatusRegion, TextareaField } from "@/components/ui";
import { useLogoDropzone } from "@/components/launch/token-card";
import { resolveImageUrl, uploadLogoToIPFS } from "@/services/ipfs-client";
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
import { formatCompactEth, formatLevel, wei } from "@/lib/display";
import { formatSubscriptPrice, truncateDecimals } from "@/lib/format";
import { ethPerTokenWei } from "@/protocol/level-math";

const PAGE_WIDTH =
  "mx-auto w-full max-w-measure px-[max(1rem,calc((100vw-80rem)/2))]";
const STEPS = ["Identity", "Payout plan", "Dev buy", "Review & launch"] as const;

const DRAFT_KEY = "spawn.launch-draft.v4";

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
  devBuyEnabled: boolean;
  devBuyPercent: string;
  deadlineMinutes: number;
  mode: "relay" | "direct";
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
  devBuyEnabled: false,
  devBuyPercent: "5",
  deadlineMinutes: 60,
  mode: "relay",
};

function loadDraft(): Draft {
  if (typeof window === "undefined") return INITIAL_DRAFT;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return INITIAL_DRAFT;
    return { ...INITIAL_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) };
  } catch {
    return INITIAL_DRAFT;
  }
}

function formatWad(wad: bigint): string {
  return formatEther(wad);
}

export function LaunchConfigurator() {
  const router = useRouter();
  const wallet = useWallet();
  const protocol = useProtocol();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<LaunchPrepareResponse | null>(null);
  const [digestCheck, setDigestCheck] = useState<"unknown" | "ok" | "mismatch">("unknown");
  const [launchPhase, setLaunchPhase] = useState<"idle" | "prepared" | "relaying" | "submitting" | "pending" | "confirmed">("idle");
  const [relayError, setRelayError] = useState<string | null>(null);
  const relayKeyRef = useRef<string | null>(null);
  const prepareMutation = usePrepareLaunch();
  const relayMutation = useRelayLaunch();

  const [launchId, setLaunchId] = useState<string | null>(null);
  const record = useLaunchRecord(launchId, launchPhase === "relaying" || launchPhase === "pending");
  const { inputRef, labelProps, dragging } = useLogoDropzone((file) => void handleLogo(file));

  useEffect(() => {
    const id = window.setTimeout(() => setDraft(loadDraft()), 0);
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

  async function handleLogo(file: File) {
    if (file.size > 4.3 * 1024 * 1024) {
      setUploadError("Logo exceeds the 4.3MB upload limit.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const { ipfsUri } = await uploadLogoToIPFS(file);
      set("imageUri", ipfsUri);
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
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
  const planTakes = planTakesSumWad(
    selectedPlan,
    selectablePlugins.map((entry) => ({ index: entry.registryIndex, takeWad: wei(entry.takeWad) })),
  );
  const planTooWide = planIndices(selectedPlan).length > 8 || planTakes > WAD;

  const descriptionWords = draft.description.trim() ? draft.description.trim().split(/\s+/).length : 0;
  const identityValid =
    draft.name.trim().length >= 1 &&
    draft.name.trim().length <= 80 &&
    /^[A-Z0-9]{1,12}$/.test(draft.symbol.trim()) &&
    descriptionWords >= 5 &&
    descriptionWords <= 100;

  const devBuyShareWad = draft.devBuyEnabled
    ? ((BigInt(Math.round(Number(draft.devBuyPercent || "0") * 100)) * WAD) / 10_000n).toString()
    : "0";
  const devBuyWithinCap =
    draft.mode === "relay" || !draft.devBuyEnabled || wei(devBuyShareWad) <= MAX_DEV_BUY_SHARE_WAD;

  const deadline = useMemo(
    () => Math.floor(Date.now() / 1000) + draft.deadlineMinutes * 60,
    [draft.deadlineMinutes],
  );

  async function apiPrepare() {
    if (!wallet.address) throw new Error("Connect a wallet first.");
    return prepareMutation.mutateAsync({
      creatorWalletAddress: wallet.address,
      name: draft.name.trim(),
      symbol: draft.symbol.trim().toUpperCase(),
      description: draft.description.trim(),
      imageUri: draft.imageUri,
      socials: socials as TokenSocials | undefined,
      totalSupply: FIXED_TOTAL_SUPPLY.toString(),
      devBuyShareWad: draft.mode === "relay" ? "0" : devBuyShareWad,
      payoutPlan: draft.payoutPlan,
      deadline,
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
          setError("Direct launch reverted on-chain. Check the dev-buy budget and deadline freshness, then retry.");
        }
      });
      setLaunchPhase("pending");
    } catch (cause) {
      setLaunchPhase("prepared");
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(
        /rejected|denied|cancelled/i.test(message)
          ? "Launch rejected in your wallet."
          : `Direct launch failed: ${message}`,
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
          Launchpad · trusted-operator relay
        </p>
        <h1 className="my-2 text-[clamp(2.2rem,5vw,3.5rem)] font-black tracking-[-0.04em]">
          Create a token
        </h1>
        <p className="m-0 max-w-2xl text-ink-muted">
          Supply is pinned to <strong>1,000,000,000</strong> tokens, every launch opens at a 2 ETH FDV
          and graduates at ~4× onto Uniswap v4. You never sign: the protocol operator relays the
          launch — or send it directly from your wallet to include a dev buy.
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
                value={draft.name}
                onChange={(event) => set("name", event.target.value)}
                maxLength={80}
              />
              <InputField
                id="launch-symbol"
                label="Ticker symbol"
                hint="1–12 characters, A–Z / 0–9. Goes on-chain."
                value={draft.symbol}
                onChange={(event) => set("symbol", event.target.value.toUpperCase())}
                maxLength={12}
              />
              <TextareaField
                id="launch-description"
                label="Description"
                hint={`5–100 words (currently ${descriptionWords}). Stored off-chain on IPFS.`}
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
                <InputField
                  id="launch-image-uri"
                  label="Or paste an ipfs:// URI"
                  optional
                  value={draft.imageUri}
                  onChange={(event) => set("imageUri", event.target.value)}
                  placeholder="ipfs://bafk…"
                />
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
                Harvested pot value is delivered to selected payout plugins in registry order; the
                creator is the mandatory remainder. An empty plan sends everything to the creator
                path. Max 8 plugins, takes must total ≤ 100%.
              </p>
              {protocol.undeployed || selectablePlugins.length === 0 ? (
                <p className="border border-rule bg-raised p-4 text-sm text-ink-muted">
                  The plugin registry mirror is empty until the indexer syncs. The canonical plan
                  (buyback-and-burn, registry index 0) is preselected and validated against the live
                  registry at prepare time.
                </p>
              ) : (
                selectablePlugins.map((entry) => (
                  <CheckboxField
                    key={entry.registryIndex}
                    id={`plugin-${entry.registryIndex}`}
                    checked={hasPlanBit(selectedPlan, entry.registryIndex)}
                    label={`Registry #${entry.registryIndex} — ${entry.plugin.slice(0, 10)}…`}
                    hint={`take ${truncateDecimals(formatWad(wei(entry.takeWad)))}% · gas ${entry.gasLimit.toLocaleString()}`}
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
                <p className="m-0">
                  Plan bits: <strong>{planIndices(selectedPlan).join(", ") || "none (100% creator path)"}</strong>
                </p>
                <p className="m-0 mt-1">
                  Plugin takes: <strong>{truncateDecimals(formatWad(planTakes))}%</strong> · creator
                  remainder: <strong>{truncateDecimals(formatWad(WAD - planTakes))}%</strong>
                </p>
                {planTooWide ? (
                  <p className="m-0 mt-1 text-error">Selected plugins exceed 8 entries or 100% takes.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-5">
              <fieldset className="grid gap-3 border-0 p-0">
                <legend className="p-0 text-[0.9375rem] font-bold text-ink">Launch mode</legend>
                <CheckboxField
                  id="mode-relay"
                  checked={draft.mode === "relay"}
                  label="Relayed launch — the protocol operator signs and broadcasts (recommended)"
                  hint="Relayed launches skip the dev buy: the share stays curve inventory."
                  onChange={(event) => {
                    set("mode", event.target.checked ? "relay" : "direct");
                    if (event.target.checked) set("devBuyEnabled", false);
                  }}
                />
                <CheckboxField
                  id="mode-direct"
                  checked={draft.mode === "direct"}
                  label="Direct launch — your wallet sends launch(config, 0x) with the dev-buy budget"
                  hint="Required if you want a dev buy. Unused ETH auto-refunds."
                  onChange={(event) => {
                    set("mode", event.target.checked ? "direct" : "relay");
                    if (!event.target.checked) set("devBuyEnabled", false);
                  }}
                />
              </fieldset>
              <CheckboxField
                id="devbuy-enabled"
                checked={draft.devBuyEnabled && draft.mode === "direct"}
                disabled={draft.mode !== "direct"}
                label="Dev buy (creator purchases at launch)"
                hint={`Hard cap 10% of supply (${formatWad(MAX_DEV_BUY_SHARE_WAD)} share).`}
                onChange={(event) => set("devBuyEnabled", event.target.checked)}
              />
              {draft.devBuyEnabled && draft.mode === "direct" ? (
                <InputField
                  id="devbuy-percent"
                  label="Dev buy share (% of supply, ≤ 10)"
                  value={draft.devBuyPercent}
                  onChange={(event) => set("devBuyPercent", event.target.value.replace(/[^0-9.]/g, ""))}
                  inputMode="decimal"
                  error={
                    !devBuyWithinCap ? "Dev-buy share exceeds the 10% protocol cap." : undefined
                  }
                />
              ) : null}
              <div className="border-2 border-ink bg-raised p-4 font-mono text-sm">
                <p className="m-0">
                  If enabled you buy{" "}
                  <strong>
                    {formatCompactEth(
                      ((FIXED_TOTAL_SUPPLY * wei(devBuyShareWad)) / WAD).toString(),
                      0,
                    )}{" "}
                    tokens
                  </strong>{" "}
                  at fresh-curve cost — the exact ETH is quoted at review and unused value is
                  refunded by the hook.
                </p>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-5">
              {!wallet.address ? (
                <div className="border-2 border-ink bg-raised p-6 text-center">
                  <p className="m-0 mb-4 text-sm text-ink-muted">
                    Your wallet is the declared creator: it receives the RevenueNFT — the permanent
                    claim right to direct creator revenue. Transferring the NFT transfers the stream.
                  </p>
                  <Button onClick={() => void wallet.connect().catch((cause) => setError((cause as Error).message))}>
                    Connect wallet to continue
                  </Button>
                </div>
              ) : (
                <>
                  <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-rule py-4 text-sm max-[40rem]:grid-cols-1 [&_dt]:text-xs [&_dt]:text-ink-muted [&_dd]:m-0 [&_dd]:font-mono [&_dd]:font-bold">
                    <div>
                      <dt>Creator wallet (declared)</dt>
                      <dd>{wallet.address}</dd>
                    </div>
                    <div>
                      <dt>Total supply (pinned)</dt>
                      <dd>1,000,000,000 {draft.symbol || "TKN"}</dd>
                    </div>
                    <div>
                      <dt>Mode</dt>
                      <dd>{draft.mode === "relay" ? "Relayed by protocol operator" : "Direct from your wallet"}</dd>
                    </div>
                    <div>
                      <dt>Dev buy</dt>
                      <dd>
                        {draft.mode === "relay"
                          ? "skipped (relayed launches never dev-buy)"
                          : draft.devBuyEnabled
                            ? `${draft.devBuyPercent}% of supply`
                            : "none"}
                      </dd>
                    </div>
                  </dl>
                  <SelectField
                    id="launch-deadline"
                    label="Signature deadline window"
                    hint="Expired configs can be re-prepared — the predicted token address never moves."
                    value={String(draft.deadlineMinutes)}
                    onChange={(event) => set("deadlineMinutes", Number(event.target.value))}
                  >
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="240">4 hours</option>
                    <option value="1440">24 hours</option>
                  </SelectField>

                  {!prepared ? (
                    <Button
                      disabled={prepareMutation.isPending}
                      onClick={() => void prepare()}
                      fullWidth
                    >
                      {prepareMutation.isPending ? "Validating & uploading metadata…" : "Prepare launch (validate + predict address)"}
                    </Button>
                  ) : (
                    <div className="grid gap-4 border-2 border-ink bg-raised p-5">
                      <h2 className="m-0 text-xl">Ready to launch</h2>
                      <ul className="m-0 grid list-none gap-2 p-0 font-mono text-xs">
                        <li className="flex justify-between gap-2">
                          <span className="text-ink-muted">predicted token (CREATE2)</span>
                          <strong>{prepared.predictedToken}</strong>
                        </li>
                        <li className="flex justify-between gap-2">
                          <span className="text-ink-muted">opening → graduation level</span>
                          <strong>
                            {formatLevel(prepared.openingLevel)} → {formatLevel(prepared.farLevel)}
                          </strong>
                        </li>
                        <li className="flex justify-between gap-2">
                          <span className="text-ink-muted">opening price</span>
                          <strong>{formatSubscriptPrice(formatEther(ethPerTokenWei(prepared.openingLevel)))} {draft.symbol || "TKN"}</strong>
                        </li>
                        <li className="flex justify-between gap-2">
                          <span className="text-ink-muted">configHash</span>
                          <strong className="truncate">{prepared.configHash.slice(0, 22)}…</strong>
                        </li>
                        <li className="flex justify-between gap-2">
                          <span className="text-ink-muted">EIP-712 digest {digestCheck === "ok" ? "✓ verified vs on-chain view" : digestCheck === "mismatch" ? "⚠ MISMATCH" : "(verifying…)"}</span>
                          <strong className="truncate">{prepared.digest.slice(0, 22)}…</strong>
                        </li>
                        <li className="flex justify-between gap-2">
                          <span className="text-ink-muted">metadata</span>
                          <strong>{prepared.metadata?.ipfsUri.slice(0, 24) ?? "—"}…</strong>
                        </li>
                        {prepared.devBuyQuote ? (
                          <>
                            <li className="flex justify-between gap-2">
                              <span className="text-ink-muted">dev-buy cost (incl. 1% fee)</span>
                              <strong>{truncateDecimals(formatEther(BigInt(prepared.devBuyQuote.ethCost)))} ETH</strong>
                            </li>
                            <li className="flex justify-between gap-2">
                              <span className="text-ink-muted">msg.value budget (+5% headroom)</span>
                              <strong>{truncateDecimals(formatEther(BigInt(prepared.devBuyQuote.suggestedMsgValueWithHeadroom)))} ETH</strong>
                            </li>
                            <li className="flex justify-between gap-2">
                              <span className="text-ink-muted">dev-buy tokens out</span>
                              <strong>{formatCompactEth(prepared.devBuyQuote.tokensOut, 0)}</strong>
                            </li>
                          </>
                        ) : null}
                      </ul>

                      <StatusRegion>
                        {relayError || relayFailure ? (
                          <StatusMessage tone="error" onDismiss={() => setRelayError(null)}>
                            {relayError ?? relayFailure}
                          </StatusMessage>
                        ) : null}
                        {launchInFlight ? (
                          <StatusMessage tone="neutral" title="Waiting for confirmation">
                            {record.data?.transactionHash ? (
                              <>tx {record.data.transactionHash.slice(0, 18)}… — the indexer binds the
                              pool by configHash; you&apos;ll be redirected the moment it lands.</>
                            ) : (launchPhase === "relaying" ? "The operator is signing and broadcasting…" : "Waiting for the launch transaction…")}
                          </StatusMessage>
                        ) : null}
                        {confirmedPoolId ? (
                          <StatusMessage tone="success" title="Launched — opening pool page">
                            Token {record.data?.onchain?.token}
                          </StatusMessage>
                        ) : null}
                      </StatusRegion>

                      {draft.mode === "relay" ? (
                        <Button
                          disabled={launchInFlight || relayMutation.isPending}
                          onClick={() => void relay()}
                          fullWidth
                        >
                          {launchInFlight
                            ? "Launch submitted — waiting for the chain…"
                            : "Relay launch (operator signs, gasless for you)"}
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
                              : `Send launch from wallet${prepared.devBuyQuote ? ` (${truncateDecimals(formatEther(BigInt(prepared.devBuyQuote.suggestedMsgValueWithHeadroom)))} ETH budget)` : ""}`}
                        </Button>
                      )}
                      <p className="m-0 text-xs text-ink-muted">{prepared.signatureNote}</p>
                      <Button
                        variant="quiet"
                        onClick={() => {
                          setPrepared(null);
                          setLaunchId(null);
                          setLaunchPhase("idle");
                        }}
                      >
                        Re-prepare (fresh deadline)
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
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
              <li className="flex justify-between"><span className="text-ink-muted">opening FDV</span><strong>2 ETH</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">graduation</span><strong>~8 ETH FDV (≈4×)</strong></li>
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
      DEV_BUY_ABOVE_CAP: "Dev-buy share exceeds the 10% cap.",
      PAYOUT_PLAN_TOO_MANY_PLUGINS: "A plan selects at most 8 payout plugins.",
      PAYOUT_PLAN_ENTRY_SUSPENDED: "A selected plugin is suspended by governance.",
      PAYOUT_PLAN_ENTRY_NOT_SELECTABLE: "A selected registry entry is not a PAYOUT plugin.",
      PAYOUT_TAKES_ABOVE_WAD: "Selected plugin takes total more than 100%.",
      OPENING_LEVEL_OUT_OF_RANGE: "The supply places the opening level outside usable tick space.",
      PROTOCOL_NOT_DEPLOYED: "The protocol is not deployed on this chain yet.",
      METADATA_UPLOAD_FAILED: "IPFS metadata upload failed — retry shortly.",
      OPERATOR_NOT_CONFIGURED: "The backend operator key is not provisioned — use a direct launch.",
      RELAY_DISABLED: "Relayed launches are disabled (trusted operator unset) — use a direct launch.",
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
