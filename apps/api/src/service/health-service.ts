import { ok, Result } from "@repo/errors"
import { logger } from "@repo/logger"

import { DatabaseHealthRepository } from "../repository/prisma"
import { RedisHealthRepository } from "../repository/redis"

export type ServiceStatus = {
  latency_ms: number
  status: "ok" | "error"
}

export type ReadinessResult = {
  database: ServiceStatus
  redis: ServiceStatus
}

/**
 * Readiness チェック
 * 外部サービス（DB, Redis）への接続状態を並列で確認する
 * 個別サービスの失敗は "error" ステータスとして結果に含め、業務エラーにはしない
 */
export const checkReadiness = async (
  repo: {
    databaseHealthRepository: DatabaseHealthRepository
    redisHealthRepository: RedisHealthRepository
  },
): Promise<Result<ReadinessResult>> => {
  const [database, redis] = await Promise.all([
    checkService("Database", repo.databaseHealthRepository),
    checkService("Redis", repo.redisHealthRepository),
  ])

  return ok({
    database,
    redis,
  })
}

const checkService = async (
  name: string,
  repo: { ping(): Promise<void> },
): Promise<ServiceStatus> => {
  const start = Date.now()
  try {
    await repo.ping()
    return {
      latency_ms: Date.now() - start,
      status: "ok",
    }
  } catch (error) {
    logger.error(
      `HealthService: ${name} check failed`,
      error instanceof Error ? error : new Error("Unknown error")
    )
    return {
      latency_ms: Date.now() - start,
      status: "error",
    }
  }
}
