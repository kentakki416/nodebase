import { createPrismaClient } from "@repo/db"
import { logger } from "@repo/logger"

import { env } from "../env"
import { PrismaMemoRepository } from "../repository/prisma"
import { setupGracefulShutdown } from "../runtime/graceful-shutdown"
import * as service from "../service"

/**
 * cleanup:old-memos
 *
 * `CLEANUP_MEMO_OLDER_THAN_DAYS` (default: 90) 日より前に作成された memo を
 * まとめて削除する。本番では EventBridge → ECS Scheduled Task で日次 / 週次
 * 起動する想定。
 *
 * task 自身は Prisma client / Repository を組み立てて service に DI するだけ。
 * 削除ロジック（閾値計算 / 件数取得）は `service.memo.cleanupOldMemos` に集約してある。
 * 失敗時は throw でプロセスを exit code 1 で終わらせ、外側のスケジューラに通知する。
 */
const main = async (): Promise<void> => {
  const prisma = createPrismaClient({ url: env.DATABASE_URL })
  setupGracefulShutdown(prisma)

  const memoRepository = new PrismaMemoRepository(prisma)

  logger.info("cleanup-old-memos started", {
    olderThanDays: env.CLEANUP_MEMO_OLDER_THAN_DAYS,
  })

  try {
    const { deletedCount, threshold } = await service.memo.cleanupOldMemos(
      { now: new Date(), olderThanDays: env.CLEANUP_MEMO_OLDER_THAN_DAYS },
      { memoRepository },
    )
    logger.info("cleanup-old-memos completed", {
      deletedCount,
      threshold: threshold.toISOString(),
    })
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err: unknown) => {
  logger.error(
    "cleanup-old-memos failed",
    err instanceof Error ? err : new Error(String(err)),
  )
  process.exit(1)
})
