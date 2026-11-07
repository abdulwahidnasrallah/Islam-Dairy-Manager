# "Error: spawn UNKNOWN" from esbuild on `pnpm backend` (Windows, Node 24)

## Symptom

Running the backend dev server produces:

```
Error: spawn UNKNOWN
    at ... node_modules/esbuild@0.28.2/...
```

Environment at the time this was reported:

- Node.js v24.15.0
- pnpm 11.10.0
- tsx v4.23.15
- `@types/node` pinned to `^22.4.1` (backend `devDependencies`)
- Prisma 5.22.0 (unchanged, not implicated)

## Root cause

`esbuild` is not a direct dependency of `apps/backend` — that is correct
and not the bug (`tsx` uses it internally to transpile TypeScript on the
fly, exactly as documented in the codebase notes). The failure is a
known class of problem where **esbuild's platform-specific native
binary was resolved/spawned against the wrong Node ABI/runtime**,
which happens most often when:

1. A project's `node_modules` was installed under one Node major version
   (or got its optional-dependency binary resolved for one platform)
   and is then *run* under a different, newer major version — Node 24
   is very new and some native binary resolution paths in the
   esbuild/tsx dependency chain were validated primarily against
   Node 18/20/22 at the time this dependency set was pinned.
2. Windows-specific process-spawn quirks (path length, an AV/EDR tool
   intercepting `child_process.spawn`, or a corrupted partial install)
   which surface as the generic `spawn UNKNOWN` rather than a more
   specific error.

Nothing in this project's own code calls `spawn` directly — this is
entirely inside the `tsx` → `esbuild` toolchain, so the fix is an
environment/toolchain fix, not a code change.

## Fix (safe — does not change any package version)

Use **Node.js 22 LTS** for local development and for packaging, per the
existing `"engines": { "node": ">=20.0.0" }` constraint in the root
`package.json` (22 LTS satisfies that range; no `package.json` version
was changed to apply this fix). A `.nvmrc` file (`22`) has been added
at the repo root so this is a one-command switch for anyone using
`nvm`/`nvm-windows`/`fnm`.

### Steps

1. Install Node 22 LTS if not already available:
   - Windows: install `nvm-windows`, then `nvm install 22.20.0` (or the
     latest 22.x) and `nvm use 22.20.0`.
   - macOS/Linux: `nvm install 22 && nvm use 22`.
2. From the repo root, with Node 22 active:
   ```bash
   node -v        # confirm it reports v22.x
   rm -rf node_modules apps/*/node_modules packages/*/node_modules database/node_modules
   pnpm install
   ```
   The `rm -rf` is required — a `node_modules` tree (and its
   platform/ABI-specific optional binaries, including esbuild's) that
   was resolved once under a different Node major version must be
   reinstalled, not reused, after switching Node versions.
3. Re-run the app as usual:
   ```bash
   pnpm db:generate
   pnpm backend
   ```

No `package.json` dependency versions, Prisma version, or `pnpm-lock.yaml`
content were changed to apply this fix — only the Node runtime used to
install/run the project.

## If the error persists after switching to Node 22

- Temporarily disable any antivirus/EDR "real-time protection" for the
  project folder and retry — some AV tools are known to interfere with
  Node's `child_process.spawn` on Windows and produce exactly
  `Error: spawn UNKNOWN`.
- Confirm the project path has no unusual characters and is not
  extremely deep (Windows `MAX_PATH` issues can also surface this way).
- As a last resort, delete pnpm's global store cache for esbuild and
  reinstall: `pnpm store prune` then repeat step 2 above.
