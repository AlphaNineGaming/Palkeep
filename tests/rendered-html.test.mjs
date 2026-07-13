import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Palkeep application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Palkeep [—-] Palworld Server Command<\/title>/i);
  assert.match(html, />PALKEEP</);
  assert.match(html, />SERVER COMMAND</);
  assert.match(html, /About Palkeep/);
  assert.match(html, /Support the project/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("ships the AlphaNineGaming support and legal details", async () => {
  const [page, readme, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /https:\/\/ko-fi\.com\/E1W220NMPA/);
  assert.match(page, /https:\/\/discord\.gg\/RQsVw2vyg/);
  assert.match(page, /AlphaNineGaming/);
  assert.match(page, /not affiliated with or endorsed by Pocketpair/);
  assert.match(readme, /Support development on Ko-fi/);
  assert.match(packageJson, /"author": "AlphaNineGaming"/);
});

test("keeps weapons complete and easy to discover", async () => {
  const [page, rawItems] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/palworld-items.json", import.meta.url), "utf8"),
  ]);
  const items = JSON.parse(rawItems);
  const weapons = items.filter((item) => item.category === "Weapon");
  const ids = new Set(weapons.map((item) => item.id));

  assert.equal(weapons.length, 388);
  for (const id of [
    "AssaultRifle_Default1",
    "HandGun_Default",
    "Launcher_Default",
    "LaserRifle",
    "GatlingGun",
    "GrenadeLauncher",
    "BeamSword",
    "SkySubmachineGun",
  ]) {
    assert.ok(ids.has(id), `missing weapon ${id}`);
  }
  assert.match(page, /const itemCategoryPriority = \[\s*"Weapon"/);
  assert.match(page, /Category[\s\S]*catalogItemCategories\.map/);
  assert.match(page, /weapon weapons gun guns firearm firearms melee ranged/);
});

test("checks for Beta updates and displays the installed build", async () => {
  const [page, main, preload, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../electron/main.cjs", import.meta.url), "utf8"),
    readFile(new URL("../electron/preload.cjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(main, /api\.github\.com\/repos\/AlphaNineGaming\/Palkeep\/releases/);
  assert.match(main, /ipcMain\.handle\("updates:check"/);
  assert.match(preload, /checkForUpdates/);
  assert.match(page, /Startup update check enabled/);
  assert.match(page, /sidebar-build/);
  assert.match(packageJson, /"version": "0\.6\.5-beta\.4"/);
});

test("ships an easy guide with prominent live bridge activation steps", async () => {
  const [guide, page, readme] = await Promise.all([
    readFile(new URL("../USER_GUIDE.md", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);

  assert.match(guide, /Activate the live bridge/);
  assert.match(guide, /Close Palworld completely/);
  assert.match(guide, /Enable live delivery/);
  assert.match(guide, /Live delivery ready/);
  assert.match(guide, /If the bridge does not become ready/);
  assert.match(page, /Easy user guide/);
  assert.match(readme, /easy user guide/);
});

test("documents and enforces source-built single-player dependencies", async () => {
  const [lockRaw, prepare, verify, security, ignore] = await Promise.all([
    readFile(new URL("../dependencies.lock.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/prepare-single-player.ps1", import.meta.url), "utf8"),
    readFile(new URL("../scripts/verify-supply-chain.ps1", import.meta.url), "utf8"),
    readFile(new URL("../SECURITY.md", import.meta.url), "utf8"),
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
  ]);
  const lock = JSON.parse(lockRaw);

  assert.equal(lock.python.version, "3.12.10");
  assert.match(lock.python.sha256, /^[a-f0-9]{64}$/);
  assert.match(lock.pyooz.commit, /^[a-f0-9]{40}$/);
  assert.match(prepare, /Get-AuthenticodeSignature/);
  assert.match(prepare, /--require-hashes/);
  assert.match(prepare, /pip[\s\S]*wheel[\s\S]*--no-build-isolation/);
  assert.match(verify, /Native files are tracked in source directories/);
  assert.match(security, /not yet Authenticode-signed/);
  assert.match(ignore, /single-player\/runtime\/\*\.dll/);
  assert.match(lock.ue4ssPalworld.assetSha256, /^[a-f0-9]{64}$/);
  assert.match(ignore, /live-bridge\/runtime\/dwmapi\.dll/);
});
