"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import itemCatalogData from "./data/palworld-items.json";
import palCatalogData from "./data/palworld-pals.json";
import passiveCatalogData from "./data/palworld-passives.json";

type Config = {
  restApiUrl: string;
  restUsername: string;
  restPassword: string;
  hasRestPassword: boolean;
  bridgeUrl: string;
  bridgeToken: string;
  hasBridgeToken: boolean;
  serverPath: string;
  safeChanges: boolean;
  pollIntervalMs: number;
  allowPublicEndpoint: boolean;
  setupComplete: boolean;
};
type LivePlayer = {
  name: string;
  accountName?: string;
  playerId: string;
  userId: string;
  ping: number;
  location_x: number;
  location_y: number;
  level: number;
  building_count?: number;
};
type Snapshot = {
  officialConnected: boolean;
  bridgeConnected: boolean;
  info: any;
  players: LivePlayer[];
  metrics: any;
  settings: any;
  bridge: any;
  errors: string[];
  checkedAt: string;
};
type Detail = {
  bridgeConnected: boolean;
  inventory: any[];
  pals: any[];
  errors: string[];
};
type SingleWorld = {
  id: string;
  label: string;
  path: string;
  modifiedAt: string;
  size: number;
  format: string;
  playerCount: number;
};
type SinglePlayer = {
  playerId: string;
  name: string;
  level: number;
  playerFile: string;
  inventory: any[];
  pals: any[];
  error?: string;
};
type SingleSnapshot = {
  world: SingleWorld;
  players: SinglePlayer[];
  settings: Record<string, string | number | boolean>;
  hasWorldOptions: boolean;
};
type SingleBackup = {
  id: string;
  createdAt: string | null;
  reason: string;
  path: string;
};
type LiveBridgeStatus = {
  gamePath: string;
  installed: boolean;
  running: boolean;
  connected: boolean;
  version: string | null;
  installedVersion: string | null;
  latestVersion: string;
  updateAvailable: boolean;
  players: string[];
  error: string | null;
};
type AppInfo = {
  version: string;
  build: string;
  channel: string;
  packaged: boolean;
};
type UpdateStatus = {
  checked: boolean;
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  prerelease: boolean;
  releaseName: string | null;
  releaseUrl: string | null;
  downloadUrl: string | null;
  publishedAt: string | null;
  error: string | null;
};
type DesktopApi = {
  getAppInfo: () => Promise<AppInfo>;
  checkForUpdates: () => Promise<UpdateStatus>;
  openUpdate: (url: string) => Promise<{ ok: boolean }>;
  getConfig: () => Promise<Config>;
  saveConfig: (config: Partial<Config>) => Promise<Config>;
  chooseServerFolder: () => Promise<string | null>;
  testConnections: () => Promise<Snapshot>;
  getLiveSnapshot: () => Promise<Snapshot>;
  getPlayerDetail: (playerId: string) => Promise<Detail>;
  runAction: (
    action: Record<string, unknown>,
  ) => Promise<{ ok: boolean; result: any }>;
  openAuditFolder: () => Promise<any>;
  discoverSinglePlayerWorlds: () => Promise<{
    root: string;
    worlds: SingleWorld[];
  }>;
  inspectSinglePlayerWorld: (worldPath: string) => Promise<SingleSnapshot>;
  chooseSinglePlayerWorld: () => Promise<string | null>;
  runSinglePlayerAction: (request: Record<string, unknown>) => Promise<any>;
  createSinglePlayerBackup: (worldPath: string) => Promise<any>;
  listSinglePlayerBackups: (worldPath: string) => Promise<SingleBackup[]>;
  restoreSinglePlayerBackup: (
    worldPath: string,
    backupId: string,
  ) => Promise<any>;
  openSinglePlayerBackups: () => Promise<any>;
  getLiveBridgeStatus: (gamePath?: string) => Promise<LiveBridgeStatus>;
  chooseLiveBridgeGame: () => Promise<string | null>;
  installLiveBridge: (gamePath: string) => Promise<any>;
  runLiveBridgeAction: (request: Record<string, unknown>) => Promise<any>;
};
declare global {
  interface Window {
    palkeepDesktop?: DesktopApi;
  }
}

