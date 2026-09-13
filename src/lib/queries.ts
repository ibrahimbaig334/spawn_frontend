import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/endpoints";
import type { CandleInterval, LaunchPrepareRequest, RevenueKind } from "@/lib/api/dto";

/**
 * Query keys + hooks for the Spawn API. Server state is the source of truth;
 * polling cadence mirrors the guide's cache notes (trades 2s, price 5s).
 */

export const qk = {
  tokens: (query: object) => ["tokens", query] as const,
  featured: () => ["tokens", "featured"] as const,
  token: (ref: string) => ["tokens", ref] as const,
  trades: (ref: string, query: object) => ["tokens", ref, "trades", query] as const,
  milestones: (ref: string) => ["tokens", ref, "milestones"] as const,
  revenue: (ref: string, kind: RevenueKind) => ["tokens", ref, "revenue", kind] as const,
  candles: (ref: string, interval: CandleInterval, limit: number) =>
    ["tokens", ref, "candles", interval, limit] as const,
  price: (ref: string) => ["tokens", ref, "price"] as const,
  quote: (ref: string, side: string, amount: string) => ["tokens", ref, "quote", side, amount] as const,
  depth: (ref: string) => ["tokens", ref, "depth"] as const,
  comments: (ref: string, query: Record<string, unknown>) => ["tokens", ref, "comments", query] as const,
  replies: (id: string) => ["comments", id, "replies"] as const,
  launchRecord: (id: string) => ["launch", "records", id] as const,
  launchRecords: (query: Record<string, unknown>) => ["launch", "records", query] as const,
  addresses: () => ["protocol", "addresses"] as const,
  economics: () => ["protocol", "economics"] as const,
  plugins: () => ["protocol", "plugins"] as const,
  governance: () => ["protocol", "governance"] as const,
  protocolRevenue: () => ["protocol", "revenue"] as const,
  protocolStats: () => ["protocol", "stats"] as const,
  watermark: () => ["protocol", "watermark"] as const,
  keeperJobs: (query: Record<string, unknown>) => ["keepers", query] as const,
  profile: (wallet: string) => ["profiles", wallet] as const,
  profileTokens: (wallet: string) => ["profiles", wallet, "tokens"] as const,
  revenueStreams: (wallet: string) => ["profiles", wallet, "revenue-streams"] as const,
  commentLikes: (id: string, wallet: string) => ["comments", id, "likes", wallet] as const,
};

export function useTokenList(query: api.ListTokensQuery, enabled = true) {
  return useQuery({
    queryKey: qk.tokens(query),
    queryFn: ({ signal }) => api.listTokens(query, signal),
    enabled,
    placeholderData: (previous) => previous,
    refetchInterval: 30_000,
  });
}

export function useFeaturedTokens() {
  return useQuery({
    queryKey: qk.featured(),
    queryFn: ({ signal }) => api.getFeaturedTokens(signal),
    refetchInterval: 30_000,
  });
}

export function useToken(tokenRef: string | null, query?: { tradePage?: number; tradeLimit?: number }) {
  return useQuery({
    queryKey: ["tokens", tokenRef, "detail", query ?? {}],
    queryFn: () => api.getToken(tokenRef as string, query),
    enabled: Boolean(tokenRef),
    refetchInterval: 15_000,
  });
}

export function useTrades(tokenRef: string | null, query: api.TradesQuery = {}, pollMs = 5_000) {
  return useQuery({
    queryKey: qk.trades(tokenRef ?? "", query),
    queryFn: ({ signal }) => api.listTokenTrades(tokenRef as string, query, signal),
    enabled: Boolean(tokenRef),
    refetchInterval: pollMs,
  });
}

export function useMilestones(tokenRef: string | null, enabled = true) {
  return useQuery({
    queryKey: qk.milestones(tokenRef ?? ""),
    queryFn: ({ signal }) => api.listTokenMilestones(tokenRef as string, { limit: 100 }, signal),
    enabled: Boolean(tokenRef) && enabled,
    staleTime: 60_000,
  });
}

