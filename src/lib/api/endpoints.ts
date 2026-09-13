import { apiData, apiFetch, apiMutation, apiPage, newIdempotencyKey } from "@/lib/api/client";
import type {
  CandlesResponse,
  CandleInterval,
  CommentItem,
  CommentLikeStatus,
  CreatedToken,
  DepthResponse,
  EconomicsResponse,
  FeaturedToken,
  GovernanceResponse,
  KeeperJobsResponse,
  LaunchPrepareRequest,
  LaunchPrepareResponse,
  LaunchRecord,
  MilestoneItem,
  Page,
  PluginEntry,
  PriceResponse,
  Profile,
  ProtocolAddresses,
  ProtocolRevenueResponse,
  ProtocolStatsResponse,
  QuoteResponse,
  RelayLaunchResponse,
  RevenueEvent,
  RevenueKind,
  RevenueStream,
  TokenDetail,
  TokenListItem,
  TokenSocials,
  TradeItem,
  WatermarkResponse,
} from "@/lib/api/dto";

/**
 * Every backend route (FRONTEND_INTEGRATION_GUIDE §2–§12).
 * `tokenRef` accepts the offchain UUID, token address, or poolId.
 */

const PAGE_SIZE_MAX = 100;

/* -------------------------------- §2 tokens -------------------------------- */

export interface ListTokensQuery {
  q?: string;
  creator?: string;
  phase?: "bonding" | "graduated";
  sort?: "newest" | "oldest" | "market_cap" | "volume" | "graduated";
  page?: number;
  limit?: number;
  chainId?: number;
}

export function listTokens(query: ListTokensQuery, signal?: AbortSignal): Promise<Page<TokenListItem>> {
  return apiPage<TokenListItem>("/tokens", { ...query, limit: Math.min(query.limit ?? 20, PAGE_SIZE_MAX) }, signal);
}

export function getFeaturedTokens(signal?: AbortSignal): Promise<FeaturedToken[]> {
  return apiData<FeaturedToken[]>("/tokens/featured", undefined, signal);
}

export function getToken(tokenRef: string, query?: { tradePage?: number; tradeLimit?: number }): Promise<TokenDetail> {
  return apiData<TokenDetail>(`/tokens/${tokenRef}`, { ...query });
}

export function createToken(
  body: {
    creatorWalletAddress: string;
    name: string;
    symbol: string;
    description: string;
    imageUri: string;
    socials?: TokenSocials;
  },
  idempotencyKey = newIdempotencyKey(),
): Promise<CreatedToken> {
  return apiMutation<CreatedToken>("/tokens", body, { idempotencyKey });
}

/* -------------------------------- §4 trades -------------------------------- */

export interface TradesQuery {
  side?: "BUY" | "SELL";
  sort?: "newest" | "oldest" | "amount";
  page?: number;
  limit?: number;
  chainId?: number;
}

export function listTokenTrades(tokenRef: string, query: TradesQuery = {}, signal?: AbortSignal): Promise<Page<TradeItem>> {
  return apiPage<TradeItem>(`/tokens/${tokenRef}/trades`, { ...query, limit: Math.min(query.limit ?? 20, PAGE_SIZE_MAX) }, signal);
}

/* ------------------------------ §5 milestones ------------------------------ */

