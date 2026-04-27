# Prisma + D1 + Hono (Reusable Notes)

## 1) Packages installed

```bash
pnpm install prisma --save-dev
npx prisma init
pnpm install @prisma/client
pnpm install @prisma/adapter-d1
```

## 2) Prisma schema used in this project

`prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
}
```

Notes:
- With `provider = "prisma-client"`, import Prisma client from generated path, not `@prisma/client`.
- D1 is SQLite-based, so `provider = "sqlite"` is correct.

## 3) D1 binding (wrangler.json)

This project uses `wrangler.json` (not `wrangler.toml`):

```json
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "push-notif",
    "database_id": "ac43e80c-75af-4881-ac19-18c50bd4f994"
  }
]
```

`binding: "DB"` means accessible in Worker as `env.DB`.

## 4) Migration flow used (working)

Create migration file:

```bash
npx wrangler d1 migrations create push-notif create_user_table
```

Generate SQL from Prisma schema (Prisma v7+ syntax):

```bash
npx prisma migrate diff --from-empty --to-schema ./prisma/schema.prisma --script --output ./migrations/0001_create_user_table.sql
```

Apply migrations:

```bash
npx wrangler d1 migrations apply push-notif --local
npx wrangler d1 migrations apply push-notif --remote
```

Generate Prisma client:

```bash
npx prisma generate --schema ./prisma/schema.prisma
```

Generate Worker types:

```bash
npx wrangler types
```

## 5) Prisma client for D1

`src/worker/lib/prismaClient.ts`

```ts
import { PrismaClient } from "../../generated/prisma/client"
import { PrismaD1 } from "@prisma/adapter-d1"

const prismaClients = {
  async fetch(db: D1Database) {
    const adapter = new PrismaD1(db)
    return new PrismaClient({ adapter })
  },
}

export default prismaClients
```

## 6) Worker usage pattern

In Hono worker, use typed bindings:

```ts
const app = new Hono<{ Bindings: Env }>()
```

Then:

```ts
const prisma = await prismaClients.fetch(c.env.DB)
```

## 7) Issues we hit (and fixes)

- `--to-schema-datamodel` removed -> use `--to-schema`.
- `zsh: parse error near ')'` -> caused by copy/pasted comment line in shell.
- `Module '@prisma/client' has no exported member PrismaClient` -> import from `src/generated/prisma/client` when using `provider = "prisma-client"`.
- `Cannot find name 'D1Database'` -> keep D1-related code in worker scope so `worker-configuration.d.ts` types are available.