export function useRevenueEvents(tokenRef: string | null, kind: RevenueKind, enabled = true) {
  return useQuery({
    queryKey: qk.revenue(tokenRef ?? "", kind),
    queryFn: ({ signal }) => api.listTokenRevenueEvents(tokenRef as string, { kind, limit: 50 }, signal),
    enabled: Boolean(tokenRef) && enabled,
  });
}

export function useCandles(tokenRef: string | null, interval: CandleInterval, limit = 500) {
  return useQuery({
    queryKey: qk.candles(tokenRef ?? "", interval, limit),
    queryFn: ({ signal }) => api.listTokenCandles(tokenRef as string, { interval, limit }, signal),
    enabled: Boolean(tokenRef),
    staleTime: 30_000,
  });
}

export function usePrice(tokenRef: string | null, pollMs = 10_000) {
  return useQuery({
    queryKey: qk.price(tokenRef ?? ""),
    queryFn: ({ signal }) => api.getTokenPrice(tokenRef as string, signal),
    enabled: Boolean(tokenRef),
    refetchInterval: pollMs,
  });
}

export function useQuote(tokenRef: string | null, side: "BUY" | "SELL", amount: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.quote(tokenRef ?? "", side, amount),
    queryFn: ({ signal }) => api.quoteTokenSwap(tokenRef as string, { side, amount }, signal),
    enabled: Boolean(tokenRef) && enabled && /^\d+$/.test(amount) && BigInt(amount || "0") > 0n,
    staleTime: 4_000,
  });
}

export function useDepth(tokenRef: string | null) {
  return useQuery({
    queryKey: qk.depth(tokenRef ?? ""),
    queryFn: ({ signal }) => api.getTokenDepth(tokenRef as string, { buckets: 16 }, signal),
    enabled: Boolean(tokenRef),
    refetchInterval: 30_000,
  });
}

/* --------------------------------- launch --------------------------------- */

export function usePrepareLaunch() {
  return useMutation({ mutationFn: (body: LaunchPrepareRequest) => api.prepareLaunch(body) });
}

export function useRelayLaunch() {
  return useMutation({
    mutationFn: (body: { launchId: string; idempotencyKey?: string }) =>
      api.relayLaunch(body.launchId, body.idempotencyKey),
  });
}

export function useLaunchRecord(launchId: string | null, pollUntilOnchain = false) {
  return useQuery({
    queryKey: qk.launchRecord(launchId ?? ""),
    queryFn: ({ signal }) => api.getLaunchRecord(launchId as string, signal),
    enabled: Boolean(launchId),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      if (!pollUntilOnchain) return false;
      return state === "CONFIRMED" || state === "FAILED" || state === "REORGED" ? false : 4_000;
    },
  });
}

export function useLaunchRecords(
  query: { creator?: string; state?: string; page?: number; limit?: number } = {},
  enabled = true,
) {
  return useQuery({
    queryKey: qk.launchRecords(query),
    queryFn: ({ signal }) => api.listLaunchRecords(query, signal),
    enabled,
  });
}

/* --------------------------------- protocol --------------------------------- */

export function useProtocolAddresses() {
  return useQuery({
    queryKey: qk.addresses(),
    queryFn: ({ signal }) => api.getProtocolAddresses(signal),
    staleTime: 300_000,
    retry: (failureCount, error) => {
      const code = (error as { code?: string }).code;
      if (code === "MANIFEST_NOT_SYNCED") return false;
      return failureCount < 2;
    },
  });
}

export function useEconomics() {
  return useQuery({
    queryKey: qk.economics(),
    queryFn: ({ signal }) => api.getEconomics(signal),
    staleTime: 120_000,
  });
}

export function usePayoutPlugins() {
  return useQuery({
    queryKey: qk.plugins(),
    queryFn: ({ signal }) => api.listPayoutPlugins(signal),
    staleTime: 60_000,
  });
}

export function useGovernance() {
  return useQuery({
    queryKey: qk.governance(),
    queryFn: ({ signal }) => api.getGovernance(undefined, signal),
    refetchInterval: 60_000,
  });
}

