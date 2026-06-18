import { type JobConsumer, PROCESS_MEMO_QUEUE_NAME, startBullMQWorker } from "@repo/queue"
import type { Redis } from "@repo/redis"

import { processMemo } from "../jobs/process-memo"
import type { MemoRepository } from "../repository/prisma"

/**
 * `process-memo` Worker の組み立て。
 *
 * Queue 実装 (BullMQ) と job ハンドラ (processMemo) をここで結線する。
 * 別の Queue 実装 (SQS / Cloud Tasks 等) に切り替えるときは `startBullMQWorker` を
 * 別関数に差し替えるだけで、`processMemo` 自体は変更不要。
 */
export type StartProcessMemoWorkerArgs = {
  concurrency: number
  memoRepository: MemoRepository
  redis: Redis
}

export const startProcessMemoWorker = (
  args: StartProcessMemoWorkerArgs,
): JobConsumer =>
  startBullMQWorker(args.redis, {
    concurrency: args.concurrency,
    processor: processMemo({ memoRepository: args.memoRepository }),
    queueName: PROCESS_MEMO_QUEUE_NAME,
  })
