# @repo/queue

ジョブキューの **抽象 (`JobQueue<T>` / `JobProcessor<T>` / `JobConsumer`) + BullMQ 実装 + Job 型定義** を提供する共有パッケージ。

## 役割

- Producer (api / cron 等) と Worker (apps/worker) が **同じ Job 型・同じ Queue 名** を共有
- BullMQ への依存を本パッケージに閉じ込め、**ジョブハンドラ側は実装を knows しない**
- 将来 SQS / Cloud Tasks / pg-boss / Inngest 等に乗り換える際、**ハンドラ無変更** で実装だけ差し替え可能

## 設計の核

```
┌────────────────────┐        ┌──────────────────┐
│  apps/api (producer) │ ──▶ │ JobQueue<T>      │ ◀── 実装は BullMQ / SQS / ...
└────────────────────┘        │  .enqueue(...)   │
                              └──────────────────┘
                                       │
                                       ▼
┌────────────────────┐        ┌──────────────────┐
│ apps/worker (jobs/) │ ◀──── │ JobProcessor<T>  │ ◀── 実装に依存しない純粋関数
└────────────────────┘        │  (msg) => Promise │
                              └──────────────────┘
```

ジョブハンドラ (`apps/worker/src/jobs/*.ts`) は **本パッケージの型しか import しない**。BullMQ の `Job` / `Worker` 型を import するのは本パッケージ内部と `apps/worker/src/index.ts` だけ。

## 公開 API

```ts
import {
  // ===== Queue 抽象 =====
  type JobQueue,
  type JobProcessor,
  type JobConsumer,
  type JobMessage,
  type EnqueueOptions,
  type StartWorkerOptions,

  // ===== BullMQ 実装 =====
  BullMQJobQueue,        // class, Producer 用
  startBullMQWorker,     // function, Consumer 用

  // ===== Job 型 + Queue 名 =====
  PROCESS_MEMO_QUEUE_NAME,
  type ProcessMemoJobData,
  buildProcessMemoJobId,
} from "@repo/queue"
```

### 抽象型

| 型 | 役割 |
| --- | --- |
| `JobQueue<T>` | Producer 側の interface。`enqueue(data, opts?)` / `close()` |
| `JobProcessor<T>` | `(msg: JobMessage<T>) => Promise<void>` の純粋関数 |
| `JobConsumer` | Worker のハンドル。`close()` で graceful shutdown |
| `JobMessage<T>` | Worker が受け取る最小情報（`id` / `data` / `attemptsMade`） |

## 使い方

### Producer 側（api / cron から enqueue）

```ts
import {
  BullMQJobQueue,
  PROCESS_MEMO_QUEUE_NAME,
  buildProcessMemoJobId,
  type ProcessMemoJobData,
} from "@repo/queue"
import { createRedisClient } from "@repo/redis"

const redis = createRedisClient({ options: { maxRetriesPerRequest: null } })
const queue: JobQueue<ProcessMemoJobData> = new BullMQJobQueue(
  redis,
  PROCESS_MEMO_QUEUE_NAME,
)

await queue.enqueue(
  { memoId: 42 },
  { jobId: buildProcessMemoJobId(42) },  // 決定的 ID で重複 enqueue を防ぐ
)
```

### Consumer 側（apps/worker）

```ts
// apps/worker/src/jobs/process-memo.ts ─ 実装に依存しない純粋関数
import type { JobProcessor, ProcessMemoJobData } from "@repo/queue"

export const processMemo = (deps: Deps): JobProcessor<ProcessMemoJobData> =>
  async (msg) => {
    const memo = await deps.memoRepository.findById(msg.data.memoId)
    deps.logger.info("memo processed", { memoId: msg.data.memoId })
  }

// apps/worker/src/workers/process-memo-worker.ts ─ 結線
import { startBullMQWorker, PROCESS_MEMO_QUEUE_NAME } from "@repo/queue"

export const startProcessMemoWorker = (args) =>
  startBullMQWorker(args.redis, {
    concurrency: args.concurrency,
    processor: processMemo({ ... }),
    queueName: PROCESS_MEMO_QUEUE_NAME,
  })
```

## 新しい Queue の追加手順

1. `src/jobs/<name>.ts` に **Queue 名・ペイロード型・jobId ビルダ** を定義
2. `src/jobs/index.ts` で re-export
3. `apps/worker/src/jobs/<name>.ts` に **純粋ハンドラ**（`(deps) => JobProcessor<T>`）を実装
4. `apps/worker/src/workers/<name>-worker.ts` で `startBullMQWorker` と結線
5. `apps/worker/src/index.ts` の `consumers` 配列に追加

詳細は [`apps/worker/CLAUDE.md`](../../apps/worker/CLAUDE.md) の「新 Queue の追加」を参照。

## 別 Queue 実装への乗り換え

例: BullMQ → SQS。

1. 本パッケージに `SqsJobQueue<T>` (= `JobQueue<T>` 実装) と `startSqsWorker` を追加
2. `apps/worker/src/workers/*.ts` の `startBullMQWorker` を `startSqsWorker` に差し替え
3. Producer 側 (api / cron) の `new BullMQJobQueue(...)` を `new SqsJobQueue(...)` に差し替え

**ジョブハンドラ自体 (`apps/worker/src/jobs/*.ts`) は無変更**。これが疎結合の意図。

## 含まれる Job

| Queue 名 | ペイロード | 用途 |
| --- | --- | --- |
| `process-memo` | `{ memoId: number }` | memo を id で fetch してログ出力（メール送信 / 通知への差し替えの起点） |

## 冪等性は必須

BullMQ の stalled 検出 / リトライ / ECS deploy 時の SIGKILL 等で **同じジョブが複数回実行されうる**。

- read-only 処理は自然に冪等
- write は upsert / 既処理フラグ / 決定的キーでの dedupe で冪等化
- exactly-once が必要なら DB 側で transactional outbox を組む（worker 単体では実現不可）

## ディレクトリ構成

```
packages/queue/
└── src/
    ├── types.ts            # JobQueue / JobProcessor / JobConsumer 等の抽象型
    ├── bullmq-queue.ts     # BullMQJobQueue + startBullMQWorker
    ├── jobs/               # Job 型 + Queue 名 + jobId ビルダ
    │   ├── process-memo.ts
    │   └── index.ts
    └── index.ts
```

## 関連

- [apps/worker/README.md](../../apps/worker/README.md) / [apps/worker/CLAUDE.md](../../apps/worker/CLAUDE.md)
