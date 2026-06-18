# apps/worker

BullMQ ベースの常駐 worker。`packages/queue` の Queue 抽象を介してジョブを処理するため、別の Queue 実装 (SQS / Cloud Tasks / pg-boss 等) に乗り換える際もハンドラ側のコードは変更不要 (詳細は [`CLAUDE.md`](./CLAUDE.md) 参照)。

## サンプルジョブ

| Queue 名 | ペイロード | 処理内容 |
| --- | --- | --- |
| `process-memo` | `{ memoId: number }` | memo を id で fetch してログ出力（メール送信 / 通知などへの差し替えの起点） |

## セットアップ

```bash
# ルートで一度だけ
pnpm install
pnpm --filter @repo/db db:generate
```

## 開発

```bash
# 起動 (tsx watch)
DATABASE_URL=postgres://... REDIS_URL=redis://localhost:6379 pnpm dev
```

## enqueue する側のサンプル (api 等から)

```ts
import { BullMQJobQueue, PROCESS_MEMO_QUEUE_NAME, buildProcessMemoJobId } from "@repo/queue"
import { createRedisClient } from "@repo/redis"

const redis = createRedisClient({ url: process.env.REDIS_URL })
const queue = new BullMQJobQueue<{ memoId: number }>(redis, PROCESS_MEMO_QUEUE_NAME)

await queue.enqueue(
  { memoId: 42 },
  { jobId: buildProcessMemoJobId(42) },  // 重複 enqueue を防ぐ決定的 ID
)
```

## ビルド & 本番起動

```bash
pnpm build
DATABASE_URL=... REDIS_URL=... node dist/index.js
```

Dockerfile はマルチステージで用意済み:

```bash
docker build -f apps/worker/Dockerfile -t nodebase-worker .
docker run --rm -e DATABASE_URL=... -e REDIS_URL=... nodebase-worker
```

## 環境変数

詳細は [`CLAUDE.md`](./CLAUDE.md) を参照。`DATABASE_URL` / `REDIS_URL` が NODE_ENV !== "test" のとき必須。
