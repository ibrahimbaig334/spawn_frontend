"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/**
 * Watchlist: purely client-side (localStorage) list of poolIds the user follows.
 * Server data comes from the API; this is the only persisted UI state.
 * Implemented as an external store so hydration is deterministic
 * (the server snapshot is always empty).
 */

const STORAGE_KEY = "spawn.watchlist.v1";

const EMPTY: readonly string[] = Object.freeze([]);

let cache: { raw: string | null; value: readonly string[] } = { raw: null, value: EMPTY };
const listeners = new Set<() => void>();

function readStore(): readonly string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }  if (cache.raw === raw) return cache.value;
  let value: readonly string[] = EMPTY;
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    value = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : EMPTY;
  } catch {
    value = EMPTY;
  }
  cache = { raw, value };
  return value;
}

function writeStore(next: readonly string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  cache = { raw: JSON.stringify(next), value: next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Also sync across tabs.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cache = { raw: null, value: EMPTY };
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function serverSnapshot(): readonly string[] {
  return EMPTY;
}

interface WatchlistContextValue {
  poolIds: readonly string[];
  isWatched: (poolId: string) => boolean;
  toggle: (poolId: string) => void;
  remove: (poolId: string) => void;
  clear: () => void;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const poolIds = useSyncExternalStore(subscribe, readStore, serverSnapshot);

  const toggle = useCallback(
    (poolId: string) => {
      const key = poolId.toLowerCase();
      const current = readStore();
      writeStore(
        current.includes(key) ? current.filter((p) => p !== key) : [key, ...current],
      );
    },
    [],
  );

  const remove = useCallback((poolId: string) => {
    const key = poolId.toLowerCase();
    writeStore(readStore().filter((p) => p !== key));
  }, []);

  const clear = useCallback(() => writeStore([]), []);

  const value = useMemo<WatchlistContextValue>(
    () => ({
      poolIds,
      isWatched: (poolId: string) => poolIds.includes(poolId.toLowerCase()),
      toggle,
      remove,
      clear,
    }),
    [poolIds, toggle, remove, clear],
  );

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist(): WatchlistContextValue {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error("useWatchlist must be used within WatchlistProvider");
  return ctx;
}
