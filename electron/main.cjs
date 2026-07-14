const { app, BrowserWindow, dialog, ipcMain, net, safeStorage, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { execFile, spawn } = require("node:child_process");
const { promisify } = require("node:util");
const { autoUpdater } = require("electron-updater");

const execFileAsync = promisify(execFile);
const LIVE_BRIDGE_VERSION = "0.2.0";
const PALKEEP_BUILD = "beta";
const RELEASES_API = "https://api.github.com/repos/AlphaNineGaming/Palkeep/releases?per_page=10";
const RELEASES_PAGE = "https://github.com/AlphaNineGaming/Palkeep/releases";

app.setName("Palkeep Server Command");
app.setAppUserModelId("com.palkeep.servercommand");
if (!app.isPackaged && process.env.PALKEEP_USER_DATA_DIR) app.setPath("userData", process.env.PALKEEP_USER_DATA_DIR);

const DEFAULT_CONFIG = {
  setupComplete: false,
  serverMode: "windows-dedicated",
  serverPath: "",
  restApiUrl: "http://127.0.0.1:8212/v1/api",
  restUsername: "admin",
  bridgeUrl: "http://127.0.0.1:8213/v1",
  safeChanges: true,
  pollIntervalMs: 5000,
  allowPublicEndpoint: false,
};

let mainWindow = null;
let updaterConfigured = false;
let updateReadyPromptShown = false;
let updaterState = {
  checked: false,
  currentVersion: app.getVersion(),
  latestVersion: null,
  updateAvailable: false,
  prerelease: true,
  releaseName: null,
  releaseUrl: RELEASES_PAGE,
  downloadUrl: null,
  publishedAt: null,
  phase: "idle",
  percent: null,
  error: null,
};

function releaseUrl(version) {
  const clean = String(version || "").replace(/^v/i, "");
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(clean)
    ? `${RELEASES_PAGE}/tag/v${clean}`
    : RELEASES_PAGE;
}

function publishUpdaterState(patch = {}) {
  updaterState = { ...updaterState, ...patch, currentVersion: app.getVersion() };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("updates:status", updaterState);
  }
  return updaterState;
}

function updateInfoPatch(info = {}) {
  const version = String(info.version || "").replace(/^v/i, "") || null;
  return {
    latestVersion: version,
    prerelease: version ? version.includes("-") : true,
    releaseName: version ? `Palkeep ${version}` : null,
    releaseUrl: releaseUrl(version),
    publishedAt: info.releaseDate || null,
  };
}

function configureAutoUpdater() {
  if (updaterConfigured || !app.isPackaged) return;
  updaterConfigured = true;
  autoUpdater.allowPrerelease = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    publishUpdaterState({ checked: false, phase: "checking", percent: null, error: null });
  });
  autoUpdater.on("update-available", (info) => {
    publishUpdaterState({
      ...updateInfoPatch(info),
      checked: true,
      updateAvailable: true,
      phase: "available",
      percent: 0,
      error: null,
    });
  });
  autoUpdater.on("update-not-available", (info) => {
    publishUpdaterState({
      ...updateInfoPatch(info),
      checked: true,
      updateAvailable: false,
      phase: "not-available",
      percent: null,
      error: null,
    });
  });
  autoUpdater.on("download-progress", (progress) => {
    publishUpdaterState({
      checked: true,
      updateAvailable: true,
      phase: "downloading",
      percent: Math.max(0, Math.min(100, Number(progress.percent) || 0)),
      error: null,
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    publishUpdaterState({
      ...updateInfoPatch(info),
      checked: true,
      updateAvailable: true,
      phase: "downloaded",
      percent: 100,
      error: null,
    });
    if (updateReadyPromptShown || !mainWindow) return;
    updateReadyPromptShown = true;
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Palkeep update ready",
      message: `Palkeep ${info.version} has been downloaded.`,
      detail: "Restart Palkeep now to install the update, or choose Later to install automatically when the app closes.",
      buttons: ["Restart and install", "Later"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall(false, true);
    }).catch(() => undefined);
  });
  autoUpdater.on("error", (error) => {
    publishUpdaterState({
      checked: true,
      phase: "error",
      percent: null,
      error: error.message || "Automatic update failed.",
    });
  });
}

function appInfo() {
  return {
    version: app.getVersion(),
    build: PALKEEP_BUILD,
    channel: "Beta",
    packaged: app.isPackaged,
  };
}