const itemCatalog = [
  { name: "Legendary Sphere", id: "LegendarySphere", tone: "gold", glyph: "◉" },
  {
    name: "Assault Rifle Ammo",
    id: "AssaultRifleBullet",
    tone: "steel",
    glyph: "▥",
  },
  { name: "Carbon Fiber", id: "CarbonFiber", tone: "slate", glyph: "◆" },
  { name: "High Quality Pal Oil", id: "PalOil", tone: "amber", glyph: "●" },
  {
    name: "Ancient Civilization Part",
    id: "AncientParts2",
    tone: "teal",
    glyph: "✦",
  },
];
const palCatalog = [
  { name: "Jetragon", id: "JetDragon", element: "Dragon", tone: "violet" },
  { name: "Anubis", id: "Anubis", element: "Ground", tone: "sand" },
  { name: "Frostallion", id: "IceHorse", element: "Ice", tone: "ice" },
  { name: "Grizzbolt", id: "ElecPanda", element: "Electric", tone: "gold" },
];
const defaultConfig: Config = {
  restApiUrl: "http://127.0.0.1:8212/v1/api",
  restUsername: "admin",
  restPassword: "",
  hasRestPassword: false,
  bridgeUrl: "http://127.0.0.1:8213/v1",
  bridgeToken: "",
  hasBridgeToken: false,
  serverPath: "",
  safeChanges: true,
  pollIntervalMs: 5000,
  allowPublicEndpoint: false,
  setupComplete: false,
};
const playerColors = [
  "#eab968",
  "#87b9a8",
  "#a98fc7",
  "#c7795e",
  "#6f98b3",
  "#b6898f",
];
const PALKEEP_VERSION = "0.6.6-beta";
const DEFAULT_APP_INFO: AppInfo = {
  version: PALKEEP_VERSION,
  build: "beta",
  channel: "Beta",
  packaged: false,
};
const SUPPORT_LINKS = {
  guide: "https://github.com/AlphaNineGaming/Palkeep/blob/main/USER_GUIDE.md",
  donate: "https://ko-fi.com/E1W220NMPA",
  discord: "https://discord.gg/RQsVw2vyg",
  youtube: "https://www.youtube.com/@AlphanineGaming",
  twitch: "https://www.twitch.tv/alphanine_gaming",
};
type CatalogItem = {
  id: string;
  name: string;
  category: string;
  maxStack: number;
  rarity: number;
  weight: number;
  description: string;
  icon: string;
};
type CatalogPal = {
  id: string;
  name: string;
  icon: string;
  elements: string[];
  dex: number;
  rarity: number;
  size: string;
  partnerSkill: string;
  description: string;
  work: { name: string; level: number }[];
};
type Passive = { id: string; name: string; rank: number; description: string };
type PalBuildPreset = {
  id: string;
  name: string;
  summary: string;
  passives: [string, string, string, string];
  rank: number;
  talents: { hp: number; attack: number; defense: number };
};
const fullItemCatalog = itemCatalogData as CatalogItem[];
const fullPalCatalog = palCatalogData as CatalogPal[];
const fullPassiveCatalog = passiveCatalogData as Passive[];
const PAL_BUILD_PRESETS: PalBuildPreset[] = [
  {
    id: "worker",
    name: "Best worker",
    summary: "Maximum work speed with all-night production.",
    passives: ["CraftSpeed_up3", "CraftSpeed_up2", "PAL_CorporateSlave", "Nocturnal"],
    rank: 5,
    talents: { hp: 100, attack: 100, defense: 100 },
  },
  {
    id: "fighter",
    name: "Best fighter",
    summary: "High attack, shorter skill cooldowns, and strong all-round combat stats.",
    passives: ["PAL_ALLAttack_up3", "Noukin", "CoolTimeReduction_Up_1", "Legend"],
    rank: 5,
    talents: { hp: 100, attack: 100, defense: 100 },
  },
  {
    id: "tank",
    name: "Defensive tank",
    summary: "Survivability, regeneration, defense, and reduced hunger.",
    passives: ["Deffence_up3", "Deffence_up2", "MutationPal_Immortal", "PAL_FullStomach_Down_3"],
    rank: 5,
    talents: { hp: 100, attack: 70, defense: 100 },
  },
  {
    id: "mount",
    name: "Fast mount",
    summary: "Maximum travel speed with extra mount stamina.",
    passives: ["MoveSpeed_up_3", "MoveSpeed_up_2", "MoveSpeed_up_1", "Stamina_Up_3"],
    rank: 5,
    talents: { hp: 100, attack: 100, defense: 100 },
  },
  {
    id: "breeding",
    name: "Breeding specialist",
    summary: "Faster breeding and incubation with better SAN and hunger efficiency.",
    passives: ["Test_PalEgg_HatchingSpeed_Up", "MutationPal_Babysitter", "PAL_Sanity_Down_2", "PAL_FullStomach_Down_2"],
    rank: 5,
    talents: { hp: 100, attack: 100, defense: 100 },
  },
  {
    id: "balanced",
    name: "Balanced all-rounder",
    summary: "A flexible mix of combat, work speed, movement, and cooldown reduction.",
    passives: ["Rare", "Legend", "CraftSpeed_up2", "CoolTimeReduction_Up_1"],
    rank: 5,
    talents: { hp: 100, attack: 100, defense: 100 },
  },
];
const itemCategoryPriority = [
  "Weapon", "Armor", "Accessory", "Food", "Consumable", "Material",
  "Glider", "Sphere Modifier", "Pal Weapon", "Essential", "Other",
];
const catalogItemCategories = [
  "All",
  ...Array.from(new Set(fullItemCatalog.map((item) => item.category))).sort((a, b) => {
    const ai = itemCategoryPriority.indexOf(a);
    const bi = itemCategoryPriority.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  }),
];
const itemCategoryCounts = Object.fromEntries(
  catalogItemCategories.map((category) => [
    category,
    category === "All"
      ? fullItemCatalog.length
      : fullItemCatalog.filter((item) => item.category === category).length,
  ]),
);
function itemSearchText(item: CatalogItem) {
  const aliases = item.category === "Weapon"
    ? "weapon weapons gun guns firearm firearms melee ranged"
    : item.category === "Armor"
      ? "armor armour gear clothing"
      : "";
  return `${item.name} ${item.id} ${item.category} ${item.description} ${aliases}`.toLowerCase();
}
type WorldSettingDefinition = {
  key: string;
  label: string;
  description: string;
  category: "Time & progress" | "Combat" | "Survival" | "Resources" | "World rules";
  type: "number" | "boolean" | "select";
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  options?: { value: string; label: string }[];
  defaultValue: string | number | boolean;
};
const worldSettingCatalog: WorldSettingDefinition[] = [
  { key:"DayTimeSpeedRate",label:"Day speed",description:"How quickly daytime passes.",category:"Time & progress",type:"number",min:.1,max:5,step:.1,suffix:"×",defaultValue:1 },
  { key:"NightTimeSpeedRate",label:"Night speed",description:"How quickly nighttime passes.",category:"Time & progress",type:"number",min:.1,max:5,step:.1,suffix:"×",defaultValue:1 },
  { key:"ExpRate",label:"Experience rate",description:"Experience earned by players and Pals.",category:"Time & progress",type:"number",min:.1,max:20,step:.1,suffix:"×",defaultValue:1 },
  { key:"PalCaptureRate",label:"Capture rate",description:"Base chance to capture Pals.",category:"Time & progress",type:"number",min:.1,max:5,step:.1,suffix:"×",defaultValue:1 },
  { key:"PalSpawnNumRate",label:"Pal spawn density",description:"Number of wild Pals spawned in the world.",category:"Time & progress",type:"number",min:.5,max:3,step:.1,suffix:"×",defaultValue:1 },
  { key:"PalEggDefaultHatchingTime",label:"Egg incubation",description:"Hours required for a large egg.",category:"Time & progress",type:"number",min:0,max:72,step:.5,suffix:"hours",defaultValue:72 },
  { key:"PlayerDamageRateAttack",label:"Player damage",description:"Damage dealt by players.",category:"Combat",type:"number",min:.1,max:5,step:.1,suffix:"×",defaultValue:1 },
  { key:"PlayerDamageRateDefense",label:"Damage to players",description:"Incoming damage received by players.",category:"Combat",type:"number",min:.1,max:5,step:.1,suffix:"×",defaultValue:1 },
  { key:"PalDamageRateAttack",label:"Pal damage",description:"Damage dealt by Pals.",category:"Combat",type:"number",min:.1,max:5,step:.1,suffix:"×",defaultValue:1 },
  { key:"PalDamageRateDefense",label:"Damage to Pals",description:"Incoming damage received by Pals.",category:"Combat",type:"number",min:.1,max:5,step:.1,suffix:"×",defaultValue:1 },
  { key:"PlayerStomachDecreaceRate",label:"Player hunger drain",description:"Speed at which player hunger decreases.",category:"Survival",type:"number",min:.1,max:5,step:.1,suffix:"×",defaultValue:1 },
  { key:"PlayerStaminaDecreaceRate",label:"Player stamina drain",description:"Stamina consumed by player actions.",category:"Survival",type:"number",min:.1,max:5,step:.1,suffix:"×",defaultValue:1 },
  { key:"PalStomachDecreaceRate",label:"Pal hunger drain",description:"Speed at which Pal hunger decreases.",category:"Survival",type:"number",min:.1,max:5,step:.1,suffix:"×",defaultValue:1 },
  { key:"PalStaminaDecreaceRate",label:"Pal stamina drain",description:"Stamina consumed by Pal actions.",category:"Survival",type:"number",min:.1,max:5,step:.1,suffix:"×",defaultValue:1 },
  { key:"PlayerAutoHPRegeneRate",label:"Player health regeneration",description:"Passive player health recovery.",category:"Survival",type:"number",min:.1,max:5,step:.1,suffix:"×",defaultValue:1 },
  { key:"PlayerAutoHpRegeneRateInSleep",label:"Sleeping regeneration",description:"Player health recovery while sleeping.",category:"Survival",type:"number",min:.1,max:5,step:.1,suffix:"×",defaultValue:1 },
  { key:"ItemWeightRate",label:"Item weight",description:"Multiplier applied to carried item weight.",category:"Survival",type:"number",min:0,max:10,step:.1,suffix:"×",defaultValue:1 },
  { key:"CollectionDropRate",label:"Gathering yield",description:"Resources received while gathering.",category:"Resources",type:"number",min:.5,max:5,step:.1,suffix:"×",defaultValue:1 },
  { key:"CollectionObjectHpRate",label:"Resource node health",description:"Durability of rocks, trees, and nodes.",category:"Resources",type:"number",min:.5,max:5,step:.1,suffix:"×",defaultValue:1 },
  { key:"CollectionObjectRespawnSpeedRate",label:"Resource respawn speed",description:"How quickly gathering nodes return.",category:"Resources",type:"number",min:.5,max:5,step:.1,suffix:"×",defaultValue:1 },
  { key:"EnemyDropItemRate",label:"Enemy drop rate",description:"Quantity of items dropped by enemies.",category:"Resources",type:"number",min:.5,max:5,step:.1,suffix:"×",defaultValue:1 },
  { key:"BuildObjectDeteriorationDamageRate",label:"Structure deterioration",description:"Damage structures take outside a base.",category:"Resources",type:"number",min:0,max:10,step:.1,suffix:"×",defaultValue:1 },
  { key:"BaseCampWorkerMaxNum",label:"Workers per base",description:"Maximum Pals assigned to one base.",category:"World rules",type:"number",min:1,max:100,step:1,defaultValue:15 },
  { key:"DropItemMaxNum",label:"Ground item limit",description:"Maximum item drops retained in the world.",category:"World rules",type:"number",min:0,max:10000,step:100,defaultValue:3000 },
  { key:"DeathPenalty",label:"Death penalty",description:"Items lost when a player dies.",category:"World rules",type:"select",options:[{value:"None",label:"Lose nothing"},{value:"Item",label:"Lose items"},{value:"ItemAndEquipment",label:"Lose items and equipment"},{value:"All",label:"Lose everything"}],defaultValue:"All" },
  { key:"bEnableInvaderEnemy",label:"Raids",description:"Allow hostile raid events at bases.",category:"World rules",type:"boolean",defaultValue:true },
  { key:"bEnableFastTravel",label:"Fast travel",description:"Allow travel between unlocked statues.",category:"World rules",type:"boolean",defaultValue:true },
  { key:"bEnableNonLoginPenalty",label:"Offline penalties",description:"Apply deterioration while players are offline.",category:"World rules",type:"boolean",defaultValue:true },
  { key:"bAutoResetGuildNoOnlinePlayers",label:"Reset inactive guilds",description:"Automatically reset guilds with no active players.",category:"World rules",type:"boolean",defaultValue:false },
  { key:"bIsStartLocationSelectByMap",label:"Choose starting location",description:"Allow players to select a starting point.",category:"World rules",type:"boolean",defaultValue:true },
  { key:"bActiveUNKO",label:"Pal droppings",description:"Enable Pal droppings in the world.",category:"World rules",type:"boolean",defaultValue:false },
];
function Mark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span className="brand-core" />
      <span className="brand-orbit one" />
      <span className="brand-orbit two" />
      <span className="brand-orbit three" />
    </div>
  );
}
function openSupportLink(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}
function SidebarSupport({ onAbout, appInfo }: { onAbout: () => void; appInfo: AppInfo }) {
  return (
    <div className="sidebar-support" aria-label="About and support">
      <button className="sidebar-about" onClick={onAbout}>
        <span>i</span>
        <b>About Palkeep</b>
      </button>
      <button
        className="sidebar-donate"
        onClick={() => openSupportLink(SUPPORT_LINKS.donate)}
      >
        <span>♥</span>
        <b>Support the project</b>
      </button>
      <small className="sidebar-build">
        v{appInfo.version} · {appInfo.channel} build {appInfo.build}
      </small>
    </div>
  );
}
function AboutDialog({
  onClose,
  appInfo,
  updateStatus,
  onCheckUpdates,
}: {
  onClose: () => void;
  appInfo: AppInfo;
  updateStatus: UpdateStatus | null;
  onCheckUpdates: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="about-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="about-card">
        <button className="about-close" aria-label="Close about Palkeep" onClick={onClose}>
          ×
        </button>
        <div className="about-hero">
          <div className="about-mark"><Mark /></div>
          <div>
            <p className="eyebrow">ABOUT THE WORKSHOP</p>
            <h2 id="about-title">Palkeep</h2>
            <p className="about-version">
              SERVER COMMAND · VERSION {appInfo.version} · {appInfo.channel.toUpperCase()} BUILD {appInfo.build.toUpperCase()}
            </p>
          </div>
        </div>
        <p className="about-intro">
          A focused desktop workshop for managing Palworld servers and single-player
          worlds, created and maintained by <b>AlphaNineGaming</b>.
        </p>
        <button className="about-guide-button" onClick={() => openSupportLink(SUPPORT_LINKS.guide)}>
          <span>?</span>
          <span><b>Easy user guide</b><small>Setup, live bridge activation, and troubleshooting</small></span>
          <em>Read guide ↗</em>
        </button>
        <div className={`about-update-status ${updateStatus?.updateAvailable ? "available" : ""}`}>
          <span>{updateStatus?.updateAvailable ? "↑" : "✓"}</span>
          <div>
            <b>{updateStatus?.updateAvailable ? `Palkeep ${updateStatus.latestVersion} is available` : "Startup update check enabled"}</b>
            <small>
              {updateStatus?.error
                ? "The last check could not reach GitHub. Palkeep will try again next launch."
                : updateStatus?.updateAvailable
                  ? "A newer Beta build is ready on GitHub."
                  : updateStatus?.checked
                    ? "You are running the newest published build."
                    : "Palkeep checks GitHub Releases when the app starts."}
            </small>
          </div>
          <button onClick={onCheckUpdates}>Check now</button>
        </div>
        <div className="about-support-callout">
          <span>♥</span>
          <div>
            <b>Enjoying Palkeep?</b>
            <p>Your support helps fund testing, updates, and new game tools.</p>
          </div>
          <button onClick={() => openSupportLink(SUPPORT_LINKS.donate)}>
            Donate on Ko-fi <span>↗</span>
          </button>
        </div>
        <div className="about-links">
          <button onClick={() => openSupportLink(SUPPORT_LINKS.discord)}>
            <span className="about-link-icon discord">D</span>
            <span><b>Discord</b><small>Community & support</small></span>
            <em>↗</em>
          </button>
          <button onClick={() => openSupportLink(SUPPORT_LINKS.youtube)}>
            <span className="about-link-icon youtube">▶</span>
            <span><b>YouTube</b><small>AlphaNineGaming</small></span>
            <em>↗</em>
          </button>
          <button onClick={() => openSupportLink(SUPPORT_LINKS.twitch)}>
            <span className="about-link-icon twitch">T</span>
            <span><b>Twitch</b><small>Live streams</small></span>
            <em>↗</em>
          </button>
        </div>
        <p className="about-legal">
          Palworld © Pocketpair, Inc. Palkeep is an independent community project
          and is not affiliated with or endorsed by Pocketpair.
        </p>
      </section>
    </div>
  );
}
function UpdateBanner({
  status,
  onOpen,
  onDismiss,
}: {
  status: UpdateStatus | null;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  if (!status?.updateAvailable) return null;
  return (
    <div className="update-banner" role="status">
      <span>↑</span>
      <div>
        <b>{status.releaseName || `Palkeep ${status.latestVersion}`} is ready</b>
        <small>You are using {status.currentVersion}. Download the newer {status.prerelease ? "Beta " : ""}build.</small>
      </div>
      <button onClick={onOpen}>View update ↗</button>
      <button className="update-dismiss" aria-label="Dismiss update notice" onClick={onDismiss}>×</button>
    </div>
  );
}
function uptime(seconds = 0) {
  const h = Math.floor(seconds / 3600);
  const d = Math.floor(h / 24);
  return d ? `${d}d ${h % 24}h` : `${h}h`;
}
function nowTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
const workLabels: Record<string, string> = {
  EmitFlame: "Kindling",
  Watering: "Watering",
  Seeding: "Planting",
  GenerateElectricity: "Electricity",
  Handcraft: "Handiwork",
  Collection: "Gathering",
  Deforest: "Lumbering",
  Mining: "Mining",
  OilExtraction: "Oil",
  ProductMedicine: "Medicine",
  Cool: "Cooling",
  Transport: "Transporting",
  MonsterFarm: "Farming",
};
function rarityLabel(rarity: number) {
  return rarity >= 20
    ? "Legendary"
    : rarity >= 10
      ? "Epic"
      : rarity >= 6
        ? "Rare"
        : rarity >= 3
          ? "Uncommon"
          : "Common";
}
function itemRarityLabel(rarity: number) {
  return rarity >= 4
    ? "Legendary"
    : rarity === 3
      ? "Epic"
      : rarity === 2
        ? "Rare"
        : rarity === 1
          ? "Uncommon"
          : "Common";
}
function Art({ src, alt }: { src: string; alt: string }) {
  return src ? (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={(event) => {
        event.currentTarget.style.display = "none";
      }}
    />
  ) : (
    <span>{alt.slice(0, 1)}</span>
  );
}
function palFormPayload(form: FormData) {
  return {
    speciesId: String(form.get("speciesId") || ""),
    displayName: String(form.get("displayName") || ""),
    gender: String(form.get("gender") || "Random"),
    level: Number(form.get("level")),
    passives: [1, 2, 3, 4]
      .map((index) => String(form.get(`passive${index}`) || ""))
      .filter(Boolean),
    rank: Number(form.get("rank") || 1),
    talentHp: Number(form.get("talentHp") || 50),
    talentAttack: Number(form.get("talentAttack") || 50),
    talentDefense: Number(form.get("talentDefense") || 50),
  };
}

function ItemPicker({ initialId = "" }: { initialId?: string }) {
  const initial = fullItemCatalog.find((item) => item.id === initialId);
  const [query, setQuery] = useState(initial?.name || "");
  const [selectedId, setSelectedId] = useState(initialId);
  const [category, setCategory] = useState(initial?.category || "All");
  const [custom, setCustom] = useState(false);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return fullItemCatalog.filter(
      (item) =>
        (category === "All" || item.category === category) &&
        (!needle || itemSearchText(item).includes(needle)),
    );
  }, [query, category]);
  if (custom)
    return (
      <div className="item-picker custom">
        <label>
          Custom item ID
          <input
            name="itemId"
            autoFocus
            placeholder="Enter the raw Palworld item ID"
            required
          />
        </label>
        <button
          className="picker-mode"
          type="button"
          onClick={() => setCustom(false)}
        >
          ← Browse the complete catalog
        </button>
      </div>
    );
  return (
    <div className="item-picker">
      <div className="item-picker-tools">
        <label>
          Find an item
          <span className="catalog-count">
            {fullItemCatalog.length.toLocaleString()} ITEMS
          </span>
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedId("");
            }}
            placeholder="Search name, ID, weapon, gear…"
            required={!selectedId}
          />
        </label>
        <label>
          Category
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setSelectedId("");
            }}
          >
            {catalogItemCategories.map((value) => (
              <option key={value} value={value}>
                {value} ({itemCategoryCounts[value].toLocaleString()})
              </option>
            ))}
          </select>
        </label>
      </div>
      <input type="hidden" name="itemId" value={selectedId} />
      <div
        className="item-results"
        role="listbox"
        aria-label="Palworld item catalog"
      >
        {matches.map((item) => (
          <button
            type="button"
            role="option"
            aria-selected={selectedId === item.id}
            className={selectedId === item.id ? "selected" : ""}
            key={item.id}
            onClick={() => {
              setSelectedId(item.id);
              setQuery(item.name);
            }}
          >
            <span>
              <b>{item.name}</b>
              <small>{item.id} · {itemRarityLabel(item.rarity)}</small>
            </span>
            <em>{item.category}</em>
          </button>
        ))}
        {!matches.length && (
          <div className="item-no-results">
            <b>No catalog match</b>
            <small>Try the exact item ID, or use custom ID entry.</small>
          </div>
        )}
      </div>
      <div className="picker-footer">
        <span>
          {matches.length.toLocaleString()}{" "}
          {matches.length === 1 ? "match" : "matches"}
          {selectedId && ` · ${selectedId}`}
        </span>
        <button
          className="picker-mode"
          type="button"
          onClick={() => setCustom(true)}
        >
          Use custom item ID
        </button>
      </div>
    </div>
  );
}

