import type { PrismaClient } from "@repo/db"
import { logger } from "@repo/logger"

export type ShutdownHandle = {
  isShuttingDown: () => boolean
}

/**
 * SIGTERM (ECS Scheduled Task の停止シグナル) / SIGINT (Ctrl-C) を受けたとき
 * Prisma を disconnect してから process.exit する graceful shutdown を登録する。
 *
 * 返り値の isShuttingDown は task 側のループや finally から「停止指示を受けたか」を
 * 読むためのハンドル。進行中の処理は中断しないので、長時間ループや batch では
 * 各 iteration の頭でこれをチェックして自発的に break すること。
 */
export const setupGracefulShutdown = (prisma: PrismaClient): ShutdownHandle => {
  let shuttingDown = false
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    logger.warn("shutdown initiated", { signal })
    try {
      await prisma.$disconnect()
    } catch (err) {
      logger.error(
        "prisma disconnect failed during shutdown",
        err instanceof Error ? err : new Error(String(err)),
      )
    }
    process.exit(signal === "SIGTERM" ? 0 : 130)
  }
  process.on("SIGTERM", (signal) => void shutdown(signal))
  process.on("SIGINT", (signal) => void shutdown(signal))
  return { isShuttingDown: () => shuttingDown }
}
