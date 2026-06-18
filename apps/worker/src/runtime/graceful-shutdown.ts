import type { PrismaClient } from "@repo/db"
import { logger } from "@repo/logger"
import type { JobConsumer } from "@repo/queue"
import type { Redis } from "@repo/redis"

export type ShutdownDeps = {
  consumers: JobConsumer[]
  prisma: PrismaClient
  redis: Redis
}

/**
 * SIGTERM (ECS deploy) / SIGINT (Ctrl-C) を受けたら:
 *
 *   1. 全 `JobConsumer.close()` を並列で呼ぶ
 *      → 新規ジョブ取得停止 + in-flight ジョブの完了を待機
 *   2. Prisma を $disconnect、Redis を quit
 *   3. process.exit(0)
 *
 * ECS は `stop_timeout_seconds` 以内に終了しなければ SIGKILL を送るため、
 * 1 ジョブの最大処理時間がこの値を超えないように設計する (BullMQ の stalled 検出で
 * 別 worker に再アサインされ 2 回実行になりうるが、ジョブが冪等であれば問題ない)。
 */
export const setupGracefulShutdown = (deps: ShutdownDeps): void => {
  let shuttingDown = false
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    logger.warn("worker shutdown initiated", { signal })
    try {
      await Promise.all(deps.consumers.map(async (c) => c.close()))
      await Promise.all([deps.prisma.$disconnect(), deps.redis.quit()])
      logger.info("worker shutdown completed")
      process.exit(0)
    } catch (err) {
      logger.error(
        "worker shutdown failed",
        err instanceof Error ? err : new Error(String(err)),
      )
      process.exit(1)
    }
  }
  process.on("SIGTERM", (signal) => void shutdown(signal))
  process.on("SIGINT", (signal) => void shutdown(signal))
}
