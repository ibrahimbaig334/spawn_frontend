"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Dialog, InputField, StatusMessage, StatusRegion, TextareaField } from "@/components/ui";
import { useProfile, useProfileTokens, useRevenueStreams, useUpdateProfile } from "@/lib/queries";
import { useWallet } from "@/lib/chain/wallet";
import { uploadLogoToIPFS } from "@/services/ipfs-client";
import { formatCompactEth, formatUtc } from "@/lib/display";
import { ApiError } from "@/lib/api/client";
import { isAddress } from "viem";

const PAGE =
  "mx-auto w-full max-w-measure px-[max(1rem,calc((100vw-80rem)/2))]";

export function ProfilePage({ walletAddress }: { walletAddress: string }) {
  const wallet = useWallet();
  const normalized = walletAddress.toLowerCase();
  const valid = isAddress(normalized);
  const profile = useProfile(valid ? normalized : null);
  const tokens = useProfileTokens(valid ? normalized : null);
  const streams = useRevenueStreams(valid ? normalized : null);
  const [editing, setEditing] = useState(false);
  const isSelf = Boolean(wallet.address && wallet.address.toLowerCase() === normalized);

  const data = profile.data;
  const display = data?.username ?? null;
  const avatar = data?.imageUri ?? null;

  return (
    <main className={`${PAGE} pb-24`} id="main-content">
      {!valid ? (
        <p className="py-24 text-center text-ink-muted">Invalid wallet address.</p>
      ) : (
        <>
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6 border-b-2 border-ink py-10 max-[48rem]:grid-cols-1">
            <div className="flex items-center gap-5 max-[34rem]:flex-col max-[34rem]:items-start">
              <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-ink bg-raised font-mono text-xl font-black text-accent-strong">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" className="size-full object-cover" />
                ) : (
                  (display ?? normalized.slice(2, 4)).slice(0, 2).toUpperCase()
                )}
              </span>
              <div className="min-w-0">
                <h1 className="m-0 text-[clamp(1.8rem,4.5vw,3rem)] font-black tracking-[-0.04em]">
                  {display ?? "Unnamed wallet"}
                </h1>
                <p className="m-0 font-mono text-xs text-ink-muted">{normalized}</p>
                {data?.createdAt ? (
                  <p className="m-0 font-mono text-xs text-ink-muted">Since {formatUtc(data.createdAt)}</p>
                ) : null}
              </div>
            </div>
            {isSelf ? (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit profile
              </Button>
            ) : null}
          </header>
          {data?.bio ? (
            <p className="mt-4 max-w-2xl whitespace-pre-wrap text-ink-muted">{data.bio}</p>
          ) : null}
          {profile.isError && (profile.error as ApiError).code === "PROFILE_NOT_FOUND" ? (
            <p className="mt-4 text-sm text-ink-muted">
              No profile details for this wallet yet{isSelf ? " — click Edit profile to add a username and bio." : "."}
            </p>
          ) : null}

          <div className="mt-10 grid grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] gap-[clamp(2rem,5vw,4rem)] items-start max-[68rem]:grid-cols-1">
            <section aria-labelledby="profile-tokens">
              <h2 className="text-[clamp(1.4rem,3vw,2rem)]" id="profile-tokens">
                Created launches ({tokens.data?.meta.total ?? 0})
              </h2>
              {tokens.data && tokens.data.data.length > 0 ? (
                <ul className="m-0 list-none border-t border-rule p-0">
                  {tokens.data.data.map((item) => (
                    <li key={item.poolId} className="flex items-center justify-between gap-4 border-b border-rule py-3">
                      <Link className="truncate font-bold text-ink no-underline hover:underline" href={`/tokens/${item.poolId}`}>
                        {item.name ?? "Unnamed"}{" "}
                        <span className="font-mono text-xs text-ink-muted">${item.symbol ?? "—"}</span>
                      </Link>
                      <span className="font-mono text-xs text-ink-muted">{item.status}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="border border-rule bg-raised p-6 text-center text-sm text-ink-muted">
                  No confirmed launches from this wallet yet.
                </p>
              )}
            </section>

            <section aria-labelledby="profile-streams">
              <h2 className="text-[clamp(1.4rem,3vw,2rem)]" id="profile-streams">
                Revenue streams ({streams.data?.length ?? 0})
              </h2>
              {streams.data && streams.data.length > 0 ? (
                <ul className="m-0 list-none border-t border-rule p-0 font-mono text-xs">
                  {streams.data.map((stream) => (
                    <li key={stream.pool_id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-rule py-2">
                      <Link className="truncate underline" href={`/tokens/${stream.pool_id}`}>
                        {stream.name ?? stream.token}
                      </Link>
                      <span>
                        {formatCompactEth(stream.creator_revenue_total, 4)} + path{" "}
                        {formatCompactEth(stream.creator_path_revenue_total, 4)} ETH
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="border border-rule bg-raised p-6 text-center text-sm text-ink-muted">
                  No RevenueNFTs currently held.
                </p>
              )}
              <p className="mt-3 text-xs text-ink-muted">
                Lifetime totals — open a pool for live claimable ledgers and claims.
              </p>
            </section>
          </div>
        </>
      )}
      {isSelf ? (
        <EditProfileDialog
          key={`${normalized}-${data?.username ?? "none"}`}
          open={editing}
          onClose={() => setEditing(false)}
          wallet={normalized}
          current={data}
        />
      ) : null}
    </main>
  );
}

function EditProfileDialog({
  open,
  onClose,
  wallet,
  current,
}: {
  open: boolean;
  onClose: () => void;
  wallet: string;
  current?: { username: string | null; bio: string | null; imageUri: string | null } | null;
}) {
  const update = useUpdateProfile(wallet);
  const [username, setUsername] = useState(current?.username ?? "");
  const [bio, setBio] = useState(current?.bio ?? "");
  const [imageUri, setImageUri] = useState(current?.imageUri ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    update.mutate(
      {
        username: username.trim() ? username.trim() : null,
        bio: bio.trim() ? bio.trim() : null,
        imageUri: imageUri.trim() ? imageUri.trim() : null,
      },
      {
        onSuccess: () => onClose(),
        onError: (cause) => {
          const apiError = cause as ApiError;
          setError(
            apiError.code === "USERNAME_TAKEN"
              ? "That username is already taken."
              : apiError.code === "VALIDATION_FAILED"
                ? apiError.fieldErrors.map((field) => `${field.path}: ${field.message}`).join("; ") || "Validation failed."
                : apiError.message,
          );
        },
      },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} title="Edit profile">
      <div className="grid gap-4">
        <InputField
          id="profile-username"
          label="Username"
          hint="3–32 characters, A–Z / a–z / 0–9 / underscore; unique case-insensitive."
          value={username}
          maxLength={32}
          onChange={(event) => setUsername(event.target.value)}
        />
        <TextareaField
          id="profile-bio"
          label="Bio"
          hint="Up to 300 characters."
          value={bio}
          maxLength={300}
          rows={3}
          onChange={(event) => setBio(event.target.value)}
        />
        <InputField
          id="profile-image"
          label="Avatar URI"
          optional
          hint="ipfs:// or https:// — upload a logo below."
          value={imageUri}
          onChange={(event) => setImageUri(event.target.value)}
        />
        <div>
          <input
            id="profile-avatar-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setUploading(true);
              try {
                const { url } = await uploadLogoToIPFS(file);
                setImageUri(url);
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "Upload failed.");
              } finally {
                setUploading(false);
              }
            }}
          />
          <label
            htmlFor="profile-avatar-upload"
            className="inline-flex min-h-10 cursor-pointer items-center rounded-sm border-2 border-ink px-3 text-sm font-bold"
          >
            {uploading ? "Uploading…" : "Upload avatar"}
          </label>
        </div>
        <StatusRegion>
          {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
          {update.isError ? <StatusMessage tone="error">{(update.error as Error).message}</StatusMessage> : null}
        </StatusRegion>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={update.isPending} onClick={save}>
            {update.isPending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
