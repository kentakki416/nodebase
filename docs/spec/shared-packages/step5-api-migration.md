# step5-api-migration.md

step1〜4 で導入した `@repo/db` / `@repo/logger` / `@repo/errors` / `@repo/redis` を `apps/api` の全コードに浸透させ、互換 wrapper と旧パスを完全削除する。**併せて `apps/api/src/env.ts` を新設して起動時 env 検証を導入** する。`@repo/db` / `@repo/redis` は **factory のみ提供** なので、この step で `apps/api/src/index.ts` を **DI assembly** に書き換えて Repository に client を渡す形に統一する。step1〜4 完了時点で wrapper 経由でも動く状態が維持されていることが前提。

## 対応内容

### 1. `apps/api/src/env.ts` を新設して起動時 env 検証を導入

`apps/api/src/env.ts` に Zod スキーマと検証ロジックをインラインで定義する。`@repo/db` / `@repo/logger` / `@repo/redis` が `process.env` から読む env も含めて、apps/api が必要とする env を 1 ファイルで宣言する。

```typescript
import { z } from "zod"

const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),

  /** @repo/db が読む */
  DATABASE_URL: z.string().url().optional(),
  DATABASE_REPLICA_URL: z.string().url().optional(),
  DB_NAME: z.string().optional(),

  /** @repo/redis が読む */
  REDIS_URL: z.string().url().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().int().positive().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().min(0).optional(),

  /** @repo/logger が読む */
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOGGER_TYPE: z.enum(["pino", "winston", "console", "silent"]).default("pino"),

  /** apps/api 固有 */
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().default("dummy"),
  GOOGLE_CLIENT_SECRET: z.string().default("dummy"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRATION: z.string().default("15m"),
  JWT_REFRESH_EXPIRATION: z.string().default("7d"),
  ADMIN_USE_DUMMY: z.enum(["true", "false"]).transform((v) => v === "true").default("false"),
})

const result = apiEnvSchema.safeParse(process.env)
if (!result.success) {
  console.error("❌ Invalid environment variables:")
  console.error(JSON.stringify(result.error.format(), null, 2))
  process.exit(1)
}

export const env = result.data
export type ApiEnv = typeof env
```

**ポイント**：

- `import { env } from "./env"` を `apps/api/src/index.ts` の **最上位に置く** ことで、env 検証が起動時の最初に走る
- shared package が読む env も apps/api 側で宣言する。shared package 自身は `process.env` から直接読むが、apps/api の `env.ts` で Zod 宣言しておくことで「shared package が必要とする env が揃っているか」を起動時に保証できる
- `dotenvx` による暗号化 `.env.local` の読み込みは `apps/api/package.json` の scripts で行う（`dotenvx run -f .env.local -- ...`）。`env.ts` は「読み込み済みの `process.env`」を検証する責務だけを持つ

### 2. `apps/api/src/index.ts` を DI assembly に書き換え

最上位で `createPrismaClient()` / `createRedisClient()` を 1 回呼び、Repository コンストラクタに渡す。SIGTERM で graceful shutdown する。

```typescript
import { createPrismaClient } from "@repo/db"
import { logger } from "@repo/logger"
import { createRedisClient } from "@repo/redis"
import express from "express"

import { env } from "./env"
import { authRouter } from "./routes/auth-router"
import { memoRouter } from "./routes/memo-router"
import { PrismaMemoRepository } from "./repository/prisma/memo-repository"
import { PrismaUserRepository } from "./repository/prisma/user-repository"
import { IoRedisRefreshTokenRepository } from "./repository/redis/refresh-token-repository"
/** ... 他の Controller / Router import ... */

/** インフラ client の生成（プロセス起動時 1 回だけ） */
const prisma = createPrismaClient()
const redis = createRedisClient()

/** Repository の DI assembly */
const memoRepository = new PrismaMemoRepository(prisma)
const userRepository = new PrismaUserRepository(prisma)
const refreshTokenRepository = new IoRedisRefreshTokenRepository(redis)

/** Controller の DI assembly */
const memoListController = new MemoListController(memoRepository)
/** ... 他の Controller も同様に組み立て ... */

/** Express app */
const app = express()
app.use(express.json())
app.use("/api/memo", memoRouter({ list: memoListController, /* ... */ }))
app.use("/api/auth", authRouter({ /* ... */ }))
app.use(errorHandler)

const server = app.listen(env.PORT, () => {
  logger.info("api started", { port: env.PORT })
})

/** Graceful shutdown */
const shutdown = async (signal: string) => {
  logger.info("shutdown initiated", { signal })
  server.close(async () => {
    await prisma.$disconnect()
    await redis.quit()
    logger.info("shutdown completed")
    process.exit(0)
  })
}
process.on("SIGTERM", () => void shutdown("SIGTERM"))
process.on("SIGINT", () => void shutdown("SIGINT"))
```

