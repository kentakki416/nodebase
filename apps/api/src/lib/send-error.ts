import type { Request, Response } from "express"

import { ErrorResponse } from "@repo/api-schema"
import { ApiError } from "@repo/errors"
import { logger } from "@repo/logger"

/**
 * Service の Result.err を HTTP レスポンスとして返却する共通ヘルパ
 * - logger.warn で業務エラーを構造化ログに残す（method / path / statusCode / type）
 * - ErrorResponse スキーマで JSON を組み立てて返す
 *
 * Controller の `if (!result.ok)` ブロックは必ずこのヘルパ経由で返却すること。
 * inline で res.status().json() を書くとログ漏れが発生する。
 *
 * このヘルパは throw しないため、想定外例外を捕捉する unhandled-exception-handler は
 * このパスを通らない（業務エラーと想定外例外を経路レベルで分離する設計）
 */
export const sendError = (req: Request, res: Response, error: ApiError) => {
  logger.warn("API business error", {
    method: req.method,
    path: req.path,
    statusCode: error.statusCode,
    type: error.type,
  })
  const errorResponse: ErrorResponse = {
    error: error.message,
    status_code: error.statusCode,
  }
  return res.status(error.statusCode).json(errorResponse)
}
