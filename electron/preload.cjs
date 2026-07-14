const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("palkeepDesktop", {
  desktop: true,
  getAppInfo: () => ipcRenderer.invoke("app:info"),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  onUpdateStatus: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on("updates:status", handler);
    return () => ipcRenderer.removeListener("updates:status", handler);
  },
  openUpdate: (url) => ipcRenderer.invoke("updates:open", url),
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (config) => ipcRenderer.invoke("config:save", config),
  chooseServerFolder: () => ipcRenderer.invoke("server:choose-folder"),
  testConnections: () => ipcRenderer.invoke("connection:test"),
  getLiveSnapshot: () => ipcRenderer.invoke("live:snapshot"),
  getPlayerDetail: (playerId) => ipcRenderer.invoke("live:player-detail", playerId),
  runAction: (action) => ipcRenderer.invoke("live:action", action),
  discoverSinglePlayerWorlds: () => ipcRenderer.invoke("single:discover"),
  inspectSinglePlayerWorld: (worldPath) => ipcRenderer.invoke("single:inspect", worldPath),
  chooseSinglePlayerWorld: () => ipcRenderer.invoke("single:choose-world"),
  runSinglePlayerAction: (request) => ipcRenderer.invoke("single:mutate", request),
  createSinglePlayerBackup: (worldPath) => ipcRenderer.invoke("single:backup", worldPath),
  listSinglePlayerBackups: (worldPath) => ipcRenderer.invoke("single:list-backups", worldPath),
  restoreSinglePlayerBackup: (worldPath, backupId) => ipcRenderer.invoke("single:restore", worldPath, backupId),
  openSinglePlayerBackups: () => ipcRenderer.invoke("single:open-backups"),
  getLiveBridgeStatus: (gamePath) => ipcRenderer.invoke("livebridge:status", gamePath),
  chooseLiveBridgeGame: () => ipcRenderer.invoke("livebridge:choose-game"),
  installLiveBridge: (gamePath) => ipcRenderer.invoke("livebridge:install", gamePath),
  runLiveBridgeAction: (request) => ipcRenderer.invoke("livebridge:action", request),
  openAuditFolder: () => ipcRenderer.invoke("audit:open"),
});
