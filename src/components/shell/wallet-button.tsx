"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/lib/chain/wallet";
import { truncateAddress } from "@/services/ipfs-client";
import { truncateDecimals } from "@/lib/format";

/**
 * Wallet connect button + connected menu (address, ETH balance, profile link,
 * disconnect, network fix). Any EIP-1193 provider works.
 */
export function WalletButton() {
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const connect = async (): Promise<void> => {
    setError(null);
    try {
      await wallet.connect();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connection failed.");
    }
  };

  if (!wallet.address) {
    return (
      <div className="relative">
        <button
          className="min-h-target cursor-pointer rounded-sm border-2 border-ink bg-ink px-4 py-2 text-sm font-bold text-inverse hover:bg-raised hover:text-ink"
          type="button"
          onClick={() => void connect()}
        >
          Connect wallet
        </button>
        {error ? (
          <p className="absolute right-0 top-full mt-1 w-64 rounded-sm border-2 border-error bg-raised p-2 text-xs font-semibold text-error">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const wrongNetwork = wallet.chainId !== wallet.targetChainId;

  return (
    <div className="relative" ref={ref}>
      <button
        className={[
          "flex min-h-target cursor-pointer items-center gap-2 rounded-sm border-2 px-3 py-2 text-sm font-bold",
          wrongNetwork ? "border-error bg-raised text-error" : "border-ink bg-raised text-ink",
        ].join(" ")}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {wrongNetwork ? (
          <span aria-hidden="true">⚠</span>
        ) : (
          <span
            className="size-2.5 rounded-full bg-accent"
            aria-hidden="true"
          />
        )}
        <span className="font-mono">{truncateAddress(wallet.address)}</span>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-sm border-2 border-ink bg-paper p-4 shadow-lg">
          <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            Connected
          </p>
          <p className="mt-1 font-mono text-sm break-all text-ink">{wallet.address}</p>
          {wallet.ethBalance !== null ? (
            <p className="mt-2 text-sm font-bold text-ink">
              {truncateDecimals(wallet.ethBalance)} ETH
            </p>
          ) : null}
          {wrongNetwork ? (
            <button
              className="mt-3 w-full cursor-pointer rounded-sm border-2 border-error bg-error px-3 py-2 text-sm font-bold text-inverse"
              type="button"
              onClick={() => void wallet.switchToTargetChain().catch(() => undefined)}
            >
              Switch to {wallet.targetChainId === 8453 ? "Base" : `chain ${wallet.targetChainId}`}
            </button>
          ) : (
            <Link
              className="mt-3 block rounded-sm border-2 border-ink bg-ink px-3 py-2 text-center text-sm font-bold text-inverse no-underline"
              href={`/profiles/${wallet.address}`}
              onClick={() => setOpen(false)}
            >
              My profile
            </Link>
          )}
          <button
            className="mt-2 w-full cursor-pointer rounded-sm border-2 border-rule bg-transparent px-3 py-2 text-sm font-bold text-ink-muted"
            type="button"
            onClick={() => {
              wallet.disconnect();
              setOpen(false);
            }}
          >
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}