**ポイント**：

- `createPrismaClient()` / `createRedisClient()` は **トップレベルで 1 回だけ** 呼ぶ
- 全 Repository に同じ `prisma` / `redis` インスタンスを渡す（中で再生成しない）
- `process.on("SIGTERM", ...)` で必ず接続をクローズする（ECS が SIGTERM を送ってから 30 秒以内に終了する必要があるため）

### 3. import パスの一括書き換え

`apps/api/src/` 配下の **すべての ts ファイル** で以下の置換を行う。

| 旧 import | 新 import |
| --- | --- |
| `from "../../prisma/prisma.client"` / `from "../prisma/prisma.client"` 等 | **削除**（singleton import を廃止。Repository は constructor で受け取る） |
| `from "../../prisma/generated/client"` 等 | `from "@repo/db"` |
| `from "../../log"` / `from "../log"` 等 | `from "@repo/logger"` |
| `from "../../types/result"` / `from "../types/result"` 等 | `from "@repo/errors"` |
| `from "../../const"` で `LOGGER_TYPE` を取っている箇所 | `from "@repo/logger"` |
| `from "../../client/redis"` / `from "../client/redis"` 等 | **削除**（singleton import を廃止。Repository は constructor で受け取る） |
| `import Redis from "ioredis"` / `import type Redis from "ioredis"` | `import type { Redis } from "@repo/redis"` または `import { IoRedis } from "@repo/redis"` |

#### Repository / Controller の見直し

既存パターンを確認：

```typescript
// repository/prisma/memo-repository.ts
import type { PrismaClient } from "@repo/db"

export interface MemoRepository { /* ... */ }

export class PrismaMemoRepository implements MemoRepository {
  constructor(private readonly prisma: PrismaClient) {}
  /** ... */
}
```

Repository は **既に constructor で受け取っている** ので変更不要。singleton から脱却するのは「`apps/api/src/index.ts` で `prisma` をどう得るか」だけ。

#### sed での一括書き換え例（参考）

```bash
cd apps/api
# Prisma generated 型のみ @repo/db に振り替え（prisma.client wrapper は import 自体を消す必要があるので sed では危険）
find src -name "*.ts" -exec sed -i '' \
  -e 's|from "\(\.\./\)*prisma/generated/client"|from "@repo/db"|g' \
  {} \;
# Logger
find src -name "*.ts" -exec sed -i '' \
  -e 's|from "\(\.\./\)*log"|from "@repo/logger"|g' \
  {} \;
# Result
find src -name "*.ts" -exec sed -i '' \
  -e 's|from "\(\.\./\)*types/result"|from "@repo/errors"|g' \
  {} \;
```

**`prisma.client` wrapper と `client/redis` wrapper の import 削除は手動で確認しながら行う**。sed で機械的に消すと依存ツリーが壊れる箇所があるため。grep で残りを潰す：

```bash
grep -rn "prisma\.client\|client/redis" apps/api/src
```

**自動置換後は必ず `pnpm lint:fix` を実行**して import 順序ルール（builtin → external → @repo → parent → sibling）に揃える。

#### test/ 配下も同様

```bash
cd apps/api
find test -name "*.ts" -exec sed -i '' \
  -e 's|from "\(\.\./\)*src/log"|from "@repo/logger"|g' \
  -e 's|from "\(\.\./\)*src/types/result"|from "@repo/errors"|g' \
  {} \;
```

test setup の `prisma` / `redis` 入手経路は次節で書き換える。

### 4. `process.env.XXX` 参照を `env` に置き換え

`apps/api/src/env.ts` で export された `env` を使うように、以下の参照箇所を書き換える：

| 旧 | 新 |
| --- | --- |
| `process.env.PORT` | `env.PORT` |
| `process.env.JWT_SECRET` | `env.JWT_SECRET` |
| `process.env.GOOGLE_CLIENT_ID` | `env.GOOGLE_CLIENT_ID` |
| `process.env.GOOGLE_CLIENT_SECRET` | `env.GOOGLE_CLIENT_SECRET` |
| `process.env.REDIS_URL` | `env.REDIS_URL` |
| `process.env.ADMIN_USE_DUMMY === "true"` | `env.ADMIN_USE_DUMMY` (既に boolean) |