export function listTokenMilestones(
  tokenRef: string,
  query: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<Page<MilestoneItem>> {
  return apiPage<MilestoneItem>(`/tokens/${tokenRef}/milestones`, { ...query, limit: Math.min(query.limit ?? 100, PAGE_SIZE_MAX) }, signal);
}

/* -------------------------------- §6 revenue -------------------------------- */

export function listTokenRevenueEvents(
  tokenRef: string,
  query: { kind?: RevenueKind; page?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<Page<RevenueEvent>> {
  return apiPage<RevenueEvent>(`/tokens/${tokenRef}/revenue`, { ...query, limit: Math.min(query.limit ?? 20, PAGE_SIZE_MAX) }, signal);
}

/* --------------------------------- §7 candles -------------------------------- */

export function listTokenCandles(
  tokenRef: string,
  query: { interval?: CandleInterval; from?: string; to?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<CandlesResponse> {
  return apiData<CandlesResponse>(`/tokens/${tokenRef}/candles`, { ...query }, signal);
}

/* ---------------------------- §8 price/quote/depth ---------------------------- */

export function getTokenPrice(tokenRef: string, signal?: AbortSignal): Promise<PriceResponse> {
  return apiData<PriceResponse>(`/tokens/${tokenRef}/price`, undefined, signal);
}

export function quoteTokenSwap(
  tokenRef: string,
  query: { side: "BUY" | "SELL"; amount: string },
  signal?: AbortSignal,
): Promise<QuoteResponse> {
  return apiData<QuoteResponse>(`/tokens/${tokenRef}/quote`, query, signal);
}

export function getTokenDepth(
  tokenRef: string,
  query: { buckets?: number } = {},
  signal?: AbortSignal,
): Promise<DepthResponse> {
  return apiData<DepthResponse>(`/tokens/${tokenRef}/depth`, query, signal);
}

/* -------------------------------- §3 launch -------------------------------- */

export function prepareLaunch(body: LaunchPrepareRequest): Promise<LaunchPrepareResponse> {
  return apiMutation<LaunchPrepareResponse>("/launch/prepare", body);
}

export function relayLaunch(launchId: string, idempotencyKey = newIdempotencyKey()): Promise<RelayLaunchResponse> {
  return apiMutation<RelayLaunchResponse>("/launch/relay", { launchId }, { idempotencyKey });
}

export function getLaunchRecord(launchId: string, signal?: AbortSignal): Promise<LaunchRecord> {
  return apiData<LaunchRecord>(`/launch/records/${launchId}`, undefined, signal);
}

export function listLaunchRecords(
  query: { creator?: string; state?: string; page?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<Page<LaunchRecord>> {
  return apiPage<LaunchRecord>("/launch/records", { ...query, limit: Math.min(query.limit ?? 20, PAGE_SIZE_MAX) }, signal);
}

/* -------------------------------- §9 protocol -------------------------------- */

export function getProtocolAddresses(signal?: AbortSignal): Promise<ProtocolAddresses> {
  return apiData<ProtocolAddresses>("/protocol/addresses", undefined, signal);
}

export function getEconomics(signal?: AbortSignal): Promise<EconomicsResponse> {
  return apiData<EconomicsResponse>("/protocol/economics", undefined, signal);
}

export function listPayoutPlugins(signal?: AbortSignal): Promise<PluginEntry[]> {
  return apiData<PluginEntry[]>("/protocol/plugins", undefined, signal);
}

export function getGovernance(query?: { status?: string }, signal?: AbortSignal): Promise<GovernanceResponse> {
  return apiData<GovernanceResponse>("/protocol/governance", query, signal);
}

export function getProtocolRevenue(signal?: AbortSignal): Promise<ProtocolRevenueResponse> {
  return apiData<ProtocolRevenueResponse>("/protocol/revenue", undefined, signal);
}

export function getProtocolStats(signal?: AbortSignal): Promise<ProtocolStatsResponse> {
  return apiData<ProtocolStatsResponse>("/protocol/stats", undefined, signal);
}

export function getChainWatermark(signal?: AbortSignal): Promise<WatermarkResponse> {
  return apiData<WatermarkResponse>("/protocol/watermark", undefined, signal);
}

export function getRevenueHistory(
  query: { kind?: string; poolId?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<{ chainId: number; kind: string; data: RevenueEvent[] }> {
  return apiData(`/protocol/revenue/history`, { ...query, limit: Math.min(query.limit ?? 100, 500) }, signal);
}

/* -------------------------------- §10 keepers -------------------------------- */

export function listKeeperJobs(
  query: { kind?: "flush" | "graduate" | "collectFees"; limit?: number } = {},
  signal?: AbortSignal,
): Promise<KeeperJobsResponse> {
  return apiData<KeeperJobsResponse>("/keepers/jobs", query, signal);
}

/* ------------------------------ §12 profiles ------------------------------- */

export function getProfile(walletAddress: string, signal?: AbortSignal): Promise<Profile> {
  return apiData<Profile>(`/profiles/${walletAddress}`, undefined, signal);
}

export function updateProfile(
  walletAddress: string,
  patch: { username?: string | null; bio?: string | null; imageUri?: string | null },
): Promise<Profile> {
  return apiMutation<Profile>(`/profiles/${walletAddress}`, patch, { method: "PUT" });
}

export function listProfileTokens(
  walletAddress: string,
  query: { sort?: "newest" | "oldest"; page?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<Page<{ poolId: string; token: string; name: string | null; symbol: string | null; status: "bonding" | "graduated"; launchTime: string; imageUri: string | null }>> {
  return apiPage(`/profiles/${walletAddress}/tokens`, { ...query, limit: Math.min(query.limit ?? 20, PAGE_SIZE_MAX) }, signal);
}

export function getProfileRevenueStreams(walletAddress: string, signal?: AbortSignal): Promise<RevenueStream[]> {
  return apiData<RevenueStream[]>(`/profiles/${walletAddress}/revenue-streams`, undefined, signal);
}

/* -------------------------------- §12 comments -------------------------------- */

export function listTokenComments(
  tokenRef: string,
  query: { sort?: "newest" | "top" | "oldest"; page?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<Page<CommentItem>> {
  return apiPage<CommentItem>(`/tokens/${tokenRef}/comments`, { ...query, limit: Math.min(query.limit ?? 20, PAGE_SIZE_MAX) }, signal);
}

export function createTokenComment(
  tokenRef: string,
  body: { walletAddress: string; text: string; parentCommentId?: string },
  idempotencyKey = newIdempotencyKey(),
): Promise<CommentItem> {
  return apiMutation<CommentItem>(`/tokens/${tokenRef}/comments`, body, { idempotencyKey });
}

export function listCommentReplies(
  commentId: string,
  query: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<Page<CommentItem>> {
  return apiPage<CommentItem>(`/comments/${commentId}/replies`, { ...query, limit: Math.min(query.limit ?? 20, PAGE_SIZE_MAX) }, signal);
}

export function deleteComment(commentId: string, walletAddress: string): Promise<CommentItem> {
  return apiFetch<{ data: CommentItem }>(`/comments/${commentId}`, {
    method: "DELETE",
    query: { walletAddress },
  }).then((r) => r.data);
}

export function getCommentLikeStatus(
  commentId: string,
  walletAddress: string,
  signal?: AbortSignal,
): Promise<CommentLikeStatus> {
  return apiData<CommentLikeStatus>(`/comments/${commentId}/likes/${walletAddress}`, undefined, signal);
}

export function likeComment(commentId: string, walletAddress: string): Promise<CommentLikeStatus> {
  return apiMutation<CommentLikeStatus>(`/comments/${commentId}/likes/${walletAddress}`, undefined, { method: "PUT" });
}

export function unlikeComment(commentId: string, walletAddress: string): Promise<CommentLikeStatus> {
  return apiFetch<{ data: CommentLikeStatus }>(`/comments/${commentId}/likes/${walletAddress}`, {
    method: "DELETE",
  }).then((r) => r.data);
}