function parsedVersion(value) {
  const clean = String(value || "").trim().replace(/^v/i, "");
  const [number, prerelease = ""] = clean.split("-", 2);
  const parts = number.split(".").map((part) => Number.parseInt(part, 10) || 0);
  return { parts: [parts[0] || 0, parts[1] || 0, parts[2] || 0], prerelease };
}

function compareVersions(left, right) {
  const a = parsedVersion(left);
  const b = parsedVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a.parts[index] !== b.parts[index]) return a.parts[index] > b.parts[index] ? 1 : -1;
  }
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease.localeCompare(b.prerelease, undefined, { numeric: true });
}

async function checkForUpdates() {
  const current = app.getVersion();
  if (app.isPackaged) {
    configureAutoUpdater();
    try {
      publishUpdaterState({ checked: false, phase: "checking", percent: null, error: null });
      await autoUpdater.checkForUpdates();
      return updaterState;
    } catch (error) {
      return publishUpdaterState({
        checked: true,
        phase: "error",
        percent: null,
        error: error.message || "Automatic update failed.",
      });
    }
  }
  try {
    const response = await net.fetch(RELEASES_API, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `Palkeep/${current}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}.`);
    const releases = await response.json();
    const published = releases.filter((release) => !release.draft && release.tag_name);
    published.sort((a, b) => compareVersions(b.tag_name, a.tag_name));
    const latest = published[0];
    if (!latest) throw new Error("No published Palkeep releases were found.");
    const installer = (latest.assets || []).find((asset) => /setup.*\.exe$/i.test(asset.name)) || latest.assets?.[0];
    return {
      checked: true,
      currentVersion: current,
      latestVersion: String(latest.tag_name).replace(/^v/i, ""),
      updateAvailable: compareVersions(latest.tag_name, current) > 0,
      prerelease: Boolean(latest.prerelease),
      releaseName: latest.name || latest.tag_name,
      releaseUrl: latest.html_url,
      downloadUrl: installer?.browser_download_url || latest.html_url,
      publishedAt: latest.published_at || null,
      phase: compareVersions(latest.tag_name, current) > 0 ? "available" : "not-available",
      percent: null,
      error: null,
    };
  } catch (error) {
    return {
      checked: true,
      currentVersion: current,
      latestVersion: null,
      updateAvailable: false,
      prerelease: false,
      releaseName: null,
      releaseUrl: null,
      downloadUrl: null,
      publishedAt: null,
      phase: "error",
      percent: null,
      error: error.message || "Could not check for updates.",
    };
  }
}

function userFile(name) {
  return path.join(app.getPath("userData"), name);
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

function readSecrets() {
  const stored = readJson(userFile("secrets.json"), {});
  if (!safeStorage.isEncryptionAvailable()) return {};
  const result = {};
  for (const [key, value] of Object.entries(stored)) {
    try { result[key] = safeStorage.decryptString(Buffer.from(String(value), "base64")); } catch { /* ignore corrupt entries */ }
  }
  return result;
}

function writeSecrets(patch) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows credential encryption is not available.");
  const stored = readJson(userFile("secrets.json"), {});
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === "") delete stored[key];
    else stored[key] = safeStorage.encryptString(String(value)).toString("base64");
  }
  writeJson(userFile("secrets.json"), stored);
}

function readConfig() {
  return { ...DEFAULT_CONFIG, ...readJson(userFile("config.json"), {}) };
}

function publicConfig() {
  const config = readConfig();
  const secrets = readSecrets();
  return {
    ...config,
    restPassword: "",
    bridgeToken: "",
    hasRestPassword: Boolean(secrets.restPassword),
    hasBridgeToken: Boolean(secrets.bridgeToken),
  };
}

function writeConfig(input = {}) {
  const { restPassword, bridgeToken, ...plain } = input;
  delete plain.hasRestPassword;
  delete plain.hasBridgeToken;
  const next = { ...readConfig(), ...plain };
  next.pollIntervalMs = Math.max(2000, Math.min(60000, Number(next.pollIntervalMs) || 5000));
  writeJson(userFile("config.json"), next);
  const secrets = {};
  if (restPassword !== undefined && restPassword !== "") secrets.restPassword = restPassword;
  if (bridgeToken !== undefined && bridgeToken !== "") secrets.bridgeToken = bridgeToken;
  if (Object.keys(secrets).length) writeSecrets(secrets);
  return publicConfig();
}