export function useProtocolRevenue() {
  return useQuery({
    queryKey: qk.protocolRevenue(),
    queryFn: ({ signal }) => api.getProtocolRevenue(signal),
    refetchInterval: 60_000,
  });
}

export function useProtocolStats() {
  return useQuery({
    queryKey: qk.protocolStats(),
    queryFn: ({ signal }) => api.getProtocolStats(signal),
    refetchInterval: 60_000,
  });
}

export function useWatermark(pollMs = 15_000) {
  return useQuery({
    queryKey: qk.watermark(),
    queryFn: ({ signal }) => api.getChainWatermark(signal),
    refetchInterval: pollMs,
    retry: (failureCount, error) => {
      const code = (error as { code?: string }).code;
      if (code === "WATERMARK_NOT_FOUND") return false;
      return failureCount < 2;
    },
  });
}

export function useRevenueHistory(kind: string, enabled = true) {
  return useQuery({
    queryKey: ["protocol", "revenue-history", kind],
    queryFn: ({ signal }) => api.getRevenueHistory({ kind, limit: 50 }, signal),
    enabled,
  });
}

export function useKeeperJobs(query: { kind?: "flush" | "graduate" | "collectFees"; limit?: number } = {}) {
  return useQuery({
    queryKey: qk.keeperJobs(query),
    queryFn: ({ signal }) => api.listKeeperJobs(query, signal),
    refetchInterval: 30_000,
  });
}

/* --------------------------------- profiles --------------------------------- */

export function useProfile(wallet: string | null) {
  return useQuery({
    queryKey: qk.profile(wallet ?? ""),
    queryFn: ({ signal }) => api.getProfile(wallet as string, signal),
    enabled: Boolean(wallet),
    retry: (failureCount, error) => {
      const code = (error as { code?: string }).code;
      if (code === "PROFILE_NOT_FOUND") return false;
      return failureCount < 2;
    },
  });
}

export function useUpdateProfile(wallet: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: { username?: string | null; bio?: string | null; imageUri?: string | null }) =>
      api.updateProfile(wallet, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.profile(wallet) });
    },
  });
}

export function useProfileTokens(wallet: string | null) {
  return useQuery({
    queryKey: qk.profileTokens(wallet ?? ""),
    queryFn: ({ signal }) => api.listProfileTokens(wallet as string, { limit: 100 }, signal),
    enabled: Boolean(wallet),
  });
}

export function useRevenueStreams(wallet: string | null) {
  return useQuery({
    queryKey: qk.revenueStreams(wallet ?? ""),
    queryFn: ({ signal }) => api.getProfileRevenueStreams(wallet as string, signal),
    enabled: Boolean(wallet),
  });
}

/* --------------------------------- comments --------------------------------- */

export function useComments(tokenRef: string | null, query: { sort?: "newest" | "top" | "oldest"; page?: number } = {}) {
  return useQuery({
    queryKey: qk.comments(tokenRef ?? "", query),
    queryFn: ({ signal }) => api.listTokenComments(tokenRef as string, query, signal),
    enabled: Boolean(tokenRef),
  });
}

export function useCommentReplies(commentId: string | null, enabled = true) {
  return useQuery({
    queryKey: qk.replies(commentId ?? ""),
    queryFn: ({ signal }) => api.listCommentReplies(commentId as string, { limit: 50 }, signal),
    enabled: Boolean(commentId) && enabled,
  });
}

export function useCreateComment(tokenRef: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { walletAddress: string; text: string; parentCommentId?: string }) =>
      api.createTokenComment(tokenRef, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tokens", tokenRef] });
    },
  });
}

export function useDeleteComment(tokenRef: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { commentId: string; walletAddress: string }) =>
      api.deleteComment(body.commentId, body.walletAddress),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tokens", tokenRef] });
    },
  });
}

export function useCommentLike(tokenRef: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { commentId: string; walletAddress: string; liked: boolean }) =>
      body.liked ? api.likeComment(body.commentId, body.walletAddress) : api.unlikeComment(body.commentId, body.walletAddress),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tokens", tokenRef] });
    },
  });
}
