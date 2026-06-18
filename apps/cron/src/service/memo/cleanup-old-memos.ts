import { logger } from "@repo/logger"

import type { MemoRepository } from "../../repository/prisma"

/**
 * 古い memo を一括削除する service。
 *
 * 「何日以上前を消すか」「現在時刻」「Repository」を引数で受け取る純粋なドメイン層。
 * env や Prisma client の生成は知らないので、task / unit test の両方から同じ形で呼べる。
 *
 * apps/api の service と同じく Repository は単一でも `repo: { ... }` のオブジェクト引数で
 * 受ける。将来 Repository が増えてもシグネチャを変えなくて済む。
 */
export type CleanupOldMemosInput = {
  /** 現在時刻（DI することでテスト時に固定できる） */
  now: Date
  /** この日数より前に作成された memo を削除対象とする */
  olderThanDays: number
}

export type CleanupOldMemosResult = {
  deletedCount: number
  threshold: Date
}

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000

export const cleanupOldMemos = async (
  input: CleanupOldMemosInput,
  repo: { memoRepository: MemoRepository },
): Promise<CleanupOldMemosResult> => {
  const threshold = new Date(input.now.getTime() - input.olderThanDays * MILLIS_PER_DAY)

  logger.debug("cleanupOldMemos: deleting memos older than threshold", {
    olderThanDays: input.olderThanDays,
    threshold: threshold.toISOString(),
  })

  const deletedCount = await repo.memoRepository.deleteOlderThan(threshold)

  logger.debug("cleanupOldMemos: completed", { deletedCount })

  return { deletedCount, threshold }
}
