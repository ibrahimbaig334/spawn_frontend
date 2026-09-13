/**
 * API DTOs mirroring the Spawn backend responses (FRONTEND_INTEGRATION_GUIDE).
 * Conventions: 256-bit values are decimal strings, addresses lowercase,
 * timestamps ISO-8601, amounts raw wei units (18 decimals) everywhere.
 */

export type HexAddress = string;
export type PoolId = string;
export type WeiString = string;

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface Envelope<T> {
  data: T;
  meta: PageMeta | Record<string, never>;
}

export interface Page<T> {
  data: T[];
  meta: PageMeta;
}

/* ---------------------------------- tokens --------------------------------- */

export type TokenStatus = "bonding" | "graduated";

export interface TokenListItem {
  poolId: PoolId;
  chainId: number;
  status: TokenStatus;
  token: HexAddress;
  creator: HexAddress;
  name: string | null;
  symbol: string | null;
  launchTime: string;
  totalSupply: WeiString;
  circulatingSupply: WeiString;
  priceEth: WeiString | null;
  fdvEthWei: WeiString | null;
  mcapEthWei: WeiString | null;
  athMcapEthWei: WeiString | null;
  imageUri: string | null;
  buyVolumeEth: WeiString;
  sellVolumeEth: WeiString;
  swapCount: WeiString;
  creatorRevenueTotal: WeiString;
  protocolRevenueTotal: WeiString;
}

export interface FeaturedToken {
  pool_id: PoolId;
  token: HexAddress;
  creator: HexAddress;
  status: TokenStatus;
  name: string | null;
  symbol: string | null;
  daily_volume_eth: WeiString;
  total_volume_eth: WeiString;
}

export interface TokenSocials {
  website?: string | null;
  x?: string | null;
  telegram?: string | null;
  discord?: string | null;
}

export interface PoolStats {
  buyVolumeEth: WeiString;
  sellVolumeEth: WeiString;
  buyVolumeTokens: WeiString;
  sellVolumeTokens: WeiString;
  swapCount: WeiString;
  lastPriceSqrtX96: WeiString;
  athSqrtX96: WeiString;
  creatorRevenueTotal: WeiString;
  creatorRevenueCurve: WeiString;
  creatorRevenueSwapFees: WeiString;
  protocolRevenueTotal: WeiString;
  protocolRevenueCurve: WeiString;
  protocolRevenueSwapFees: WeiString;
  protocolRevenueHarvest: WeiString;
  creatorPathRevenueTotal: WeiString;
  pluginRevenueTotal: WeiString;
  potFundedTotal: WeiString;
  tipsTotal: WeiString;
  bandsDeployed: number;
  harvestCount: number;
  harvestQuoteTotal: WeiString;
  swapFeeBurnedTokens: WeiString;
  burnedTotal: WeiString;
  lastSwapBlock: WeiString;
}

export interface TokenDetail {
  poolId: PoolId;
  chainId: number;
  status: TokenStatus;
  token: HexAddress;
  creator: HexAddress;
  name: string | null;
  symbol: string | null;
  description: string | null;
  imageUri: string | null;
  uri: string | null;
  socials: TokenSocials | null;
  launchTime: string;
  totalSupply: WeiString;
  circulatingSupply: WeiString;
  configHash: string;
  payoutPlan: WeiString;
  devBuyShareWad: WeiString;
  openingLevel: number;
  farLevel: number;
  graduationLevel: number | null;
  wallLiquidity: WeiString | null;
  revenueNftOwner: HexAddress | null;
  priceEth: WeiString | null;
  launchRecord: { id: string; state: LaunchState; transactionHash: string | null } | null;
  stats: PoolStats | null;
  pot: { balance: WeiString; fundedTotal: WeiString; serviceFeeTotal: WeiString };
  milestones: { live: number; completed: number };
  trades: Page<TradeItem>;
  stale?: boolean;
}

export interface TradeItem {
  transactionHash: string;
  logIndex: number;
  blockNumber: WeiString;
  timestamp: string;
  side: "BUY" | "SELL";
  sender: HexAddress;
  ethAmount: WeiString;
  tokenAmount: WeiString;
  sqrtPriceX96: WeiString;
  level: number;
  priceEth: WeiString;
  feePips: number;
  feeEth: WeiString;
  feeTokens: WeiString;
}