function appendAudit(entry) {
  const folder = userFile("audit");
  fs.mkdirSync(folder, { recursive: true });
  fs.appendFileSync(path.join(folder, "operations.jsonl"), `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, "utf8");
}

function singlePlayerRoot() {
  return path.join(app.getAppPath(), "single-player");
}

function liveBridgeBundleRoot() {
  return path.join(app.getAppPath(), "live-bridge", "runtime");
}

function liveBridgeIpcRoot() {
  const folder = userFile("live-bridge");
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

function palworldGameCandidates() {
  const configured = readJson(userFile("live-bridge-install.json"), {}).gamePath;
  const roots = [
    configured,
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Steam", "steamapps", "common", "Palworld"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Steam", "steamapps", "common", "Palworld"),
    ...["C", "D", "E", "F", "G"].map((drive) => `${drive}:\\SteamLibrary\\steamapps\\common\\Palworld`),
    "C:\\XboxGames\\Palworld",
  ].filter(Boolean);
  return [...new Set(roots.map((value) => path.resolve(value)))];
}

function validatePalworldGame(gamePath) {
  const resolved = path.resolve(String(gamePath || ""));
  const win64 = path.join(resolved, "Pal", "Binaries", "Win64");
  if (!fs.existsSync(path.join(win64, "Palworld-Win64-Shipping.exe"))) {
    throw new Error("Choose the Palworld game folder containing Pal/Binaries/Win64/Palworld-Win64-Shipping.exe.");
  }
  return { gamePath: resolved, win64 };
}

function discoverPalworldGame() {
  for (const candidate of palworldGameCandidates()) {
    try { return validatePalworldGame(candidate); } catch { /* continue */ }
  }
  return null;
}

function appendModLine(modsFile) {
  const current = fs.existsSync(modsFile) ? fs.readFileSync(modsFile, "utf8") : "";
  const lines = current.split(/\r?\n/).filter((line) => !/^\s*PalkeepLive\s*:/i.test(line));
  lines.push("PalkeepLive : 1");
  fs.writeFileSync(modsFile, `${lines.filter(Boolean).join("\r\n")}\r\n`, "utf8");
}

async function sendLiveBridgeCommand(type, params = {}, timeoutMs = 9000) {
  if (!(await isPalworldRunning())) throw new Error("Start Palworld and enter the world before using Live Delivery.");
  const folder = liveBridgeIpcRoot();
  const commandFile = path.join(folder, "commands.json");
  const responseFile = path.join(folder, "responses.json");
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  for (const file of [commandFile, `${commandFile}.tmp`, responseFile, `${responseFile}.tmp`]) {
    try { fs.rmSync(file, { force: true }); } catch { /* ignore stale IPC cleanup */ }
  }
  const temporary = `${commandFile}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ id, type, params, timestamp: new Date().toISOString() }), "utf8");
  fs.renameSync(temporary, commandFile);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (!fs.existsSync(responseFile)) continue;
    let response;
    try { response = JSON.parse(fs.readFileSync(responseFile, "utf8")); } catch { continue; }
    if (String(response.id) !== id) continue;
    fs.rmSync(responseFile, { force: true });
    if (!response.success) throw new Error(response.message || "Palworld rejected the live operation.");
    return response;
  }
  fs.rmSync(commandFile, { force: true });
  throw new Error("The Palkeep game bridge did not respond. Restart Palworld after installing the bridge.");
}

async function liveBridgeStatus(gamePath) {
  let game;
  try { game = gamePath ? validatePalworldGame(gamePath) : discoverPalworldGame(); } catch { game = null; }
  const running = await isPalworldRunning();
  const installed = Boolean(game && fs.existsSync(path.join(game.win64, "ue4ss", "Mods", "PalkeepLive", "Scripts", "main.lua")));
  let health = null;
  let error = null;
  if (installed && running) {
    try { health = await sendLiveBridgeCommand("health", {}, 3500); }
    catch (cause) { error = cause.message; }
  }
  const manifestVersion = readJson(userFile("live-bridge-install.json"), {}).version || null;
  const installedVersion = health?.data?.version || manifestVersion;
  return {
    gamePath: game?.gamePath || "",
    installed,
    running,
    connected: Boolean(health?.success),
    version: health?.data?.version || null,
    installedVersion,
    latestVersion: LIVE_BRIDGE_VERSION,
    updateAvailable: Boolean(installed && installedVersion !== LIVE_BRIDGE_VERSION),
    players: health?.data?.players || [],
    error,
  };
}

