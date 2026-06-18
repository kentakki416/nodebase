import crypto from "crypto"

import type { Request, Response, NextFunction } from "express"

import { logger, logContext } from "@repo/logger"

import { LOG_EXCLUDE_PATHS } from "../const"

import type { AuthRequest } from "./auth"

/**
 * リクエストのアクセスログを担当するミドルウェア
 * - 受信時 / 完了時 / 異常切断時の 3 イベントを info / warn で記録する
 * - ステータスコードによる level 分岐はしない（エラー詳細は出さず status / latency / path のみ）
 * - エラーの内容ログは sendError ヘルパ（業務 4xx）と unhandled-exception-handler（想定外例外）の責務
 * - requestId を AsyncLocalStorage に積み、同一リクエストの全ログに自動付与する
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  /**
   * ヘルスチェック等はログ除外
   */
  if (LOG_EXCLUDE_PATHS.some(path => path === req.path)) {
    return next()
  }

  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  const authReq = req as AuthRequest
  const userId = authReq.userId || "unauthenticated"

  /**
   * AsyncLocalStorage でコンテキストを設定
   * この中で実行される全てのログに自動的に requestId / userId が含まれる
   */
  logContext.run({ requestId, userId }, () => {
    /**
     * リクエスト受信時のログ
     */
    logger.info("API Request Received", {
      duration: 0,
      ip: req.ip,
      method: req.method,
      path: req.path,
      userAgent: req.get("user-agent") || "unknown",
    })

    /**
     * レスポンス完了時のアクセスログ
     * ステータスコードに関わらず info で出す（HTTP ライフサイクルの完了を意味するため）
     */
    res.on("finish", () => {
      const duration = Date.now() - startTime
      logger.info("API Request Completed", {
        duration,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
      })
    })

    /**
     * 予期しないクローズ時のログ（クライアント切断、タイムアウト等）
     */
    res.on("close", () => {
      if (!res.writableEnded) {
        const duration = Date.now() - startTime

        logger.warn("API Request Closed Unexpectedly", {
          duration,
          method: req.method,
          path: req.path,
        })
      }
    })

    next()
  })
}
