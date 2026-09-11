import { createThirdwebClient } from "thirdweb";
import { upload, resolveScheme } from "thirdweb/storage";

/**
 * Client-side IPFS logo upload via thirdweb storage.
 *
 * The frontend owns the upload (credentials live in NEXT_PUBLIC_ env vars);
 * the resulting gateway URL is what the future backend stores as the
 * token's image link. Matches the reference launchpad flow exactly.
 */

function makeClient() {
  return createThirdwebClient({
    clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "",
    secretKey: process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY || "",
  });
}

function replaceClientId(url: string, newClientId: string): string {
  return url.replace(
    /https:\/\/([a-f0-9]+)\.ipfscdn\.io/,
    `https://${newClientId}.ipfscdn.io`,
  );
}

export const LOGO_MAX_BYTES = 4.3 * 1024 * 1024;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const LOGO_TYPE_LABEL = "PNG, JPEG, WEBP, or GIF under 4.3MB";

export interface LogoUploadResult {
  /** Resolved gateway URL to store as the token's image link. */
  url: string;
}

export async function uploadLogoToIPFS(file: File): Promise<LogoUploadResult> {
  if (!file || !process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID)
    throw new Error("IPFS uploads are not configured.");
  if (!LOGO_TYPES.includes(file.type))
    throw new Error("Logos must be PNG, JPEG, WEBP, or GIF.");
  if (file.size > LOGO_MAX_BYTES) throw new Error("Logos must be under 4.3MB.");

  const client = makeClient();
  const uri = await upload({
    client,
    files: [file],
    uploadWithoutDirectory: true,
  });

  let url = resolveScheme({ client, uri });

  if (!url.includes(process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID)) {
    url = replaceClientId(url, process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID);
  }

  return { url };
}

/** Truncates a contract address for display: 0x1234…abcd. */
export function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
