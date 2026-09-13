import { hashTypedData, type Address, type Hex } from "viem";
import { LAUNCH_DOMAIN_NAME, LAUNCH_DOMAIN_VERSION } from "@/protocol/constants";

/**
 * EIP-712 launch digest (SpawnLaunchpad v1, verifyingContract = hook).
 * The struct includes `uri` — the documented handoff viem snippet that omits it
 * is wrong; this matches LaunchSignature.sol's typehash:
 *   LaunchConfig(address creator,string name,string symbol,string uri,
 *                uint256 totalSupply,uint64 devBuyShareWad,uint256 payoutPlan,uint256 deadline)
 */

export const launchTypedTypes = {
  LaunchConfig: [
    { name: "creator", type: "address" },
    { name: "name", type: "string" },
    { name: "symbol", type: "string" },
    { name: "uri", type: "string" },
    { name: "totalSupply", type: "uint256" },
    { name: "devBuyShareWad", type: "uint64" },
    { name: "payoutPlan", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export interface DigestConfig {
  creator: string;
  name: string;
  symbol: string;
  uri: string;
  totalSupply: string | bigint;
  devBuyShareWad: string | bigint;
  payoutPlan: string | bigint;
  deadline: string | number | bigint;
}

export interface DigestDomain {
  chainId: number;
  verifyingContract: string;
}

function toWad(value: string | bigint): bigint {
  if (typeof value === "bigint") return value;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return BigInt(trimmed);
  const [whole = "0", fraction = ""] = trimmed.split(".");
  return (BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, "0") || "0")) / 1n;
}

export function computeLaunchDigest(domain: DigestDomain, config: DigestConfig): Hex {
  return hashTypedData({
    domain: {
      name: LAUNCH_DOMAIN_NAME,
      version: LAUNCH_DOMAIN_VERSION,
      chainId: domain.chainId,
      verifyingContract: domain.verifyingContract as Address,
    },
    types: launchTypedTypes,
    primaryType: "LaunchConfig",
    message: {
      creator: config.creator as Address,
      name: config.name,
      symbol: config.symbol,
      uri: config.uri,
      totalSupply: typeof config.totalSupply === "string" && /^\d+$/.test(config.totalSupply)
        ? BigInt(config.totalSupply)
        : toWad(config.totalSupply),
      devBuyShareWad: toWad(config.devBuyShareWad),
      payoutPlan: BigInt(config.payoutPlan.toString()),
      deadline: BigInt(config.deadline.toString()),
    },
  });
}