function installLiveBridge(gamePath) {
  const game = validatePalworldGame(gamePath);
  const bundle = liveBridgeBundleRoot();
  if (!fs.existsSync(path.join(bundle, "dwmapi.dll")) || !fs.existsSync(path.join(bundle, "ue4ss", "UE4SS.dll"))) {
    throw new Error("The bundled live bridge runtime is missing.");
  }
  if (fs.existsSync(path.join(game.win64, "dwmapi.dll")) && !fs.existsSync(path.join(game.win64, "ue4ss", "UE4SS.dll"))) {
    throw new Error("Another dwmapi.dll loader already exists in Palworld. Remove or configure the conflicting mod loader first.");
  }
  const hadUe4ss = fs.existsSync(path.join(game.win64, "ue4ss", "UE4SS.dll"));
  if (!hadUe4ss) {
    fs.copyFileSync(path.join(bundle, "dwmapi.dll"), path.join(game.win64, "dwmapi.dll"));
    fs.cpSync(path.join(bundle, "ue4ss"), path.join(game.win64, "ue4ss"), { recursive: true, force: false, errorOnExist: false });
  } else {
    fs.cpSync(
      path.join(bundle, "ue4ss", "Mods", "PalkeepLive"),
      path.join(game.win64, "ue4ss", "Mods", "PalkeepLive"),
      { recursive: true, force: true },
    );
  }
  appendModLine(path.join(game.win64, "ue4ss", "Mods", "mods.txt"));
  writeJson(userFile("live-bridge-install.json"), {
    gamePath: game.gamePath,
    installedAt: new Date().toISOString(),
    installedRuntime: !hadUe4ss,
    version: LIVE_BRIDGE_VERSION,
  });
  appendAudit({ state: "completed", action: "liveBridgeInstall", gamePath: game.gamePath, installedRuntime: !hadUe4ss });
  return { ok: true, gamePath: game.gamePath, restartRequired: true };
}

function runSinglePlayerHelper(request, timeoutMs = 180000) {
  const root = singlePlayerRoot();
  const python = path.join(root, "runtime", "python.exe");
  const script = path.join(root, "palkeep_save.py");
  if (!fs.existsSync(python) || !fs.existsSync(script)) throw new Error("The bundled single-player save engine is missing.");
  return new Promise((resolve, reject) => {
    const child = spawn(python, [script], {
      cwd: root,
      windowsHide: true,
      env: { ...process.env, PYTHONUTF8: "1", PYTHONNOUSERSITE: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Single-player save processing timed out."));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); if (stdout.length > 8_000_000) child.kill(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); if (stderr.length > 2_000_000) stderr = stderr.slice(-2_000_000); });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      let result;
      try { result = JSON.parse(stdout.trim()); }
      catch { return reject(new Error(stderr.trim().split(/\r?\n/).pop() || "The save engine returned an invalid response.")); }
      if (code !== 0 || result?.ok === false) return reject(new Error(result?.error || stderr.trim().split(/\r?\n/).pop() || "Save processing failed."));
      resolve(result);
    });
    child.stdin.end(JSON.stringify(request));
  });
}

async function isPalworldRunning() {
  const names = ["Palworld-Win64-Shipping.exe", "Palworld.exe"];
  for (const name of names) {
    try {
      const { stdout } = await execFileAsync("tasklist.exe", ["/FI", `IMAGENAME eq ${name}`, "/FO", "CSV", "/NH"], { windowsHide: true });
      if (stdout.toLowerCase().includes(name.toLowerCase())) return true;
    } catch { /* a tasklist failure is not proof that the game is running */ }
  }
  return false;
}

function validateWorldFolder(worldPath) {
  const resolved = path.resolve(String(worldPath || ""));
  if (!fs.existsSync(path.join(resolved, "Level.sav"))) throw new Error("Choose a Palworld world folder containing Level.sav.");
  return resolved;
}

function backupRoot() {
  return path.join(app.getPath("userData"), "single-player-backups");
}

function backupWorld(worldPath, reason = "manual") {
  const world = validateWorldFolder(worldPath);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const worldId = path.basename(world).replace(/[^a-zA-Z0-9_-]/g, "_");
  const destination = path.join(backupRoot(), worldId, stamp);
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(world, { withFileTypes: true })) {
    if (entry.name.endsWith(".palkeep.tmp")) continue;
    fs.cpSync(path.join(world, entry.name), path.join(destination, entry.name), { recursive: true, force: true });
  }
  const manifest = { id: stamp, worldId, worldPath: world, reason, createdAt: new Date().toISOString() };
  fs.writeFileSync(path.join(destination, "palkeep-backup.json"), JSON.stringify(manifest, null, 2), "utf8");
  appendAudit({ state: "completed", action: "singlePlayerBackup", worldId, backupId: stamp, reason });
  return { ...manifest, path: destination };
}

