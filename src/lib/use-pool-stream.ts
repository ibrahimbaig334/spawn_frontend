"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { APP_ENV } from "@/lib/env";
import type { WsBar, WsMessage, WsTick } from "@/lib/api/dto";
import { qk } from "@/lib/queries";

/**
 * Pool-scoped WebSocket client for the live stream (guide §11).
 *
 * - Subscribes with `?pool=<poolId>` so the broadcaster routes only this pool.
 * - Surfaces the newest ticks (for the tape and sub-minute building), the
 *   in-flight 1m bar (for the live chart candle) and a status flag.
 * - WS is at-most-once: on reconnect the REST price/candle/tape queries are
 *   invalidated (Postgres is the source of truth; the stream is delivery).
 * - State is keyed by pool so switching pools needs no synchronous reset.
 */
export interface PoolStream {
  connected: boolean;
  ticks: WsTick[];
  lastTick: WsTick | null;
  liveBar: WsBar | null;
  subscribeMessage: (listener: (message: WsMessage) => void) => () => void;
}

const MAX_TICKS = 60;

interface StreamState {
  poolId: string;
  connected: boolean;
  ticks: WsTick[];
  liveBar: WsBar | null;
}

export function usePoolStream(poolId: string | null): PoolStream {
  const queryClient = useQueryClient();
  const [state, setState] = useState<StreamState | null>(null);
  const listeners = useRef(new Set<(message: WsMessage) => void>());

  const subscribeMessage = useCallback((listener: (message: WsMessage) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!poolId) return;
    const pool = poolId.toLowerCase();

    let socket: WebSocket | null = null;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const patch = (update: (current: StreamState) => StreamState) => {
      setState((current) => {
        const base: StreamState =
          current && current.poolId === pool
            ? current
            : { poolId: pool, connected: false, ticks: [], liveBar: null };
        return update(base);
      });
    };

    const url = `${APP_ENV.wsUrl}?pool=${pool}`;

    const scheduleRetry = (): void => {
      if (closed || retryTimer) return;
      attempt += 1;
      const delay = Math.min(500 * 2 ** Math.min(attempt, 5), 20_000);
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        // Reconnect reconciliation (guide §11): REST refetch, then resume.
        void queryClient.invalidateQueries({ queryKey: qk.price(pool) });
        void queryClient.invalidateQueries({ queryKey: qk.candles(pool, "1m", 500) });
        void queryClient.invalidateQueries({ queryKey: ["tokens", pool, "trades"] });
        connect();
      }, delay);
    };

    const connect = (): void => {
      if (closed || typeof WebSocket === "undefined") return;
      try {
        socket = new WebSocket(url);
      } catch {
        scheduleRetry();
        return;
      }
      socket.onopen = () => {
        attempt = 0;
        patch((current) => ({ ...current, connected: true }));
      };
      socket.onmessage = (event) => {
        let message: WsMessage;
        try {
          message = JSON.parse(String(event.data)) as WsMessage;
        } catch {
          return;
        }
        for (const listener of listeners.current) listener(message);
        if (message.type === "tick") {
          const tick = message;
          patch((current) => ({ ...current, ticks: [tick, ...current.ticks].slice(0, MAX_TICKS) }));
        } else if (message.type === "bar") {
          patch((current) => ({ ...current, liveBar: message }));
        } else if (message.type === "bar_close") {
          patch((current) => ({ ...current, liveBar: message }));
          void queryClient.invalidateQueries({ queryKey: qk.candles(pool, "1m", 500) });
        } else if (message.type === "pool") {
          void queryClient.invalidateQueries({ queryKey: ["tokens", pool] });
          void queryClient.invalidateQueries({ queryKey: qk.price(pool) });
          void queryClient.invalidateQueries({ queryKey: qk.depth(pool) });
          void queryClient.invalidateQueries({ queryKey: qk.milestones(pool) });
        }
      };
      socket.onclose = () => {
        patch((current) => ({ ...current, connected: false }));
        scheduleRetry();
      };
      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();
    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [poolId, queryClient]);

  const active = state && poolId && state.poolId === poolId.toLowerCase() ? state : null;

  return {
    connected: active?.connected ?? false,
    ticks: active?.ticks ?? [],
    lastTick: active?.ticks[0] ?? null,
    liveBar: active?.liveBar ?? null,
    subscribeMessage,
  };
}