ただし以下は **`process.env` のままにする**：

- `process.env.NODE_ENV` の比較で多重ガードに使われているもの（`packages/db` の connection-string、`@repo/logger` の factory、`@repo/redis` の buildOptionsFromEnv など、env 検証前に評価される箇所）
- dev-login の多重ガード（`apps/api/src/index.ts` の `NODE_ENV !== "production"` チェック）— 本番混入リスクを下げるため、env 経由ではなく直接 `process.env.NODE_ENV` で判定する設計を維持
- `DB_NAME`（テスト DB 切替）— `prisma migrate` CLI から渡される動的 env
- `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB` — `@repo/redis` 内部のフォールバックで使われる（後方互換）。`apps/api` は `REDIS_URL` 一本に統一する

### 5. 旧ファイルの物理削除

| 削除対象 | 理由 |
| --- | --- |
| `apps/api/src/prisma/prisma.client.ts` | wrapper 削除（`createPrismaClient` を src/index.ts で呼ぶ） |
| `apps/api/src/prisma/` ディレクトリごと | schema/migrations/seed/generated は step1 で `packages/db/` に移設済み |
| `apps/api/src/log/index.ts` | wrapper 削除 |
| `apps/api/src/log/` ディレクトリごと | 実装は step2 で `packages/logger/` に移設済み |
| `apps/api/src/types/result.ts` | wrapper 削除 |
| `apps/api/src/client/redis.ts` | wrapper 削除（`createRedisClient` を src/index.ts で呼ぶ） |
| `apps/api/src/const/index.ts` 内の `LOGGER_TYPE` 定義 | `@repo/logger` から re-export に切替済み |

#### 削除後の `apps/api/src/const/index.ts`

```typescript
export { LOGGER_TYPE } from "@repo/logger"

/**
 * LOGレベル
 */
export const LOG_LEVEL = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
} as const

/**
 * Nodeの環境
 */
export const NODE_ENV = {
  DEV: "development",
  PRD: "production",
} as const

/** ... PUBLIC_PATHS / LOG_EXCLUDE_PATHS / DEV_ONLY_PUBLIC_PATHS はそのまま ... */
```

#### `apps/api/src/client/` の扱い

`apps/api/src/client/google-oauth.ts` は **API 固有（Google OAuth クライアント）** なのでそのまま残す。redis.ts を削除すると `client/` ディレクトリには google-oauth.ts だけが残る形。

### 6. テストファイルの更新

`apps/api/test/setup.ts` も **factory ベース** に統一する：

```typescript
// apps/api/test/setup.ts
import { createPrismaClient } from "@repo/db"
import { createRedisClient } from "@repo/redis"

/**
 * テスト専用の Prisma client。
 * package.json の test スクリプトで DB_NAME=nodebase_test を設定済みなので、
 * createPrismaClient() がそのまま test DB に繋がる。
 * テスト全体で 1 つだけ作って使い回す。
 */
export const testPrisma = createPrismaClient()

/**
 * テスト専用の Redis client (db: 1 を使ってアプリの cache と分離)
 */
export const testRedis = createRedisClient({
  options: { db: 1 },
})

export const cleanupTestData = async () => {
  await testPrisma.memo.deleteMany()
  await testPrisma.authAccount.deleteMany()
  await testPrisma.user.deleteMany()
}

export const cleanupTestRedis = async () => {
  await testRedis.flushdb()
}

export const disconnectTestDb = async () => {
  await testPrisma.$disconnect()
}

export const disconnectTestRedis = async () => {
  await testRedis.quit()
}
```

#### Controller インテグレーションテストでの DI assembly

`apps/api/test/controller/*.test.ts` のテスト app セットアップでは、`testPrisma` / `testRedis` を Repository に注入する：

```typescript
import express from "express"
import request from "supertest"

import { attachErrorHandler, createTestApp } from "../helper"
import { testPrisma, testRedis, cleanupTestData, cleanupTestRedis } from "../setup"
import { PrismaMemoRepository } from "../../src/repository/prisma/memo-repository"
import { memoRouter } from "../../src/routes/memo-router"
import { MemoListController } from "../../src/controller/memo/list"

const memoRepository = new PrismaMemoRepository(testPrisma)
const memoListController = new MemoListController(memoRepository)

const app = createTestApp()
app.use("/api/memo", memoRouter({ list: memoListController }))
attachErrorHandler(app)

describe("GET /api/memo", () => {
  beforeEach(async () => {
    await cleanupTestData()
    await cleanupTestRedis()
  })

  /** ... */
})
```