function listBackups(worldPath) {
  const world = validateWorldFolder(worldPath);
  const worldId = path.basename(world).replace(/[^a-zA-Z0-9_-]/g, "_");
  const folder = path.join(backupRoot(), worldId);
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => {
    const location = path.join(folder, entry.name);
    const manifest = readJson(path.join(location, "palkeep-backup.json"), {});
    return { id: entry.name, createdAt: manifest.createdAt || null, reason: manifest.reason || "automatic", path: location };
  }).sort((a, b) => String(b.createdAt || b.id).localeCompare(String(a.createdAt || a.id)));
}

async function restoreBackup(worldPath, backupId) {
  if (await isPalworldRunning()) throw new Error("Close Palworld before restoring a save backup.");
  const world = validateWorldFolder(worldPath);
  const worldId = path.basename(world).replace(/[^a-zA-Z0-9_-]/g, "_");
  const root = path.resolve(path.join(backupRoot(), worldId));
  const source = path.resolve(path.join(root, String(backupId || "")));
  if (!source.startsWith(root + path.sep) || !fs.existsSync(path.join(source, "Level.sav"))) throw new Error("The selected backup is invalid.");
  const safety = backupWorld(world, "pre-restore");
  const players = path.join(world, "Players");
  if (fs.existsSync(players)) fs.rmSync(players, { recursive: true, force: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name === "palkeep-backup.json") continue;
    fs.cpSync(path.join(source, entry.name), path.join(world, entry.name), { recursive: true, force: true });
  }
  appendAudit({ state: "completed", action: "singlePlayerRestore", worldId, backupId, safetyBackupId: safety.id });
  return { ok: true, backupId, safetyBackupId: safety.id };
}

function isPrivateHostname(hostname) {
  const host = hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "::1"].includes(host) || host.endsWith(".local") || !host.includes(".")) return true;
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  const match = host.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function validateEndpoint(value, allowPublicEndpoint) {
  let url;
  try { url = new URL(String(value || "")); } catch { throw new Error("The endpoint URL is invalid."); }
  if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error("Only HTTP and HTTPS endpoints are supported.");
  if (!allowPublicEndpoint && !isPrivateHostname(url.hostname)) {
    throw new Error("Palkeep blocks public Internet endpoints by default. Use localhost or a private LAN address.");
  }
  return url.toString().replace(/\/$/, "");
}

