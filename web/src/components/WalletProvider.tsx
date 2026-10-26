"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Account,
  type Address,
  type Chain,
  type PublicClient,
  type Transport,
  type WalletClient,
} from "viem";
import { readContractConfig, type ContractConfig } from "@/lib/contracts";
import { chain, rpcUrl } from "@/lib/network";

type Eip1193 = {
  request(args: { method: string; params?: unknown }): Promise<unknown>;
  on?(event: string, listener: (...args: never[]) => void): void;
  removeListener?(event: string, listener: (...args: never[]) => void): void;
};

type Wallet = {
  account: Address | null;
  hasWallet: boolean;
  connecting: boolean;
  wrongChain: boolean;
  error: string | null;
  config: ContractConfig | null;
  publicClient: PublicClient | null;
  walletClient: WalletClient<Transport, Chain, Account> | null;
  connect: () => Promise<void>;
  switchChain: () => Promise<void>;
};

const Ctx = createContext<Wallet | null>(null);

export function useWallet(): Wallet {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used inside <WalletProvider>");
  return v;
}

const config = readContractConfig();

export function WalletProvider({ children }: { children: ReactNode }) {
  // The injected wallet is an external system: read it without setting state in an effect.
  const provider = useSyncExternalStore(
    () => () => {},
    () => (window as unknown as { ethereum?: Eip1193 }).ethereum ?? null,
    () => null,
  );
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Silently restore an already-authorised account and follow wallet changes.
  useEffect(() => {
    const eth = provider;
    if (!eth) return;

    const onAccounts = (accounts: string[]) => setAccount((accounts[0] as Address) ?? null);
    const onChain = (hex: string) => setChainId(parseInt(hex, 16));

    eth.request({ method: "eth_accounts" }).then((a) => onAccounts(a as string[])).catch(() => {});
    eth.request({ method: "eth_chainId" }).then((c) => onChain(c as string)).catch(() => {});
    eth.on?.("accountsChanged", onAccounts as never);
    eth.on?.("chainChanged", onChain as never);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts as never);
      eth.removeListener?.("chainChanged", onChain as never);
    };
  }, [provider]);

  const connect = useCallback(async () => {
    if (!provider) {
      setError("No wallet found. Install an EVM wallet such as MetaMask, then reload.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      setAccount((accounts[0] as Address) ?? null);
      setChainId(parseInt((await provider.request({ method: "eth_chainId" })) as string, 16));
    } catch (e) {
      const code = (e as { code?: number }).code;
      setError(code === 4001 ? "You cancelled the connection request." : "Couldn't connect to your wallet.");
    } finally {
      setConnecting(false);
    }
  }, [provider]);

  const switchChain = useCallback(async () => {
    if (!provider) return;
    const hex = `0x${chain.id.toString(16)}`;
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    } catch (e) {
      if ((e as { code?: number }).code === 4902 && rpcUrl) {
        await provider
          .request({
            method: "wallet_addEthereumChain",
            params: [{ chainId: hex, chainName: chain.name, nativeCurrency: chain.nativeCurrency, rpcUrls: [rpcUrl] }],
          })
          .catch(() => setError("Couldn't add the network to your wallet."));
      } else {
        setError("Couldn't switch network. Switch it in your wallet.");
      }
    }
  }, [provider]);

  const publicClient = useMemo<PublicClient | null>(() => {
    if (rpcUrl) return createPublicClient({ chain, transport: http(rpcUrl) });
    if (provider) return createPublicClient({ chain, transport: custom(provider) });
    return null;
  }, [provider]);

  const walletClient = useMemo(() => {
    if (!provider || !account) return null;
    return createWalletClient({ account, chain, transport: custom(provider) });
  }, [provider, account]);

  const value: Wallet = {
    account,
    hasWallet: !!provider,
    connecting,
    wrongChain: account !== null && chainId !== null && chainId !== chain.id,
    error,
    config,
    publicClient,
    walletClient,
    connect,
    switchChain,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