export type MilestoneState = "PENDING" | "DEPLOYED" | "SKIPPED" | "HARVESTED";

export interface MilestoneItem {
  index: number;
  kind: "CORE" | "EXTENSION";
  state: MilestoneState;
  levelLower: number;
  levelUpper: number;
  liquidity: WeiString | null;
  tokenInventory: WeiString | null;
  deployedAt: string | null;
  completedAt: string | null;
}

export interface Candle {
  time: string;
  openEth: WeiString | null;
  closeEth: WeiString | null;
  highEth: WeiString | null;
  lowEth: WeiString | null;
  openSqrtX96: WeiString;
  highSqrtX96: WeiString;
  lowSqrtX96: WeiString;
  closeSqrtX96: WeiString;
  buyVolumeEth: WeiString;
  sellVolumeEth: WeiString;
  swapCount: WeiString;
}

export interface CandlesResponse {
  poolId: PoolId;
  chainId: number;
  interval: CandleInterval;
  candles: Candle[];
}

export type CandleInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

/* --------------------------------- trading --------------------------------- */

export interface PriceResponse {
  poolId: PoolId;
  chainId: number;
  token: HexAddress;
  status: TokenStatus;
  level: number;
  tick: number;
  sqrtPriceX96: WeiString;
  priceEth: WeiString;
  fdvEthWei: WeiString;
  mcapEthWei: WeiString;
  athPriceEth: WeiString | null;
  openingLevel: number;
  farLevel: number;
  graduationLevel: number | null;
  progress: number;
  source: "live" | "indexer" | "opening";
}

export interface QuoteResponse {
  poolId: PoolId;
  chainId: number;
  side: "BUY" | "SELL";
  amountIn: WeiString;
  amountInCurrency: "ETH" | "TOKEN";
  amountOut: WeiString;
  amountOutCurrency: "TOKEN" | "ETH";
  gasEstimate: WeiString;
  note: string;
}

export interface DepthCurvePosition {
  position: number;
  startLevel: number;
  endLevel: number;
  liquidity: WeiString;
}

export interface DepthBand {
  index: number;
  levelLower: number;
  levelUpper: number;
  liquidity: WeiString;
  tokenInventory: WeiString;
}

export interface DepthResponse {
  poolId: PoolId;
  status: TokenStatus;
  level: number;
  graduationLevel?: number | null;
  curvePositions?: DepthCurvePosition[];
  bands?: DepthBand[];
  fullRange?: { liquidity: WeiString | null; tickLower: number; tickUpper: number };
  wall?: { liquidity: WeiString | null; levelLower: number; levelUpper: number };
}

/* --------------------------------- revenue --------------------------------- */

export type RevenueKind =
  | "creatorAccruals"
  | "protocolAccruals"
  | "creatorPathAccruals"
  | "claims"
  | "payoutTips"
  | "pluginPayouts"
  | "potFundings"
  | "potRedemptions"
  | "feeCollections"
  | "feeRoutings"
  | "tokenBurns"
  | "graduates";

export interface RevenueEvent {
  transactionHash: string;
  logIndex: number;
  blockNumber: WeiString;
  timestamp: string;
  [key: string]: unknown;
}

/* ---------------------------------- launch --------------------------------- */

export interface LaunchPrepareRequest {
  creatorWalletAddress: HexAddress;
  name: string;
  symbol: string;
  description: string;
  imageUri: string;
  socials?: TokenSocials;
  totalSupply: WeiString;
  devBuyShareWad: string;
  payoutPlan: string;
  deadline: number;
}

