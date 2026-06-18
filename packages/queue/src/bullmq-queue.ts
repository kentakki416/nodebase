import { Queue, Worker } from "bullmq"

import { logger } from "@repo/logger"
import type { Redis } from "@repo/redis"

import type {
  EnqueueOptions,
  JobConsumer,
  JobQueue,
  StartWorkerOptions,
} from "./types"

/**
 * BullMQ ベースの `JobQueue` 実装。
 *
 * 他の queue 実装 (AWS SQS / GCP Cloud Tasks / pg-boss / Inngest 等) に切り替えるときは、
 * 同じ `JobQueue<T>` interface を実装した別クラス（例: `SqsJobQueue<T>`）を用意し、
 * app 側の生成箇所だけ差し替える。ジョブハンドラは `JobQueue<T>` interface しか
 * 知らないため、Queue 実装の変更で影響を受けない。
 */
export class BullMQJobQueue<T> implements JobQueue<T> {
  private _queue: Queue<T>

  constructor(redis: Redis, queueName: string) {
    this._queue = new Queue<T>(queueName, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { delay: 5000, type: "exponential" },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400 },
      },
    })
  }

  public async enqueue(data: T, options?: EnqueueOptions): Promise<void> {
    /**
     * BullMQ 5.x の `Queue.add` は jobName / data を discriminated union で絞る
     * 高度な generic (`ExtractNameType<T,...>` / `ExtractDataType<T,...>`) を
     * 要求するが、ここでは generic な `T` をそのまま受ける queue 抽象越しなので
     * 型推論が決まらない。`never` キャストで通す（実行時挙動は変わらない）。
     */
    await this._queue.add(
      this._queue.name as never,
      data as never,
      {
        delay: options?.delayMs,
        jobId: options?.jobId,
      },
    )
  }

  public async close(): Promise<void> {
    await this._queue.close()
  }
}

/**
 * BullMQ ベースの Worker を起動する。返り値の `JobConsumer.close()` で
 * 新規ジョブ取得を停止し、in-flight ジョブの完了を待つ (graceful shutdown 用)。
 *
 * BullMQ の Worker は内部で Redis 接続を共有するため、呼び出し側で
 * `maxRetriesPerRequest: null` を指定した ioredis インスタンスを渡すこと
 * (BullMQ 5.x の要件)。
 */
export const startBullMQWorker = <T>(
  redis: Redis,
  options: StartWorkerOptions<T>,
): JobConsumer => {
  const worker = new Worker<T>(
    options.queueName,
    async (job) => {
      await options.processor({
        attemptsMade: job.attemptsMade,
        data: job.data,
        id: job.id ?? "",
      })
    },
    {
      concurrency: options.concurrency ?? 1,
      connection: redis,
    },
  )

  worker.on("failed", (job, err) => {
    logger.error(
      "[queue] job failed",
      err instanceof Error ? err : new Error(String(err)),
      { jobId: job?.id, queueName: options.queueName },
    )
  })

  worker.on("completed", (job) => {
    logger.debug("[queue] job completed", {
      jobId: job.id,
      queueName: options.queueName,
    })
  })

  return {
    close: async (): Promise<void> => {
      await worker.close()
    },
  }
}
