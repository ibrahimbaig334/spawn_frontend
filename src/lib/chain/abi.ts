import { type Address, type Hex } from "viem";

/**
 * Contract surfaces used by the frontend. Only MilestoneHook is ever sent to a
 * signer for state changes (satellite contracts are delegatecall implementations
 * or read-only observers — direct state calls revert).
 */

export const POOL_KEY_TUPLE = {
  type: "tuple",
  name: "key",
  components: [
    { name: "currency0", type: "address" },
    { name: "currency1", type: "address" },
    { name: "fee", type: "uint24" },
    { name: "tickSpacing", type: "int24" },
    { name: "hooks", type: "address" },
  ],
} as const;

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export const LAUNCH_CONFIG_COMPONENTS = [
  { name: "creator", type: "address" },
  { name: "name", type: "string" },
  { name: "symbol", type: "string" },
  { name: "uri", type: "string" },
  { name: "totalSupply", type: "uint256" },
  { name: "devBuyShareWad", type: "uint64" },
  { name: "payoutPlan", type: "uint256" },
  { name: "deadline", type: "uint256" },
] as const;

export const milestoneHookAbi = [
  {
    type: "function",
    name: "launch",
    stateMutability: "payable",
    inputs: [
      { name: "config", type: "tuple", components: LAUNCH_CONFIG_COMPONENTS },
      { name: "signature", type: "bytes" },
    ],
    outputs: [
      { name: "poolId", type: "bytes32" },
      { name: "token", type: "address" },
      { name: "key", type: "tuple", components: POOL_KEY_TUPLE.components.map((c) => ({ ...c })) },
    ],
  },
  {
    type: "function",
    name: "graduate",
    stateMutability: "nonpayable",
    inputs: [{ ...POOL_KEY_TUPLE }],
    outputs: [],
  },
  {
    type: "function",
    name: "collectFees",
    stateMutability: "nonpayable",
    inputs: [{ ...POOL_KEY_TUPLE }],
    outputs: [
      { name: "quoteFees", type: "uint256" },
      { name: "tokenFees", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "flushTo",
    stateMutability: "nonpayable",
    inputs: [
      { name: "poolId", type: "bytes32" },
      { name: "tipTo", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "flushBatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "pools", type: "bytes32[]" },
      { name: "tipTo", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimCreator",
    stateMutability: "nonpayable",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimCreatorPath",
    stateMutability: "nonpayable",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [
      { name: "success", type: "bool" },
      { name: "attemptedAmount", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "claimCreatorPathBatch",
    stateMutability: "nonpayable",
    inputs: [{ name: "pools", type: "bytes32[]" }],
    outputs: [
      { name: "", type: "bool[]" },
      { name: "", type: "uint256[]" },
    ],
  },
  {
    type: "function",
    name: "creatorClaimable",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "creatorPathClaimable",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "payoutPot",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "carryBitmap",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "payoutPlan",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "bandLevels",
    stateMutability: "view",
    inputs: [
      { name: "poolId", type: "bytes32" },
      { name: "index", type: "uint256" },
    ],
    outputs: [
      { name: "lower", type: "int24" },
      { name: "upper", type: "int24" },
      { name: "exists", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "template",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "openingFdvWei", type: "uint256" },
          { name: "curvePositions", type: "uint16" },
          { name: "curveSpanLevels", type: "int24" },
          { name: "bandLevelSpacing", type: "int24" },
          { name: "bandFirstStepLevels", type: "int24" },
          { name: "bandStepDecayLevels", type: "int24" },
          { name: "bandWidthLevels", type: "int24" },
          { name: "coreBandCount", type: "uint8" },
          { name: "maxFeeFundedBands", type: "uint8" },
          { name: "curveSupplyShareWad", type: "uint64" },
          { name: "ladderSupplyShareWad", type: "uint64" },
          { name: "fullRangeSupplyShareWad", type: "uint64" },
          { name: "lpSeedWad", type: "uint64" },
          { name: "proceedsCreatorWad", type: "uint64" },
          { name: "proceedsProtocolWad", type: "uint64" },
          { name: "tradingFeeHundredthsBip", type: "uint24" },
          { name: "bandInventoryCapMultiple", type: "uint8" },
          { name: "maxDeploysPerSwap", type: "uint8" },
          { name: "maxHarvestsPerSwap", type: "uint8" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "Launched",
    inputs: [
      { name: "poolId", type: "bytes32", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
      { name: "uri", type: "string", indexed: false },
      { name: "totalSupply", type: "uint256", indexed: false },
      { name: "openingLevel", type: "int24", indexed: false },
      { name: "farLevel", type: "int24", indexed: false },
      { name: "configHash", type: "bytes32", indexed: false },
    ],
  },
] as const;

export const launchSupportAbi = [
  {
    type: "function",
    name: "predictToken",
    stateMutability: "view",
    inputs: [
      { name: "config", type: "tuple", components: LAUNCH_CONFIG_COMPONENTS },
      { name: "hook", type: "address" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "launchDigest",
    stateMutability: "view",
    inputs: [
      { name: "config", type: "tuple", components: LAUNCH_CONFIG_COMPONENTS },
      { name: "hook", type: "address" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "validate",
    stateMutability: "view",
    inputs: [{ name: "config", type: "tuple", components: LAUNCH_CONFIG_COMPONENTS }],
    outputs: [],
  },
] as const;

export const revenueNftAbi = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "exists",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/** Uniswap v4 Universal Router (V4_SWAP command family). */
export const universalRouterAbi = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "commands", type: "bytes" },
      { name: "inputs", type: "bytes[]" },
    ],
    outputs: [],
  },
] as const;

export const NATIVE_ETH: Address = "0x0000000000000000000000000000000000000000";
export const NULL_SIGNATURE: Hex = "0x";
