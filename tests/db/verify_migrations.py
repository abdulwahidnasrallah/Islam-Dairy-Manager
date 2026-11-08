#!/usr/bin/env python3
"""
Database verification that needs NO npm packages (Python + sqlite3 only):

  1. Fresh database  : every migration applies cleanly, in order.
  2. Existing database: migrations up to the previous one are applied, rows are
     inserted, then the newest migrations are applied -> data must survive and
     the backfill must be correct (no data loss).
  3. schema.prisma vs. migrations: every model/column/unique/index/foreign key
     declared in schema.prisma exists in the migrated SQLite database (and
     vice-versa for columns), so Prisma Client and the DB cannot disagree on a
     field name.
  4. Foreign keys are really enforced.

Usage:  python3 tests/db/verify_migrations.py
Exit code 0 = everything passed.
"""
import re, sqlite3, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
MIG = ROOT / "database" / "prisma" / "migrations"
SCHEMA = (ROOT / "database" / "prisma" / "schema.prisma").read_text(encoding="utf8")
migrations = sorted(p for p in MIG.iterdir() if p.is_dir())
failures = []

def check(cond, msg):
    print(("  PASS  " if cond else "  FAIL  ") + msg)
    if not cond:
        failures.append(msg)

def apply(conn, dirs):
    for d in dirs:
        conn.executescript((d / "migration.sql").read_text(encoding="utf8"))

# ---------- 1. fresh database ----------
print("1) fresh database")
fresh = sqlite3.connect(":memory:")
try:
    apply(fresh, migrations)
    check(True, f"all {len(migrations)} migrations apply in order")
except Exception as e:
    check(False, f"fresh apply failed: {e}")

# ---------- 2. existing database with data ----------
print("2) existing database keeps its data")
old = sqlite3.connect(":memory:")
apply(old, migrations[:-1])  # everything except the newest migration
old.execute("PRAGMA foreign_keys=ON")
now = "2026-09-01 10:00:00"
old.execute("INSERT INTO Supplier (id,name,createdAt,updatedAt) VALUES ('s1','مورد',?,?)", (now, now))
old.execute("INSERT INTO Product (id,name,unit,sellingPrice,minStockAlert,isActive,createdAt,updatedAt) VALUES ('p1','منتج','KG',10,0,1,?,?)", (now, now))
old.execute("INSERT INTO PurchaseInvoice (id,purchaseNumber,supplierId,date,totalAmount,paidAmount,remainingAmount,paymentMethod,status,createdAt,updatedAt) VALUES ('i1','PUR-000001','s1',?,100,40,60,'CASH','CONFIRMED',?,?)", (now, now, now))
old.execute("INSERT INTO SupplierPayment (id,supplierId,amount,date,method,createdAt) VALUES ('pay1','s1',25,?,'CASH',?)", (now, now))
old.commit()
before_inv = old.execute("SELECT id,totalAmount,paidAmount,remainingAmount FROM PurchaseInvoice").fetchall()
before_pay = old.execute("SELECT id,supplierId,amount FROM SupplierPayment").fetchall()
try:
    old.executescript((migrations[-1] / "migration.sql").read_text(encoding="utf8"))
    check(True, f"newest migration ({migrations[-1].name}) applies on a populated database")
except Exception as e:
    check(False, f"upgrade failed: {e}")
after_inv = old.execute("SELECT id,totalAmount,paidAmount,remainingAmount FROM PurchaseInvoice").fetchall()
after_pay = old.execute("SELECT id,supplierId,amount FROM SupplierPayment").fetchall()
check(before_inv == after_inv, "existing purchase invoices unchanged")
check(before_pay == after_pay, "existing supplier payments unchanged")
init = old.execute("SELECT initialPaidAmount FROM PurchaseInvoice WHERE id='i1'").fetchone()
check(init is not None and init[0] == 40, "initialPaidAmount backfilled = paidAmount for existing invoices")
pl = old.execute("SELECT purchaseInvoiceId, idempotencyKey FROM SupplierPayment WHERE id='pay1'").fetchone()
check(pl == (None, None), "existing payments stay unlinked (general payments)")

# ---------- 4. foreign keys / unique enforced ----------
print("3) constraints are enforced")
fresh.execute("PRAGMA foreign_keys=ON")
def raises(sql, args=()):
    try:
        fresh.execute(sql, args); return False
    except sqlite3.IntegrityError:
        return True
    finally:
        fresh.rollback()
check(raises("INSERT INTO SupplierPayment (id,supplierId,amount,date,method,createdAt) VALUES ('x','NO_SUCH',1,'2026','CASH','2026')"),
      "payment with unknown supplier rejected (FK)")
fresh.execute("INSERT INTO Supplier (id,name,createdAt,updatedAt) VALUES ('s1','m','2026','2026')")
fresh.commit()
check(raises("INSERT INTO SupplierPayment (id,supplierId,amount,date,method,createdAt,purchaseInvoiceId) VALUES ('x','s1',1,'2026','CASH','2026','NO_SUCH_INV')"),
      "payment linked to unknown invoice rejected (FK)")
