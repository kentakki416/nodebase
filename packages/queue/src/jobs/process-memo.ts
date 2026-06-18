/**
 * `process-memo` Queue: memo を非同期に処理するサンプル job。
 *
 * Producer (api / cron / 他の worker など) はこの module の
 * `PROCESS_MEMO_QUEUE_NAME` と `ProcessMemoJobData` 型を import して enqueue する。
 * Consumer (apps/worker) は同じ型を import し、`JobProcessor<ProcessMemoJobData>` の
 * 形で処理関数を実装する。
 */
export const PROCESS_MEMO_QUEUE_NAME = "process-memo"

export type ProcessMemoJobData = {
  memoId: number
}

/**
 * 同じ memoId に対する重複 enqueue を防ぐための決定的 jobId。
 * BullMQ では同じ jobId のジョブを add しようとしても黙って捨てられる
 * (他の Queue 実装では best-effort)。
 */
export const buildProcessMemoJobId = (memoId: number): string =>
  `process-memo-${memoId}`
