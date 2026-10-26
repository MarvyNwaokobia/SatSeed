import { parseAbi, type Address } from "viem";

export const registryAbi = parseAbi([
  "function claim(string handle, string metadataURI)",
  "function update(string handle, string metadataURI)",
  "function release()",
  "function isClaimed(address owner) view returns (bool)",
  "function isHandleAvailable(string handle) view returns (bool)",
  "function ownerOfHandle(string handle) view returns (address)",
  "function isHandleCoolingDown(string handle) view returns (bool)",
  "function gardenOf(address owner) view returns ((string handle, string metadataURI, uint64 claimedAt))",
  "error AlreadyClaimed()",
  "error NotClaimed()",
  "error HandleTaken()",
  "error InvalidHandle()",
  "error MetadataURITooLong()",
  "error HandleCoolingDown()",
]);

export const tipsAbi = parseAbi([
  "function tip(address to, uint256 amount, string memo)",
  "function minTip() view returns (uint256)",
  "event Tipped(address indexed from, address indexed to, uint256 amount, string memo)",
  "error ZeroAmount()",
  "error TipTooSmall(uint256 minimum)",
  "error SelfTip()",
  "error RecipientNotClaimed()",
  "error MemoTooLong()",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

export type ContractConfig = {
  registry: Address;
  tips: Address;
  musd: Address;
  /** First block to scan for tip events. */
  fromBlock: bigint;
};

const isAddr = (v: string | undefined): v is Address => !!v && /^0x[0-9a-fA-F]{40}$/.test(v);

/**
 * Deployed addresses come from env. Until the contracts are deployed this is null and the UI
 * says so instead of pretending. (Literal process.env reads so Next can inline them.)
 */
export function readContractConfig(): ContractConfig | null {
  const registry = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
  const tips = process.env.NEXT_PUBLIC_TIPS_ADDRESS;
  const musd = process.env.NEXT_PUBLIC_MUSD_ADDRESS;
  if (!isAddr(registry) || !isAddr(tips) || !isAddr(musd)) return null;
  return {
    registry,
    tips,
    musd,
    fromBlock: BigInt(process.env.NEXT_PUBLIC_TIPS_FROM_BLOCK ?? "0"),
  };
}
