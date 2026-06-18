# step4-packages-redis.md

`@repo/redis` パッケージを新設し、`apps/api/src/client/redis.ts` の接続クライアントを移設する。`packages/redis` は **factory `createRedisClient` のみを export** し、singleton は持たない（`@repo/db` と同じ方針）。既存 `apps/api/src/client/redis.ts` は **内部に singleton を持つ wrapper** に差し替えて既存 import を壊さず、step5 で wrapper 自体を削除する。

Repository 実装（`IoRedisRefreshTokenRepository` 等）は **app 固有のため packages には移さない**。`@repo/redis` は接続クライアントと型 re-export のみを責務とする。

## 対応内容

### 1. ディレクトリ作成

```
packages/redis/
├── package.json
├── tsconfig.json
├── eslint.config.js
├── .gitignore
└── src/
    ├── client.ts
    └── index.ts
```

### 2. `packages/redis/package.json`

```json
{
  "name": "@repo/redis",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "sideEffects": false,
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "dev": "tsc --watch",
    "lint": "eslint 'src/**/*.ts'",
    "lint:fix": "eslint 'src/**/*.ts' --fix"
  },
  "dependencies": {
    "ioredis": "^5.10.0"
  },
  "devDependencies": {
    "@types/node": "^24.10.1",
    "@typescript-eslint/eslint-plugin": "^8.46.4",
    "@typescript-eslint/parser": "^8.46.4",
    "eslint": "^9.39.1",
    "typescript": "^5.9.3"
  }
}
```

### 3. `packages/redis/src/client.ts`

```typescript
import Redis, { type RedisOptions } from "ioredis"

export type CreateRedisClientOptions = {
  /**
   * 接続 URL を明示指定（例: redis://:password@host:6379/0）
   * 省略時は process.env.REDIS_URL を優先し、無ければ個別の REDIS_HOST/PORT/PASSWORD/DB から組み立てる
   */
  url?: string
  /**
   * ioredis に追加で渡したいオプション（lazyConnect, keyPrefix, retryStrategy など）
   */
  options?: RedisOptions
}

/**
 * 環境変数から ioredis に渡すオプションを組み立てる
 * REDIS_URL が優先される。無ければ REDIS_HOST/PORT/PASSWORD/DB を個別に読む
 */
const buildOptionsFromEnv = (): RedisOptions | string => {
  if (process.env.REDIS_URL) return process.env.REDIS_URL
  return {
    db: Number(process.env.REDIS_DB) || 0,
    host: process.env.REDIS_HOST || "localhost",
    password: process.env.REDIS_PASSWORD || undefined,
    port: Number(process.env.REDIS_PORT) || 6379,
  }
}

/**
 * ioredis クライアントのファクトリ
 * 各 app の src/index.ts で 1 回呼び、Repository コンストラクタに渡す。
 * BullMQ や Pub/Sub の subscriber などは別接続が必須なので、
 * 用途ごとに複数回呼んで使い分ける。
 */
export const createRedisClient = (params: CreateRedisClientOptions = {}): Redis => {
  if (params.url) {
    return new Redis(params.url, params.options ?? {})
  }
  const base = buildOptionsFromEnv()
  if (typeof base === "string") {
    return new Redis(base, params.options ?? {})
  }
  return new Redis({ ...base, ...params.options })
}
```

`packages/redis` 側に singleton (`redis`) は **持たない**。各 app が `createRedisClient()` を呼んで自分の接続を作る。

#### URL ベース接続を優先する理由

既存 `apps/api/src/client/redis.ts` は `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB` の 4 つの env を個別に読んでいるが、新規 app では `REDIS_URL` を 1 本で扱う設計を推奨する（cron/worker でも env を増やさず済むため）。後方互換として個別 env も読めるようにしておく。

### 4. `packages/redis/src/index.ts`

```typescript
export { createRedisClient } from "./client"
export type { CreateRedisClientOptions } from "./client"

/**
 * ioredis の型を re-export
 * 利用側は import type { Redis, RedisOptions } from "@repo/redis" で参照できる
 */
export type { Redis, RedisOptions } from "ioredis"
export { default as IoRedis } from "ioredis"
```

