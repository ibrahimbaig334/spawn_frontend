import { apiMutation } from "@/lib/api/client";
import { APP_ENV } from "@/lib/env";

/**
 * Logo upload via the backend (`POST /tokens/images`), which pins to Pinata
 * server-side. No storage credentials live in the browser bundle.
 *
 * Form state keeps the canonical `ipfs://` URI (the backend only accepts
 * ipfs:// image URIs); `resolveImageUrl` maps it to a gateway URL for `<img>`.
 */

const IPFS_GATEWAY = APP_ENV.ipfsGateway.replace(/\/+$/, "");

/** Browser-displayable URL for an `ipfs://` URI (passes https:// through). */
export function resolveImageUrl(uri: string | null | undefined): string | undefined {
  if (!uri) return undefined;
  if (!uri.startsWith("ipfs://")) return uri;
  return `${IPFS_GATEWAY}/${uri.slice("ipfs://".length)}`;
}

export const LOGO_MAX_BYTES = 4.3 * 1024 * 1024;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const LOGO_TYPE_LABEL = "PNG, JPEG, WEBP, or GIF under 4.3MB";

export interface LogoUploadResult {
  /** Canonical `ipfs://` URI — store this in form state / send to the API. */
  ipfsUri: string;
  /** Gateway URL — use for `<img>` previews. */
  url: string;
}

interface UploadImageResponse {
  ipfsUri: string;
  gatewayUrl: string;
  url: string;
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read file."));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadLogoToIPFS(file: File): Promise<LogoUploadResult> {
  if (!file) throw new Error("No file selected.");
  if (!LOGO_TYPES.includes(file.type))
    throw new Error("Logos must be PNG, JPEG, WEBP, or GIF.");
  if (file.size > LOGO_MAX_BYTES) throw new Error("Logos must be under 4.3MB.");

  const contentBase64 = await readAsBase64(file);
  const result = await apiMutation<UploadImageResponse>("/tokens/images", {
    filename: file.name || "logo",
    contentType: file.type,
    contentBase64,
  });
  return { ipfsUri: result.ipfsUri, url: result.url ?? result.gatewayUrl };
}

/** Truncates a contract address for display: 0x1234…abcd. */
export function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
