# Resources

`template.db` is generated here by `pnpm db:build-template` (run
automatically as part of `pnpm package:win`) — it is **not** committed
to the repo since it's a build artifact. If you see a build error about
a missing `template.db`, run:

```bash
pnpm db:build-template
```

This is the database every fresh install starts from: schema migrated,
permissions + Administrator role + one admin user, and deliberately
**no demo data** (unlike `pnpm db:seed`, which is dev-only).
