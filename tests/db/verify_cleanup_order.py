#!/usr/bin/env python3
"""
Static verification of the "clear operational data" feature against schema.prisma:
  1. Every table that references another deleted table (foreign key) is deleted
     BEFORE the table it references (otherwise the real delete would fail).
  2. The tables that are NOT deleted are exactly the ones that must survive
     (users, roles/permissions, settings, audit log, ...).
Run: python3 tests/db/verify_cleanup_order.py
"""
import re, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
schema = (ROOT/"database/prisma/schema.prisma").read_text(encoding="utf8")
repo = (ROOT/"apps/backend/src/modules/data-cleanup/data-cleanup.repository.ts").read_text(encoding="utf8")

order = re.findall(r'"(\w+)",', re.search(r"const DELETE_ORDER = \[(.*?)\] as const", repo, re.S).group(1))
tx = re.findall(r"prisma\.(\w+)\.deleteMany\(\)", repo)
cap = lambda n: n[0].upper()+n[1:]
fails = []
def check(c, m):
    print(("  PASS  " if c else "  FAIL  ")+m)
    if not c: fails.append(m)

check([cap(t) for t in tx] == order, "the actual $transaction runs in the same order as DELETE_ORDER")
models = {}
for m in re.finditer(r"^model\s+(\w+)\s*\{(.*?)^\}", schema, re.S|re.M):
    models[m.group(1)] = m.group(2)
deps = []  # (child, parent)
for name, body in models.items():
    for rel in re.finditer(r"^\s*\w+\s+(\w+)\??\s+@relation\(fields:", body, re.M):
        deps.append((name, rel.group(1)))
pos = {n:i for i,n in enumerate(order)}
for child, parent in deps:
    if child in pos and parent in pos:
        check(pos[child] < pos[parent], f"{child} deleted before {parent}")
    elif parent in pos and child not in pos:
        check(False, f"{child} references {parent} but is not deleted (delete would fail)")
kept = sorted(set(models) - set(order))
print("  kept tables:", ", ".join(kept))
must_keep = {"User","Role","Permission","RolePermission","Session","ApplicationSettings","AuditLog"}
check(must_keep <= set(kept), "users, roles, permissions, sessions, settings and audit log are preserved")
check(not (set(order) & must_keep), "no preserved table appears in DELETE_ORDER")
sys.exit(1 if fails else 0)
