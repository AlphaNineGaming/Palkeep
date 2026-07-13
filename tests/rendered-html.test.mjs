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
