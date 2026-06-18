# shared-packages

このテンプレートが想定するユースケース（api / cron / worker / batch などの複数 server-side アプリ）で共通利用される基盤コードを `packages/` 配下に切り出し、新規 server-side app をテンプレートからスピンアップした時にゼロから書き直さずに済む状態にする。

対象は以下の 4 パッケージ:

- `@repo/db` — Prisma schema / generated client / 接続クライアント
- `@repo/logger` — Logger インターフェース + Pino/Winston/Console/Silent 実装 + リクエストコンテキスト
- `@repo/errors` — `Result<T>` 型と業務エラーのヘルパ
- `@repo/redis` — ioredis 接続クライアント（singleton + factory）

> **環境変数の検証は共通パッケージ化しない**。Zod スキーマと `safeParse → process.exit(1)` は各 app の `src/env.ts` にインラインで定義する。詳細は[「環境変数の管理」](#環境変数の管理)節を参照。

このドキュメントは **仕様（What）** と **設計（How）** を分けて記述する：

- **仕様**：テンプレート利用者・将来の server-side app 実装者から見える挙動・ルール・利用方法
- **設計**：実装にあたっての技術的な選択と制約

## 関連 spec

- [`../dev-login/README.md`](../dev-login/README.md) — dev-login の API は `@repo/logger` / `@repo/errors` / `@repo/db` をすべて利用する。移行時の参照実装になる

## 目次

- [仕様](#仕様)
  - [パッケージ全体像](#パッケージ全体像)
  - [`@repo/db` の仕様](#repodb-の仕様)
  - [`@repo/logger` の仕様](#repologger-の仕様)
  - [`@repo/errors` の仕様](#repoerrors-の仕様)
  - [`@repo/redis` の仕様](#reporedis-の仕様)
  - [環境変数の管理](#環境変数の管理)
  - [テンプレート利用フロー](#テンプレート利用フロー)
- [設計](#設計)
  - [パッケージ境界の原則](#パッケージ境界の原則)
  - [`@repo/db` の設計](#repodb-の設計)
  - [`@repo/logger` の設計](#repologger-の設計)
  - [`@repo/errors` の設計](#repoerrors-の設計)
  - [`@repo/redis` の設計](#reporedis-の設計)
  - [ビルド順序と Turborepo タスク](#ビルド順序と-turborepo-タスク)
  - [段階移行戦略](#段階移行戦略)
  - [MVP 対象外（将来検討）](#mvp-対象外将来検討)
- [必要な画面](#必要な画面)
- [必要な API](#必要な-api)
- [必要な DB 設計](#必要な-db-設計)
- [フロー図](#フロー図)

---

## 仕様

### パッケージ全体像

```mermaid
flowchart LR
    subgraph packages
        DB["@repo/db<br/>Prisma schema + client"]
        LOG["@repo/logger<br/>ILogger + factory"]
        ERR["@repo/errors<br/>Result&lt;T&gt; + ApiError"]
        RDS["@repo/redis<br/>ioredis client"]
        SCH["@repo/api-schema<br/>(既存)"]
    end

    subgraph apps
        API[apps/api]
        CRON["apps/cron<br/>(将来)"]
        WORKER["apps/worker<br/>(将来)"]
    end

    API --> DB
    API --> LOG
    API --> ERR
    API --> RDS
    API --> SCH

    CRON -.-> DB
    CRON -.-> LOG
    CRON -.-> ERR
    CRON -.-> RDS

    WORKER -.-> DB
    WORKER -.-> LOG
    WORKER -.-> ERR
    WORKER -.-> RDS
```

`@repo/db` / `@repo/logger` / `@repo/errors` / `@repo/redis` はすべて **Node 専用** パッケージ。`apps/web` / `apps/admin` / `apps/mobile` などのクライアント側からは原則 import しない（フロント用の logger / error は別途必要になった時点で `@repo/logger-client` 等として切り出す方針）。

環境変数の検証ロジック（Zod スキーマ + `safeParse → process.exit(1)`）は **共通パッケージ化せず各 app の `src/env.ts` にインラインで定義する**。詳細は[「環境変数の管理」](#環境変数の管理)節を参照。

### `@repo/db` の仕様

- Prisma の `schema.prisma` / `migrations/` / generated client を集約する正本
- 利用側 app は **factory `createPrismaClient()` のみ** を import し、各 app の起動コード (`src/index.ts` 等) で 1 回呼んで PrismaClient を生成する。`packages/db` 側では singleton を持たない
- 生成した PrismaClient は Repository コンストラクタに DI で渡す（既存パターンを踏襲）
- Prisma が生成する **ドメイン型は `@repo/db` から re-export** される（例：`import type { User, Memo } from "@repo/db"`）
- マイグレーション / generate / seed のコマンドは `packages/db` の package.json に閉じ込め、各 app からは叩かない
  - `pnpm --filter @repo/db db:generate`
  - `pnpm --filter @repo/db db:migrate`
  - `pnpm --filter @repo/db db:migrate:deploy`
  - `pnpm --filter @repo/db db:seed`
  - `pnpm --filter @repo/db db:studio`
- `DB_NAME` 環境変数による DB 名上書き（テスト DB 用）の挙動は維持する。テストでは `createPrismaClient({ url: testDbUrl })` を test setup で 1 つ作って使い回す
- **read replica 対応**：`createPrismaClient({ replicaUrl })` で replica URL を渡すと `@prisma/extension-read-replicas` 経由で自動振り分け（read は replica、write / `$transaction` は primary）。`replicaUrl` 省略時は `process.env.DATABASE_REPLICA_URL` を読む。明示的に primary 強制が必要な read は `prisma.$primary().user.findUnique(...)` で切り替え可能

### `@repo/logger` の仕様

- `ILogger` インターフェースに沿って `debug` / `info` / `warn` / `error` のメソッドを提供
- `LoggerFactory.getLogger()` で **環境変数 `LOGGER_TYPE` に応じた logger** を取得（singleton）
  - `pino`（デフォルト・推奨）/ `winston` / `console` / `silent`
- `logger` という名前で **app 全体共通のデフォルト logger を export** する（`import { logger } from "@repo/logger"`）
- リクエストスコープの値（requestId / userId 等）を渡す `logContext` を提供し、AsyncLocalStorage で全 logger 実装に伝播
- 各 logger 実装は `LogMetadata` オブジェクトでメタデータを受け取り、構造化ログとして出力する
- cron / worker からも同じ logger を使えるよう、Express / Next.js への依存は持たない

### `@repo/errors` の仕様

- `Result<T>` 型と `ok(value)` / `err(apiError)` のヘルパを提供
- `ApiError` の `type` は `BAD_REQUEST` / `UNAUTHORIZED` / `FORBIDDEN` / `NOT_FOUND` / `CONFLICT` の 5 種類
- 業務エラー生成のヘルパ関数を提供：`badRequestError(msg)` / `unauthorizedError(msg)` / `forbiddenError(msg)` / `notFoundError(msg)` / `conflictError(msg)`
- DB 障害などの想定外エラーは **throw** が原則で、`Result` には乗せない（既存ルールを維持）
- cron / worker でも同じ `Result<T>` を使うことで、Service 層のコードを app 横断で再利用しやすくする

### `@repo/redis` の仕様

- ioredis の **factory `createRedisClient({ url?, options? })` のみを提供** する。`packages/redis` 側に singleton を持たない（`@repo/db` と同じ方針）
- 各 app の起動コードで factory を呼んで Redis client を生成し、Repository コンストラクタに DI で渡す
- `REDIS_URL` を最優先で読み、無ければ `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB` から組み立てる（既存挙動の後方互換）
- ioredis の型（`Redis` / `RedisOptions`）を re-export し、利用側は `@repo/redis` 経由で参照する（依存方向を packages に集約）
- Repository 実装（例：refresh token / cache / job queue）は **app 側** に置く（app ごとにキー設計や TTL が異なるため packages では責務外）
- **1 app で複数 Redis 接続が必要なケース**：BullMQ の Worker / QueueEvents、Pub/Sub の subscriber は専用接続が必須なので、`createRedisClient` を **複数回呼んで使い分ける**
  - cache / session 用：`createRedisClient()`（デフォルト設定）
  - BullMQ Queue / Worker 用：`createRedisClient({ options: { maxRetriesPerRequest: null } })`（BullMQ の要件）
  - Pub/Sub subscriber 用：`createRedisClient()`（subscribe するとそのコネクションは通常コマンド不可になるため別接続が必須）

### 環境変数の管理

env 検証は **共通パッケージ化せず、各 app の `src/env.ts` に Zod スキーマと `safeParse → process.exit(1)` をインラインで定義する**。

#### 方針

- **app ごとに自己完結**：`apps/{app}/src/env.ts` 単体を読めば、その app が必要とする env 仕様が全て分かる
- **fail-fast**：起動時に env が壊れていれば `process.exit(1)` で即停止し、実行時の `undefined` 参照を防ぐ
- **shared package が読む env も各 app が直接宣言する**：`@repo/db` は `DATABASE_URL` / `DB_NAME`、`@repo/logger` は `LOGGER_TYPE` / `LOG_LEVEL`、`@repo/redis` は `REDIS_URL` / `REDIS_HOST` 等を `process.env` から読む。各 app の `env.ts` でそれらも宣言し、Zod 検証を通すことで「shared package が想定する env が揃っているか」を起動時に保証する
- **Next.js（apps/web / apps/admin）は `server-only` でガード**：`env.ts` の先頭で `import "server-only"` を書き、client component から誤って import された場合にビルドエラーになるようにする

#### apps/api の例

```typescript
import { z } from "zod"

const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().url().optional(),    // @repo/db が読む
  REDIS_URL: z.string().url().optional(),       // @repo/redis が読む
  LOGGER_TYPE: z.enum(["pino", "winston", "console", "silent"]).default("pino"),  // @repo/logger が読む
  JWT_ACCESS_SECRET: z.string().min(32),
  /** ... */
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

#### apps/web の例（server-only ガード）

```typescript
import "server-only"
import { z } from "zod"

const webEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  API_URL: z.string().url().default("http://localhost:8080"),
  GOOGLE_CLIENT_ID: z.string().default("dummy"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
})

const result = webEnvSchema.safeParse(process.env)
if (!result.success) { /** ... */ process.exit(1) }

export const env = result.data
```

#### なぜパッケージ化しないか

- env は app ごとに異なる（api は JWT 系、web は OAuth 系、cron はクローラ系）。共通化できる「base env」は実は `NODE_ENV` / `LOG_LEVEL` 程度しかなく、抽象化のコストの方が大きい
- test 環境では JWT 系を `vitest.setup.ts` で個別上書きするなど、「全 app 共通の default」は実態と乖離しやすい
- shared package 自身が `process.env` を直接読む設計（`@repo/db` / `@repo/redis` / `@repo/logger`）なので、各 app の `env.ts` は「shared package が必要とする env を Zod で宣言し、起動時に検証する」役割を担うだけで十分

### テンプレート利用フロー

新規 server-side app（例：cron）をテンプレートから派生させる場合、以下のフローを想定：

1. `apps/cron/` を新規作成し、`package.json` に依存を追加
   ```json
   {
     "dependencies": {
       "@repo/db": "workspace:^",
       "@repo/logger": "workspace:^",
       "@repo/errors": "workspace:^",
       "@repo/redis": "workspace:^",
       "zod": "^3.25.76"
     }
   }
   ```
2. `apps/cron/src/env.ts` に Zod スキーマで env を宣言（`apps/api/src/env.ts` を参考に必要なフィールドだけ抜粋）
   ```typescript
   import { z } from "zod"

   const cronEnvSchema = z.object({
     NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
     DATABASE_URL: z.string().url().optional(),
     REDIS_URL: z.string().url().optional(),
     LOGGER_TYPE: z.enum(["pino", "winston", "console", "silent"]).default("pino"),
   })

   const result = cronEnvSchema.safeParse(process.env)
   if (!result.success) {
     console.error("❌ Invalid environment variables:")
     console.error(JSON.stringify(result.error.format(), null, 2))
     process.exit(1)
   }
   export const env = result.data
   ```
3. `src/index.ts` でインフラを起動（接続を持つ client は **factory で 1 回作って使い回す**）
   ```typescript
   import { createPrismaClient } from "@repo/db"
   import { logger } from "@repo/logger"
   import { createRedisClient } from "@repo/redis"

   import { env } from "./env"

   const prisma = createPrismaClient()
   const redis = createRedisClient()

   logger.info("cron started", { env: env.NODE_ENV })

   const count = await prisma.user.count()
   await redis.set("cron:last-user-count", count, "EX", 3600)
   logger.info("user count cached", { count })

   await prisma.$disconnect()
   await redis.quit()
   ```
4. Repository / Service は既存パターン（`Result<T>` + `repo: { ... }`）を踏襲し、`prisma` / `redis` は Repository コンストラクタに DI で渡す

---

## 設計

### パッケージ境界の原則

| 観点 | ルール |
| --- | --- |
| **責務最小化** | 各パッケージは「共通 1 機能」に絞る。Repository や Service は packages に置かない（app ごとにクエリ最適化が異なるため） |
| **依存方向** | `@repo/errors` は他 packages に依存しない。`@repo/logger` は `@repo/errors` のみ任意依存可。`@repo/db` は `@repo/errors` / `@repo/logger` のいずれにも依存しない（型レベルで切り離す） |
| **Node 専用** | すべて Node 専用。Next.js / Expo の client bundle に混入させない |
| **環境変数の読み込み** | shared package は `process.env` を直接読んで良い（`@repo/db` / `@repo/redis` / `@repo/logger`）。各 app の `src/env.ts` で必要な env を Zod で宣言・検証することで、起動時に「shared package が想定する env が揃っているか」を保証する |
| **接続を持つものは factory のみ** | `@repo/db` / `@repo/redis` は **factory のみ** を export し、singleton を持たない。client の生成・破棄は app 側 (`src/index.ts`) の責務。logger / errors のように接続を持たないものは singleton / 純関数で OK |
| **副作用** | `package.json` に `"sideEffects": false` を付ける。tree-shaking 可能にする |

### `@repo/db` の設計

```
packages/db/
├── package.json
├── tsconfig.json
├── eslint.config.js
├── prisma/
│   ├── schema.prisma          # apps/api/src/prisma/schema.prisma を移設
│   ├── migrations/            # apps/api/src/prisma/migrations/ を移設
│   ├── prisma.config.ts       # apps/api/src/prisma/prisma.config.ts を移設
│   └── seed.ts                # apps/api/src/prisma/seed.ts を移設（dev users 含む全 seed）
├── src/
│   ├── client.ts              # createPrismaClient factory + 接続文字列ヘルパ (DB_NAME 上書き含む)
│   └── index.ts               # client + generated 型の re-export
└── generated/                 # prisma generate の出力先（gitignore）
```

#### Prisma クライアントの提供形態

**factory `createPrismaClient` のみを export する**。`packages/db` 側に singleton を持たない。各 app の起動コードで factory を呼び、生成した client を Repository に DI で渡す。

```typescript
import { PrismaPg } from "@prisma/adapter-pg"
import { readReplicas } from "@prisma/extension-read-replicas"

import { PrismaClient } from "../generated/client"
import { buildConnectionString } from "./connection-string"

export type CreatePrismaClientOptions = {
  /**
   * 接続文字列を明示指定。省略時は process.env.DATABASE_URL (+ DB_NAME 上書き)
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
 * read replica が設定されていれば @prisma/extension-read-replicas で自動振り分け：
 *   - findMany / findUnique / count / aggregate などの read → replica
 *   - create / update / delete / $transaction / $executeRaw → primary
 * 強整合性が必要な read は prisma.$primary().user.findUnique(...) で primary 強制
 */
export const createPrismaClient = (options: CreatePrismaClientOptions = {}) => {
  const adapter = new PrismaPg(options.url ?? buildConnectionString())
  const base = new PrismaClient({ adapter })
  const replicaUrl = options.replicaUrl ?? process.env.DATABASE_REPLICA_URL
  return replicaUrl ? base.$extends(readReplicas({ url: replicaUrl })) : base
}
```

#### singleton を持たない理由

- **接続を持つものはモジュール import の副作用にしない**：`import { prisma }` の瞬間に DB 接続が始まる singleton は、テスト・スクリプト・CLI ツールから import するだけで意図しない接続が走るリスクがある。factory なら `createPrismaClient()` を **呼んだ時にだけ** 接続される
- **既存の DI パターンと一貫**：Repository は constructor で `PrismaClient` を受け取る形になっており、その引数を作るのは最上位 (`src/index.ts`) の責務。singleton import で済ませると「Repository は DI、その手前は singleton」という捻れが発生する
- **テストが書きやすい**：test setup は `createPrismaClient({ url: testDbUrl })` で test DB 専用 client を 1 つ作るだけ。本番 singleton との二重 import 問題が起きない
- **ライフサイクルが明示的**：`apps/api/src/index.ts` で `createPrismaClient()` → ルート組み立て → `process.on("SIGTERM", () => prisma.$disconnect())` まで一貫して書ける
- **将来のマルチ DB / マルチテナント拡張に強い**：DB-per-tenant が必要になっても、リクエストごとに `createPrismaClient({ url: tenantUrl })` を呼べば対応できる

#### app 側の利用例

```typescript
// apps/api/src/index.ts
import { createPrismaClient } from "@repo/db"

const prisma = createPrismaClient()

const memoRepository = new PrismaMemoRepository(prisma)
const userRepository = new PrismaUserRepository(prisma)
/** ... 他の Repository も同じ prisma を渡す ... */

process.on("SIGTERM", async () => {
  await prisma.$disconnect()
  process.exit(0)
})
```

#### `$primary()` の使い方（read replica 利用時）

```typescript
/** デフォルト：read は replica へ自動振り分け */
const users = await prisma.user.findMany()

/** 強整合 read：直前の write を確実に読む / 残高チェックなど */
const fresh = await prisma.$primary().user.findUnique({ where: { id } })

/** $transaction 内は read も自動で primary */
await prisma.$transaction(async (tx) => {
  const account = await tx.account.findUnique({ where: { id } })  // primary
  await tx.account.update({ where: { id }, data: { balance: account.balance - 100 } })  // primary
})
```

Repository 層の規約：

- デフォルト（replica 許容）：`findById(id)` のように普通の名前で実装
- 強整合 read 必須：メソッド名末尾に `FromPrimary` を付ける（例：`findByIdFromPrimary`）。実装内で `prisma.$primary()` を使う

#### connection-string.ts

```typescript
const DEFAULT_URL = "postgresql://postgres:password@localhost:5432/nodebase_dev"

export const buildConnectionString = (): string => {
  const baseUrl = process.env.DATABASE_URL ?? DEFAULT_URL
  const dbName = process.env.DB_NAME
  if (!dbName) return baseUrl
  return baseUrl.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`)
}
```

`process.env` を直接読む（理由：Prisma CLI 起動時など、app の `src/env.ts` を経由しない経路でも使われるため）。値の存在保証は各 app の `src/env.ts` の Zod 検証側で担保する。

#### マイグレーション / generate / seed のコマンド

`packages/db/package.json` の scripts に集約。

```json
{
  "scripts": {
    "build": "tsc",
    "db:generate": "prisma generate --config=prisma/prisma.config.ts",
    "db:migrate": "prisma migrate dev --config=prisma/prisma.config.ts",
    "db:migrate:deploy": "prisma migrate deploy --config=prisma/prisma.config.ts",
    "db:push": "prisma db push --config=prisma/prisma.config.ts",
    "db:seed": "prisma db seed --config=prisma/prisma.config.ts",
    "db:studio": "prisma studio --config=prisma/prisma.config.ts",
    "postinstall": "prisma generate --config=prisma/prisma.config.ts"
  }
}
```

`postinstall` を入れて、新規 clone / CI install 時に generated client が必ず生成される状態を担保する。

`dotenvx` による env 復号化は **各 app の package.json で wrapper を書いて呼ぶ** 設計にする：

```jsonc
// apps/api/package.json
{
  "scripts": {
    "db:migrate": "dotenvx run -f .env.local -- pnpm --filter @repo/db db:migrate",
    "db:seed": "DB_NAME=nodebase_dev dotenvx run -f .env.local -- pnpm --filter @repo/db db:seed"
  }
}
```

これにより `apps/api` 専用の env で migration / seed が走り、cron app などが将来独自の env で同じコマンドを叩けるようになる。

#### seed.ts の扱い

seed は **テスト初期化と開発環境のセットアップが目的** で、本番マスターデータは管理画面経由での登録を推奨する方針。そのため seed は **`packages/db/prisma/seed.ts` に一元化** する（app ごとに分けない）。

- 全 app (api / cron / worker) が同じ DB スキーマ・同じ dev データを共有するため、seed を共通化しても齟齬は出ない
- 既存の dev-login 用 dev ユーザー（alice / bob）や、将来追加される Memo / カテゴリ等のサンプルデータもすべてここに集約
- 起動コマンドは `pnpm --filter @repo/db db:seed`。各 app の `package.json` は dotenvx ラッパー (`dotenvx run -f .env.local -- pnpm --filter @repo/db db:seed`) だけを持つ
- `NODE_ENV === "production"` の場合は seed 自体をスキップする多重ガードを `seed.ts` 内に維持

### `@repo/logger` の設計

```
packages/logger/
├── package.json
├── tsconfig.json
├── eslint.config.js
└── src/
    ├── interface.ts            # ILogger / LogMetadata
    ├── context.ts              # AsyncLocalStorage の logContext
    ├── logger-factory.ts       # LoggerFactory + 既定 logger
    ├── console-logger.ts
    ├── pino-logger.ts
    ├── winston-logger.ts
    ├── silent-logger.ts
    └── index.ts                # re-export
```

ファイル構成は既存 `apps/api/src/log/` をほぼそのまま移設する。差分は以下：

- `LOGGER_TYPE` 定数は `apps/api/src/const` から `packages/logger/src/const.ts` に移設
- `LoggerFactory.getLogger()` は `process.env.LOGGER_TYPE` を直接読む。値の存在は各 app の `src/env.ts` で `LOGGER_TYPE` を Zod で宣言しておくことで保証される
- Express への依存は **元から無いはず** なので変更不要

#### context.ts と AsyncLocalStorage

リクエストスコープの `requestId` / `userId` を logger 出力に自動付与するための仕組み。Express の `app.use` でリクエストごとに `logContext.run(...)` を呼ぶ middleware は `apps/api` に残し、`@repo/logger` 側は AsyncLocalStorage の入れ物と取得関数のみを export する。

```typescript
// packages/logger/src/context.ts
import { AsyncLocalStorage } from "async_hooks"

export type LogContext = {
  requestId?: string
  userId?: number
}

export const logContext = new AsyncLocalStorage<LogContext>()
```

cron / worker では `logContext.run({ jobId }, async () => { /* ... */ })` のように job ごとのコンテキストを設定可能。

### `@repo/errors` の設計

```
packages/errors/
├── package.json
├── tsconfig.json
├── eslint.config.js
└── src/
    ├── result.ts               # Result<T> + ApiError + ヘルパ
    └── index.ts
```

中身は既存 `apps/api/src/types/result.ts` を 1 ファイルそのまま移設するだけ。

```typescript
export type ApiErrorType =
  | "BAD_REQUEST"
  | "CONFLICT"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UNAUTHORIZED"

export type ApiError = {
  statusCode: number
  type: ApiErrorType
  message: string
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: ApiError }

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })
export const err = (error: ApiError): Result<never> => ({ ok: false, error })

export const badRequestError = (message: string): ApiError => ({
  message,
  statusCode: 400,
  type: "BAD_REQUEST",
})

export const unauthorizedError = (message: string): ApiError => ({
  message,
  statusCode: 401,
  type: "UNAUTHORIZED",
})

export const forbiddenError = (message: string): ApiError => ({
  message,
  statusCode: 403,
  type: "FORBIDDEN",
})

export const notFoundError = (message: string): ApiError => ({
  message,
  statusCode: 404,
  type: "NOT_FOUND",
})

export const conflictError = (message: string): ApiError => ({
  message,
  statusCode: 409,
  type: "CONFLICT",
})
```

利用側は `import { Result, ok, err, notFoundError } from "@repo/errors"` のみで完結。

### `@repo/redis` の設計

```
packages/redis/
├── package.json
├── tsconfig.json
├── eslint.config.js
└── src/
    ├── client.ts              # createRedisClient + デフォルト singleton
    └── index.ts               # client + ioredis 型 re-export
```

#### Redis クライアントの提供形態

**factory `createRedisClient` のみを export する**（`@repo/db` と同じ方針）。`packages/redis` 側に singleton を持たない。

```typescript
import Redis, { type RedisOptions } from "ioredis"

export type CreateRedisClientOptions = {
  url?: string
  options?: RedisOptions
}

export const createRedisClient = (params: CreateRedisClientOptions = {}): Redis => {
  if (params.url) return new Redis(params.url, params.options ?? {})
  const base = buildOptionsFromEnv()
  if (typeof base === "string") return new Redis(base, params.options ?? {})
  return new Redis({ ...base, ...params.options })
}
```

#### app 側の利用例

通常用途は singleton 的に 1 つ生成して Repository に DI：

```typescript
// apps/api/src/index.ts
import { createRedisClient } from "@repo/redis"

const redis = createRedisClient()
const refreshTokenRepository = new IoRedisRefreshTokenRepository(redis)

process.on("SIGTERM", async () => {
  await redis.quit()
})
```

BullMQ や Pub/Sub を後から入れる場合は **factory を複数回呼ぶだけ**：

```typescript
// apps/worker/src/index.ts
import { Queue, Worker, QueueEvents } from "bullmq"
import { createRedisClient } from "@repo/redis"

/** cache / 通常用途 */
const redis = createRedisClient()

/** BullMQ Queue / Worker 用（別接続必須、maxRetriesPerRequest: null は BullMQ の要件） */
const bullConnection = createRedisClient({
  options: { maxRetriesPerRequest: null },
})
const emailQueue = new Queue("email", { connection: bullConnection })

const emailWorker = new Worker(
  "email",
  async (job) => { /* ... */ },
  { connection: createRedisClient({ options: { maxRetriesPerRequest: null } }) },
)

/** Pub/Sub subscriber 用（subscribe するとこの接続は通常コマンド不可になるため別接続必須） */
const subscriber = createRedisClient()
await subscriber.subscribe("user-events")
subscriber.on("message", (channel, message) => { /* ... */ })
```

#### Repository 実装は packages に置かない

`IoRedisRefreshTokenRepository` のような **app 固有のキー設計 / TTL を含む Repository** は app 側に残す。`@repo/redis` は接続クライアントと型 re-export だけを責務とする（`@repo/db` が Prisma client だけを提供して Repository を app に残すのと同じ思想）。

既存の `apps/api/src/client/redis.ts` は step6 で削除し、`apps/api/src/index.ts` で `createRedisClient()` を呼ぶ形に統一する。

#### env 読み込みのフォールバック

既存 `apps/api` は `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB` の 4 つを個別に読んでいる。`@repo/redis` では：

1. `REDIS_URL` が設定されていればそれを最優先
2. 無ければ既存の 4 つの個別 env から組み立て（後方互換）

新規 app では `REDIS_URL` 一本に統一する方針を各 app の `src/env.ts` で示唆する（`REDIS_URL` を必須相当、個別 env は optional で宣言する形）。

### ビルド順序と Turborepo タスク

`turbo.json` の `build` / `dev` / `test` タスクは既に `dependsOn: ["^build"]` が入っているため、依存 packages から先にビルドされる。`@repo/db` だけは **`prisma generate` を build 前に走らせる必要がある** ため、専用タスクを追加する。

```jsonc
// turbo.json への追記
{
  "tasks": {
    "@repo/db#db:generate": {
      "cache": false,
      "inputs": ["prisma/schema.prisma"],
      "outputs": ["generated/**"]
    },
    "build": {
      "dependsOn": ["^build", "^db:generate"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**", "build/**", "generated/**"]
    }
  }
}
```

これにより `pnpm build` を root で叩くと、`@repo/db` の generate → 全 packages の build → 全 apps の build の順で安全に実行される。

### 段階移行戦略

apps/api のコードと既存 spec / テストを壊さないよう、以下の順序で step を分けて移行する：

| step | 内容 | 完了時の状態 |
| --- | --- | --- |
| step1 | `packages/db` 新設 + Prisma schema/migrations/seed 移設。`packages/db` は **factory のみ export**。既存 `apps/api/src/prisma/prisma.client.ts` は **内部 singleton を持つ wrapper** に差し替えて互換維持 | api の既存 import (`import { prisma } from "../prisma/prisma.client"`) は wrapper 経由で動き続ける |
| step2 | `packages/logger` 新設 + 既存 log/ 移設 | api からは `@repo/logger` の `logger` を import 可能。既存 `apps/api/src/log/` は wrapper で互換維持 |
| step3 | `packages/errors` 新設 + Result 型移設 | api からは `@repo/errors` の `Result` を import 可能。既存 `apps/api/src/types/result.ts` は wrapper |
| step4 | `packages/redis` 新設 + 既存 client/redis.ts 移設。**factory のみ export**。`apps/api/src/client/redis.ts` は内部 singleton を持つ wrapper に差し替え | api の既存 import (`import { redis } from "./client/redis"`) は wrapper 経由で動き続ける |
| step5 | `apps/api/src/env.ts` を新設して起動時 env 検証を導入 + `apps/api/src/index.ts` を **factory ベースの DI assembly** に書き換え + 全 import を `@repo/*` に置換 + 旧 wrapper / 旧ファイル削除 + テスト setup を factory ベースに更新 | apps/api 内部の singleton 完全消滅。env 検証と client の生成・破棄が `src/index.ts` に集約される |

各 step は **単独で test:ci が緑**になることを必須にする。step5 完了までは「packages は factory のみ、apps/api 内部に singleton wrapper」という二重構造で互換性を保つ。

### MVP 対象外（将来検討）

以下は今回のスコープ外。必要になった時点で別 spec を切る。

- `packages/auth` — JWT 発行 / 検証ヘルパ（現在 `apps/api/src/lib/jwt.ts`）。cron が JWT を発行することは稀だが、検証は OAuth トークン管理系の cron で必要になり得る
- `apps/cron` / `apps/worker` のテンプレート実装 — 本 spec では packages の切り出しのみに集中する
- `@repo/logger-client` — フロント用 logger。Next.js の Sentry 連携などが具体化したら別パッケージとして切る
- `@repo/queue` — BullMQ などのジョブキュー抽象。`@repo/redis` をベースに、worker 実装が具体化した段階で検討

---

## 必要な画面

なし（インフラ／基盤の切り出しタスク）。

## 必要な API

なし（既存 API の挙動は変えない。import パスだけが変わる）。

## 必要な DB 設計

DB 設計の変更はなし。既存の `schema.prisma` をそのまま `packages/db/prisma/schema.prisma` に移設する。

参考までに、移設対象の現行スキーマ：

```mermaid
erDiagram
    USERS ||--o{ AUTH_ACCOUNTS : has
    USERS {
        int id PK
        string email
        string name
        string avatarUrl
        datetime createdAt
        datetime updatedAt
    }
    AUTH_ACCOUNTS {
        int id PK
        int userId FK
        string provider
        string providerAccountId
        string accessToken
        string refreshToken
        datetime createdAt
        datetime updatedAt
    }
    MEMOS {
        int id PK
        string title
        string body
        datetime createdAt
        datetime updatedAt
    }
```

## フロー図

### 移行後の app 起動シーケンス（例：apps/api）

```mermaid
sequenceDiagram
    autonumber
    participant Boot as apps/api/src/index.ts
    participant ENV as src/env.ts
    participant LOG as "@repo/logger"
    participant DB as "@repo/db"
    participant RDS as "@repo/redis"
    participant Repo as Repositories
    participant EXP as Express

    Boot->>ENV: import { env }
    ENV->>ENV: apiEnvSchema.safeParse(process.env)
    Note over ENV: 失敗時は process.exit(1)
    ENV-->>Boot: env (型付き)
    Boot->>LOG: import { logger }
    LOG-->>Boot: logger (singleton)
    Boot->>DB: createPrismaClient()
    DB-->>Boot: prisma
    Boot->>RDS: createRedisClient()
    RDS-->>Boot: redis
    Boot->>Repo: new PrismaMemoRepository(prisma)
    Boot->>Repo: new IoRedisRefreshTokenRepository(redis)
    Boot->>EXP: app.listen(env.PORT)
    EXP-->>Boot: ready
    Boot->>LOG: logger.info("api started", { port })
    Note over Boot: process.on("SIGTERM", ...) で<br/>prisma.$disconnect() + redis.quit()
```

### 新規 app（cron）からの利用シーケンス

```mermaid
sequenceDiagram
    autonumber
    participant Cron as apps/cron/src/index.ts
    participant ENV as src/env.ts
    participant LOG as "@repo/logger"
    participant DB as "@repo/db"
    participant RDS as "@repo/redis"
    participant PG as Postgres
    participant R as Redis

    Cron->>ENV: import { env }
    ENV->>ENV: cronEnvSchema.safeParse(process.env)
    Note over ENV: 失敗時は process.exit(1)
    ENV-->>Cron: env (型付き)
    Cron->>DB: createPrismaClient()
    DB-->>Cron: prisma
    Cron->>RDS: createRedisClient()
    RDS-->>Cron: redis
    Cron->>LOG: import { logger, logContext }
    Cron->>LOG: logContext.run({ jobId }, run)
    Note over Cron: run()
    Cron->>DB: prisma.user.count()
    DB->>PG: SELECT COUNT(*) FROM users
    PG-->>DB: 42
    DB-->>Cron: 42
    Cron->>RDS: redis.set("cron:last-count", 42, "EX", 3600)
    RDS->>R: SET cron:last-count 42 EX 3600
    R-->>RDS: OK
    Cron->>LOG: logger.info("user count cached", { count: 42 })
    Cron->>DB: prisma.$disconnect()
    Cron->>RDS: redis.quit()
```
