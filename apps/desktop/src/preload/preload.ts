import { contextBridge, ipcRenderer } from "electron";

/**
 * The ONLY surface exposed to the renderer (React). Never expose
 * ipcRenderer, require, or any Node API directly — add new whitelisted
 * functions here one at a time as real features need them.
 */
contextBridge.exposeInMainWorld("idm", {
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  getAppName: () => ipcRenderer.invoke("app:get-name"),
  openBackupsFolder: () => ipcRenderer.invoke("backup:open-folder"),
});
