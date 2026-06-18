# step1-packages-db.md

`@repo/db` パッケージを新設し、Prisma schema / migrations / generated client / factory を `apps/api` から移設する。`packages/db` は **factory `createPrismaClient` のみを export** し、singleton は持たない。既存 `apps/api/src/prisma/prisma.client.ts` は **内部に singleton を持つ wrapper** に差し替えて既存 import (`import { prisma } from "../../prisma/prisma.client"`) を壊さず、step6 で wrapper 自体を削除する。

## 対応内容

### 1. ディレクトリ作成

```
packages/db/
├── package.json
├── tsconfig.json
├── eslint.config.js
├── .gitignore
├── prisma/
│   ├── schema.prisma            # apps/api/src/prisma/schema.prisma を移動
│   ├── prisma.config.ts         # apps/api/src/prisma/prisma.config.ts を移動
│   ├── seed.ts                  # apps/api/src/prisma/seed.ts を移動（dev users 含む全 seed）
│   └── migrations/              # apps/api/src/prisma/migrations/ を全移動
├── src/
│   ├── client.ts                # createPrismaClient factory + 接続文字列ヘルパ
│   └── index.ts
└── generated/                   # prisma generate の出力先 (tracked)
```

### 2. `packages/db/package.json`

```json
{
  "name": "@repo/db",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "sideEffects": false,
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist generated",
    "dev": "tsc --watch",
    "db:generate": "prisma generate --config=prisma/prisma.config.ts",
    "db:migrate": "prisma migrate dev --config=prisma/prisma.config.ts",
    "db:migrate:deploy": "prisma migrate deploy --config=prisma/prisma.config.ts",
    "db:push": "prisma db push --config=prisma/prisma.config.ts",
    "db:seed": "prisma db seed --config=prisma/prisma.config.ts",
    "db:studio": "prisma studio --config=prisma/prisma.config.ts",
    "lint": "eslint 'src/**/*.ts'",
    "lint:fix": "eslint 'src/**/*.ts' --fix",
    "postinstall": "prisma generate --config=prisma/prisma.config.ts"
  },
  "dependencies": {
    "@prisma/adapter-pg": "^7.7.0",
    "@prisma/client": "^7.2.0",
    "@prisma/extension-read-replicas": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^24.10.1",
    "@typescript-eslint/eslint-plugin": "^8.46.4",
    "@typescript-eslint/parser": "^8.46.4",
    "eslint": "^9.39.1",
    "prisma": "^7.2.0",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3"
  }
}
```

### 3. `packages/db/prisma/schema.prisma`

`apps/api/src/prisma/schema.prisma` を **そのまま** 移動。1 箇所だけ修正：

```diff
 generator client {
     provider     = "prisma-client"
-    output       = "./generated"
+    output       = "../generated"
     moduleFormat = "cjs"
 }
```

`output` は `prisma/` から見て `../generated` を指すため。

### 4. `packages/db/prisma/prisma.config.ts`

```typescript
import { defineConfig, env } from "prisma/config"

/**
 * DB_NAME 環境変数が設定されている場合、DATABASE_URL のDB名部分を置き換える
 * テスト実行時に DB_NAME=nodebase_test を指定することで、
 * テスト用DBにマイグレーションを適用できる
 */
const getDatasourceUrl = (): string => {
  const baseUrl = env("DATABASE_URL")
  const dbName = process.env.DB_NAME
  if (!dbName) return baseUrl
  return baseUrl.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`)
}

export default defineConfig({
  datasource: {
    url: getDatasourceUrl(),
  },
  migrations: {
    path: "./migrations",
    seed: "npx tsx ./prisma/seed.ts",
  },
  schema: "./schema.prisma",
})
```

### 5. `packages/db/prisma/seed.ts`

既存の `apps/api/src/prisma/seed.ts` をそのまま移設する。**seed は全 app 共通**（dev users / Memo サンプル等を一元管理）で、本番マスターデータは管理画面経由で投入する方針なのでこれで十分。

`@repo/db` 本体は factory のみを提供するが、`seed.ts` 自体は CLI スクリプトなので **`createPrismaClient` を 1 回呼んで 1 接続だけ使う**形にする。

```typescript
/* eslint-disable no-console */
import { createPrismaClient } from "../src/client"

const prisma = createPrismaClient()

/**
 * dev-login で使う開発用ユーザー
 *
 * `/api/auth/dev-login` および web の sign-in 画面の「Login as alice/bob」
 * ボタン経由でログインできる。production 環境では seed 自体スキップする。
 */
type DevUserSeed = {
  email: string
  name: string
}

const devUsers: DevUserSeed[] = [
  { email: "alice@dev.local", name: "Alice (dev)" },
  { email: "bob@dev.local", name: "Bob (dev)" },
]

