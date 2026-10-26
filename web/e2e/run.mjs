// End-to-end browser test: real contracts on a local chain, the real app built against them,
// and Chrome driving the pages with a test wallet that sends real transactions.
//
//   pnpm e2e
//
// Needs: foundry (anvil, forge, cast) on PATH, Google Chrome (or CHROME_PATH), and `forge build`
// working in ../contracts. Everything is local and throwaway; nothing touches a real network.
// The private keys below are anvil's public development keys.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const CONTRACTS = path.resolve(WEB, "../contracts");
const OUT = path.join(HERE, "out");

const RPC_PORT = Number(process.env.E2E_RPC_PORT ?? 8547);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3111);
const RPC = `http://127.0.0.1:${RPC_PORT}`;
const BASE = `http://localhost:${WEB_PORT}`;
const CHAIN_ID = 31337;

// anvil development accounts #0, #1, #2
const K0 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const K1 = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const ACCT0 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // tipper
const ACCT1 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // recipient
const ACCT2 = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"; // fresh wallet
const STRANGER = "0x000000000000000000000000000000000000dEaD";
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const children = [];
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", ...opts }).trim();
const cast = (...args) => sh("cast", [...args, "--rpc-url", RPC]);

function portInUse(port) {
  return new Promise((resolve) => {
    const s = net.connect(port, "127.0.0.1");
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("error", () => resolve(false));
  });
}

