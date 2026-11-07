import { BrowserWindow } from "electron";
import path from "node:path";

const isDev = process.env.NODE_ENV === "development";

/**
 * Creates the main application window with Electron's recommended
 * security settings enabled. React never gets direct Node access —
 * only the whitelisted bridge exposed by preload.ts.
 */
export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: "إسلام للألبان والأجبان",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    void window.loadURL("http://localhost:5173");
    window.webContents.openDevTools({ mode: "detach" });
  } else {
    void window.loadFile(path.join(__dirname, "../../../frontend/dist/index.html"));
  }

  return window;
}
