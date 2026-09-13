"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  formatEther,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { APP_ENV } from "@/lib/env";
import { chainFor } from "@/lib/chain/chains";

/**
 * Browser (EIP-1193) wallet connection. Works with any injected provider
 * (MetaMask, Coinbase Wallet, Rabby, Frame, ...). Exposes the connected
 * address, a viem wallet client for signing/sending, chain reconciliation,
 * and live ETH balance.
 */

export type WalletStatus = "disconnected" | "connecting" | "connected" | "wrong-network";

interface WalletContextValue {
  status: WalletStatus;
  address: Address | null;
  chainId: number;
  targetChainId: number;
  ethBalance: string | null;
  publicClient: PublicClient;
  walletClient: WalletClient | null;
  connect: () => Promise<Address | null>;
  disconnect: () => void;
  switchToTargetChain: () => Promise<void>;
  sendTransaction: (args: { to: Address; data: Hex; value?: bigint }) => Promise<Hex>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (payload: unknown) => void) => void;
  removeListener?: (event: string, handler: (payload: unknown) => void) => void;
};

function getInjectedProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: Eip1193Provider }).ethereum ?? null;
}

const chain = chainFor(APP_ENV.chainId);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [address, setAddress] = useState<Address | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [chainId, setChainId] = useState<number>(APP_ENV.chainId);
  const [ethBalance, setEthBalance] = useState<string | null>(null);

  const publicClient = useMemo<PublicClient>(
    () =>
      createPublicClient({
        chain,
        transport: http(APP_ENV.rpcUrl),
        batch: { multicall: true },
      }),
    [],
  );

  const refreshBalance = useCallback(
    async (account: Address) => {
      try {
        const value = await publicClient.getBalance({ address: account });
        setEthBalance(formatEther(value));
      } catch {
        setEthBalance(null);
      }
    },
    [publicClient],
  );

  const applyAccount = useCallback(
    (account: Address | null) => {
      if (!account) {
        setWalletClient(null);
        setAddress(null);
        setEthBalance(null);
        setStatus("disconnected");
        return;
      }
      const provider = getInjectedProvider();
      setWalletClient(
        provider
          ? createWalletClient({ account, chain, transport: custom(provider as never) })
          : null,
      );
      setAddress(account);
      setStatus("connected");
      void refreshBalance(account);
    },
    [refreshBalance],
  );

  const readChainId = useCallback(async (): Promise<number> => {
    const provider = getInjectedProvider();
    if (!provider) return APP_ENV.chainId;
    try {
      const hex = (await provider.request({ method: "eth_chainId" })) as string;
      return Number.parseInt(hex, 16);
    } catch {
      return APP_ENV.chainId;
    }
  }, []);

  const connect = useCallback(async (): Promise<Address | null> => {
    const provider = getInjectedProvider();
    if (!provider) {
      throw new Error("No injected wallet detected. Install MetaMask or another EIP-1193 wallet.");
    }
    setStatus("connecting");
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    const account = accounts?.[0]?.toLowerCase() as Address | undefined;
    if (!account) {
      setStatus("disconnected");
      return null;
    }
    applyAccount(account);
    const network = await readChainId();
    setChainId(network);
    setStatus(network === chain.id ? "connected" : "wrong-network");
    return account;
  }, [applyAccount, readChainId]);

  const disconnect = useCallback(() => {
    setWalletClient(null);
    setAddress(null);
    setEthBalance(null);
    setStatus("disconnected");
  }, []);

  const switchToTargetChain = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider) return;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${chain.id.toString(16)}` }],
      });
    } catch (error) {
      const code = (error as { code?: number }).code;
      if (code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${chain.id.toString(16)}`,
              chainName: chain.name,
              nativeCurrency: chain.nativeCurrency,
              rpcUrls: Object.values(chain.rpcUrls.default.http),
              blockExplorerUrls: chain.blockExplorers
                ? [chain.blockExplorers.default.url]
                : undefined,
            },
          ],
        });
      } else {
        throw error;
      }
    }
  }, []);

  const sendTransaction = useCallback<WalletContextValue["sendTransaction"]>(
    async (args) => {
      if (!walletClient || !address) {
        throw new Error("Wallet not connected.");
      }
      return walletClient.sendTransaction({
        account: address,
        chain,
        to: args.to,
        data: args.data,
        value: args.value ?? 0n,
      });
    },
    [walletClient, address],
  );

  // Keep account/chain in sync with wallet-side changes.
  useEffect(() => {
    const provider = getInjectedProvider();
    if (!provider || typeof provider.on !== "function") return;
    const handler = (payload: unknown) => {
      const event = payload as { method?: string; params?: unknown };
      if (event.method === "accountsChanged") {
        const accounts = event.params as string[] | undefined;
        const next = accounts?.[0]?.toLowerCase() as Address | undefined;
        applyAccount(next ?? null);
      } else if (event.method === "chainChanged") {
        const changed = payload as { params?: string };
        const next = Number.parseInt(String(changed.params ?? "0x0"), 16);
        setChainId(next);
        setStatus((current) =>
          current === "connected" || current === "wrong-network"
            ? next === chain.id
              ? "connected"
              : "wrong-network"
            : current,
        );
      }
    };
    provider.on("accountsChanged", handler);
    provider.on("chainChanged", handler);
    return () => {
      provider.removeListener?.("accountsChanged", handler);
      provider.removeListener?.("chainChanged", handler);
    };
  }, [applyAccount]);

  // Restore a previously-connected session on mount (MM persists accounts).
  useEffect(() => {
    const provider = getInjectedProvider();
    if (!provider) return;
    let cancelled = false;
    const restore = window.setTimeout(() => {
      void provider
        .request({ method: "eth_accounts" })
        .then(async (accounts) => {
          if (cancelled) return;
          const list = accounts as string[];
          if (list?.length) {
            const account = list[0]!.toLowerCase() as Address;
            applyAccount(account);
            const network = await readChainId();
            if (!cancelled) {
              setChainId(network);
              setStatus(network === chain.id ? "connected" : "wrong-network");
            }
          }
        })
        .catch(() => undefined);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(restore);
    };
  }, [applyAccount, readChainId]);

  // Refresh balance while connected.
  useEffect(() => {
    if (status !== "connected" || !address) return;
    const id = window.setInterval(() => void refreshBalance(address), 12_000);
    return () => window.clearInterval(id);
  }, [status, address, refreshBalance]);

  const value = useMemo<WalletContextValue>(
    () => ({
      status,
      address,
      chainId,
      targetChainId: chain.id,
      ethBalance,
      publicClient,
      walletClient,
      connect,
      disconnect,
      switchToTargetChain,
      sendTransaction,
    }),
    [
      status,
      address,
      chainId,
      ethBalance,
      publicClient,
      walletClient,
      connect,
      disconnect,
      switchToTargetChain,
      sendTransaction,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

/** Throws a user-facing error if the wallet is disconnected or on the wrong chain. */
export function requireReady(wallet: WalletContextValue): Address {
  if (!wallet.address) throw new Error("Connect your wallet to continue.");
  if (wallet.chainId !== wallet.targetChainId) {
    throw new Error(
      `Switch your wallet to ${wallet.targetChainId === 8453 ? "Base" : `chain ${wallet.targetChainId}`} to continue.`,
    );
  }
  return wallet.address;
}