async function waitFor(fn, what, tries = 100) {
  for (let i = 0; i < tries; i++) {
    try {
      if (await fn()) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

function stopAll() {
  for (const c of children) c.kill();
}

async function setup() {
  for (const port of [RPC_PORT, WEB_PORT]) {
    if (await portInUse(port)) throw new Error(`Port ${port} is already in use (set E2E_RPC_PORT / E2E_WEB_PORT).`);
  }

  console.log("› starting anvil and deploying contracts");
  children.push(spawn("anvil", ["--port", String(RPC_PORT), "--silent"], { stdio: "ignore" }));
  await waitFor(() => cast("chain-id") === String(CHAIN_ID), "anvil");

  const musdOut = sh("forge", ["create", "test/mocks/MockMUSD.sol:MockMUSD", "--rpc-url", RPC, "--private-key", K0, "--broadcast"], { cwd: CONTRACTS });
  const musd = musdOut.match(/Deployed to:\s*(0x[0-9a-fA-F]{40})/)?.[1];
  if (!musd) throw new Error("Could not deploy MockMUSD:\n" + musdOut);

  const deployOut = sh("forge", ["script", "script/Deploy.s.sol", "--rpc-url", RPC, "--private-key", K0, "--broadcast"], {
    cwd: CONTRACTS,
    env: { ...process.env, MUSD_ADDRESS: musd },
  });
  const registry = deployOut.match(/SatSeedRegistry:\s*(0x[0-9a-fA-F]{40})/)?.[1];
  const tips = deployOut.match(/SatSeedTips:\s*(0x[0-9a-fA-F]{40})/)?.[1];
  if (!registry || !tips) throw new Error("Could not read deployed addresses:\n" + deployOut);

  cast("send", musd, "mint(address,uint256)", ACCT0, "1000ether", "--private-key", K0);
  cast("send", registry, "claim(string,string)", "recipient", "", "--private-key", K1);

  console.log("› building the app against the local chain");
  const env = {
    ...process.env,
    NEXT_DIST_DIR: ".next-e2e",
    NEXT_PUBLIC_CHAIN_ID: String(CHAIN_ID),
    NEXT_PUBLIC_RPC_URL: RPC,
    NEXT_PUBLIC_REGISTRY_ADDRESS: registry,
    NEXT_PUBLIC_TIPS_ADDRESS: tips,
    NEXT_PUBLIC_MUSD_ADDRESS: musd,
  };
  const next = path.join(WEB, "node_modules/next/dist/bin/next");
  const build = spawnSync(process.execPath, [next, "build"], { cwd: WEB, env, encoding: "utf8" });
  if (build.status !== 0) throw new Error("next build failed:\n" + (build.stdout + build.stderr).split("\n").slice(-25).join("\n"));

  console.log("› starting the app");
  children.push(spawn(process.execPath, [next, "start", "-p", String(WEB_PORT)], { cwd: WEB, env, stdio: "ignore" }));
  await waitFor(() => fetch(BASE).then((r) => r.ok), "the app");

  return { registry, tips, musd };
}

// A minimal EIP-1193 wallet. It forwards everything to anvil, which has these accounts unlocked.
const walletScript = (acct) => `
  (() => {
    let connected = false;
    const ACCT = "${acct}";
    const rpc = async (method, params) => {
      const r = await fetch("${RPC}", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }) });
      const j = await r.json();
      if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; e.data = j.error.data; throw e; }
      return j.result;
    };
    window.ethereum = {
      request: async ({ method, params }) => {
        if (method === "eth_requestAccounts") { connected = true; return [ACCT]; }
        if (method === "eth_accounts") return connected ? [ACCT] : [];
        if (method === "eth_chainId") return "0x${CHAIN_ID.toString(16)}";
        if (method === "wallet_switchEthereumChain") return null;
        return rpc(method, params);
      },
      on() {}, removeListener() {},
    };
  })();`;

const results = [];
let shot = 0;
async function step(name, page, fn) {
  try {
    await fn();
    results.push({ ok: true, name });
    console.log("  PASS", name);
  } catch (e) {
    const msg = e.message.split("\n")[0];
    results.push({ ok: false, name, msg });
    console.log("  FAIL", name, "-", msg);
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: path.join(OUT, `fail-${++shot}.png`) }).catch(() => {});
  }
}

async function runTests({ registry, musd }) {
  const browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" },
  );
  const T = { timeout: 15000 };
  const consoleErrors = [];
  const newPage = async (acct) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    await ctx.addInitScript(walletScript(acct));
    const page = await ctx.newPage();
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
    return page;
  };
  const connect = (p) => p.getByRole("button", { name: "Connect wallet" }).first().click();

  console.log("› running browser checks");
  const a = await newPage(ACCT0);

  await step("join: connect wallet from the header", a, async () => {
    await a.goto(`${BASE}/join`);
    await connect(a);
    await a.getByText(short(ACCT0)).waitFor(T);
  });
  await step("join: no 'not live yet' banner when contracts are configured", a, async () => {
    if (await a.getByText("Not live yet").count()) throw new Error("banner shown");
  });
  await step("join: rejects an invalid handle format", a, async () => {
    await a.getByLabel("Handle").fill("Bad Handle!");
    await a.getByText("Use only lowercase letters").waitFor(T);
    if (await a.getByRole("button", { name: "Plant my garden" }).isEnabled()) throw new Error("claim enabled");
  });
  await step("join: reports a taken handle from the chain", a, async () => {
    await a.getByLabel("Handle").fill("recipient");
    await a.getByText("@recipient is taken.").waitFor(T);
    if (await a.getByRole("button", { name: "Plant my garden" }).isEnabled()) throw new Error("claim enabled");
  });
  await step("join: claims an available handle on-chain", a, async () => {
    await a.getByLabel("Handle").fill("e2e_user");
    await a.getByText("@e2e_user is available.").waitFor(T);
    await a.getByRole("button", { name: "Plant my garden" }).click();
    await a.getByText("Planted.").waitFor(T);
    const claimed = cast("call", registry, "isClaimed(address)(bool)", ACCT0);
    if (claimed !== "true") throw new Error(`not claimed on chain: ${claimed}`);
  });
  await step("join: revisiting says the garden already exists", a, async () => {
    await a.goto(`${BASE}/join`);
    await connect(a);
    await a.getByText("already has a garden").waitFor(T);
  });
  await step("me: shows the handle and no tips yet", a, async () => {
    await a.goto(`${BASE}/me`);
    await connect(a);
    await a.getByRole("heading", { name: "@e2e_user" }).waitFor(T);
    await a.getByText("No tips yet").waitFor(T);
  });

  const openTip = async (addr) => {
    await a.goto(`${BASE}/garden/${addr}`);
    await connect(a);
    await a.getByText(short(ACCT0)).first().waitFor(T);
    await a.getByRole("button", { name: "Tip this garden" }).click();
  };

  await step("tip: reads the minimum from the contract and shows the recipient", a, async () => {
    await openTip(ACCT1);
    await a.getByText("Minimum tip: 0.10 MUSD").waitFor(T);
    await a.getByText(short(ACCT1)).first().waitFor(T);
  });
  await step("tip: an amount below the minimum blocks sending", a, async () => {
    await a.getByLabel("Amount (MUSD)").fill("0.01");
    if (await a.getByRole("button", { name: "Send tip" }).isEnabled()) throw new Error("send enabled below min");
  });
  await step("tip: an emoji note over 140 bytes blocks sending and says why", a, async () => {
    await a.getByLabel("Amount (MUSD)").fill("5");
    await a.getByLabel("Note (optional)").fill("😀".repeat(36));
    await a.getByText("144 / 140 bytes").waitFor(T);
    if (await a.getByRole("button", { name: "Send tip" }).isEnabled()) throw new Error("send enabled over limit");
  });
  await step("tip: sends 5 MUSD with a note (approve + tip); recipient balance updates", a, async () => {
    await a.getByLabel("Note (optional)").fill("e2e thanks");
    await a.getByRole("button", { name: "Send tip" }).click();
    await a.getByText("Tip sent.").waitFor({ timeout: 30000 });
    const bal = cast("call", musd, "balanceOf(address)(uint256)", ACCT1);
    if (!bal.startsWith("5000000000000000000")) throw new Error(`recipient balance ${bal}`);
  });
  await step("tip: an unclaimed wallet explains it can't be tipped", a, async () => {
    await openTip(STRANGER);
    await a.getByText("hasn't claimed its garden yet").waitFor(T);
  });
  await step("tip: tipping yourself is explained", a, async () => {
    await openTip(ACCT0);
    await a.getByText("your own garden").waitFor(T);
  });
  await step("dashboard: Tip on a demo wallet explains it is unclaimed", a, async () => {
    await a.goto(`${BASE}/dashboard`);
    await connect(a);
    await a.getByText(short(ACCT0)).waitFor(T);
    await a.getByRole("button", { name: "Tip this garden" }).click();
    await a.getByText("hasn't claimed its garden yet").waitFor(T);
  });

  const b = await newPage(ACCT1);
  await step("recipient /me: sees handle, the 5.00 MUSD tip, sender and note", b, async () => {
    await b.goto(`${BASE}/me`);
    await connect(b);
    await b.getByRole("heading", { name: "@recipient" }).waitFor(T);
    await b.getByText("5.00 MUSD").waitFor(T);
    await b.getByText(short(ACCT0)).first().waitFor(T);
    await b.getByText("“e2e thanks”").waitFor(T);
  });

  const c = await newPage(ACCT2);
  await step("join: a just-released handle is reserved for its previous owner", c, async () => {
    cast("send", registry, "release()", "--private-key", K1);
    await c.goto(`${BASE}/join`);
    await connect(c);
    await c.getByLabel("Handle").fill("recipient");
    await c.getByText("reserved for its previous owner").waitFor(T);
  });

  await step("no unexpected browser console errors", a, async () => {
    const real = consoleErrors.filter((t) => !/Failed to load resource|favicon/i.test(t));
    if (real.length) throw new Error(real.slice(0, 3).join(" | "));
  });

  await browser.close();
}

let exitCode = 1;
try {
  const deployed = await setup();
  await runTests(deployed);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  exitCode = failed.length ? 1 : 0;
} catch (e) {
  console.error("\nSetup failed:", e.message);
} finally {
  stopAll();
}
process.exit(exitCode);