async function requestJson(baseUrl, route, options = {}) {
  const config = readConfig();
  const base = validateEndpoint(baseUrl, config.allowPublicEndpoint);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${base}${route}`, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.authorization ? { Authorization: options.authorization } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = { message: text }; }
    }
    if (!response.ok) {
      const message = data?.message || data?.error || `HTTP ${response.status}`;
      throw new Error(message);
    }
    return data ?? { ok: true };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Connection timed out after 8 seconds.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function restAuth() {
  const config = readConfig();
  const secrets = readSecrets();
  return `Basic ${Buffer.from(`${config.restUsername || "admin"}:${secrets.restPassword || ""}`).toString("base64")}`;
}

function bridgeAuth() {
  const token = readSecrets().bridgeToken;
  return token ? `Bearer ${token}` : undefined;
}

function rest(route, options = {}) {
  return requestJson(readConfig().restApiUrl, route, { ...options, authorization: restAuth() });
}

function bridge(route, options = {}) {
  return requestJson(readConfig().bridgeUrl, route, { ...options, authorization: bridgeAuth() });
}

async function settle(label, promise) {
  try { return { ok: true, value: await promise }; }
  catch (error) { return { ok: false, error: `${label}: ${error.message}` }; }
}

async function liveSnapshot() {
  const [info, players, metrics, settings, bridgeHealth] = await Promise.all([
    settle("Server info", rest("/info")),
    settle("Players", rest("/players")),
    settle("Metrics", rest("/metrics")),
    settle("Settings", rest("/settings")),
    settle("Bridge", bridge("/health")),
  ]);
  const officialConnected = info.ok || players.ok || metrics.ok || settings.ok;
  const errors = [info, players, metrics, settings].filter((item) => !item.ok).map((item) => item.error);
  return {
    officialConnected,
    bridgeConnected: bridgeHealth.ok,
    info: info.value || null,
    players: players.value?.players || [],
    metrics: metrics.value || null,
    settings: settings.value || null,
    bridge: bridgeHealth.value || null,
    errors,
    checkedAt: new Date().toISOString(),
  };
}

async function playerDetail(playerId) {
  if (!playerId) throw new Error("Select a live player first.");
  const encoded = encodeURIComponent(playerId);
  const [inventory, pals] = await Promise.all([
    settle("Inventory bridge", bridge(`/players/${encoded}/inventory`)),
    settle("Palbox bridge", bridge(`/players/${encoded}/pals`)),
  ]);
  return {
    bridgeConnected: inventory.ok || pals.ok,
    inventory: inventory.value?.items || [],
    pals: pals.value?.pals || [],
    errors: [inventory, pals].filter((item) => !item.ok).map((item) => item.error),
  };
}

async function runAction(action = {}) {
  const allowed = new Set(["save", "announce", "giveItem", "addPal", "teleport", "message", "kick", "ban"]);
  if (!allowed.has(action.type)) throw new Error("Unsupported live operation.");
  const config = readConfig();
  appendAudit({ state: "requested", action: { ...action, bridgeToken: undefined, restPassword: undefined } });

  try {
    let result;
    if (action.type === "save") result = await rest("/save", { method: "POST" });
    else if (action.type === "announce") result = await rest("/announce", { method: "POST", body: { message: String(action.message || "") } });
    else if (action.type === "kick" || action.type === "ban") {
      result = await rest(`/${action.type}`, { method: "POST", body: { userid: action.userId, message: action.message || "Removed by server administrator." } });
    } else {
      if (config.safeChanges) await rest("/save", { method: "POST" });
      const playerId = encodeURIComponent(String(action.playerId || ""));
      if (!playerId) throw new Error("Select a live player first.");
      const routes = {
        giveItem: [`/players/${playerId}/items`, { itemId: action.itemId, quantity: Number(action.quantity), destination: action.destination }],
        addPal: [`/players/${playerId}/pals`, {
          speciesId: action.speciesId,
          displayName: action.displayName,
          gender: action.gender,
          level: Number(action.level),
          passive: action.passive,
          passives: action.passives,
          rank: Number(action.rank),
          talentHp: Number(action.talentHp),
          talentAttack: Number(action.talentAttack),
          talentDefense: Number(action.talentDefense),
        }],
        teleport: [`/players/${playerId}/teleport`, { mode: action.mode || "to-admin" }],
        message: [`/players/${playerId}/message`, { message: String(action.message || "") }],
      };
      const [route, body] = routes[action.type];
      result = await bridge(route, { method: "POST", body });
    }
    appendAudit({ state: "completed", action: action.type, playerId: action.playerId || null });
    return { ok: true, result };
  } catch (error) {
    appendAudit({ state: "failed", action: action.type, playerId: action.playerId || null, error: error.message });
    throw error;
  }
}

ipcMain.handle("config:get", () => publicConfig());
ipcMain.handle("app:info", () => appInfo());
ipcMain.handle("updates:check", () => checkForUpdates());
ipcMain.handle("updates:install", () => {
  if (!app.isPackaged || updaterState.phase !== "downloaded") {
    throw new Error("The update has not finished downloading yet.");
  }
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return { ok: true };
});
ipcMain.handle("updates:open", async (_event, url) => {
  const target = String(url || "");
  if (!/^https:\/\/github\.com\/AlphaNineGaming\/Palkeep\/releases(?:\/|$)/i.test(target)) {
    throw new Error("Blocked an untrusted update URL.");
  }
  await shell.openExternal(target);
  return { ok: true };
});
ipcMain.handle("config:save", (_event, config) => writeConfig(config));
ipcMain.handle("connection:test", () => liveSnapshot());
ipcMain.handle("live:snapshot", () => liveSnapshot());
ipcMain.handle("live:player-detail", (_event, playerId) => playerDetail(playerId));
ipcMain.handle("live:action", (_event, action) => runAction(action));
ipcMain.handle("server:choose-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, { title: "Select Palworld dedicated server folder", properties: ["openDirectory"] });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle("single:discover", () => runSinglePlayerHelper({ action: "discover" }));
ipcMain.handle("single:inspect", (_event, worldPath) => runSinglePlayerHelper({ action: "inspect", worldPath: validateWorldFolder(worldPath) }));
ipcMain.handle("single:choose-world", async () => {
  const result = await dialog.showOpenDialog(mainWindow, { title: "Select a Palworld single-player world folder", properties: ["openDirectory"] });
  if (result.canceled) return null;
  return validateWorldFolder(result.filePaths[0]);
});
ipcMain.handle("single:backup", async (_event, worldPath) => {
  if (await isPalworldRunning()) throw new Error("Close Palworld before creating a single-player backup.");
  return backupWorld(worldPath, "manual");
});
ipcMain.handle("single:list-backups", (_event, worldPath) => listBackups(worldPath));
ipcMain.handle("single:restore", (_event, worldPath, backupId) => restoreBackup(worldPath, backupId));
ipcMain.handle("single:mutate", async (_event, request = {}) => {
  if (!new Set(["giveItem", "addPal", "updateSettings"]).has(request.action)) throw new Error("Unsupported single-player operation.");
  if (await isPalworldRunning()) throw new Error("Close Palworld before applying single-player changes.");
  const worldPath = validateWorldFolder(request.worldPath);
  appendAudit({ state: "requested", action: `singlePlayer:${request.action}`, playerId: request.playerId || null, worldId: path.basename(worldPath) });
  const backup = backupWorld(worldPath, `before-${request.action}`);
  try {
    const result = await runSinglePlayerHelper({ ...request, worldPath });
    appendAudit({ state: "completed", action: `singlePlayer:${request.action}`, playerId: request.playerId || null, worldId: path.basename(worldPath), backupId: backup.id });
    return { ...result, backup };
  } catch (error) {
    appendAudit({ state: "failed", action: `singlePlayer:${request.action}`, playerId: request.playerId || null, worldId: path.basename(worldPath), backupId: backup.id, error: error.message });
    throw error;
  }
});
ipcMain.handle("single:open-backups", async () => {
  const folder = backupRoot();
  fs.mkdirSync(folder, { recursive: true });
  const error = await shell.openPath(folder);
  return { ok: !error, error };
});
ipcMain.handle("livebridge:status", (_event, gamePath) => liveBridgeStatus(gamePath));
ipcMain.handle("livebridge:choose-game", async () => {
  const result = await dialog.showOpenDialog(mainWindow, { title: "Select the Palworld game folder", properties: ["openDirectory"] });
  if (result.canceled) return null;
  return validatePalworldGame(result.filePaths[0]).gamePath;
});
ipcMain.handle("livebridge:install", async (_event, gamePath) => {
  if (await isPalworldRunning()) throw new Error("Close Palworld before installing the live bridge.");
  return installLiveBridge(gamePath || discoverPalworldGame()?.gamePath);
});
ipcMain.handle("livebridge:action", async (_event, request = {}) => {
  if (request.action !== "giveItem") throw new Error("Unsupported live bridge operation.");
  const itemId = String(request.itemId || "");
  const quantity = Math.floor(Number(request.quantity));
  if (!/^[A-Za-z0-9_]+$/.test(itemId)) throw new Error("Choose a valid item ID.");
  if (quantity < 1 || quantity > 9999) throw new Error("Live quantity must be between 1 and 9,999.");
  const response = await sendLiveBridgeCommand("give_item", {
    target_player: String(request.playerName || ""),
    item_id: itemId,
    quantity,
    destination: "inventory",
  });
  appendAudit({ state: "completed", action: "liveBridge:giveItem", playerName: request.playerName || null, itemId, quantity });
  return response;
});
ipcMain.handle("audit:open", async () => {
  const folder = userFile("audit");
  fs.mkdirSync(folder, { recursive: true });
  const error = await shell.openPath(folder);
  return { ok: !error, error };
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: "#f4f1ea",
    title: "Palkeep Server Command",
    autoHideMenuBar: true,
    icon: path.join(app.getAppPath(), "build", "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.loadFile(path.join(app.getAppPath(), "desktop-dist", "index.html"));
  mainWindow.on("closed", () => { mainWindow = null; });
}

const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(() => {
    configureAutoUpdater();
    createWindow();
  });
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  app.on("window-all-closed", () => app.quit());
}
