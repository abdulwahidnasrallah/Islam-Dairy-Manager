import { app } from "electron";
import { fork, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const isDev = process.env.NODE_ENV === "development";
const BACKEND_PORT = 4000;

let backendProcess: ChildProcess | null = null;

/**
 * In dev, the backend runs separately via `pnpm backend` (see the root
 * `dev` script) — this is a no-op then, same as today. In a packaged
 * build there is no separate terminal for the user to run, so the
 * Electron main process spawns the backend itself as a child Node
 * process, pointed at a per-user writable database file instead of
 * anything inside the installed (read-only) Program Files folder.
 *
 * NOTE: this path is written but not exercised by the test suite — it
 * only runs inside a packaged Electron app. Verify it end-to-end on a
 * real Windows build (see docs/ROADMAP.md, Phase 9) before shipping.
 */
export async function startBackend(): Promise<void> {
  if (isDev) return;

  const userDataDir = app.getPath("userData");
  const dataDir = path.join(userDataDir, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, "islam-dairy.db");
  const templatePath = path.join(process.resourcesPath, "template.db");

  // First launch after install: seed the user's database from a
  // pre-migrated (schema-only, no demo data) template shipped inside
  // the installer, instead of running migrations at runtime — that
  // would require bundling the Prisma CLI/migration engine just for
  // a one-time step.
  if (!fs.existsSync(dbPath) && fs.existsSync(templatePath)) {
    fs.copyFileSync(templatePath, dbPath);
  }

  const sessionSecret = getOrCreateSessionSecret(userDataDir);
  const backendEntry = path.join(process.resourcesPath, "backend", "server.js");

  backendProcess = fork(backendEntry, [], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(BACKEND_PORT),
      // Prisma's sqlite URLs want forward slashes even on Windows.
      DATABASE_URL: `file:${dbPath.replace(/\\/g, "/")}`,
      SESSION_SECRET: sessionSecret,
      APP_VERSION: app.getVersion(),
    },
    stdio: "inherit",
  });

  backendProcess.on("exit", (code) => {
    // eslint-disable-next-line no-console -- this is the main process, there is no logger to fall back to here
    console.error(`Backend process exited unexpectedly with code ${code}`);
  });

  await waitForBackendReady();
}

/** A stable secret across restarts, generated once per install and never shipped in the installer. */
function getOrCreateSessionSecret(userDataDir: string): string {
  const secretPath = path.join(userDataDir, "session-secret.txt");
  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, "utf-8").trim();
  }
  const secret = randomBytes(32).toString("hex");
  fs.writeFileSync(secretPath, secret, "utf-8");
  return secret;
}

async function waitForBackendReady(retries = 40): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://localhost:${BACKEND_PORT}/api/health`);
      if (res.ok) return;
    } catch {
      // Backend hasn't bound its port yet — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  // eslint-disable-next-line no-console
  console.error("Backend did not report healthy in time; loading the window anyway.");
}

export function stopBackend(): void {
  backendProcess?.kill();
  backendProcess = null;
}
