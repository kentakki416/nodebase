import { logger } from "@repo/logger"
import type { JobProcessor, ProcessMemoJobData } from "@repo/queue"

import type { MemoRepository } from "../repository/prisma"

/**
 * `process-memo` ジョブハンドラ。
 *
 * memoId を受け取り、Repository 経由で memo を取得してログ出力する。サンプルなので
 * 副作用はログだけだが、メール送信 / 通知 / 集計などに置き換えやすいよう
 * 「Repository を引数で受け取る純粋関数」として書く。
 *
 * **重要**: BullMQ や別の Queue 実装の型 (Job / Worker など) は import しない。
 * `JobProcessor<T>` 経由でしか Queue を knows しないので、別実装に乗り換えても
 * このファイルは変更不要。
 *
 * 冪等性: 同じ memo を何度処理しても DB を壊さないこと（ジョブはリトライされうるため）。
 * 本サンプルは read-only なので自然に冪等。
 */
export type ProcessMemoDeps = {
  memoRepository: MemoRepository
}

export const processMemo = (
  deps: ProcessMemoDeps,
): JobProcessor<ProcessMemoJobData> =>
  async (message) => {
    const memo = await deps.memoRepository.findById(message.data.memoId)
    if (!memo) {
      logger.warn("processMemo: memo not found", {
        jobId: message.id,
        memoId: message.data.memoId,
      })
      return
    }
    logger.info("processMemo: processed", {
      jobId: message.id,
      memoId: memo.id,
      title: memo.title,
    })
  }
