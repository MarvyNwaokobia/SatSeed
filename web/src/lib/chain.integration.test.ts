// Runs the real chain helpers against the compiled contracts on a local anvil node.
// Skipped automatically when anvil or the Foundry build output is missing
// (run `forge build` in ../contracts first).
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import {
  claimGarden,
  explainError,
  getGarden,
  getMinTip,
  getTipsReceived,
  isClaimed,
  isHandleAvailable,
  isHandleCoolingDown,
  sendTip,
} from "./chain";
import { registryAbi } from "./contracts";
import type { ContractConfig } from "./contracts";

const OUT = path.resolve(__dirname, "../../../contracts/out");
const artifact = (file: string, name: string) => {
  const p = path.join(OUT, `${file}.sol`, `${name}.json`);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as { abi: Abi; bytecode: { object: Hex } }) : null;
};

const hasAnvil = spawnSync("anvil", ["--version"]).status === 0;
const arts = {
  musd: artifact("MockMUSD", "MockMUSD"),
  registry: artifact("SatSeedRegistry", "SatSeedRegistry"),
  tips: artifact("SatSeedTips", "SatSeedTips"),
};
const runnable = hasAnvil && !!arts.musd && !!arts.registry && !!arts.tips;

// Public anvil dev keys.
const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
] as const;
const PORT = 8599;
const URL = `http://127.0.0.1:${PORT}`;

describe.skipIf(!runnable)("chain helpers against anvil", () => {
  let proc: ChildProcess;
  const pub = createPublicClient({ chain: foundry, transport: http(URL) });
  const wallet = (i: number) =>
    createWalletClient({ account: privateKeyToAccount(KEYS[i]), chain: foundry, transport: http(URL) });
  const [alice, bob, carol] = [wallet(0), wallet(1), wallet(2)];
  let cfg: ContractConfig;

  async function deploy(a: { abi: Abi; bytecode: { object: Hex } }, args: unknown[] = []): Promise<Address> {
    const hash = await alice.deployContract({ abi: a.abi, bytecode: a.bytecode.object, args });
    const r = await pub.waitForTransactionReceipt({ hash });
    return r.contractAddress!;
  }

  beforeAll(async () => {
    proc = spawn("anvil", ["--port", String(PORT), "--silent"], { stdio: "ignore" });
    for (let i = 0; i < 50; i++) {
      try {
        await pub.getChainId();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    const musd = await deploy(arts.musd!);
    const registry = await deploy(arts.registry!);
    const tips = await deploy(arts.tips!, [musd, registry, parseUnits("0.1", 18)]);
    cfg = { musd, registry, tips, fromBlock: 0n };

    // alice (tipper) gets MUSD
    const h = await alice.writeContract({
      address: musd,
      abi: arts.musd!.abi,
      functionName: "mint",
      args: [alice.account.address, parseUnits("100", 18)],
    });
    await pub.waitForTransactionReceipt({ hash: h });
  }, 30_000);

  afterAll(() => {
    proc?.kill();
  });

  it("claims a garden and reads it back", async () => {
    expect(await isClaimed(pub, cfg, bob.account.address)).toBe(false);
    expect(await getGarden(pub, cfg, bob.account.address)).toBeNull();
    expect(await isHandleAvailable(pub, cfg, "bobby")).toBe(true);

    await claimGarden(bob, pub, cfg, "bobby");

    expect(await isClaimed(pub, cfg, bob.account.address)).toBe(true);
    expect(await isHandleAvailable(pub, cfg, "bobby")).toBe(false);
    const g = await getGarden(pub, cfg, bob.account.address);
    expect(g?.handle).toBe("bobby");
  });

  it("surfaces a plain message when claiming twice", async () => {
    const err = await claimGarden(bob, pub, cfg, "bobby2").catch((e) => e);
    expect(explainError(err)).toMatch(/already has a garden/i);
  });

  it("approves and tips a claimed garden, then lists it as received", async () => {
    const steps: string[] = [];
    await sendTip(alice, pub, cfg, bob.account.address, parseUnits("12.5", 18), "great tool", (s) => steps.push(s));
    expect(steps).toEqual(["approving", "tipping"]);

    const received = await getTipsReceived(pub, cfg, bob.account.address);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ from: alice.account.address, amount: parseUnits("12.5", 18), memo: "great tool" });
  });

  it("skips the approval when the allowance already covers the tip", async () => {
    // Previous tip approved exactly 12.5; approve more, then tip within it.
    const h = await alice.writeContract({
      address: cfg.musd,
      abi: arts.musd!.abi,
      functionName: "approve",
      args: [cfg.tips, parseUnits("50", 18)],
    });
    await pub.waitForTransactionReceipt({ hash: h });

    const steps: string[] = [];
    await sendTip(alice, pub, cfg, bob.account.address, parseUnits("1", 18), "", (s) => steps.push(s));
    expect(steps).toEqual(["tipping"]);
  });

  it("refuses to tip more than the balance", async () => {
    const err = await sendTip(alice, pub, cfg, bob.account.address, parseUnits("1000", 18), "").catch((e) => e);
    expect(explainError(err)).toMatch(/not enough musd/i);
  });

  it("explains that unclaimed wallets can't be tipped", async () => {
    const stranger = "0x000000000000000000000000000000000000dEaD" as const;
    const err = await sendTip(alice, pub, cfg, stranger, parseUnits("1", 18), "").catch((e) => e);
    expect(explainError(err)).toMatch(/hasn't claimed/i);
  });

  it("reads the minimum tip from the contract", async () => {
    expect(await getMinTip(pub, cfg)).toBe(parseUnits("0.1", 18));
  });

  it("rejects a below-minimum tip before sending any transaction", async () => {
    const before = await pub.getTransactionCount({ address: alice.account.address });
    const err = await sendTip(alice, pub, cfg, bob.account.address, parseUnits("0.01", 18), "").catch((e) => e);
    expect(explainError(err)).toMatch(/minimum tip is 0\.10 musd/i);
    expect(await pub.getTransactionCount({ address: alice.account.address })).toBe(before);
  });

  it("rejects an over-long memo measured in bytes, before sending any transaction", async () => {
    const before = await pub.getTransactionCount({ address: alice.account.address });
    const memo = "😀".repeat(36); // 36 characters, 144 bytes
    expect(memo.length).toBeLessThan(140);
    const err = await sendTip(alice, pub, cfg, bob.account.address, parseUnits("1", 18), memo).catch((e) => e);
    expect(explainError(err)).toMatch(/too long/i);
    expect(await pub.getTransactionCount({ address: alice.account.address })).toBe(before);
  });

  it("reserves a released handle for its previous owner", async () => {
    await claimGarden(carol, pub, cfg, "carol");
    const h = await carol.writeContract({ address: cfg.registry, abi: registryAbi, functionName: "release" });
    await pub.waitForTransactionReceipt({ hash: h });

    expect(await isHandleCoolingDown(pub, cfg, "carol")).toBe(true);
    expect(await isHandleAvailable(pub, cfg, "carol")).toBe(false);

    const err = await claimGarden(alice, pub, cfg, "carol").catch((e) => e);
    expect(explainError(err)).toMatch(/reserved for its previous owner/i);

    // the previous owner can take it back
    await claimGarden(carol, pub, cfg, "carol");
    expect(await isClaimed(pub, cfg, carol.account.address)).toBe(true);
  });
});
