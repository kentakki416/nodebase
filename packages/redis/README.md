# @repo/redis

ioredis の接続クライアントを生成する **factory + 型 re-export** を提供する共有パッケージ。**全 server-side app (api / cron / worker) で利用する**。

## 役割

- `createRedisClient()` factory のみ export（パッケージ側では singleton を持たない）
- ioredis の型 (`Redis` / `RedisOptions`) を re-export し、利用側は本パッケージ経由で参照
- 1 app で複数 Redis 接続が必要なケース（BullMQ / Pub/Sub）にも factory を複数回呼ぶだけで対応

## 公開 API

```ts
import { createRedisClient, type Redis, type RedisOptions } from "@repo/redis"
```

| Export | 用途 |
| --- | --- |
| `createRedisClient(options?)` | ioredis client を生成 |
| `Redis` / `RedisOptions` | ioredis の型 re-export |

### `createRedisClient` のオプション

| key | デフォルト | 説明 |
| --- | --- | --- |
| `url` | `process.env.REDIS_URL`、無ければ `REDIS_HOST` 等から組み立て | 接続文字列 |
| `options` | `{}` | `ioredis` の `RedisOptions` をそのまま渡す |

## 使い方

### 通常用途（cache / session）

```ts
// apps/api/src/index.ts
import { createRedisClient } from "@repo/redis"

const redis = createRedisClient()
const refreshTokenRepository = new IoRedisRefreshTokenRepository(redis)

process.on("SIGTERM", async () => {
  await redis.quit()
})
```

### BullMQ Queue / Worker 用（別接続必須）

```ts
import { createRedisClient } from "@repo/redis"

/** BullMQ の要件で maxRetriesPerRequest: null が必須 */
const bullConnection = createRedisClient({
  options: { maxRetriesPerRequest: null },
})
```

### Pub/Sub subscriber 用（別接続必須）

```ts
const subscriber = createRedisClient()
await subscriber.subscribe("user-events")
subscriber.on("message", (channel, message) => { /* ... */ })
```

> subscribe するとその接続は通常コマンド不可になるため、cache 用とは **必ず別接続** にする。

## 環境変数

各 app の `src/env.ts` で宣言・検証する（本パッケージは `process.env` を直接読む）。

| 変数 | 優先度 | 説明 |
| --- | --- | --- |
| `REDIS_URL` | 最優先 | `redis://[:password@]host:port[/db]` |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB` | フォールバック | `REDIS_URL` が無いときに組み立て |

**新規 app では `REDIS_URL` 一本に統一** することを推奨。

## Repository を packages に置かない理由

app ごとにキー設計 / TTL / シリアライズ方針が違うため、**`IoRedisRefreshTokenRepository` のような実装は app 側に置く**。本パッケージは「接続と型」だけに責務を絞る（`@repo/db` が Prisma client だけを提供して Repository は app に残すのと同じ思想）。

## ディレクトリ構成

```
packages/redis/
└── src/
    ├── client.ts    # createRedisClient factory + env パーサ
    └── index.ts     # client + ioredis 型 re-export
```

## 設計詳細

→ [`docs/spec/shared-packages/README.md`](../../docs/spec/shared-packages/README.md) の「@repo/redis の設計」を参照。
