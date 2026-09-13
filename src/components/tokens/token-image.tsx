"use client";

import { useEffect, useState } from "react";
import { resolveImageUrl } from "@/services/ipfs-client";

/** Give a hanging gateway this long before trying the next source. */
const SOURCE_TIMEOUT_MS = 8_000;

const FALLBACK_GATEWAY = "https://ipfs.io/ipfs";

function fallbackSrc(uri: string): string | null {
  if (!uri.startsWith("ipfs://")) return null;
  return `${FALLBACK_GATEWAY}/${uri.slice("ipfs://".length)}`;
}

/**
 * Token logo with graceful degradation: primary gateway → public fallback
 * gateway → symbol letters. Broken-image icons never reach the user.
 */
export function TokenImage({
  imageUri,
  symbol,
  className,
  eager = false,
  hideOnFail = false,
  onFail,
}: {
  imageUri: string | null | undefined;
  symbol?: string | null;
  className?: string;
  eager?: boolean;
  /** Render nothing (instead of letters) once every source fails. */
  hideOnFail?: boolean;
  onFail?: () => void;
}) {
  const primary = resolveImageUrl(imageUri);
  const [stage, setStage] = useState(0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!primary || loaded || stage >= 2) return;
    const id = setTimeout(() => setStage((current) => current + 1), SOURCE_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [primary, loaded, stage]);
  const src =
    !primary || stage >= 2
      ? null
      : stage === 1
        ? (fallbackSrc(imageUri!) ?? primary)
        : primary;
  if (hideOnFail && (!primary || stage >= 2)) return null;
  if (!src) {
    return (
      <span className={className} aria-hidden="true">
        {symbol ? symbol.slice(0, 2).toUpperCase() : "?"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={className}
      loading={eager ? "eager" : "lazy"}
      onLoad={() => setLoaded(true)}
      onError={() =>
        setStage((current) => {
          if (current + 1 >= 2) onFail?.();
          return current + 1;
        })
      }
    />
  );
}