`IoRedis` を `default` 経由で re-export することで、`new IoRedis(...)` のように **コンストラクタを直接使いたいケース**（テストや特殊な接続制御）にも対応する。`redis` singleton は export しない。

### 5. `packages/redis/tsconfig.json`

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
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### 6. `packages/redis/.gitignore` / `eslint.config.js`

step1〜3 と同様の構成。

### 7. `apps/api` 側の互換 wrapper

`apps/api/src/client/redis.ts` を以下に差し替える。`@repo/redis` は factory のみ提供なので、apps/api 内部で **暫定的に singleton を保持する** wrapper にして既存 import を壊さない。step5 でこの wrapper 自体を削除し、`src/index.ts` での DI assembly に置き換える。

```typescript
import { createRedisClient } from "@repo/redis"

/**
 * @deprecated step5 で削除予定。
 * 新規コードは src/index.ts で createRedisClient() を呼び、
 * Repository に DI で渡すこと。
 */
export const redis = createRedisClient()
```

### 8. Repository 実装は触らない

`apps/api/src/repository/redis/refresh-token-repository.ts` / `healthcheck-repository.ts` などの **ioredis 直接 import** は **この step では変更しない**（step5 で `@repo/redis` 経由の import に書き換える）。

理由：

- Repository 実装は app 固有のロジックなので packages に移さない
- ただし `import type Redis from "ioredis"` のような type-only import は `import type { Redis } from "@repo/redis"` に揃えるとパッケージ境界が綺麗になる（step5 で実施）

### 9. `apps/api/package.json` の修正

```diff
   "dependencies": {
     "@repo/db": "workspace:^",
     "@repo/api-schema": "workspace:^",
     "@repo/errors": "workspace:^",
     "@repo/logger": "workspace:^",
+    "@repo/redis": "workspace:^",
     "cors": "^2.8.5",
     "express": "^5.1.0",
     "google-auth-library": "^10.5.0",
-    "ioredis": "^5.10.0",
     "jsonwebtoken": "^9.0.3",
```

`ioredis` の直接依存は `@repo/redis` 側に集約される。ただし step4 完了時点では Repository が `import Redis from "ioredis"` のままなので、**この step では `ioredis` を残しておき、step5 の最終クリーンアップで削除する**（step4 単独で test:ci が緑になる状態を維持するため）。

→ つまり step4 では `@repo/redis` を追加するだけで `ioredis` は残す。最終削除は step5。

## 動作確認

### 単体確認

```bash
cd packages/redis
pnpm install
pnpm build

# 型定義が出力されている
test -f packages/redis/dist/index.d.ts && echo OK

# factory で接続できる（デフォルト env）
node -e "
const { createRedisClient } = require('./dist');
const client = createRedisClient();
client.set('test-key', 'hello').then(() => client.get('test-key')).then((v) => {
  console.log('value:', v);
  return client.del('test-key');
}).then(() => client.quit());
"
```

### factory に URL を渡す

```bash
node -e "
const { createRedisClient } = require('./dist');
const client = createRedisClient({ url: 'redis://localhost:6379/1' });
client.set('factory-key', 'works').then(() => client.quit());
"
```

### BullMQ 用接続（maxRetriesPerRequest: null）

```bash
node -e "
const { createRedisClient } = require('./dist');
const conn = createRedisClient({ options: { maxRetriesPerRequest: null } });
conn.ping().then(console.log).finally(() => conn.quit());
"
```

### apps/api 側の確認

```bash
cd apps/api
pnpm build

# 既存 wrapper (内部で createRedisClient を呼んで singleton 化) 経由で動く
node -e "const { redis } = require('./dist/client/redis'); redis.ping().then(console.log).finally(() => redis.quit())"
```

### テスト

```bash
cd apps/api
pnpm test:ci
```

refresh token 関連のテスト（`IoRedisRefreshTokenRepository`）が緑であること。Repository 実装は触っていないので影響なし。

**ゴール**: `apps/api/src/client/redis.ts` が **`createRedisClient()` を呼んで singleton 化する暫定 wrapper** になり、`@repo/redis` は factory のみを export する状態。step5 でこの wrapper も削除して `apps/api/src/index.ts` に DI assembly を集約する。