CLAUDE.md の方針（自前 Postgres / Redis は本物を使う、外部 SaaS だけ mock）はそのまま維持。違いは **「`testPrisma` の入手経路が singleton import から `createPrismaClient()` の戻り値になっただけ」**。

### 7. dotenvx wrapper コマンドの整理

`apps/api/package.json` の `db:*` スクリプトは step1 で既に書き換え済み。最終形を確認する：

```json
{
  "scripts": {
    "db:generate": "dotenvx run -f .env.local -- pnpm --filter @repo/db db:generate",
    "db:migrate": "dotenvx run -f .env.local -- pnpm --filter @repo/db db:migrate",
    "db:migrate:deploy": "dotenvx run -f .env.local -- pnpm --filter @repo/db db:migrate:deploy",
    "db:push": "dotenvx run -f .env.local -- pnpm --filter @repo/db db:push",
    "db:seed": "dotenvx run -f .env.local -- pnpm --filter @repo/db db:seed",
    "db:studio": "dotenvx run -f .env.local -- pnpm --filter @repo/db db:studio",
    "test": "DB_NAME=nodebase_test dotenvx run -f .env.local -- pnpm --filter @repo/db db:migrate:deploy && vitest run",
    "test:ci": "pnpm --filter @repo/db db:generate && pnpm --filter @repo/db db:migrate:deploy && vitest run",
    "test:coverage": "DB_NAME=nodebase_test dotenvx run -f .env.local -- pnpm --filter @repo/db db:migrate:deploy && vitest run --coverage"
  }
}
```

### 8. `apps/api/package.json` の依存最終形

```diff
   "dependencies": {
     "@repo/api-schema": "workspace:^",
     "@repo/db": "workspace:^",
     "@repo/errors": "workspace:^",
     "@repo/logger": "workspace:^",
     "@repo/redis": "workspace:^",
     "cors": "^2.8.5",
     "express": "^5.1.0",
     "google-auth-library": "^10.5.0",
-    "ioredis": "^5.10.0",
     "jsonwebtoken": "^9.0.3",
-    "pino": "^10.1.0",
-    "pino-pretty": "^13.1.3",
     "uuid": "^13.0.0",
-    "winston": "^3.19.0",
     "zod": "^3.25.76"
   },
   "devDependencies": {
-    "@prisma/adapter-pg": "^7.7.0",
-    "@prisma/client": "^7.2.0",
-    "prisma": "^7.2.0",
     "tsx": "^4.21.0",
     "typescript": "^5.9.3"
   }
```

`@prisma/*` / `prisma` / `pino` / `pino-pretty` / `winston` / `ioredis` の直接依存はすべて消える。

### 9. ルート `pnpm dev` / `pnpm build` の確認

`turbo.json` の `build` タスクが `@repo/db#db:generate` を `dependsOn` に持っているため、`pnpm build` をルートで叩くと自動的に：

1. `@repo/db` の prisma generate
2. `@repo/errors` / `@repo/logger` / `@repo/redis` / `@repo/api-schema` / `@repo/db` の build
3. `apps/api` / `apps/web` / `apps/admin` の build

の順で実行される。

### 10. CLAUDE.md の更新

`apps/api/CLAUDE.md` の以下を更新：

- Repository / Service の例で `import { ApiError } from "../types/result"` → `from "@repo/errors"` に書き換え
- Redis Repository の例で `import Redis from "ioredis"` → `import type { Redis } from "@repo/redis"` に書き換え
- **「DI（依存性注入）」セクションを更新**：`src/index.ts` で `createPrismaClient()` / `createRedisClient()` を呼ぶ → Repository → Controller → Router の順に DI する。Prisma / Redis client は **トップレベルで 1 回だけ生成** し、Repository に渡すルールを明記
- 「新エンドポイント追加の手順」に **「env を追加する場合は `apps/api/src/env.ts` の `apiEnvSchema` に追記」** を 1 行追加
- 「Common Commands」セクションに db コマンドが apps/api と packages/db の wrapper であることを注記

ルート `CLAUDE.md` の Project Overview にも `packages/db` / `packages/logger` / `packages/errors` / `packages/redis` を追記。

## 動作確認

### Build / Lint

