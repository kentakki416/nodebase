# @repo/db

Prisma schema / migrations / generated client を一元管理する共有パッケージ。**全 server-side app (api / cron / worker / 将来の batch) は本パッケージ越しに DB へアクセスする**。

## 役割

- `prisma/schema.prisma` を **唯一の正本** として保有
- `createPrismaClient()` factory のみ export（パッケージ側では singleton を持たない）
- マイグレーション / generate / seed のコマンドを 1 箇所に集約
- Prisma が生成するドメイン型（`User` / `Memo` 等）を re-export

## 公開 API

```ts
import { createPrismaClient, type PrismaClient, type User, type Memo } from "@repo/db"
```

| Export | 用途 |
| --- | --- |
| `createPrismaClient(options?)` | PrismaClient を生成する factory。`url` と `replicaUrl` を任意指定可 |
| Prisma 生成型 (`User` / `Memo` ...) | re-export されたドメイン型 |

### `createPrismaClient` のオプション

| key | デフォルト | 説明 |
| --- | --- | --- |
| `url` | `process.env.DATABASE_URL` (+ `DB_NAME` 上書き) | 接続文字列 |
| `replicaUrl` | `process.env.DATABASE_REPLICA_URL` | read replica の接続文字列。指定時は `@prisma/extension-read-replicas` で read/write を自動振り分け |

## 使い方

各 app の `src/index.ts` で **1 回だけ** 呼び、生成した client を Repository に DI する。

```ts
// apps/api/src/index.ts
import { createPrismaClient } from "@repo/db"

const prisma = createPrismaClient()

const memoRepository = new PrismaMemoRepository(prisma)

process.on("SIGTERM", async () => {
  await prisma.$disconnect()
})
```

> **NG**: `import { prisma } from "@repo/db"` のような singleton import はしない。**factory を経由しない接続は禁止**。

### 強整合 read（replica 利用時）

```ts
const fresh = await prisma.$primary().user.findUnique({ where: { id } })
```

Repository 規約：強整合必須のメソッド名は末尾に `FromPrimary` を付ける（例: `findByIdFromPrimary`）。

## コマンド

すべて `pnpm --filter @repo/db <cmd>` で実行（各 app からは `dotenvx` ラッパー経由で叩く）。

```bash
pnpm --filter @repo/db db:generate         # Prisma Client を生成
pnpm --filter @repo/db db:migrate          # マイグレーション作成（開発）
pnpm --filter @repo/db db:migrate:deploy   # マイグレーション適用（本番）
pnpm --filter @repo/db db:seed             # シード投入
pnpm --filter @repo/db db:studio           # Prisma Studio 起動
```

`postinstall` で `prisma generate` が自動実行されるため、新規 clone / CI install 時に generated client が必ず揃う。

## ディレクトリ構成

```
packages/db/
├── prisma/
│   ├── schema.prisma         # 唯一の DB スキーマ
│   ├── migrations/           # マイグレーション履歴
│   ├── prisma.config.ts      # Prisma CLI 設定
│   └── seed.ts               # 全 app 共通のシード
├── src/
│   ├── client.ts             # createPrismaClient factory
│   └── index.ts              # client + 生成型 re-export
└── generated/                # prisma generate 出力（gitignore）
```

## 設計詳細

- なぜ singleton を持たず factory のみか
- read replica の振り分けルール
- `seed.ts` を packages に集約する理由

→ [`docs/spec/shared-packages/README.md`](../../docs/spec/shared-packages/README.md) の「@repo/db の設計」を参照。
