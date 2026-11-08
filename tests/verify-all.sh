#!/bin/sh
# Verification that needs NO npm install: Python 3 + Node.js >= 22.18.
# They do NOT replace `pnpm test` / `pnpm build` (those need the project's dependencies).
#
# Exit code: 0 only if EVERY check passed. Any failing step, a missing tool, a too-old
# Node, or a test run that executed zero tests makes the whole script exit non-zero.
# The full output of a failing step is always printed (nothing is hidden by grep/tail).
set -u
cd "$(dirname "$0")/.." || exit 2

FAILED=0
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

# --- tool checks -------------------------------------------------------------
command -v python3 >/dev/null 2>&1 || { echo "FAIL: python3 not found"; exit 2; }
command -v node >/dev/null 2>&1 || { echo "FAIL: node not found"; exit 2; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
NODE_MINOR="$(node -p 'process.versions.node.split(".")[1]')"
echo "node $(node -v), python $(python3 -V 2>&1 | cut -d' ' -f2)"
# The Node-based checks run TypeScript directly via Node's built-in type stripping,
# which is enabled by default from Node 22.18.
if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 18 ]; }; then
  echo "FAIL: Node.js >= 22.18 is required (found $(node -v)). Use: nvm install 22 && nvm use 22"
  exit 2
fi
[ "$NODE_MAJOR" -gt 22 ] && echo "WARNING: the project targets Node 22 LTS (see .nvmrc); Node $NODE_MAJOR may break esbuild/tsx."

# --- step runner: keeps the REAL exit code of the command ---------------------
# usage: run "title" <min_tests|-> command args...
run() {
  title="$1"; min_tests="$2"; shift 2
  echo "== $title =="
  "$@" >"$LOG" 2>&1
  status=$?
  if [ "$status" -ne 0 ]; then
    cat "$LOG"
    echo "  -> FAILED (exit code $status)"
    FAILED=$((FAILED + 1))
    return 0
  fi
  if [ "$min_tests" != "-" ]; then
    # node --test prints "# tests N" / "# pass N" / "# fail N": require >= min_tests, all passing, none failing
    n_tests="$(sed -n 's/^# tests \([0-9][0-9]*\).*/\1/p' "$LOG" | tail -1)"
    n_pass="$(sed -n 's/^# pass \([0-9][0-9]*\).*/\1/p' "$LOG" | tail -1)"
    n_fail="$(sed -n 's/^# fail \([0-9][0-9]*\).*/\1/p' "$LOG" | tail -1)"
    if [ -z "$n_tests" ] || [ "$n_tests" -lt "$min_tests" ] || [ "${n_fail:-1}" -ne 0 ] || [ "${n_pass:-0}" -ne "$n_tests" ]; then
      cat "$LOG"
      echo "  -> FAILED (expected >= $min_tests tests, all passing; got tests=${n_tests:-?} pass=${n_pass:-?} fail=${n_fail:-?})"
      FAILED=$((FAILED + 1))
      return 0
    fi
    echo "  OK: $n_pass/$n_tests tests passed"
  else
    tail -1 "$LOG" | sed 's/^/  /'
  fi
}

run "1/5 database: migrations, upgrade-with-data, schema.prisma vs DB" - python3 tests/db/verify_migrations.py
run "2/5 data cleanup order vs foreign keys"                          - python3 tests/db/verify_cleanup_order.py
run "3/5 imports / routes"                                            - python3 tests/static/check_imports.py
run "4/5 accounting helpers (Node test runner)"                       9 node --test packages/shared-utils/src/accounting.test.mjs
run "5/5 purchase-invoice scenarios (real services, in-memory DB)"    12 node --import ./tests/scenario/register.mjs --test tests/scenario/purchase-scenarios.test.mjs

echo
if [ "$FAILED" -ne 0 ]; then
  echo "VERIFICATION FAILED: $FAILED step(s) failed"
  exit 1
fi
echo "ALL 5 VERIFICATION STEPS PASSED"
exit 0
