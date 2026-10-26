import {
  BaseError,
  ContractFunctionRevertedError,
  type Account,
  type Address,
  type Chain,
  type Hash,
  type PublicClient,
  type Transport,
  type WalletClient,
} from "viem";
import { erc20Abi, registryAbi, tipsAbi, type ContractConfig } from "./contracts";
import { MEMO_MAX_BYTES, formatMusd, memoBytes } from "./format";

type Reader = PublicClient;
type Writer = WalletClient<Transport, Chain, Account>;

/** An error whose message is already fit to show to a person. */
export class UserError extends Error {}

export type Garden = { handle: string; metadataURI: string; claimedAt: bigint };

export async function getGarden(pub: Reader, cfg: ContractConfig, owner: Address): Promise<Garden | null> {
  const g = await pub.readContract({
    address: cfg.registry,
    abi: registryAbi,
    functionName: "gardenOf",
    args: [owner],
  });
  return g.claimedAt === 0n ? null : { handle: g.handle, metadataURI: g.metadataURI, claimedAt: g.claimedAt };
}

export function isClaimed(pub: Reader, cfg: ContractConfig, owner: Address): Promise<boolean> {
  return pub.readContract({ address: cfg.registry, abi: registryAbi, functionName: "isClaimed", args: [owner] });
}

export function isHandleAvailable(pub: Reader, cfg: ContractConfig, handle: string): Promise<boolean> {
  return pub.readContract({
    address: cfg.registry,
    abi: registryAbi,
    functionName: "isHandleAvailable",
    args: [handle],
  });
}

export function isHandleCoolingDown(pub: Reader, cfg: ContractConfig, handle: string): Promise<boolean> {
  return pub.readContract({
    address: cfg.registry,
    abi: registryAbi,
    functionName: "isHandleCoolingDown",
    args: [handle],
  });
}

export function getMinTip(pub: Reader, cfg: ContractConfig): Promise<bigint> {
  return pub.readContract({ address: cfg.tips, abi: tipsAbi, functionName: "minTip" });
}

export async function claimGarden(
  wallet: Writer,
  pub: Reader,
  cfg: ContractConfig,
  handle: string,
): Promise<Hash> {
  const hash = await wallet.writeContract({
    address: cfg.registry,
    abi: registryAbi,
    functionName: "claim",
    args: [handle, ""],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new UserError("The claim transaction failed.");
  return hash;
}

/** Approves if needed, then tips. Returns the tip transaction hash. */
export async function sendTip(
  wallet: Writer,
  pub: Reader,
  cfg: ContractConfig,
  to: Address,
  amount: bigint,
  memo: string,
  onStep?: (step: "approving" | "tipping") => void,
): Promise<Hash> {
  const from = wallet.account.address;

  // Fail before any transaction (including the approval) if the contract would reject the tip.
  const min = await getMinTip(pub, cfg);
  if (amount < min) throw new UserError(`The minimum tip is ${formatMusd(min)} MUSD.`);
  if (memoBytes(memo) > MEMO_MAX_BYTES) {
    throw new UserError(`The note is too long (${MEMO_MAX_BYTES} bytes max; emoji and accented letters use more than one).`);
  }

  const balance = await pub.readContract({ address: cfg.musd, abi: erc20Abi, functionName: "balanceOf", args: [from] });
  if (balance < amount) throw new UserError("Not enough MUSD in this wallet.");

  const allowance = await pub.readContract({
    address: cfg.musd,
    abi: erc20Abi,
    functionName: "allowance",
    args: [from, cfg.tips],
  });
  if (allowance < amount) {
    onStep?.("approving");
    const approval = await wallet.writeContract({
      address: cfg.musd,
      abi: erc20Abi,
      functionName: "approve",
      args: [cfg.tips, amount],
    });
    const r = await pub.waitForTransactionReceipt({ hash: approval });
    if (r.status !== "success") throw new UserError("The approval transaction failed.");
  }

  onStep?.("tipping");
  const hash = await wallet.writeContract({
    address: cfg.tips,
    abi: tipsAbi,
    functionName: "tip",
    args: [to, amount, memo],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new UserError("The tip transaction failed.");
  return hash;
}

export type ReceivedTip = { from: Address; amount: bigint; memo: string; txHash: Hash };

export async function getTipsReceived(pub: Reader, cfg: ContractConfig, to: Address): Promise<ReceivedTip[]> {
  const logs = await pub.getContractEvents({
    address: cfg.tips,
    abi: tipsAbi,
    eventName: "Tipped",
    args: { to },
    fromBlock: cfg.fromBlock,
  });
  return logs
    .map((l) => ({ from: l.args.from!, amount: l.args.amount!, memo: l.args.memo ?? "", txHash: l.transactionHash }))
    .reverse();
}

/** Turns a viem/wallet error into one plain sentence. */
export function explainError(e: unknown): string {
  if (e instanceof UserError) return e.message;
  const err = e as { shortMessage?: string; message?: string; code?: number };
  if (err?.code === 4001 || /user rejected|denied/i.test(err?.shortMessage ?? err?.message ?? "")) {
    return "You cancelled the request in your wallet.";
  }
  const known: Record<string, string> = {
    HandleTaken: "That handle is already taken.",
    HandleCoolingDown: "That handle was just released and is reserved for its previous owner for 30 days.",
    TipTooSmall: "That tip is below the minimum.",
    ZeroAmount: "Enter an amount above zero.",
    AlreadyClaimed: "This wallet already has a garden.",
    InvalidHandle: "That handle isn't allowed.",
    RecipientNotClaimed: "That wallet hasn't claimed its garden yet, so it can't be tipped.",
    SelfTip: "You can't tip yourself.",
    MemoTooLong: "The note is too long (140 bytes max; emoji and accented letters use more than one).",
  };
  if (e instanceof BaseError) {
    const reverted = e.walk((x) => x instanceof ContractFunctionRevertedError);
    const name = reverted instanceof ContractFunctionRevertedError ? reverted.data?.errorName : undefined;
    if (name && known[name]) return known[name];
  }
  return err?.shortMessage ?? "Something went wrong. Please try again.";
}