fresh.execute("INSERT INTO PurchaseInvoice (id,purchaseNumber,supplierId,date,totalAmount,remainingAmount,updatedAt,idempotencyKey) VALUES ('i1','PUR-1','s1','2026',10,10,'2026','K-1')")
fresh.commit()
check(raises("INSERT INTO PurchaseInvoice (id,purchaseNumber,supplierId,date,totalAmount,remainingAmount,updatedAt,idempotencyKey) VALUES ('i2','PUR-2','s1','2026',10,10,'2026','K-1')"),
      "duplicate invoice idempotencyKey rejected (UNIQUE)")
check(raises("INSERT INTO PurchaseInvoice (id,purchaseNumber,supplierId,date,totalAmount,remainingAmount,updatedAt) VALUES ('i3','PUR-1','s1','2026',10,10,'2026')"),
      "duplicate purchaseNumber rejected (UNIQUE)")
fresh.execute("INSERT INTO SupplierPayment (id,supplierId,amount,date,method,createdAt,idempotencyKey) VALUES ('p1','s1',1,'2026','CASH','2026','PK-1')")
fresh.commit()
check(raises("INSERT INTO SupplierPayment (id,supplierId,amount,date,method,createdAt,idempotencyKey) VALUES ('p2','s1',1,'2026','CASH','2026','PK-1')"),
      "duplicate payment idempotencyKey rejected (UNIQUE)")
fresh.execute("INSERT INTO SupplierPayment (id,supplierId,amount,date,method,createdAt) VALUES ('p3','s1',1,'2026','CASH','2026')")
fresh.execute("INSERT INTO SupplierPayment (id,supplierId,amount,date,method,createdAt) VALUES ('p4','s1',1,'2026','CASH','2026')")
fresh.commit()
check(True, "several payments without a key are allowed (NULLs are distinct)")

# ---------- 3. schema.prisma vs database ----------
print("4) schema.prisma matches the migrated database")
SCALARS = {"String","Int","Float","Boolean","DateTime","BigInt","Decimal","Json","Bytes"}
models = {}
for m in re.finditer(r"^model\s+(\w+)\s*\{(.*?)^\}", SCHEMA, re.S | re.M):
    name, body = m.group(1), m.group(2)
    cols = {}
    for line in body.splitlines():
        line = line.split("//")[0].strip()
        if not line or line.startswith("@@"):
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        fname, ftype = parts[0], parts[1]
        base = ftype.rstrip("?").rstrip("[]")
        if base in SCALARS and not ftype.endswith("[]"):
            cols[fname] = {"optional": ftype.endswith("?"), "unique": "@unique" in line or "@id" in line}
    idx = re.findall(r"@@index\(\[([^\]]+)\]\)", body)
    uq = re.findall(r"@@unique\(\[([^\]]+)\]\)", body)
    models[name] = {"cols": cols, "index": [tuple(x.strip() for x in i.split(",")) for i in idx],
                    "unique": [tuple(x.strip() for x in i.split(",")) for i in uq]}

db_tables = {r[0] for r in fresh.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'")}
check(set(models) == db_tables, f"tables match ({len(models)} models)"
      + ("" if set(models) == db_tables else f" model-only={set(models)-db_tables} db-only={db_tables-set(models)}"))
for name, info in sorted(models.items()):
    if name not in db_tables:
        continue
    dbcols = {r[1]: r for r in fresh.execute(f'PRAGMA table_info("{name}")')}
    miss = set(info["cols"]) - set(dbcols)
    extra = set(dbcols) - set(info["cols"])
    bad_null = [c for c, i in info["cols"].items() if c in dbcols and bool(dbcols[c][3]) == i["optional"] and dbcols[c][5] == 0]
    check(not miss and not extra and not bad_null,
          f"{name}: columns match" + (f" missing={miss}" if miss else "") + (f" extra={extra}" if extra else "") + (f" nullability={bad_null}" if bad_null else ""))
    db_idx = {}
    for r in fresh.execute(f'PRAGMA index_list("{name}")'):
        cols = tuple(c[2] for c in fresh.execute(f'PRAGMA index_info("{r[1]}")'))
        db_idx[cols] = r[2]  # 1 = unique
    for cols in info["index"]:
        check(cols in db_idx, f"{name}: index on {cols}")
    for cols in info["unique"]:
        check(db_idx.get(cols) == 1, f"{name}: unique on {cols}")
    for c, i in info["cols"].items():
        if i["unique"] and c != "id":
            check(db_idx.get((c,)) == 1, f"{name}: unique on ({c},)")

# foreign keys declared via @relation(fields: [...], references: [...])
for m in re.finditer(r"^model\s+(\w+)\s*\{(.*?)^\}", SCHEMA, re.S | re.M):
    name, body = m.group(1), m.group(2)
    for rel in re.finditer(r"@relation\(fields:\s*\[(\w+)\],\s*references:\s*\[(\w+)\]", body):
        fk = {r[3] for r in fresh.execute(f'PRAGMA foreign_key_list("{name}")')}
        check(rel.group(1) in fk, f"{name}.{rel.group(1)} has a foreign key")

print()
if failures:
    print(f"{len(failures)} CHECK(S) FAILED"); sys.exit(1)
print("ALL DATABASE CHECKS PASSED"); sys.exit(0)
