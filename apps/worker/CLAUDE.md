# apps/worker

BullMQ (現状の Queue 実装) からジョブを取り出して処理する常駐型の worker プロセス。本番では ECS Service (long-running) / Kubernetes Deployment を想定。

## 設計の核: Queue 実装を差し替え可能にする

ジョブハンドラ (`src/jobs/*.ts`) は **`packages/queue` が公開する抽象 (`JobProcessor<T>` / `JobMessage<T>`) しか knows しない**。BullMQ の `Job` / `Worker` 型を直接 import するのは `packages/queue/src/bullmq-queue.ts` と `apps/worker/src/index.ts` (Redis 接続を作る所) だけ。

将来 SQS / GCP Cloud Tasks / pg-boss / Inngest 等に乗り換えるときは:

1. `packages/queue` に同じ `JobQueue<T>` interface を実装した別クラスを追加 (例: `SqsJobQueue<T>`)
2. `apps/worker/src/index.ts` の `createRedisClient` + `startBullMQWorker` を新実装に置き換え

ジョブハンドラ自体 (`src/jobs/process-memo.ts`) は無変更で済む。これが「疎結合」の意図。

## 含まれる Worker

| Queue 名 | ジョブ型 | 処理内容 |
| --- | --- | --- |
| `process-memo` | `ProcessMemoJobData = { memoId: number }` | memo を id で fetch してログ出力（メール送信 / 通知などに差し替える起点） |

新しい Queue を追加する手順は本ドキュメント末尾の「新 Queue の追加」を参照。

## Commands

```bash
pnpm dev              # tsx watch で src/index.ts を起動
pnpm build            # dist/ にコンパイル
pnpm start            # dist/index.js を実行
pnpm lint             # ESLint
pnpm test             # Vitest（Prisma / Redis を mock するので DB / Redis 不要）
```

## ディレクトリ構成

```
apps/worker/
  src/
    index.ts                       # PrismaClient / Redis を生成し、各 startXxxWorker を呼んで graceful shutdown に登録
    env.ts                         # Zod による env 検証 (safeParse → exit(1))
    workers/                       # Queue 実装 + ハンドラを「結線」する組み立て層
      process-memo-worker.ts       # startBullMQWorker(...) を呼んで JobConsumer を返す
    jobs/                          # 純粋なジョブハンドラ。Queue 実装を knows しない
      process-memo.ts              # ProcessMemoDeps を受けて JobProcessor<ProcessMemoJobData> を返す factory
    runtime/
      graceful-shutdown.ts         # SIGTERM/SIGINT で consumers.close() → Prisma/Redis を閉じる
    repository/prisma/             # DB アクセス (api / cron と同じ構造)
      memo-repository.ts
      index.ts                     # barrel export
  test/                            # vitest unit test
```

## レイヤード設計のルール

- **`jobs/<name>.ts`**: 純粋関数 (`(deps) => JobProcessor<T>` の factory 形式)。`@repo/queue` から `JobProcessor<T>` / `JobMessage<T>` だけ import する。**BullMQ や ioredis を直接 import しない**
- **`workers/<name>-worker.ts`**: Queue 実装 (現状は `startBullMQWorker`) と job ハンドラを結線するだけ。ここが Queue 実装を切り替えるときの唯一の差分対象
- **`repository/prisma/`**: `interface XxxRepository` + `class PrismaXxxRepository implements XxxRepository` のペア + barrel
- **`runtime/graceful-shutdown.ts`**: SIGTERM/SIGINT を捕まえて全 `JobConsumer.close()` → Prisma/Redis 切断 → exit
- **`src/index.ts`**: 接続生成 (Prisma / Redis) + Repository インスタンス化 + 各 Worker 起動 + graceful shutdown 登録

### Repository の interface 分離

worker 側の `MemoRepository` は apps/api / apps/cron と意図的に分離している。各 app は必要な操作のみを持つ独自 interface を定義する方針（共有 interface を作ると不要なメソッドが漏れるため）。

### 冪等性は必須

BullMQ の stalled 検出 / リトライ / ECS deploy 時の SIGKILL 等で **同じジョブが複数回実行されうる**。ジョブハンドラは「再実行されても DB が壊れない」設計が必須。

- read-only 処理（fetch + ログ等）は自然に冪等
- write は upsert / 既処理フラグ / 決定的キーでの dedupe などで冪等化する
- どうしても exactly-once が必要なら DB 側で transactional outbox を組む（worker 単体では実現できない）

## 環境変数

| 変数 | 必須 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `DATABASE_URL` | NODE_ENV !== "test" のとき必須 | - | Prisma の接続文字列 |
| `REDIS_URL` | NODE_ENV !== "test" のとき必須 | - | BullMQ 用 Redis 接続 URL |
| `NODE_ENV` | no | `development` | `development` / `test` / `production` |
| `LOGGER_TYPE` | no | `pino` | `pino` / `winston` / `console` / `silent` |
| `LOG_LEVEL` | no | `info` | `debug` / `info` / `warn` / `error` |
| `WORKER_CONCURRENCY` | no | `10` | 1 worker あたりの同時並行ジョブ数 |

## 新 Queue の追加

例: `send-notification` queue を追加する手順。

### 1. `packages/queue` に Job 型と queue 名を追加

`packages/queue/src/jobs/send-notification.ts`:

```ts
export const SEND_NOTIFICATION_QUEUE_NAME = "send-notification"
export type SendNotificationJobData = { userId: number; message: string }
export const buildSendNotificationJobId = (userId: number, ts: number): string =>
  `send-notification-${userId}-${ts}`
```

`packages/queue/src/jobs/index.ts` に re-export を追加。

### 2. `apps/worker/src/jobs/send-notification.ts` に純粋ハンドラを書く

```ts
import { logger } from "@repo/logger"
import type { JobProcessor, SendNotificationJobData } from "@repo/queue"

export type SendNotificationDeps = { /* ... */ }

export const sendNotification = (deps: SendNotificationDeps): JobProcessor<SendNotificationJobData> =>
  async (message) => {
    /* 実際の送信処理 */
    logger.info("notification sent", { userId: message.data.userId })
  }
```

### 3. `apps/worker/src/workers/send-notification-worker.ts` で結線する

```ts
import { SEND_NOTIFICATION_QUEUE_NAME, startBullMQWorker } from "@repo/queue"
import type { JobConsumer } from "@repo/queue"
import type { Redis } from "@repo/redis"
import { sendNotification } from "../jobs/send-notification"

export const startSendNotificationWorker = (
  args: { redis: Redis; concurrency: number },
): JobConsumer =>
  startBullMQWorker(args.redis, {
    concurrency: args.concurrency,
    processor: sendNotification({ /* ... */ }),
    queueName: SEND_NOTIFICATION_QUEUE_NAME,
  })
```

### 4. `src/index.ts` で起動して consumers に追加

```ts
const consumers = [
  startProcessMemoWorker({ ... }),
  startSendNotificationWorker({ redis, concurrency: env.WORKER_CONCURRENCY }),
]
```

`packages/queue` から enqueue する側（api 等）は `BullMQJobQueue` を作って `enqueue({ userId, message })` するだけ。

## コードスタイル

ルート `CLAUDE.md` の規約に従う。Function style は **`const + arrow function`**。クラスメンバーは `public` / `private` 明示 + private には `_` プレフィックス必須。
