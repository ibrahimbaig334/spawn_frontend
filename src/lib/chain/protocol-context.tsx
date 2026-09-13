"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useProtocolAddresses, useEconomics, usePayoutPlugins } from "@/lib/queries";
import type { EconomicCurrent, PluginEntry, ProtocolAddresses } from "@/lib/api/dto";
import { ApiError } from "@/lib/api/client";

/**
 * Protocol runtime context. Contract addresses are sourced ONLY from
 * GET /protocol/addresses (START-HERE fact #1: never hardcode). Until a
 * deployment manifest is synced, the protocol is considered undeployed and
 * write actions are disabled.
 */

interface ProtocolContextValue {
  addresses: ProtocolAddresses | null;
  economics: EconomicCurrent | null;
  plugins: PluginEntry[];
  /** 404 MANIFEST_NOT_SYNCED — contracts not deployed for the active chain yet. */
  undeployed: boolean;
  loading: boolean;
  error: unknown;
}

const ProtocolContext = createContext<ProtocolContextValue | null>(null);

function isCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}

export function ProtocolProvider({ children }: { children: ReactNode }) {
  const addresses = useProtocolAddresses();
  const economics = useEconomics();
  const plugins = usePayoutPlugins();

  const value = useMemo<ProtocolContextValue>(() => {
    const undeployed = isCode(addresses.error, "MANIFEST_NOT_SYNCED");
    return {
      addresses: addresses.data ?? null,
      economics: economics.data?.current ?? null,
      plugins: plugins.data ?? [],
      undeployed,
      loading: (addresses.isLoading && !undeployed) || economics.isLoading,
      error: addresses.error ?? economics.error,
    };
  }, [addresses, economics, plugins]);

  return <ProtocolContext.Provider value={value}>{children}</ProtocolContext.Provider>;
}

export function useProtocol(): ProtocolContextValue {
  const ctx = useContext(ProtocolContext);
  if (!ctx) throw new Error("useProtocol must be used within ProtocolProvider");
  return ctx;
}