function PalPicker({ initialId = "" }: { initialId?: string }) {
  const initial = fullPalCatalog.find((pal) => pal.id === initialId);
  const [query, setQuery] = useState(initial?.name || "");
  const [element, setElement] = useState("All");
  const [selectedId, setSelectedId] = useState(initialId);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return fullPalCatalog.filter(
      (pal) =>
        (element === "All" || pal.elements.includes(element)) &&
        (!needle ||
          `${pal.name} ${pal.id} ${pal.elements.join(" ")} ${pal.dex}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [query, element]);
  return (
    <div className="pal-picker">
      <div className="pal-picker-tools">
        <label>
          Find a Pal
          <span className="catalog-count">{fullPalCatalog.length} PALS</span>
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedId("");
            }}
            placeholder="Search name, Paldeck number, or internal ID…"
            required={!selectedId}
          />
        </label>
        <label>
          Element
          <select
            value={element}
            onChange={(event) => {
              setElement(event.target.value);
              setSelectedId("");
            }}
          >
            <option>All</option>
            {[...new Set(fullPalCatalog.flatMap((pal) => pal.elements))]
              .sort()
              .map((value) => (
                <option key={value}>{value}</option>
              ))}
          </select>
        </label>
      </div>
      <input type="hidden" name="speciesId" value={selectedId} />
      <div
        className="pal-picker-results"
        role="listbox"
        aria-label="Complete Pal species catalog"
      >
        {matches.map((pal) => (
          <button
            type="button"
            role="option"
            aria-selected={selectedId === pal.id}
            className={selectedId === pal.id ? "selected" : ""}
            key={pal.id}
            onClick={() => {
              setSelectedId(pal.id);
              setQuery(pal.name);
            }}
          >
            <span className="picker-pal-art">
              <Art src={pal.icon} alt={pal.name} />
            </span>
            <span>
              <b>{pal.name}</b>
              <small>
                #{pal.dex || "—"} · {pal.id}
              </small>
            </span>
            <em>{pal.elements.join(" / ") || "Unknown"}</em>
          </button>
        ))}
        {!matches.length && (
          <div className="item-no-results">
            <b>No Pals match</b>
            <small>Try another name or clear the element filter.</small>
          </div>
        )}
      </div>
      <div className="picker-footer">
        <span>
          {matches.length} matches{selectedId && ` · ${selectedId}`}
        </span>
        <span>Select one Pal to continue</span>
      </div>
    </div>
  );
}

function PalCreationFields({ initialId = "" }: { initialId?: string }) {
  const [presetId, setPresetId] = useState("");
  const [passives, setPassives] = useState(["", "", "", ""]);
  const [rank, setRank] = useState(1);
  const [talents, setTalents] = useState({ hp: 50, attack: 50, defense: 50 });
  const selectedPreset = PAL_BUILD_PRESETS.find((preset) => preset.id === presetId);

  function applyPreset(nextId: string) {
    setPresetId(nextId);
    const preset = PAL_BUILD_PRESETS.find((entry) => entry.id === nextId);
    if (!preset) return;
    setPassives([...preset.passives]);
    setRank(preset.rank);
    setTalents({ ...preset.talents });
  }

  function changePassive(index: number, value: string) {
    setPresetId("custom");
    setPassives((current) => current.map((passive, slot) => slot === index ? value : passive));
  }

  return (
    <>
      <PalPicker initialId={initialId} />
      <div className="form-row pal-basics">
        <label>
          Nickname
          <input
            name="displayName"
            maxLength={24}
            placeholder="Use species name"
          />
        </label>
        <label>
          Gender
          <select name="gender" defaultValue="Random">
            <option>Random</option>
            <option>Female</option>
            <option>Male</option>
          </select>
        </label>
        <label>
          Level
          <input
            name="level"
            type="number"
            min="1"
            max="100"
            defaultValue="50"
            required
          />
        </label>
      </div>
      <div className="pal-preset-panel">
        <label>
          Build preset
          <select value={presetId} onChange={(event) => applyPreset(event.target.value)}>
            <option value="">Choose a preset...</option>
            <option value="custom" disabled>Custom selection</option>
            {PAL_BUILD_PRESETS.map((preset) => (
              <option value={preset.id} key={preset.id}>{preset.name}</option>
            ))}
          </select>
        </label>
        <div>
          <b>{selectedPreset?.name || "Start with a proven build"}</b>
          <small>
            {selectedPreset?.summary || "A preset fills all four traits, condensation, and talent values. You can change anything afterward."}
          </small>
        </div>
      </div>
      <details className="pal-advanced">
        <summary>
          Traits and advanced stats <span>Optional</span>
        </summary>
        <div className="passive-grid">
          {[1, 2, 3, 4].map((index) => (
            <label key={index}>
              Passive trait {index}
              <select
                name={`passive${index}`}
                value={passives[index - 1]}
                onChange={(event) => changePassive(index - 1, event.target.value)}
              >
                <option value="">None</option>
                {fullPassiveCatalog.map((passive) => (
                  <option value={passive.id} key={passive.id}>
                    {passive.name} · {passive.rank > 0 ? "+" : ""}
                    {passive.rank}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="form-row pal-stats">
          <label>
            Condensation
            <select
              name="rank"
              value={rank}
              onChange={(event) => {
                setPresetId("custom");
                setRank(Number(event.target.value));
              }}
            >
              {[1, 2, 3, 4, 5].map((rank) => (
                <option value={rank} key={rank}>
                  Rank {rank}
                </option>
              ))}
            </select>
          </label>
          <label>
            Health talent
            <input
              name="talentHp"
              type="number"
              min="0"
              max="100"
              value={talents.hp}
              onChange={(event) => {
                setPresetId("custom");
                setTalents((current) => ({ ...current, hp: Number(event.target.value) }));
              }}
            />
          </label>
          <label>
            Attack talent
            <input
              name="talentAttack"
              type="number"
              min="0"
              max="100"
              value={talents.attack}
              onChange={(event) => {
                setPresetId("custom");
                setTalents((current) => ({ ...current, attack: Number(event.target.value) }));
              }}
            />
          </label>
          <label>
            Defense talent
            <input
              name="talentDefense"
              type="number"
              min="0"
              max="100"
              value={talents.defense}
              onChange={(event) => {
                setPresetId("custom");
                setTalents((current) => ({ ...current, defense: Number(event.target.value) }));
              }}
            />
          </label>
        </div>
      </details>
    </>
  );
}

function DatabaseView({
  kind,
  onUse,
}: {
  kind: "items" | "pals";
  onUse?: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState("index");
  const [limit, setLimit] = useState(120);
  const elements = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(fullPalCatalog.flatMap((pal) => pal.elements)),
      ).sort(),
    ],
    [],
  );
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (kind === "items")
      return fullItemCatalog
        .filter(
          (item) =>
            (filter === "All" || item.category === filter) &&
            (!needle || itemSearchText(item).includes(needle)),
        )
        .sort((a, b) =>
          sort === "rarity"
            ? b.rarity - a.rarity || a.name.localeCompare(b.name)
            : a.name.localeCompare(b.name),
        );
    return fullPalCatalog
      .filter(
        (pal) =>
          (filter === "All" || pal.elements.includes(filter)) &&
          (!needle ||
            `${pal.name} ${pal.id} ${pal.dex} ${pal.elements.join(" ")} ${pal.description}`
              .toLowerCase()
              .includes(needle)),
      )
      .sort((a, b) =>
        sort === "rarity"
          ? b.rarity - a.rarity || (a.dex || 9999) - (b.dex || 9999)
          : (a.dex || 9999) - (b.dex || 9999) || a.name.localeCompare(b.name),
      );
  }, [kind, query, filter, sort]);
  useEffect(() => setLimit(120), [kind, query, filter, sort]);
  useEffect(() => {
    setQuery("");
    setFilter("All");
    setSort("index");
  }, [kind]);
  return (
    <div className="database-view">
      <div className={`database-hero ${kind}`}>
        <div>
          <p className="eyebrow">PALKEEP FIELD ARCHIVE</p>
          <h1>{kind === "items" ? "Item Database" : "Pal Database"}</h1>
          <p>
            {kind === "items"
              ? "Browse every known gear piece, weapon, food, material, schematic, and usable item."
              : "Explore the complete in-game Pal catalog with elements, work skills, partner skills, and internal IDs."}
          </p>
        </div>
        <div className="database-count">
          <strong>
            {(kind === "items"
              ? fullItemCatalog.length
              : fullPalCatalog.length
            ).toLocaleString()}
          </strong>
          <span>{kind === "items" ? "KNOWN ITEMS" : "INGAME PALS"}</span>
        </div>
      </div>
      <div className="database-toolbar panel">
        <label className="database-search">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              kind === "items"
                ? "Search item name, ID, category, or description"
                : "Search Pal name, Paldeck number, element, or ID"
            }
          />
        </label>
        <div className="filter-chips">
          {(kind === "items" ? catalogItemCategories : elements).map((value) => (
            <button
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value)}
              key={value}
            >
              {value}
              {kind === "items" && (
                <span>{itemCategoryCounts[value].toLocaleString()}</span>
              )}
            </button>
          ))}
        </div>
        <select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="index">
            {kind === "items" ? "Name A–Z" : "Paldeck order"}
          </option>
          <option value="rarity">Highest rarity</option>
        </select>
      </div>
      <div className="database-result-line">
        <b>{results.length.toLocaleString()} results</b>
        <span>Showing {Math.min(limit, results.length).toLocaleString()}</span>
      </div>
      {kind === "items" ? (
        <div className="database-grid item-db-grid">
          {(results as CatalogItem[]).slice(0, limit).map((item) => (
            <article key={item.id}>
              <div className="db-art item">
                <Art src={item.icon} alt={item.name} />
                <span>R{item.rarity}</span>
              </div>
              <div className="db-card-body">
                <small>
                  {item.category} · {itemRarityLabel(item.rarity)}
                </small>
                <h3>{item.name}</h3>
                <code>{item.id}</code>
                <p>{item.description || "No description available."}</p>
                <div className="db-facts">
                  <span>
                    STACK <b>{item.maxStack.toLocaleString()}</b>
                  </span>
                  <span>
                    WEIGHT <b>{item.weight}</b>
                  </span>
                </div>
                {onUse && (
                  <button onClick={() => onUse(item.id)}>
                    Give this item <span>＋</span>
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="database-grid pal-db-grid">
          {(results as CatalogPal[]).slice(0, limit).map((pal) => (
            <article key={pal.id}>
              <div className="db-art pal">
                <Art src={pal.icon} alt={pal.name} />
                <span>#{pal.dex || "—"}</span>
              </div>
              <div className="db-card-body">
                <small>
                  {pal.elements.join(" / ") || "Unknown"} ·{" "}
                  {rarityLabel(pal.rarity)}
                </small>
                <h3>{pal.name}</h3>
                <code>{pal.id}</code>
                <p>{pal.description || "No description available."}</p>
                {pal.partnerSkill && (
                  <div className="partner-skill">
                    <span>✦</span>
                    <div>
                      <small>PARTNER SKILL</small>
                      <b>{pal.partnerSkill}</b>
                    </div>
                  </div>
                )}
                <div className="work-tags">
                  {pal.work.slice(0, 4).map((work) => (
                    <span key={work.name}>
                      {workLabels[work.name] || work.name} {work.level}
                    </span>
                  ))}
                </div>
                {onUse && (
                  <button onClick={() => onUse(pal.id)}>
                    Create this Pal <span>◇</span>
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {limit < results.length && (
        <button
          className="load-more"
          onClick={() => setLimit((value) => value + 120)}
        >
          Load 120 more <span>↓</span>
        </button>
      )}
    </div>
  );
}

function WorldSettingsView({
  settings,
  hasWorldOptions,
  busy,
  onSave,
}: {
  settings: Record<string, string | number | boolean>;
  hasWorldOptions: boolean;
  busy: boolean;
  onSave: (changes: Record<string, string | number | boolean>) => Promise<void>;
}) {
  const initial = useMemo(
    () => Object.fromEntries(worldSettingCatalog.map((entry) => [entry.key, settings[entry.key] ?? entry.defaultValue])),
    [settings],
  );
  const [draft, setDraft] = useState<Record<string, string | number | boolean>>(initial);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  useEffect(() => setDraft(initial), [initial]);
  const changed = worldSettingCatalog.filter((entry) => String(draft[entry.key]) !== String(initial[entry.key]));
  const visible = worldSettingCatalog.filter((entry) => {
    const matchesCategory = category === "All" || entry.category === category;
    const needle = search.toLowerCase();
    return matchesCategory && `${entry.label} ${entry.description} ${entry.key}`.toLowerCase().includes(needle);
  });
  const presets: Record<string, Record<string, string | number | boolean>> = {
    Relaxed: { ExpRate: 3, PalCaptureRate: 2, PalEggDefaultHatchingTime: 0, PlayerDamageRateDefense: .5, PlayerStaminaDecreaceRate: .5, CollectionDropRate: 2, EnemyDropItemRate: 2, DeathPenalty: "None" },
    Standard: Object.fromEntries(worldSettingCatalog.map((entry) => [entry.key, entry.defaultValue])),
    Survival: { ExpRate: .7, PalCaptureRate: .7, PlayerDamageRateDefense: 1.5, PlayerStomachDecreaceRate: 1.5, PlayerStaminaDecreaceRate: 1.35, CollectionDropRate: .7, EnemyDropItemRate: .7, DeathPenalty: "All" },
  };
  function update(key: string, value: string | number | boolean) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  async function save() {
    const changes = Object.fromEntries(changed.map((entry) => [entry.key, draft[entry.key]]));
    await onSave(changes);
  }
  return (
    <section className="world-settings-view">
      <div className="world-settings-hero">
        <div>
          <p className="eyebrow">WORLD CONFIGURATION</p>
          <h1>Shape the rules of your world.</h1>
          <p>Adjust progression, combat, survival and world behavior. Palkeep backs up the complete world before applying changes.</p>
        </div>
        <div className="settings-save-box">
          <strong>{changed.length}</strong>
          <span>UNSAVED CHANGES</span>
          <button disabled={busy || !changed.length || !hasWorldOptions} onClick={save}>
            {busy ? "Validating…" : "Apply settings"}
          </button>
        </div>
      </div>
      {!hasWorldOptions && (
        <div className="world-settings-warning">WorldOption.sav has not been created yet. Open this world’s settings in Palworld once and save them before editing here.</div>
      )}
      <div className="settings-preset-bar panel">
        <div><b>Quick presets</b><small>Presets only change the draft until you apply.</small></div>
        {Object.entries(presets).map(([name, values]) => (
          <button key={name} onClick={() => setDraft((current) => ({ ...current, ...values }))}>{name}</button>
        ))}
        <button className="reset" disabled={!changed.length} onClick={() => setDraft(initial)}>Discard changes</button>
      </div>
      <div className="settings-toolbar panel">
        <label className="database-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search world settings" /></label>
        <div className="filter-chips">
          {["All", "Time & progress", "Combat", "Survival", "Resources", "World rules"].map((name) => (
            <button key={name} className={category === name ? "active" : ""} onClick={() => setCategory(name)}>{name}</button>
          ))}
        </div>
      </div>
      <div className="world-setting-grid">
        {visible.map((entry) => {
          const value = draft[entry.key];
          const isChanged = String(value) !== String(initial[entry.key]);
          return (
            <article className={isChanged ? "changed" : ""} key={entry.key}>
              <div className="setting-copy"><span>{entry.category}</span><h3>{entry.label}</h3><p>{entry.description}</p><code>{entry.key}</code></div>
              <div className="setting-control">
                {entry.type === "boolean" ? (
                  <button className={`setting-toggle ${value ? "on" : ""}`} onClick={() => update(entry.key, !value)}><i /><b>{value ? "Enabled" : "Disabled"}</b></button>
                ) : entry.type === "select" ? (
                  <select value={String(value)} onChange={(event) => update(entry.key, event.target.value)}>{entry.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                ) : (
                  <label className="number-setting"><input type="number" value={Number(value)} min={entry.min} max={entry.max} step={entry.step} onChange={(event) => update(entry.key, Number(event.target.value))} /><span>{entry.suffix}</span></label>
                )}
                {isChanged && <small>was {String(initial[entry.key])}</small>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SinglePlayerApp({
  api,
  onServer,
  appInfo,
  updateStatus,
  onCheckUpdates,
  onOpenUpdate,
  onDismissUpdate,
}: {
  api: DesktopApi | undefined;
  onServer: () => void;
  appInfo: AppInfo;
  updateStatus: UpdateStatus | null;
  onCheckUpdates: () => void;
  onOpenUpdate: () => void;
  onDismissUpdate: () => void;
}) {
  const [worlds, setWorlds] = useState<SingleWorld[]>([]);
  const [worldPath, setWorldPath] = useState("");
  const [snapshot, setSnapshot] = useState<SingleSnapshot | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [backups, setBackups] = useState<SingleBackup[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<
    | "Inventory"
    | "Palbox"
    | "World Settings"
    | "Backups"
    | "Item Database"
    | "Pal Database"
  >("Inventory");
  const [modal, setModal] = useState<"item" | "pal" | null>(null);
  const [presetId, setPresetId] = useState("");
  const [liveBridge, setLiveBridge] = useState<LiveBridgeStatus>({
    gamePath: "",
    installed: false,
    running: false,
    connected: false,
    version: null,
    installedVersion: null,
    latestVersion: "0.2.0",
    updateAvailable: false,
    players: [],
    error: null,
  });
  const [busy, setBusy] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
    null,
  );
  const [activity, setActivity] = useState([
    {
      time: "Now",
      title: "Offline editor ready",
      detail: "Palworld must be closed before changes",
      tone: "green",
    },
  ]);
  const current =
    snapshot?.players.find((player) => player.playerId === playerId) ||
    snapshot?.players[0] ||
    null;
  const filteredItems = (current?.inventory || []).filter((item) =>
    `${item.itemId}`.toLowerCase().includes(query.toLowerCase()),
  );
  const filteredPals = (current?.pals || []).filter((pal) =>
    `${pal.name} ${pal.speciesId}`.toLowerCase().includes(query.toLowerCase()),
  );
  function notify(text: string, error = false) {
    setToast({ text, error });
    window.setTimeout(() => setToast(null), 3600);
  }
  function openModal(kind: "item" | "pal", id = "") {
    setPresetId(id);
    setModal(kind);
  }
  function addActivity(title: string, detail: string, tone = "green") {
    setActivity((items) =>
      [{ time: nowTime(), title, detail, tone }, ...items].slice(0, 6),
    );
  }
  const openWorld = useCallback(
    async (path: string) => {
      if (!api || !path) return;
      setBusy(true);
      try {
        const [data, history] = await Promise.all([
          api.inspectSinglePlayerWorld(path),
          api.listSinglePlayerBackups(path),
        ]);
        setWorldPath(path);
        setSnapshot(data);
        setBackups(history);
        setPlayerId((id) =>
          data.players.some((player) => player.playerId === id)
            ? id
            : data.players[0]?.playerId || "",
        );
      } catch (e: any) {
        notify(e.message || "Could not open this world", true);
      } finally {
        setBusy(false);
      }
    },
    [api],
  );
  useEffect(() => {
    if (!api) return;
    api
      .discoverSinglePlayerWorlds()
      .then((result) => {
        setWorlds(result.worlds);
        if (result.worlds[0]) openWorld(result.worlds[0].path);
      })
      .catch((e) => notify(e.message, true));
  }, [api, openWorld]);
  const refreshLiveBridge = useCallback(async () => {
    if (!api) return;
    try {
      setLiveBridge(await api.getLiveBridgeStatus());
    } catch (e: any) {
      setLiveBridge((status) => ({
        ...status,
        connected: false,
        error: e.message || "Could not check the live bridge",
      }));
    }
  }, [api]);
  useEffect(() => {
    refreshLiveBridge();
    const timer = window.setInterval(refreshLiveBridge, 5000);
    return () => window.clearInterval(timer);
  }, [refreshLiveBridge]);
  async function installBridge() {
    if (!api) return;
    setBusy(true);
    try {
      let gamePath = liveBridge.gamePath;
      if (!gamePath) gamePath = (await api.chooseLiveBridgeGame()) || "";
      if (!gamePath) return;
      await api.installLiveBridge(gamePath);
      await refreshLiveBridge();
      addActivity(
        liveBridge.installed ? "Live bridge updated" : "Live bridge installed",
        "Restart Palworld to load it",
        "blue",
      );
      notify(
        `${liveBridge.installed ? "Live bridge updated" : "Live bridge installed"}. Start Palworld, then enter the world.`,
      );
    } catch (e: any) {
      notify(e.message || "Live bridge installation failed", true);
    } finally {
      setBusy(false);
    }
  }
  async function chooseWorld() {
    if (!api) return;
    const path = await api.chooseSinglePlayerWorld();
    if (!path) return;
    await openWorld(path);
    const found = worlds.find((world) => world.path === path);
    if (!found)
      setWorlds((items) => [
        {
          id: path.split(/[\\/]/).pop() || path,
          label: `World ${path.slice(-8)}`,
          path,
          modifiedAt: new Date().toISOString(),
          size: 0,
          format: "Save",
          playerCount: 1,
        },
        ...items,
      ]);
  }
  async function makeBackup() {
    if (!api || !worldPath) return;
    setBusy(true);
    try {
      await api.createSinglePlayerBackup(worldPath);
      setBackups(await api.listSinglePlayerBackups(worldPath));
      addActivity(
        "Backup created",
        snapshot?.world.label || "Single-player world",
      );
      notify("Backup created safely");
    } catch (e: any) {
      notify(e.message || "Backup failed", true);
    } finally {
      setBusy(false);
    }
  }
  async function restore(backup: SingleBackup) {
    if (
      !api ||
      !worldPath ||
      !window.confirm(
        `Restore backup from ${backup.createdAt ? new Date(backup.createdAt).toLocaleString() : backup.id}? A safety backup of the current save will be created first.`,
      )
    )
      return;
    setBusy(true);
    try {
      await api.restoreSinglePlayerBackup(worldPath, backup.id);
      await openWorld(worldPath);
      addActivity(
        "Backup restored",
        backup.createdAt
          ? new Date(backup.createdAt).toLocaleString()
          : backup.id,
        "violet",
      );
      notify("Backup restored");
    } catch (e: any) {
      notify(e.message || "Restore failed", true);
    } finally {
      setBusy(false);
    }
  }
  async function saveWorldSettings(
    changes: Record<string, string | number | boolean>,
  ) {
    if (!api || !worldPath || !Object.keys(changes).length) return;
    setBusy(true);
    try {
      await api.runSinglePlayerAction({
        action: "updateSettings",
        worldPath,
        settings: changes,
      });
      addActivity(
        "World settings updated",
        `${Object.keys(changes).length} rules · automatic backup created`,
        "blue",
      );
      notify("World settings saved");
      await openWorld(worldPath);
    } catch (e: any) {
      notify(e.message || "Could not save world settings", true);
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!api || !current || !worldPath || !modal) return;
    const form = new FormData(event.currentTarget);
    const itemId = String(form.get("itemId") || "").trim();
    const pal = palFormPayload(form);
    if (modal === "item" && !itemId) {
      notify("Select an item from the catalog or enter a custom item ID", true);
      return;
    }
    if (modal === "pal" && !pal.speciesId) {
      notify("Select a Pal from the complete catalog", true);
      return;
    }
    setBusy(true);
    try {
      const delivery = String(form.get("delivery") || "offline");
      if (modal === "item" && delivery === "live") {
        if (!liveBridge.connected)
          throw new Error("Start Palworld, enter the world, and wait for LIVE READY.");
        await api.runLiveBridgeAction({
          action: "giveItem",
          playerName: current.name,
          itemId,
          quantity: Number(form.get("quantity")),
        });
      } else if (modal === "item")
        await api.runSinglePlayerAction({
          action: "giveItem",
          worldPath,
          playerId: current.playerId,
          itemId,
          quantity: Number(form.get("quantity")),
          mode: form.get("mode"),
        });
      else {
        const species = fullPalCatalog.find(
          (entry) => entry.id === pal.speciesId,
        );
        await api.runSinglePlayerAction({
          action: "addPal",
          worldPath,
          playerId: current.playerId,
          ...pal,
          displayName: pal.displayName || species?.name || pal.speciesId,
        });
      }
      addActivity(
        modal === "item" && delivery === "live"
          ? "Live item delivered"
          : modal === "item"
            ? "Inventory updated"
            : "Pal added",
        modal === "item" && delivery === "live"
          ? `${current.name} · delivered by the running game`
          : `${current.name} · automatic backup created`,
        modal === "pal" ? "violet" : "gold",
      );
      notify(
        modal === "item" && delivery === "live"
          ? "Item delivered live in Palworld"
          : modal === "item"
            ? "Item saved to inventory"
            : "Pal saved to Palbox",
      );
      setModal(null);
      if (!(modal === "item" && delivery === "live")) await openWorld(worldPath);
    } catch (e: any) {
      notify(e.message || "Save change failed", true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="app-shell single-shell">
      <UpdateBanner status={updateStatus} onOpen={onOpenUpdate} onDismiss={onDismissUpdate} />
      <aside className="sidebar">
        <div className="brand-row">
          <Mark />
          <div>
            <strong>PALKEEP</strong>
            <span>WORLD WORKSHOP</span>
          </div>
        </div>
        <div className="mode-switch">
          <button onClick={onServer}>Server</button>
          <button className="active">Single player</button>
        </div>
        <nav aria-label="Single player navigation">
          <p className="nav-label">LOCAL WORLD</p>
          {(["Inventory", "Palbox", "World Settings", "Backups"] as const).map((item) => (
            <button
              key={item}
              className={tab === item ? "nav-item active" : "nav-item"}
              onClick={() => setTab(item)}
            >
              <span className="nav-icon">
                {item === "Inventory"
                  ? "▦"
                  : item === "Palbox"
                    ? "◈"
                    : item === "World Settings"
                      ? "⌘"
                      : "↺"}
              </span>
              {item}
              {item === "Backups" && <em>{backups.length}</em>}
            </button>
          ))}
          <p className="nav-label second">DATABASE</p>
          {(["Item Database", "Pal Database"] as const).map((item) => (
            <button
              key={item}
              className={tab === item ? "nav-item active" : "nav-item"}
              onClick={() => setTab(item)}
            >
              <span className="nav-icon">
                {item === "Item Database" ? "▤" : "◉"}
              </span>
              {item}
            </button>
          ))}
          <p className="nav-label second">DISCOVERED SAVES</p>
          <div className="world-list">
            {worlds.slice(0, 6).map((world) => (
              <button
                className={
                  worldPath === world.path
                    ? "world-button active"
                    : "world-button"
                }
                key={world.path}
                onClick={() => openWorld(world.path)}
              >
                <i />
                <span>
                  <b>{world.label}</b>
                  <small>
                    {new Date(world.modifiedAt).toLocaleDateString()} ·{" "}
                    {world.format}
                  </small>
                </span>
              </button>
            ))}
          </div>
          <button className="nav-item" onClick={chooseWorld}>
            <span className="nav-icon">＋</span>Choose folder
          </button>
        </nav>
        <div className={`offline-safety ${liveBridge.connected ? "live-ready" : ""}`}>
          <span>{liveBridge.connected ? "●" : liveBridge.installed ? "◌" : "＋"}</span>
          <div>
            <b>
              {liveBridge.updateAvailable
                ? "Live bridge update ready"
                : liveBridge.connected
                  ? "Live delivery ready"
                : liveBridge.installed
                  ? "Live bridge installed"
                  : "Enable live delivery"}
            </b>
            <small>
              {liveBridge.updateAvailable
                ? liveBridge.running
                  ? `Close Palworld to update ${liveBridge.installedVersion || "the old bridge"} → ${liveBridge.latestVersion}.`
                  : `Update ${liveBridge.installedVersion || "the old bridge"} → ${liveBridge.latestVersion} for Palworld 1.0.`
                : liveBridge.connected
                  ? `${liveBridge.players.join(", ") || "Player detected"} · game-thread delivery`
                : liveBridge.installed
                  ? liveBridge.running
                    ? "Enter your world and wait for the bridge."
                    : "Start Palworld to connect."
                  : "Install the optional local game bridge."}
            </small>
            {(!liveBridge.installed || liveBridge.updateAvailable) && (
              <button
                disabled={busy || (liveBridge.updateAvailable && liveBridge.running)}
                onClick={installBridge}
              >
                {liveBridge.updateAvailable
                  ? liveBridge.running
                    ? "Close game to update"
                    : "Update bridge"
                  : "Install bridge"}
              </button>
            )}
          </div>
        </div>
        <SidebarSupport onAbout={() => setAboutOpen(true)} appInfo={appInfo} />
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div className="crumb">
            <span>Single player</span>
            <i>/</i>
            <b>{snapshot?.world.label || "Choose a world"}</b>
            <span className={`live-chip ${liveBridge.connected ? "" : "local"}`}>
              ● {liveBridge.connected ? "LIVE READY" : "LOCAL SAVE"}
            </span>
          </div>
          <div className="top-actions">
            <button
              className="icon-button"
              aria-label="Refresh local save"
              disabled={!worldPath || busy}
              onClick={() => openWorld(worldPath)}
            >
              ↻
            </button>
            <button
              className="backup-button"
              disabled={!worldPath || busy}
              onClick={makeBackup}
            >
              <span>↺</span>
              {busy ? " Working…" : " Create backup"}
            </button>
            <button
              className="avatar"
              onClick={() => api?.openSinglePlayerBackups()}
            >
              SP
            </button>
          </div>
        </header>
        <div className="content single-content">
          {tab === "World Settings" ? (
            snapshot ? (
              <WorldSettingsView
                settings={snapshot.settings}
                hasWorldOptions={snapshot.hasWorldOptions}
                busy={busy}
                onSave={saveWorldSettings}
              />
            ) : (
              <section className="single-empty panel">
                <span>⌘</span>
                <h2>Choose a world to edit its rules</h2>
                <p>World settings are stored in that world&apos;s WorldOption.sav.</p>
                <button onClick={chooseWorld}>Choose world folder</button>
              </section>
            )
          ) : tab === "Item Database" || tab === "Pal Database" ? (
            <DatabaseView
              kind={tab === "Item Database" ? "items" : "pals"}
              onUse={snapshot ? (id) => openModal(tab === "Item Database" ? "item" : "pal", id) : undefined}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">SINGLE-PLAYER SAVE WORKSHOP</p>
                  <h1>
                    {snapshot
                      ? "Your local world is ready."
                      : "Choose a Palworld save."}
                  </h1>
                  <p>
                    {snapshot
                      ? `${current?.name || "Player"} · Level ${current?.level || "—"} · ${current?.inventory?.length || 0} inventory stacks · ${current?.pals?.length || 0} Pals`
                      : "Palkeep can automatically discover Steam single-player worlds on this PC."}
                  </p>
                </div>
                <div className={`sync-pill ${snapshot ? "" : "sync-off"}`}>
                  <span>{snapshot ? "✓" : "!"}</span>
                  <div>
                    <b>
                      {snapshot
                        ? "Save parsed successfully"
                        : "No world selected"}
                    </b>
                    <small>
                      {snapshot
                        ? `${snapshot.world.format} · changes are offline and reversible`
                        : "Select a discovered save or browse to Level.sav"}
                    </small>
                  </div>
                </div>
              </div>
              {snapshot && (
                <>
                  <section className="single-hero-grid">
                    <article className="single-world-card">
                      <div>
                        <span className="section-kicker">ACTIVE WORLD</span>
                        <h2>{snapshot.world.label}</h2>
                        <p title={snapshot.world.path}>{snapshot.world.path}</p>
                      </div>
                      <span className="save-format">
                        {snapshot.world.format}
                      </span>
                    </article>
                    <article className="single-player-card">
                      <span className="summary-avatar">
                        {(current?.name || "P").slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <span className="section-kicker">EDITING PLAYER</span>
                        {snapshot.players.length > 1 ? (
                          <select
                            value={current?.playerId || ""}
                            onChange={(e) => setPlayerId(e.target.value)}
                          >
                            {snapshot.players.map((player) => (
                              <option
                                value={player.playerId}
                                key={player.playerId}
                              >
                                {player.name} · Lv. {player.level}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <h2>{current?.name}</h2>
                        )}
                      </div>
                      <strong>LV. {current?.level}</strong>
                    </article>
                    <article className="single-action-card">
                      <button disabled={busy} onClick={() => openModal("item")}>
                        <span className="action-icon gold">＋</span>
                        <div>
                          <b>Give item</b>
                          <small>Add or set an inventory stack</small>
                        </div>
                        <em>→</em>
                      </button>
                      <button disabled={busy} onClick={() => openModal("pal")}>
                        <span className="action-icon violet">◇</span>
                        <div>
                          <b>Add Pal</b>
                          <small>Create in the selected Palbox</small>
                        </div>
                        <em>→</em>
                      </button>
                    </article>
                  </section>
                  {tab !== "Backups" ? (
                    <section className="single-data-grid">
                      <div className="panel single-table-panel">
                        <div className="panel-head inventory-head">
                          <div>
                            <span className="section-kicker">
                              {tab === "Inventory"
                                ? "LOCAL INVENTORY"
                                : "LOCAL PALBOX"}
                            </span>
                            <h2>
                              {tab === "Inventory"
                                ? `${current?.name}'s pack`
                                : "Stored companions"}
                            </h2>
                          </div>
                          <label className="search">
                            <span>⌕</span>
                            <input
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                              placeholder={
                                tab === "Inventory"
                                  ? "Search items"
                                  : "Search Pals"
                              }
                            />
                          </label>
                        </div>
                        {tab === "Inventory" ? (
                          <div className="inventory-table">
                            <div className="table-header">
                              <span>ITEM</span>
                              <span>QUANTITY</span>
                              <span>SLOT</span>
                            </div>
                            {filteredItems.map((item) => (
                              <div
                                className="inventory-row"
                                key={`${item.slot}-${item.itemId}`}
                              >
                                <span className="item-glyph teal">◆</span>
                                <span className="item-name">
                                  <b>
                                    {fullItemCatalog.find(
                                      (entry) => entry.id === item.itemId,
                                    )?.name || item.itemId}
                                  </b>
                                  <small>{item.itemId}</small>
                                </span>
                                <span className="qty">
                                  {Number(item.quantity).toLocaleString()}
                                </span>
                                <span className="slot-number">
                                  #{item.slot}
                                </span>
                                <button onClick={() => openModal("item", item.itemId)}>
                                  •••
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="single-pal-grid">
                            {filteredPals.map((pal) => (
                              <article key={pal.instanceId}>
                                <span className="pal-glyph violet">
                                  {String(pal.name || pal.speciesId).slice(
                                    0,
                                    1,
                                  )}
                                  <i>✦</i>
                                </span>
                                <div>
                                  <small>
                                    {pal.location} · SLOT {pal.slot}
                                  </small>
                                  <b>{pal.name || pal.speciesId}</b>
                                  <em>
                                    Lv. {pal.level} ·{" "}
                                    {pal.passives?.[0] || "No passive"}
                                  </em>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="panel activity-panel">
                        <div className="panel-head">
                          <div>
                            <span className="section-kicker">
                              SAFE OPERATIONS
                            </span>
                            <h2>Recent activity</h2>
                          </div>
                          <button onClick={() => api?.openAuditFolder()}>
                            Audit files ↗
                          </button>
                        </div>
                        <div className="activity-list">
                          {activity.slice(0, 5).map((entry, index) => (
                            <div
                              className="activity-row"
                              key={`${entry.time}-${index}`}
                            >
                              <span className={`activity-dot ${entry.tone}`} />
                              <div>
                                <b>{entry.title}</b>
                                <small>{entry.detail}</small>
                              </div>
                              <time>{entry.time}</time>
                            </div>
                          ))}
                        </div>
                        <div className="safety-note">
                          <span>✓</span>
                          <div>
                            <b>Mandatory backup protection</b>
                            <small>
                              The original world is copied before every
                              inventory or Pal write.
                            </small>
                          </div>
                        </div>
                      </div>
                    </section>
                  ) : (
                    <section className="panel backup-browser">
                      <div className="panel-head">
                        <div>
                          <span className="section-kicker">RESTORE POINTS</span>
                          <h2>Single-player backups</h2>
                        </div>
                        <button onClick={makeBackup}>Create now ＋</button>
                      </div>
                      {backups.length ? (
                        <div className="backup-list">
                          {backups.map((backup) => (
                            <article key={backup.id}>
                              <span>↺</span>
                              <div>
                                <b>
                                  {backup.createdAt
                                    ? new Date(
                                        backup.createdAt,
                                      ).toLocaleString()
                                    : backup.id}
                                </b>
                                <small>
                                  {backup.reason.replace(/-/g, " ")} · stored
                                  outside Steam Cloud
                                </small>
                              </div>
                              <button
                                disabled={busy}
                                onClick={() => restore(backup)}
                              >
                                Restore
                              </button>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="pal-empty">
                          No backups yet. Palkeep creates one automatically
                          before the first change.
                        </div>
                      )}
                    </section>
                  )}
                </>
              )}
              {!snapshot && (
                <section className="single-empty panel">
                  <span>◇</span>
                  <h2>No single-player world selected</h2>
                  <p>
                    Palkeep checks{" "}
                    <code>%LOCALAPPDATA%\Pal\Saved\SaveGames</code>{" "}
                    automatically.
                  </p>
                  <button onClick={chooseWorld}>Choose world folder</button>
                </section>
              )}
            </>
          )}
        </div>
      </section>
      {modal && current && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}
        >
          <form
            className={`modal ${modal === "item" ? "item-catalog-modal" : "pal-editor-modal"}`}
            onSubmit={submit}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setModal(null)}
            >
              ×
            </button>
            <span className={`modal-symbol ${modal}`}>
              {modal === "item" ? "＋" : "◇"}
            </span>
            <p className="eyebrow">
              {modal === "item" ? "LIVE OR OFFLINE DELIVERY" : "OFFLINE SAVE OPERATION"}
            </p>
            <h2>{modal === "item" ? "Give an item" : "Create a Pal"}</h2>
            <p className="modal-copy">
              {modal === "item"
                ? "Choose game-native live delivery while Palworld is running, or use the protected offline editor with a full backup and validation."
                : "Palworld must be closed. Palkeep creates a full backup and validates the save before replacing it."}
            </p>
            {modal === "item" ? (
              <>
                <ItemPicker initialId={presetId} />
                <div className="form-row">
                  <label>
                    Quantity
                    <input
                      name="quantity"
                      type="number"
                      min="1"
                      max="9999"
                      defaultValue="20"
                      required
                    />
                  </label>
                  <label>
                    Delivery
                    <select
                      name="delivery"
                      defaultValue={liveBridge.connected ? "live" : "offline"}
                    >
                      <option value="live" disabled={!liveBridge.connected}>
                        Live in running game
                      </option>
                      <option value="offline">Protected offline save</option>
                    </select>
                  </label>
                </div>
                <label>
                  Offline stack operation
                  <select name="mode">
                    <option value="add">Add to current stack</option>
                    <option value="set">Set exact quantity</option>
                  </select>
                </label>
              </>
            ) : (
              <PalCreationFields initialId={presetId} />
            )}
            <div className="backup-check">
              <span>✓</span>
              <div>
                <b>
                  {modal === "item" && liveBridge.connected
                    ? "Live delivery available"
                    : "Backup and validation required"}
                </b>
                <small>
                  {modal === "item" && liveBridge.connected
                    ? "Live mode calls Palworld's inventory function; offline mode never edits a running save."
                    : "Protected offline changes leave the original save untouched if validation fails."}
                </small>
              </div>
            </div>
            <button className="submit-button" disabled={busy} type="submit">
              {busy
                ? modal === "item" ? "Applying item…" : "Validating save…"
                : modal === "item" && liveBridge.connected
                  ? "Deliver item"
                  : "Back up and apply change"}
              <span>→</span>
            </button>
          </form>
        </div>
      )}
      {toast && (
        <div className={`toast ${toast.error ? "error" : ""}`}>
          <span>{toast.error ? "!" : "✓"}</span>
          {toast.text}
        </div>
      )}
      {aboutOpen && (
        <AboutDialog
          onClose={() => setAboutOpen(false)}
          appInfo={appInfo}
          updateStatus={updateStatus}
          onCheckUpdates={onCheckUpdates}
        />
      )}
    </main>
  );
}

export default function Home() {
  const api = typeof window !== "undefined" ? window.palkeepDesktop : undefined;
  const [mode, setMode] = useState<"server" | "single">("server");
  const [active, setActive] = useState("Overview");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<Detail>({
    bridgeConnected: false,
    inventory: [],
    pals: [],
    errors: [],
  });
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<"item" | "pal" | "message" | null>(null);
  const [presetId, setPresetId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [appInfo, setAppInfo] = useState<AppInfo>(DEFAULT_APP_INFO);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [activity, setActivity] = useState([
    {
      time: "Now",
      title: "Live client ready",
      detail: "Configure your Palworld server connection",
      tone: "blue",
    },
  ]);

  const players = snapshot?.players || [];
  const currentPlayer =
    players.find((p) => p.playerId === selectedId) || players[0] || null;
  const serverName =
    snapshot?.info?.servername ||
    snapshot?.settings?.ServerName ||
    "Palworld server";
  const official = Boolean(snapshot?.officialConnected);
  const bridge = Boolean(snapshot?.bridgeConnected);

  function notify(text: string, error = false) {
    setToast({ text, error });
    window.setTimeout(() => setToast(null), 3200);
  }
  const checkUpdates = useCallback(async () => {
    if (!api) return;
    const result = await api.checkForUpdates();
    setUpdateStatus(result);
  }, [api]);
  const openUpdate = useCallback(async () => {
    if (!api || !updateStatus?.releaseUrl) return;
    await api.openUpdate(updateStatus.releaseUrl);
  }, [api, updateStatus]);

  useEffect(() => {
    if (!api) return;
    api.getAppInfo().then(setAppInfo).catch(() => undefined);
    checkUpdates().catch(() => undefined);
  }, [api, checkUpdates]);
  function openModal(kind: "item" | "pal" | "message", id = "") {
    setPresetId(id);
    setModal(kind);
  }
  function addActivity(title: string, detailText: string, tone = "green") {
    setActivity((items) =>
      [{ time: nowTime(), title, detail: detailText, tone }, ...items].slice(
        0,
        6,
      ),
    );
  }

  const refresh = useCallback(
    async (silent = true) => {
      if (!api || mode !== "server") return;
      try {
        const next = await api.getLiveSnapshot();
        setSnapshot(next);
        if (!silent && !next.officialConnected)
          notify(
            next.errors[0] || "Could not connect to the official API",
            true,
          );
      } catch (error: any) {
        if (!silent) notify(error.message || "Connection failed", true);
        setSnapshot((s) =>
          s
            ? {
                ...s,
                officialConnected: false,
                bridgeConnected: false,
                errors: [error.message],
              }
            : null,
        );
      }
    },
    [api, mode],
  );

  useEffect(() => {
    if (!api || mode !== "server") return;
    api
      .getConfig()
      .then(setConfig)
      .then(() => refresh(true))
      .catch((e) => notify(e.message, true));
  }, [api, mode, refresh]);
  useEffect(() => {
    if (!api || mode !== "server") return;
    const id = window.setInterval(
      () => refresh(true),
      Math.max(2000, config.pollIntervalMs),
    );
    return () => window.clearInterval(id);
  }, [api, mode, config.pollIntervalMs, refresh]);
  useEffect(() => {
    if (players.length && !players.some((p) => p.playerId === selectedId))
      setSelectedId(players[0].playerId);
  }, [players, selectedId]);
  const refreshDetail = useCallback(async () => {
    if (!api || !currentPlayer || mode !== "server") {
      setDetail({
        bridgeConnected: false,
        inventory: [],
        pals: [],
        errors: [],
      });
      return;
    }
    try {
      setDetail(await api.getPlayerDetail(currentPlayer.playerId));
    } catch (e: any) {
      setDetail({
        bridgeConnected: false,
        inventory: [],
        pals: [],
        errors: [e.message],
      });
    }
  }, [api, currentPlayer, mode]);
  useEffect(() => {
    refreshDetail();
  }, [refreshDetail]);

  const inventory = useMemo(
    () =>
      detail.inventory
        .map((raw, index) => {
          const id = raw.itemId || raw.id || raw.staticId || `item-${index}`;
          const featured = itemCatalog.find((i) => i.id === id);
          const catalog = fullItemCatalog.find((i) => i.id === id);
          return {
            name: raw.name || catalog?.name || featured?.name || id,
            id,
            qty: Number(raw.quantity ?? raw.qty ?? raw.count ?? 0),
            cap: Number(
              raw.capacity ?? raw.maxStack ?? catalog?.maxStack ?? 9999,
            ),
            tone: featured?.tone || "slate",
            glyph: featured?.glyph || "◆",
          };
        })
        .filter((item) =>
          `${item.name} ${item.id}`.toLowerCase().includes(query.toLowerCase()),
        ),
    [detail.inventory, query],
  );
  const pals = useMemo(
    () =>
      detail.pals.map((raw, index) => {
        const id = raw.speciesId || raw.id || `pal-${index}`;
        const featured = palCatalog.find((p) => p.id === id);
        const catalog = fullPalCatalog.find((p) => p.id === id);
        return {
          name: raw.name || catalog?.name || featured?.name || id,
          code: raw.instanceId || id,
          level: Number(raw.level || 1),
          trait: raw.passive || raw.trait || "—",
          element:
            raw.element ||
            catalog?.elements?.[0] ||
            featured?.element ||
            "Unknown",
          glyph: (raw.name || catalog?.name || featured?.name || "P")[0],
          tone: featured?.tone || "violet",
        };
      }),
    [detail.pals],
  );

  async function createBackup() {
    if (!api || !official) {
      setSettingsOpen(true);
      notify("Connect the official REST API first", true);
      return;
    }
    setBusy(true);
    try {
      await api.runAction({ type: "save" });
      addActivity("World saved", `${serverName} · Official REST API`, "green");
      notify("World save completed");
    } catch (e: any) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  }
  async function liveAction(action: Record<string, unknown>, success: string) {
    if (!api) return;
    setBusy(true);
    try {
      await api.runAction(action);
      addActivity(
        success,
        currentPlayer
          ? `${currentPlayer.name} · Live operation`
          : `${serverName} · Live operation`,
        action.type === "addPal" ? "violet" : "gold",
      );
      notify(success);
      await Promise.all([refresh(true), refreshDetail()]);
    } catch (e: any) {
      notify(e.message || "Live operation failed", true);
    } finally {
      setBusy(false);
    }
  }
  async function submitChange(
    kind: "item" | "pal" | "message",
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!currentPlayer) return;
    const form = new FormData(event.currentTarget);
    const itemId = String(form.get("itemId") || "").trim();
    const pal = palFormPayload(form);
    if (kind === "item" && !itemId) {
      notify("Select an item from the catalog or enter a custom item ID", true);
      return;
    }
    if (kind === "pal" && !pal.speciesId) {
      notify("Select a Pal from the complete catalog", true);
      return;
    }
    if (kind === "item")
      await liveAction(
        {
          type: "giveItem",
          playerId: currentPlayer.playerId,
          itemId,
          quantity: Number(form.get("quantity")),
          destination: form.get("destination"),
        },
        "Item delivered",
      );
    if (kind === "pal")
      await liveAction(
        {
          type: "addPal",
          playerId: currentPlayer.playerId,
          ...pal,
          passive: pal.passives[0] || "",
        },
        "Pal added to Palbox",
      );
    if (kind === "message")
      await liveAction(
        {
          type: "message",
          playerId: currentPlayer.playerId,
          message: form.get("message"),
        },
        "Private message sent",
      );
    setModal(null);
  }
  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!api) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const saved = await api.saveConfig({
        restApiUrl: String(form.get("restApiUrl")),
        restUsername: String(form.get("restUsername")),
        restPassword: String(form.get("restPassword")),
        bridgeUrl: String(form.get("bridgeUrl")),
        bridgeToken: String(form.get("bridgeToken")),
        serverPath: String(form.get("serverPath")),
        pollIntervalMs: Number(form.get("pollIntervalMs")),
        safeChanges: form.get("safeChanges") === "on",
        allowPublicEndpoint: form.get("allowPublicEndpoint") === "on",
        setupComplete: true,
      });
      setConfig(saved);
      const test = await api.testConnections();
      setSnapshot(test);
      notify(
        test.officialConnected
          ? "Official API connected"
          : test.errors[0] || "Settings saved; server is offline",
        !test.officialConnected,
      );
      if (test.officialConnected) setSettingsOpen(false);
    } catch (e: any) {
      notify(e.message || "Could not save settings", true);
    } finally {
      setBusy(false);
    }
  }
  async function chooseFolder() {
    if (!api) return;
    const folder = await api.chooseServerFolder();
    if (folder) setConfig((c) => ({ ...c, serverPath: folder }));
  }
  function nav(item: string) {
    if (item === "World settings") setSettingsOpen(true);
    else if (item === "Activity log" && api) api.openAuditFolder();
    else setActive(item);
  }

  if (mode === "single")
    return (
      <SinglePlayerApp
        api={api}
        onServer={() => setMode("server")}
        appInfo={appInfo}
        updateStatus={updateDismissed ? null : updateStatus}
        onCheckUpdates={checkUpdates}
        onOpenUpdate={openUpdate}
        onDismissUpdate={() => setUpdateDismissed(true)}
      />
    );

  return (
    <main className="app-shell">
      <UpdateBanner
        status={updateDismissed ? null : updateStatus}
        onOpen={openUpdate}
        onDismiss={() => setUpdateDismissed(true)}
      />
      <aside className="sidebar">
        <div className="brand-row">
          <Mark />
          <div>
            <strong>PALKEEP</strong>
            <span>SERVER COMMAND</span>
          </div>
        </div>
        <div className="mode-switch">
          <button className="active">Server</button>
          <button onClick={() => setMode("single")}>Single player</button>
        </div>
        <nav aria-label="Main navigation">
          <p className="nav-label">COMMAND</p>
          {["Overview", "Players", "Inventory", "Palbox"].map((item) => (
            <button
              key={item}
              className={active === item ? "nav-item active" : "nav-item"}
              onClick={() => nav(item)}
            >
              <span className="nav-icon">
                {item === "Overview"
                  ? "⌂"
                  : item === "Players"
                    ? "♙"
                    : item === "Inventory"
                      ? "▦"
                      : "◈"}
              </span>
              {item}
              {item === "Players" && <em>{players.length}</em>}
            </button>
          ))}
          <p className="nav-label second">DATABASE</p>
          {["Item Database", "Pal Database"].map((item) => (
            <button
              key={item}
              className={active === item ? "nav-item active" : "nav-item"}
              onClick={() => nav(item)}
            >
              <span className="nav-icon">
                {item === "Item Database" ? "▤" : "◉"}
              </span>
              {item}
            </button>
          ))}
          <p className="nav-label second">OPERATIONS</p>
          {["World settings", "Backups", "Activity log"].map((item) => (
            <button
              key={item}
              className={active === item ? "nav-item active" : "nav-item"}
              onClick={() => nav(item)}
            >
              <span className="nav-icon">
                {item === "World settings"
                  ? "⌘"
                  : item === "Backups"
                    ? "↺"
                    : "≡"}
              </span>
              {item}
            </button>
          ))}
        </nav>
        <div className={`server-mini ${official ? "connected" : "offline"}`}>
          <div className="server-mini-top">
            <span className="status-dot" />
            <b>{official ? "Server online" : "Server offline"}</b>
            <small>{official ? "LIVE" : "SETUP"}</small>
          </div>
          <p>{serverName}</p>
          <div className="server-stats">
            <span>
              <b>{snapshot?.metrics?.currentplayernum ?? players.length}</b>/
              {snapshot?.metrics?.maxplayernum ?? "—"} players
            </span>
            <span>
              <b>{snapshot?.metrics?.serverfps ?? "—"}</b> FPS
            </span>
          </div>
          <div className="mini-track">
            <i
              style={{
                width: official
                  ? `${Math.max(8, Math.min(100, (players.length / (snapshot?.metrics?.maxplayernum || 32)) * 100))}%`
                  : "0%",
              }}
            />
          </div>
          <button onClick={() => setSettingsOpen(true)}>
            {official ? "Edit connection" : "Connect your server"}
            <span>→</span>
          </button>
        </div>
        <SidebarSupport onAbout={() => setAboutOpen(true)} appInfo={appInfo} />
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="crumb">
            <span>{serverName}</span>
            <i>/</i>
            <b>{active}</b>
            <span className={`live-chip ${official ? "on" : "off"}`}>
              {official ? "● LIVE" : "● OFFLINE"}
            </span>
          </div>
          <div className="top-actions">
            <button
              className="icon-button"
              aria-label="Refresh live data"
              onClick={() => refresh(false)}
            >
              ↻
            </button>
            <button
              className="backup-button"
              disabled={busy || !official}
              onClick={createBackup}
            >
              <span>↺</span>
              {busy ? " Working…" : " Save world"}
            </button>
            <button
              className="avatar"
              aria-label="Connection settings"
              onClick={() => setSettingsOpen(true)}
            >
              PK
            </button>
          </div>
        </header>
        <div className="content">
          {active === "Item Database" || active === "Pal Database" ? (
            <DatabaseView
              kind={active === "Item Database" ? "items" : "pals"}
              onUse={currentPlayer && bridge ? (id) => openModal(active === "Item Database" ? "item" : "pal", id) : undefined}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">REAL-TIME CONTROL CENTER</p>
                  <h1>
                    {official
                      ? "Your world is live."
                      : "Connect your Palworld server."}
                  </h1>
                  <p>
                    {official
                      ? `${players.length} keeper${players.length === 1 ? " is" : "s are"} currently roaming ${serverName}.`
                      : "Add the official REST API credentials to start receiving live server data."}
                  </p>
                </div>
                <div className={`sync-pill ${official ? "" : "sync-off"}`}>
                  <span>{official ? "✓" : "!"}</span>
                  <div>
                    <b>
                      {official ? "Official API synced" : "Connection required"}
                    </b>
                    <small>
                      {bridge
                        ? "Mutation bridge connected"
                        : official
                          ? "Bridge offline · read-only live mode"
                          : "Open settings to continue"}
                    </small>
                  </div>
                </div>
              </div>

              <div className="metric-grid">
                <article className="metric-card hero-metric">
                  <div className="metric-top">
                    <span className="metric-icon">♙</span>
                    <span className={`trend ${official ? "up" : ""}`}>
                      {official ? "REAL TIME" : "OFFLINE"}
                    </span>
                  </div>
                  <strong>
                    {official ? String(players.length).padStart(2, "0") : "—"}
                  </strong>
                  <p>Players online</p>
                  <div className="avatar-stack">
                    {players.slice(0, 5).map((p, i) => (
                      <span
                        style={{
                          background: playerColors[i % playerColors.length],
                        }}
                        key={p.playerId}
                      >
                        {p.name[0]}
                      </span>
                    ))}
                  </div>
                </article>
                <article className="metric-card">
                  <div className="metric-top">
                    <span className="metric-icon gold">◈</span>
                    <span className="trend">BASES</span>
                  </div>
                  <strong>{snapshot?.metrics?.basecampnum ?? "—"}</strong>
                  <p>Base camps</p>
                  <div className="metric-line">
                    <i style={{ width: official ? "64%" : "0%" }} />
                  </div>
                </article>
                <article className="metric-card">
                  <div className="metric-top">
                    <span className="metric-icon green">⌁</span>
                    <span className={`trend ${official ? "up" : ""}`}>
                      {official ? "Healthy" : "Unknown"}
                    </span>
                  </div>
                  <strong>{snapshot?.metrics?.serverfps ?? "—"}</strong>
                  <p>Server FPS</p>
                  <div className="sparkline">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                </article>
                <article className="metric-card">
                  <div className="metric-top">
                    <span className="metric-icon blue">◌</span>
                    <span className="trend">
                      DAY {snapshot?.metrics?.days ?? "—"}
                    </span>
                  </div>
                  <strong>
                    {official ? uptime(snapshot?.metrics?.uptime) : "—"}
                  </strong>
                  <p>World uptime</p>
                  <div className="sun-cycle">
                    <i />
                  </div>
                </article>
              </div>

              <section className="control-grid">
                <div className="panel player-panel">
                  <div className="panel-head">
                    <div>
                      <span className="section-kicker">LIVE KEEPERS</span>
                      <h2>Online players</h2>
                    </div>
                    <button onClick={() => refresh(false)}>
                      Refresh <span>↻</span>
                    </button>
                  </div>
                  <div className="player-list">
                    {players.length ? (
                      players.map((player, index) => (
                        <button
                          className={
                            currentPlayer?.playerId === player.playerId
                              ? "player-row selected"
                              : "player-row"
                          }
                          key={player.playerId}
                          onClick={() => setSelectedId(player.playerId)}
                        >
                          <span
                            className="player-avatar"
                            style={{
                              background:
                                playerColors[index % playerColors.length],
                            }}
                          >
                            {player.name.slice(0, 2).toUpperCase()}
                            <i />
                          </span>
                          <span className="player-name">
                            <b>{player.name}</b>
                            <small>
                              {player.userId ||
                                player.accountName ||
                                player.playerId}
                            </small>
                          </span>
                          <span className="player-level">
                            <small>LEVEL</small>
                            <b>{player.level}</b>
                          </span>
                          <span className="ping">
                            <i /> {Math.round(player.ping || 0)} ms
                          </span>
                          <span className="row-arrow">›</span>
                        </button>
                      ))
                    ) : (
                      <div className="empty-state">
                        <span>⌁</span>
                        <b>No live players</b>
                        <small>
                          {official
                            ? "The server is connected, but nobody is online."
                            : "Connect the official REST API to see players."}
                        </small>
                        <button onClick={() => setSettingsOpen(true)}>
                          Open connection settings
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="panel quick-panel">
                  <div className="panel-head">
                    <div>
                      <span className="section-kicker">LIVE ACTIONS</span>
                      <h2>{currentPlayer?.name || "No player selected"}</h2>
                    </div>
                    <span
                      className={`selected-label ${bridge ? "" : "bridge-off"}`}
                    >
                      <i /> {bridge ? "BRIDGE READY" : "BRIDGE OFFLINE"}
                    </span>
                  </div>
                  {currentPlayer ? (
                    <>
                      <div className="player-summary">
                        <span
                          className="summary-avatar"
                          style={{
                            background:
                              playerColors[
                                Math.max(0, players.indexOf(currentPlayer)) %
                                  playerColors.length
                              ],
                          }}
                        >
                          {currentPlayer.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <b>{currentPlayer.name}</b>
                          <small>Level {currentPlayer.level} · Live now</small>
                        </div>
                        <span className="world-pos">
                          X {Number(currentPlayer.location_x || 0).toFixed(1)}
                          <br />Y{" "}
                          {Number(currentPlayer.location_y || 0).toFixed(1)}
                        </span>
                      </div>
                      <div className="quick-actions">
                        <button
                          disabled={!bridge || busy}
                          onClick={() => openModal("item")}
                        >
                          <span className="action-icon gold">＋</span>
                          <b>Give item</b>
                          <small>Live inventory write</small>
                          <em>→</em>
                        </button>
                        <button
                          disabled={!bridge || busy}
                          onClick={() => openModal("pal")}
                        >
                          <span className="action-icon violet">◇</span>
                          <b>Add Pal</b>
                          <small>Live Palbox write</small>
                          <em>→</em>
                        </button>
                        <button
                          disabled={!bridge || busy}
                          onClick={() =>
                            liveAction(
                              {
                                type: "teleport",
                                playerId: currentPlayer.playerId,
                                mode: "to-admin",
                              },
                              "Player teleported",
                            )
                          }
                        >
                          <span className="action-icon green">⌖</span>
                          <b>Teleport</b>
                          <small>Bring player to admin</small>
                          <em>→</em>
                        </button>
                        <button
                          disabled={!bridge || busy}
                          onClick={() => openModal("message")}
                        >
                          <span className="action-icon blue">◌</span>
                          <b>Message</b>
                          <small>Private live message</small>
                          <em>→</em>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="quick-empty">
                      Select an online player to enable live actions.
                    </div>
                  )}
                </div>
              </section>

              <section className="lower-grid">
                <div className="panel inventory-panel">
                  <div className="panel-head inventory-head">
                    <div>
                      <span className="section-kicker">LIVE INVENTORY</span>
                      <h2>
                        {currentPlayer
                          ? `${currentPlayer.name}'s pack`
                          : "Player inventory"}
                      </h2>
                    </div>
                    <label className="search">
                      <span>⌕</span>
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search items"
                        aria-label="Search inventory"
                      />
                    </label>
                  </div>
                  <div className="inventory-table">
                    {inventory.length ? (
                      <>
                        <div className="table-header">
                          <span>ITEM</span>
                          <span>QUANTITY</span>
                          <span>CAPACITY</span>
                        </div>
                        {inventory.map((item) => (
                          <div className="inventory-row" key={item.id}>
                            <span className={`item-glyph ${item.tone}`}>
                              {item.glyph}
                            </span>
                            <span className="item-name">
                              <b>{item.name}</b>
                              <small>{item.id}</small>
                            </span>
                            <span className="qty">
                              {item.qty.toLocaleString()}
                            </span>
                            <span className="capacity">
                              <i>
                                <em
                                  style={{
                                    width: `${Math.max(4, Math.min(100, (item.qty / item.cap) * 100))}%`,
                                  }}
                                />
                              </i>
                              <small>{item.cap.toLocaleString()}</small>
                            </span>
                            <button
                              aria-label={`Edit ${item.name}`}
                              disabled={!bridge}
                              onClick={() => openModal("item", item.id)}
                            >
                              •••
                            </button>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="table-empty">
                        <b>
                          {bridge
                            ? "No inventory returned"
                            : "Mutation bridge required"}
                        </b>
                        <small>
                          {bridge
                            ? "This player currently has no reported items."
                            : "Install/configure the local Palkeep mod bridge for live inventory and Palbox data."}
                        </small>
                      </div>
                    )}
                  </div>
                </div>
                <div className="panel activity-panel">
                  <div className="panel-head">
                    <div>
                      <span className="section-kicker">AUDIT TRAIL</span>
                      <h2>Recent activity</h2>
                    </div>
                    <button onClick={() => api?.openAuditFolder()}>
                      Open files <span>↗</span>
                    </button>
                  </div>
                  <div className="activity-list">
                    {activity.slice(0, 4).map((entry, index) => (
                      <div
                        className="activity-row"
                        key={`${entry.time}-${index}`}
                      >
                        <span className={`activity-dot ${entry.tone}`} />
                        <div>
                          <b>{entry.title}</b>
                          <small>{entry.detail}</small>
                        </div>
                        <time>{entry.time}</time>
                      </div>
                    ))}
                  </div>
                  <div className="safety-note">
                    <span>✓</span>
                    <div>
                      <b>Protected live changes</b>
                      <small>
                        {config.safeChanges
                          ? "A world save is requested before every bridge mutation."
                          : "Safety saves are disabled in settings."}
                      </small>
                    </div>
                  </div>
                </div>
              </section>

              <section className="pal-strip panel">
                <div className="panel-head">
                  <div>
                    <span className="section-kicker">LIVE PALBOX</span>
                    <h2>Companions</h2>
                  </div>
                  <span className={`bridge-badge ${bridge ? "on" : ""}`}>
                    {bridge ? "BRIDGE CONNECTED" : "BRIDGE REQUIRED"}
                  </span>
                </div>
                {pals.length ? (
                  <div className="pal-cards">
                    {pals.slice(0, 6).map((pal) => (
                      <article key={pal.code}>
                        <span className={`pal-glyph ${pal.tone}`}>
                          {pal.glyph}
                          <i>✦</i>
                        </span>
                        <div>
                          <small>
                            {pal.element.toUpperCase()} · LV. {pal.level}
                          </small>
                          <b>{pal.name}</b>
                          <em>{pal.trait}</em>
                        </div>
                        <button aria-label={`Inspect ${pal.name}`}>›</button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="pal-empty">
                    Live Palbox data will appear here when the mutation bridge
                    is connected.
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </section>

      {modal && currentPlayer && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}
        >
          <form
            className={`modal ${modal === "item" ? "item-catalog-modal" : modal === "pal" ? "pal-editor-modal" : ""}`}
            onSubmit={(e) => submitChange(modal, e)}
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={() => setModal(null)}
            >
              ×
            </button>
            <span className={`modal-symbol ${modal}`}>
              {modal === "item" ? "＋" : modal === "pal" ? "◇" : "◌"}
            </span>
            <p className="eyebrow">LIVE BRIDGE OPERATION</p>
            <h2>
              {modal === "item"
                ? "Give an item"
                : modal === "pal"
                  ? "Create a Pal"
                  : "Private message"}
            </h2>
            <p className="modal-copy">
              This will run against <b>{currentPlayer.name}</b> through the
              configured bridge.{" "}
              {config.safeChanges && "The world will be saved first."}
            </p>
            {modal === "item" && (
              <>
                <ItemPicker initialId={presetId} />
                <div className="form-row">
                  <label>
                    Quantity
                    <input
                      name="quantity"
                      type="number"
                      min="1"
                      max="9999"
                      defaultValue="20"
                      required
                    />
                  </label>
                  <label>
                    Destination
                    <select name="destination">
                      <option value="inventory">Player inventory</option>
                      <option value="storage">Base storage</option>
                    </select>
                  </label>
                </div>
              </>
            )}
            {modal === "pal" && <PalCreationFields initialId={presetId} />}
            {modal === "message" && (
              <label>
                Message
                <textarea
                  name="message"
                  maxLength={240}
                  placeholder="Write a private server message…"
                  required
                />
              </label>
            )}
            <div className="backup-check">
              <span>✓</span>
              <div>
                <b>
                  {config.safeChanges
                    ? "Safety save enabled"
                    : "Direct mutation mode"}
                </b>
                <small>
                  {config.safeChanges
                    ? "The official /save endpoint runs before this change."
                    : "No pre-change save will be requested."}
                </small>
              </div>
            </div>
            <button className="submit-button" disabled={busy} type="submit">
              {busy ? "Applying live change…" : "Apply live change"}
              <span>→</span>
            </button>
          </form>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop">
          <form className="modal settings-modal" onSubmit={saveSettings}>
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={() => setSettingsOpen(false)}
            >
              ×
            </button>
            <p className="eyebrow">LIVE CONNECTION</p>
            <h2>Connect Palkeep</h2>
            <p className="modal-copy">
              Official REST provides live players, metrics, saves,
              announcements, and moderation. The optional bridge unlocks
              inventory, Palbox, teleport, and private messages.
            </p>
            <div className="connection-grid">
              <div className={`connection-card ${official ? "ok" : ""}`}>
                <span>{official ? "✓" : "1"}</span>
                <div>
                  <b>Official REST API</b>
                  <small>
                    {official ? "Connected" : "Required for live server data"}
                  </small>
                </div>
              </div>
              <div className={`connection-card ${bridge ? "ok" : ""}`}>
                <span>{bridge ? "✓" : "2"}</span>
                <div>
                  <b>Palkeep mod bridge</b>
                  <small>
                    {bridge ? "Connected" : "Optional mutation layer"}
                  </small>
                </div>
              </div>
            </div>
            <div className="settings-section">
              <b>Official server API</b>
              <div className="form-row wide">
                <label>
                  REST API URL
                  <input
                    name="restApiUrl"
                    value={config.restApiUrl}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, restApiUrl: e.target.value }))
                    }
                    required
                  />
                </label>
                <label>
                  Username
                  <input
                    name="restUsername"
                    value={config.restUsername}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, restUsername: e.target.value }))
                    }
                    required
                  />
                </label>
              </div>
              <label>
                Admin password
                <input
                  name="restPassword"
                  type="password"
                  placeholder={
                    config.hasRestPassword
                      ? "Saved securely · leave blank to keep"
                      : "Enter AdminPassword"
                  }
                  autoComplete="new-password"
                />
              </label>
            </div>
            <div className="settings-section">
              <b>Mutation bridge</b>
              <label>
                Bridge URL
                <input
                  name="bridgeUrl"
                  value={config.bridgeUrl}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, bridgeUrl: e.target.value }))
                  }
                />
              </label>
              <label>
                Bridge token
                <input
                  name="bridgeToken"
                  type="password"
                  placeholder={
                    config.hasBridgeToken
                      ? "Saved securely · leave blank to keep"
                      : "Bearer token from the bridge"
                  }
                  autoComplete="new-password"
                />
              </label>
            </div>
            <div className="settings-section">
              <b>Local server</b>
              <label>
                Dedicated server folder
                <div className="path-field">
                  <input
                    name="serverPath"
                    value={config.serverPath}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, serverPath: e.target.value }))
                    }
                    placeholder="Optional local server path"
                  />
                  <button type="button" onClick={chooseFolder}>
                    Browse
                  </button>
                </div>
              </label>
              <label>
                Refresh interval
                <select
                  name="pollIntervalMs"
                  value={config.pollIntervalMs}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      pollIntervalMs: Number(e.target.value),
                    }))
                  }
                >
                  <option value="2000">2 seconds</option>
                  <option value="5000">5 seconds</option>
                  <option value="10000">10 seconds</option>
                  <option value="30000">30 seconds</option>
                </select>
              </label>
              <label className="check-row">
                <input
                  name="safeChanges"
                  type="checkbox"
                  checked={config.safeChanges}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, safeChanges: e.target.checked }))
                  }
                />
                <span>
                  <b>Save before mutations</b>
                  <small>
                    Call the official world-save endpoint before inventory or
                    Pal changes.
                  </small>
                </span>
              </label>
              <label className="check-row warning">
                <input
                  name="allowPublicEndpoint"
                  type="checkbox"
                  checked={config.allowPublicEndpoint}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      allowPublicEndpoint: e.target.checked,
                    }))
                  }
                />
                <span>
                  <b>Allow public Internet endpoints</b>
                  <small>
                    Not recommended. Palworld advises keeping its REST API on a
                    LAN.
                  </small>
                </span>
              </label>
            </div>
            <button className="submit-button" disabled={busy} type="submit">
              {busy ? "Testing connections…" : "Save and test connections"}
              <span>→</span>
            </button>
          </form>
        </div>
      )}
      {toast && (
        <div className={`toast ${toast.error ? "error" : ""}`}>
          <span>{toast.error ? "!" : "✓"}</span>
          {toast.text}
        </div>
      )}
      {aboutOpen && (
        <AboutDialog
          onClose={() => setAboutOpen(false)}
          appInfo={appInfo}
          updateStatus={updateStatus}
          onCheckUpdates={checkUpdates}
        />
      )}
    </main>
  );
}
