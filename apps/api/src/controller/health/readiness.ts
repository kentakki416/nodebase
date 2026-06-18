import { Request, Response } from "express"

import { healthReadinessResponseSchema } from "@repo/api-schema"
import { logger } from "@repo/logger"

import { parseResponse } from "../../lib/parse-schema"
import { DatabaseHealthRepository } from "../../repository/prisma"
import { RedisHealthRepository } from "../../repository/redis"
import * as service from "../../service"

/**
 * Readiness チェック
 * 外部サービス（DB, Redis）への接続状態を確認する
 * 健康診断エンドポイントなので、依存サービスが落ちている場合は 503 を返す
 * （他の Controller と異なり、独自にステータスコードを制御）
 */
export class HealthReadinessController {
  constructor(
    private _databaseHealthRepository: DatabaseHealthRepository,
    private _redisHealthRepository: RedisHealthRepository,
  ) {}

  public async execute(_req: Request, res: Response) {
    const result = await service.health.checkReadiness({
      databaseHealthRepository: this._databaseHealthRepository,
      redisHealthRepository: this._redisHealthRepository,
    })

    /**
     * checkReadiness は常に ok: true を返す（個別サービス失敗は status: "error" に集約される）
     * 予期しない throw はグローバルエラーハンドラが 500 で返す
     */
    if (!result.ok) {
      return res.status(503).json({ error: result.error.message, status_code: 503 })
    }

    const { database, redis } = result.value
    const overallStatus = database.status === "ok" && redis.status === "ok" ? "ok" : "degraded"

    /**
     * degraded（依存サービスのいずれかが落ちている）時はアラートのため warn ログを残す
     * sendError 経由ではなく独自に 503 を返すため、ログもこの場で出す
     */
    if (overallStatus !== "ok") {
      logger.warn("Readiness degraded", {
        database: database.status,
        redis: redis.status,
      })
    }

    const response = parseResponse(healthReadinessResponseSchema, {
      services: { database, redis },
      status: overallStatus,
    })

    const statusCode = overallStatus === "ok" ? 200 : 503
    res.status(statusCode).json(response)
  }
}