```bash
# ルートから全体ビルド
pnpm build

# lint も全体で通る
pnpm lint

# 旧パスへの参照がゼロ
grep -r "from \"\.\./.*prisma/prisma\.client\"" apps/api/src && echo "FAIL" || echo "OK"
grep -r "from \"\.\./.*log\"" apps/api/src | grep -v "@repo/logger" && echo "FAIL" || echo "OK"
grep -r "from \"\.\./.*types/result\"" apps/api/src && echo "FAIL" || echo "OK"
grep -r "from \"\.\./.*client/redis\"" apps/api/src && echo "FAIL" || echo "OK"

# ioredis 直接 import が消えている (test/ は別途確認)
grep -rE "from \"ioredis\"|import .* from \"ioredis\"" apps/api/src && echo "FAIL" || echo "OK"

# 旧ディレクトリが消えている
test ! -d apps/api/src/prisma && echo "OK"
test ! -d apps/api/src/log && echo "OK"
test ! -f apps/api/src/types/result.ts && echo "OK"
test ! -f apps/api/src/client/redis.ts && echo "OK"

# createPrismaClient / createRedisClient が src/index.ts でしか呼ばれていない
grep -rn "createPrismaClient\|createRedisClient" apps/api/src
# → src/index.ts と test/setup.ts のみであることを確認
```

### テスト

```bash
cd apps/api
pnpm test:ci
```

すべての Service ユニットテスト + Controller インテグレーションテストが緑であること。

### 動作確認（dev-login で E2E）

```bash
# DB 初期化 + seed
cd apps/api
pnpm db:migrate
pnpm db:seed  # alice / bob を投入

# api 起動
pnpm dev

# 別ターミナルから web 起動
cd apps/web
pnpm dev

# ブラウザで http://localhost:3000/dev/login?as=alice
# → /sign-in 経由でログインできる
```

refresh token フローも動くこと（再ログイン後に access token 期限切れで refresh が走る）を確認。

### Graceful shutdown の確認

```bash
# api を起動
cd apps/api
pnpm dev

# 別ターミナルから SIGTERM 送信
kill -TERM $(pgrep -f "tsx.*apps/api")

# ログに以下が出力されること:
#   {"level":"info","msg":"shutdown initiated","signal":"SIGTERM"}
#   {"level":"info","msg":"shutdown completed"}
# プロセスが exit code 0 で終了
```

### 新規 app（cron）が組めることを確認

実際に cron app を作らないが、「組める状態」を spot check として最小スクリプトで検証：

```typescript
// /tmp/check-cron-template.ts （捨てスクリプト）
import { z } from "zod"

import { createPrismaClient } from "@repo/db"
import { ok } from "@repo/errors"
import { logger } from "@repo/logger"
import { createRedisClient } from "@repo/redis"

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
})

const result = envSchema.safeParse(process.env)
if (!result.success) {
  console.error("❌ Invalid environment variables:")
  console.error(JSON.stringify(result.error.format(), null, 2))
  process.exit(1)
}
const env = result.data

const prisma = createPrismaClient()
const redis = createRedisClient()

logger.info("cron template check", { env: env.NODE_ENV })

const userCount = await prisma.user.count()
const ping = await redis.ping()
logger.info("infra check", { ping, userCount })

console.log(ok({ ping, userCount }))
await prisma.$disconnect()
await redis.quit()
```

```bash
npx tsx /tmp/check-cron-template.ts
```

→ env 検証 → DB 接続 (factory) → Redis 接続 (factory) → ログ出力 → 切断、まで通れば 4 packages + 各 app の env.ts 方針の組み合わせが正しく動いていることが確認できる。

**ゴール**:
- `apps/api/src/env.ts` で起動時 env 検証が走り、不正な env では即 `process.exit(1)` で停止する
- `apps/api/src/index.ts` で `createPrismaClient()` / `createRedisClient()` を 1 回呼び、Repository に DI する形に統一
- `apps/api/src/` から `prisma/` / `log/` / `types/result.ts` / `client/redis.ts` が完全消滅
- 全 import が `@repo/db` / `@repo/logger` / `@repo/errors` / `@repo/redis` 経由
- `apps/api/package.json` から `@prisma/*` / `prisma` / `pino` / `pino-pretty` / `winston` / `ioredis` の直接依存が消滅
- 全テスト緑、dev-login が動く、SIGTERM で graceful shutdown する
- 新規 server-side app（cron / worker / batch）をテンプレートからゼロから作るのに `packages/` の 4 つを import + `src/env.ts` を作るだけで動く状態が完成