const seedDevUsers = async () => {
  for (const devUser of devUsers) {
    const user = await prisma.user.upsert({
      create: { email: devUser.email, name: devUser.name },
      update: { name: devUser.name },
      where: { email: devUser.email },
    })

    await prisma.authAccount.upsert({
      create: {
        provider: "dev",
        providerAccountId: devUser.email,
        userId: user.id,
      },
      update: {},
      where: {
        provider_providerAccountId: {
          provider: "dev",
          providerAccountId: devUser.email,
        },
      },
    })
    console.log(`Seeded dev user: ${devUser.email} (id=${user.id})`)
  }
}

const main = async () => {
  if (process.env.NODE_ENV === "production") {
    console.log("Skip seeding: NODE_ENV=production")
    return
  }
  await seedDevUsers()
  console.log("Seed completed (PostgreSQL)")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

**ポイント**：

- `import { createPrismaClient } from "../src/client"` で `@repo/db` 自身の factory を相対 import 経由で使う（workspace 依存を自分自身に向けるのを避ける）
- スクリプトトップで `const prisma = createPrismaClient()` を 1 回だけ呼ぶ
- 新しい dev データ（サンプル Memo / カテゴリ等）を追加したくなったら、この `seed.ts` 内に `seedSampleMemos()` のような関数を増やして `main()` から呼ぶだけ
- `NODE_ENV === "production"` ガードを seed.ts 自身に持たせる（CLI から間違って本番 DB に向けて叩いても落ちる）

### 6. `packages/db/src/client.ts`

**factory のみを提供** する。`packages/db` 側に singleton を持たない。各 app の `src/index.ts` で 1 回呼んで Repository に DI で渡す。接続文字列ヘルパ (DB_NAME 上書きロジック) もこのファイル内にまとめる（別ファイルに切る程の規模ではないため）。

```typescript
import { PrismaPg } from "@prisma/adapter-pg"
import { readReplicas } from "@prisma/extension-read-replicas"

import { PrismaClient } from "../generated/client"

const DEFAULT_URL = "postgresql://postgres:password@localhost:5432/nodebase_dev"

/**
 * DATABASE_URL を取得しつつ、DB_NAME が指定されていれば DB 名部分を上書きする
 * テスト実行時の DB 切り替え（DB_NAME=nodebase_test）に対応
 */
const buildConnectionString = (): string => {
  const baseUrl = process.env.DATABASE_URL ?? DEFAULT_URL
  const dbName = process.env.DB_NAME
  if (!dbName) return baseUrl
  return baseUrl.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`)
}

export type CreatePrismaClientOptions = {
  /**
   * 接続文字列を明示指定する。省略時は process.env.DATABASE_URL (+ DB_NAME 上書き)
   */
  url?: string
  /**
   * read replica の接続文字列。省略時は process.env.DATABASE_REPLICA_URL を読み、
   * それも無ければ replica を使わない（primary のみで read/write 両方を扱う）
   */
  replicaUrl?: string
}

/**
 * PrismaClient のファクトリ
 * 各 app の src/index.ts で 1 回呼び、Repository コンストラクタに渡す。
 *
 * read replica が設定されている場合は @prisma/extension-read-replicas で自動振り分け：
 *   - findMany / findUnique / count / aggregate などの read → replica
 *   - create / update / delete / $transaction / $executeRaw → primary
 * 強整合性が必要な read は (prisma as any).$primary().user.findUnique(...) で primary 強制可能
 *
 * 戻り値は PrismaClient 型に揃えている（extension の戻り値は別型になるため、
 * Repository コンストラクタの互換性確保のためにキャストしている）。
 */
export const createPrismaClient = (options: CreatePrismaClientOptions = {}): PrismaClient => {
  const adapter = new PrismaPg(options.url ?? buildConnectionString())
  const base = new PrismaClient({ adapter })
  const replicaUrl = options.replicaUrl ?? process.env.DATABASE_REPLICA_URL
  if (!replicaUrl) return base
  const replicaAdapter = new PrismaPg(replicaUrl)
  const replica = new PrismaClient({ adapter: replicaAdapter })
  return base.$extends(readReplicas({ replicas: [replica] })) as unknown as PrismaClient
}
```

### 7. `packages/db/src/index.ts`

```typescript
export { createPrismaClient } from "./client"
export type { CreatePrismaClientOptions } from "./client"

/**
 * Prisma が生成するドメイン型を re-export
 * 利用側は import type { User, Memo } from "@repo/db" で参照できる
 */
