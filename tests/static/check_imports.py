#!/usr/bin/env python3
"""
Static project check with no npm packages:
  1. every relative import ("./x", "../y") in apps/*/src and packages/*/src resolves to a real file
  2. every "@/..." import in apps/frontend resolves under apps/frontend/src
  3. every route file imported by apps/backend/src/app.ts exists and every router it mounts is exported
  4. every <Route element={<Page/>}> in App.tsx refers to an imported component
Run: python3 tests/static/check_imports.py
"""
import re, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
EXT = [".ts", ".tsx", ".js", ".mjs", ".json", "/index.ts", "/index.tsx"]
bad = []
n = 0
def resolves(base: pathlib.Path):
    if base.exists() and base.is_file(): return True
    return any(pathlib.Path(str(base)+e).exists() for e in EXT)
files = [p for d in ("apps/backend/src","apps/frontend/src","apps/desktop","packages") for p in (ROOT/d).rglob("*") if p.suffix in (".ts",".tsx") and "node_modules" not in p.parts and "dist" not in p.parts]
pat = re.compile(r'(?:import|export)\s[^;]*?from\s+["\']([^"\']+)["\']|import\(\s*["\']([^"\']+)["\']\s*\)')
for f in files:
    src = f.read_text(encoding="utf8")
    for m in pat.finditer(src):
        spec = m.group(1) or m.group(2)
        if spec.startswith("."):
            n += 1
            if not resolves((f.parent/spec).resolve()): bad.append(f"{f.relative_to(ROOT)}: {spec}")
        elif spec.startswith("@/") and "apps/frontend" in str(f):
            n += 1
            if not resolves(ROOT/"apps/frontend/src"/spec[2:]): bad.append(f"{f.relative_to(ROOT)}: {spec}")
print(f"checked {n} relative/alias imports in {len(files)} files")
app = (ROOT/"apps/frontend/src/App.tsx").read_text(encoding="utf8")
imported = set(re.findall(r'^import\s+(\w+)\s+from', app, re.M))
for grp in re.findall(r'^import\s+\{([^}]*)\}\s+from', app, re.M):
    imported |= {x.strip().split(' as ')[-1] for x in grp.split(',') if x.strip()}
for comp in set(re.findall(r'element=\{<(\w+)', app)):
    if comp not in imported and comp not in ("Navigate",) and not re.search(rf'function {comp}\b|const {comp}\b', app):
        bad.append(f"App.tsx uses <{comp}> but it is not imported")
be = (ROOT/"apps/backend/src/app.ts").read_text(encoding="utf8")
for name, path in re.findall(r'import\s+\{\s*(\w+)\s*\}\s+from\s+"(\./modules/[^"]+)"', be):
    f = (ROOT/"apps/backend/src"/path)
    t = pathlib.Path(str(f)+".ts")
    if not t.exists(): bad.append(f"app.ts imports missing {path}"); continue
    if not re.search(rf'export\s+const\s+{name}\b', t.read_text(encoding="utf8")): bad.append(f"{path} does not export {name}")
for name in re.findall(r'app\.use\([^,]+,\s*(\w+Router)', be):
    if not re.search(rf'import\s+\{{\s*{name}\s*\}}', be): bad.append(f"app.ts mounts {name} without importing it")
print(f"routers mounted in app.ts: {len(re.findall(r'app.use\([^,]+,\s*\w+Router', be))}")
for b in bad: print("  FAIL ", b)
print("ALL STATIC CHECKS PASSED" if not bad else f"{len(bad)} PROBLEM(S)")
sys.exit(1 if bad else 0)