export interface LaunchPrepareResponse {
  launchId: string;
  chainId: number;
  config: {
    creator: HexAddress;
    name: string;
    symbol: string;
    uri: string;
    totalSupply: WeiString;
    devBuyShareWad: string;
    payoutPlan: string;
    deadline: number;
  };
  configHash: string;
  digest: string;
  domain: { name: string; version: string; chainId: number; verifyingContract: HexAddress };
  predictedToken: HexAddress;
  openingLevel: number;
  farLevel: number;
  devBuyQuote: {
    tokensOut: WeiString;
    ethCost: WeiString;
    suggestedMsgValueWithHeadroom: WeiString;
    endLevel: number;
  } | null;
  metadata: { ipfsUri: string; gatewayUrl: string } | null;
  signatureNote: string;
  signaturePayload: Record<string, unknown>;
}

export interface RelayLaunchResponse {
  launchId: string;
  state: LaunchState;
  transactionHash: string;
  predictedToken: HexAddress;
  configHash: string;
}

export type LaunchState = "PENDING_RELAY" | "SUBMITTED" | "CONFIRMED" | "REORGED" | "FAILED";

export interface LaunchRecord {
  launchId: string;
  chainId: number;
  creatorWallet: HexAddress;
  name: string;
  symbol: string;
  uri: string;
  totalSupply: WeiString;
  devBuyShareWad: string;
  payoutPlan: string;
  deadline: string;
  configHash: string;
  predictedToken: HexAddress;
  digest: string;
  state: LaunchState;
  transactionHash: string | null;
  blockNumber: WeiString | null;
  failureReason: string | null;
  createdAt: string;
  onchain: { token: HexAddress; poolId: PoolId; status: TokenStatus } | null;
}

/* --------------------------------- protocol -------------------------------- */

export interface ProtocolAddresses {
  chainId: number;
  hook: HexAddress;
  launchSupport: HexAddress;
  revenueNft: HexAddress;
  payoutPluginRegistry: HexAddress;
  protocolController: HexAddress;
  buybackAndBurnPlugin: HexAddress | null;
  poolManager: HexAddress;
  stateView: HexAddress | null;
  v4Quoter: HexAddress | null;
  multicall3: HexAddress;
  canonicalPayoutPlan: string | null;
  hookSalt: string | null;
}

export interface EconomicCurrent {
  version: string;
  harvestServiceFeeWad: string;
  quoteCreatorShareWad: string;
  tokenMilestoneFundShareWad: string;
  effectiveBlock?: string;
  effectiveAt?: string;
}

export interface EconomicsResponse {
  chainId: number;
  current: EconomicCurrent;
  caps: {
    harvestServiceFeeWad: { max: string };
    quoteCreatorShareWad: { max: string };
    tokenMilestoneFundShareWad: { max: string };
  };
  history: { version: string; effectiveBlock: string; effectiveAt: string }[];
  source: "indexer" | "live";
}

export interface PluginEntry {
  registryIndex: number;
  plugin: HexAddress;
  takeWad: WeiString;
  gasLimit: number;
  codeHash: string;
  role: "INVALID" | "PAYOUT" | "CREATOR_SYSTEM" | "UTILITY";
  suspended: boolean;
  registeredAtBlock: WeiString;
}

export interface GovernanceState {
  economicVersion: string;
  protocolRecipient: HexAddress;
  trustedOperator: HexAddress;
  trustedOperatorSetBlock: string | null;
  administrator: HexAddress;
  pendingAdministrator: HexAddress | null;
  governanceDelaySeconds: string | null;
}

export interface GovernanceOperation {
  operationId: string;
  action: string;
  status: "SCHEDULED" | "EXECUTED" | "CANCELLED";
  readyAt: string | null;
  executedAtBlock: string | null;
  cancelledAtBlock: string | null;
  blockTime: string;
}

export interface GovernanceResponse {
  chainId: number;
  state: GovernanceState | null;
  operations: GovernanceOperation[];
}

export interface ProtocolRevenueResponse {
  chainId: number;
  totals: {
    accrued: WeiString;
    curve: WeiString;
    swapFees: WeiString;
    harvestFees: WeiString;
    claimed: WeiString;
  } | null;
  live: { protocolClaimable: WeiString; protocolClaimBacked: WeiString } | null;
  accruals: {
    poolId: PoolId;
    source: number;
    amountWei: WeiString;
    economicVersion: string;
    transactionHash: string;
    blockNumber: WeiString;
    timestamp: string;
  }[];
  claims: {
    recipient: HexAddress;
    amountWei: WeiString;
    transactionHash: string;
    blockNumber: WeiString;
    timestamp: string;
  }[];
}

