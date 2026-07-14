import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("builds the Palkeep desktop application shell", async () => {
  const [html, entry, page] = await Promise.all([
    readFile(new URL("../desktop-dist/index.html", import.meta.url), "utf8"),
    readFile(new URL("../desktop/src/main.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(html, /<title>Palkeep .* Server Command<\/title>/i);
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(entry, /import Palkeep from "\.\.\/\.\.\/app\/page"/);
  assert.match(page, />PALKEEP</);
  assert.match(page, />SERVER COMMAND</);
  assert.match(page, /About Palkeep/);
  assert.match(page, /Support the project/);
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

test("offers optimized Pal build presets with complete bridge payloads", async () => {
  const [page, main, rawPassives] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../electron/main.cjs", import.meta.url), "utf8"),
    readFile(new URL("../app/data/palworld-passives.json", import.meta.url), "utf8"),
  ]);
  const passiveIds = new Set(JSON.parse(rawPassives).map((passive) => passive.id));
  const presetPassiveIds = [
    "CraftSpeed_up3", "CraftSpeed_up2", "PAL_CorporateSlave", "Nocturnal",
    "PAL_ALLAttack_up3", "Noukin", "CoolTimeReduction_Up_1", "Legend",
    "Deffence_up3", "MutationPal_Immortal", "MoveSpeed_up_3", "Stamina_Up_3",
    "Test_PalEgg_HatchingSpeed_Up", "MutationPal_Babysitter", "Rare",
  ];

  assert.match(page, /Best worker/);
  assert.match(page, /Best fighter/);
  assert.match(page, /Defensive tank/);
  assert.match(page, /Fast mount/);
  assert.match(page, /Breeding specialist/);
  assert.match(page, /Balanced all-rounder/);
  for (const id of presetPassiveIds) {
    assert.ok(passiveIds.has(id), `preset uses unknown passive ${id}`);
  }
  assert.match(main, /passives: action\.passives/);
  assert.match(main, /talentAttack: Number\(action\.talentAttack\)/);
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