export * from "../generated/client"
```

`prisma` singleton は **export しない**。各 app 側で `createPrismaClient()` を呼ぶ。

### 8. `packages/db/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "composite": true
  },
  "include": ["src/**/*.ts", "generated/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

`generated/` を `include` に入れることで、re-export した Prisma の型が `dist` にも出力される。

### 9. `packages/db/.gitignore`

```
dist/
generated/
node_modules/
```

### 10. `packages/db/eslint.config.js`

`packages/schema/eslint.config.js` をコピーし、`generated/` を ignore に追加。

```javascript
import baseConfig from "../../eslint.config.js"

export default [
  ...baseConfig,
  {
    ignores: ["dist/**", "generated/**", "node_modules/**"],
  },
]
```

### 11. `apps/api` 側の互換 wrapper

`apps/api/src/prisma/prisma.client.ts` を以下に差し替える。`@repo/db` は factory のみ提供なので、apps/api 内部で **暫定的に singleton を保持する** wrapper にして既存 import を壊さない。step6 でこの wrapper 自体を削除し、`src/index.ts` での DI assembly に置き換える。

```typescript
import { createPrismaClient } from "@repo/db"

/**
 * @deprecated step6 で削除予定。
 * 新規コードは src/index.ts で createPrismaClient() を呼び、
 * Repository に DI で渡すこと。
 */
export const prisma = createPrismaClient()
```

`apps/api/src/prisma/schema.prisma` / `migrations/` / `prisma.config.ts` / `seed.ts` / `generated/` は **物理的に packages/db へ移動**。`apps/api/src/prisma/` は `prisma.client.ts` のみ残る wrapper ディレクトリになる。

### 12. `apps/api/package.json` の修正

```diff
 {
   "scripts": {
-    "db:generate": "dotenvx run -f .env.local -- prisma generate --config=src/prisma/prisma.config.ts",
-    "db:migrate": "dotenvx run -f .env.local -- prisma migrate dev --config=src/prisma/prisma.config.ts",
-    "db:migrate:deploy": "dotenvx run -f .env.local -- prisma migrate deploy --config=src/prisma/prisma.config.ts",
-    "db:push": "dotenvx run -f .env.local -- prisma db push --config=src/prisma/prisma.config.ts",
-    "db:seed": "dotenvx run -f .env.local -- prisma db seed --config=src/prisma/prisma.config.ts",
-    "db:studio": "dotenvx run -f .env.local -- prisma studio --config=src/prisma/prisma.config.ts",
+    "db:generate": "dotenvx run -f .env.local -- pnpm --filter @repo/db db:generate",
+    "db:migrate": "dotenvx run -f .env.local -- pnpm --filter @repo/db db:migrate",
+    "db:migrate:deploy": "dotenvx run -f .env.local -- pnpm --filter @repo/db db:migrate:deploy",
+    "db:push": "dotenvx run -f .env.local -- pnpm --filter @repo/db db:push",
+    "db:seed": "dotenvx run -f .env.local -- pnpm --filter @repo/db db:seed",
+    "db:studio": "dotenvx run -f .env.local -- pnpm --filter @repo/db db:studio",
   }
 }
```

apps/api は **dotenvx で .env.local を復号化して `pnpm --filter @repo/db db:*` に渡すラッパー** だけを持つ。seed の中身（dev-login 用 alice / bob 等）は `packages/db/prisma/seed.ts` に集約されているため、apps/api 側に seed スクリプトを置く必要はない。

```diff
   "dependencies": {
-    "@prisma/adapter-pg": "^7.7.0",
-    "@prisma/client": "^7.2.0",
+    "@repo/db": "workspace:^",
     "@repo/api-schema": "workspace:^",
```

```diff
   "devDependencies": {
-    "prisma": "^7.2.0",
```

`@prisma/*` / `prisma` 本体の依存は `@repo/db` 側に集約され、apps/api からは消える。

### 13. `turbo.json` への追記

```jsonc
{
  "tasks": {
    "@repo/db#db:generate": {
      "cache": false,
      "inputs": ["prisma/schema.prisma"],
      "outputs": ["generated/**"]
    },
    "build": {
      "dependsOn": ["^build", "@repo/db#db:generate"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**", "build/**", "generated/**"]
    }
  }
}
```

## 動作確認

### 単体確認

```bash
# packages/db 単体でビルドできる
cd packages/db
pnpm install
pnpm db:generate
pnpm build

# generated client が出力されている
ls packages/db/generated/client/

# dist に re-export された型が出ている
test -f packages/db/dist/index.d.ts && echo OK
```

### apps/api 側の確認

```bash
# api ビルドが通る（@repo/db からの factory import が解決される）
cd apps/api
pnpm build

# 既存の互換 wrapper (内部で createPrismaClient を呼んで singleton 化) 経由で動く
node -e "const { prisma } = require('./dist/prisma/prisma.client'); console.log(typeof prisma.user.findMany)"
```

### migration / seed の動作

```bash
# api 側の wrapper コマンドから migration が走る（実体は @repo/db の prisma migrate）
cd apps/api
pnpm db:migrate:deploy

# seed が @repo/db の seed.ts から実行される（apps/api 側はラッパーだけ）
pnpm db:seed

# alice / bob が投入されている
pnpm db:studio
```

### テスト

```bash
# apps/api の既存テスト（service / controller）が全て通る
cd apps/api
pnpm test:ci
```

**ゴール**: この step 完了時点で、`apps/api` の既存テストが緑のまま、Prisma 関連のファイルが `packages/db` に物理的に移動している状態。`@repo/db` は **factory のみ export**、`apps/api/src/prisma/prisma.client.ts` は **`createPrismaClient()` を呼んで singleton 化する暫定 wrapper** になる。step6 でこの wrapper も削除して `apps/api/src/index.ts` に DI assembly を集約する。