export interface ProtocolStatsResponse {
  chainId: number;
  daily: {
    day: string;
    buyVolumeEth: WeiString;
    sellVolumeEth: WeiString;
    swapCount: WeiString;
    creatorRevenueEth: WeiString;
    protocolRevenueEth: WeiString;
    harvestFeesEth: WeiString;
    graduationCount: number;
    launchCount: number;
  }[];
  leaderboard: Record<string, unknown>[];
}

export interface WatermarkResponse {
  chainId: number;
  committedVersion: string;
  blockNumber: WeiString;
  blockHash: string;
  blockTime: string;
  lastIndexedBlock: WeiString | null;
  trustedOperator: HexAddress | null;
}

/* --------------------------------- keepers --------------------------------- */

export interface KeeperJob {
  kind: "flush" | "graduate" | "collectFees";
  poolId: PoolId;
  call: { to: HexAddress; function: string; args: unknown[] };
  incentiveWei?: WeiString;
  signal: Record<string, string>;
}

export interface KeeperJobsResponse {
  chainId: number;
  jobs: KeeperJob[];
  multicall3: HexAddress;
  batchingNote: string;
}

/* --------------------------------- profiles -------------------------------- */

export interface Profile {
  walletAddress: HexAddress;
  username: string | null;
  bio: string | null;
  imageUri: string | null;
  createdAt: string;
}

export interface ProfileToken {
  poolId: PoolId;
  token: HexAddress;
  name: string | null;
  symbol: string | null;
  status: TokenStatus;
  launchTime: string;
  imageUri: string | null;
}

export interface RevenueStream {
  pool_id: PoolId;
  status: TokenStatus;
  token: HexAddress;
  name: string | null;
  symbol: string | null;
  creator_revenue_total: WeiString;
  creator_path_revenue_total: WeiString;
  launch_time: string;
}

/* --------------------------------- comments -------------------------------- */

export interface CommentAuthor {
  walletAddress: HexAddress;
  username: string | null;
  bio: string | null;
  imageUri: string | null;
  createdAt?: string;
}

export interface CommentItem {
  id: string;
  tokenDbId: string;
  walletAddress: HexAddress;
  parentId: string | null;
  rootId: string;
  depth: number;
  text: string | null;
  isDeleted: boolean;
  likeCount: number;
  replyCount: number;
  createdAt: string;
  deletedAt: string | null;
  author?: CommentAuthor | null;
  replies?: CommentItem[];
}

export interface CommentLikeStatus {
  commentId: string;
  walletAddress: HexAddress;
  liked: boolean;
  likeCount: number;
}

/* ----------------------------- token registration --------------------------- */

export interface CreateTokenRequest {
  creatorWalletAddress: HexAddress;
  name: string;
  symbol: string;
  description: string;
  imageUri: string;
  socials?: TokenSocials;
}

export interface CreatedToken {
  tokenId: string;
  chainId: number;
  name: string;
  symbol: string;
  description: string;
  claimedCreatorWallet: HexAddress;
  imageUri: string;
  socials: TokenSocials | null;
  ipfsUri: string;
  gatewayUrl: string;
  contractAddress: HexAddress | null;
  createdAt: string;
}

/* ------------------------------- websocket --------------------------------- */

export interface WsTick {
  type: "tick";
  pool: PoolId;
  isBuy: boolean;
  priceEth: WeiString | null;
  sqrt: WeiString;
  eth: WeiString;
  tokens: WeiString;
  ts: string | number;
  block: string | number;
  tx: string;
}

export interface WsBar {
  type: "bar" | "bar_close";
  interval: string;
  pool: PoolId;
  start: number;
  open: WeiString;
  high: WeiString;
  low: WeiString;
  close: WeiString;
  volEth: WeiString;
  trades: number;
}

export interface WsPoolEvent {
  type: "pool";
  [key: string]: unknown;
}

export type WsMessage = WsTick | WsBar | WsPoolEvent;
