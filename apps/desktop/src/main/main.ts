import { app, BrowserWindow, dialog } from "electron";
import { createMainWindow } from "./window";
import { registerIpcHandlers } from "./ipc";
import { startBackend, stopBackend } from "./backend-process";

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(async () => {
  try {
    await startBackend();
  } catch (error) {
    console.error("Failed to start backend:", error);
    dialog.showErrorBox(
      "تعذّر تشغيل الخادم",
      "حدث خطأ أثناء تشغيل خادم التطبيق. أعد تشغيل البرنامج، وإن تكرر الخطأ راجع سجلات الأخطاء.",
    );
  }

  registerIpcHandlers();
  mainWindow = createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopBackend();
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception in main process:", error);
});
