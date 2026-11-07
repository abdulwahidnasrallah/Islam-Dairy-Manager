import { ipcMain, app, shell } from "electron";
import path from "node:path";

/**
 * Foundation-phase IPC surface, extended in Phase 9 with a single
 * desktop-native convenience: revealing the local backups folder in
 * File Explorer. Everything else (creating/listing/restoring backups)
 * goes through the normal HTTP API — the renderer already has that
 * plumbing, and duplicating it over IPC would just be two paths to
 * maintain for the same feature.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle("app:get-version", () => app.getVersion());
  ipcMain.handle("app:get-name", () => "Islam Dairy Manager");

  ipcMain.handle("backup:open-folder", () => {
    if (process.env.NODE_ENV === "development") {
      return { opened: false, reason: "Not available in dev mode — backend runs outside Electron." };
    }
    const dataDir = path.join(app.getPath("userData"), "data");
    const backupsDir = path.join(dataDir, "backups");
    shell.openPath(backupsDir).catch(() => undefined);
    return { opened: true };
  });
}
