import { NextFunction, Request, Response } from "express"

import { ErrorResponse } from "@repo/api-schema"
import { logger } from "@repo/logger"

import { RequestSchemaMismatchError, ResponseSchemaMismatchError } from "../lib/parse-schema"

/**
 * ルート内で throw された想定外例外を捕捉する Express の最終エラーハンドラ
 * 業務 4xx エラー（Service の Result.err）は Controller の sendError 経由で返却されるため、ここを通らない
 *
 * 捕捉対象:
 * - RequestSchemaMismatchError    → 400 + warn ログ（クライアント入力不正）
 * - ResponseSchemaMismatchError   → 500 + error ログ（サーバ起因の契約違反、Zod issues 付き）
 * - その他の throw（DB 障害等）   → 500 + error ログ（スタック付き）
 *
 * Express の「引数が4つのミドルウェア」はエラーハンドラとして扱われるため
 * シグネチャは (err, req, res, next) で固定。next は呼ばないが Express の規約で受け取る
 */
export const unhandledExceptionHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  /**
   * すでにレスポンス送信済みなら Express に委譲（二重送信防止）
   */
  if (res.headersSent) {
    return
  }

  /**
   * リクエスト検証失敗は 400 Bad Request
   */
  if (err instanceof RequestSchemaMismatchError) {
    logger.warn("Request validation error", {
      issues: err.zodError.issues,
      method: req.method,
      path: req.path,
    })
    const errorResponse: ErrorResponse = {
      error: "Invalid request",
      status_code: 400,
    }
    return res.status(400).json(errorResponse)
  }

  /**
   * レスポンス検証失敗はサーバ起因の不整合 → 500
   */
  if (err instanceof ResponseSchemaMismatchError) {
    logger.error("Response schema mismatch", err, {
      issues: err.zodError.issues,
      method: req.method,
      path: req.path,
    })
    const errorResponse: ErrorResponse = {
      error: "Internal Server Error",
      status_code: 500,
    }
    return res.status(500).json(errorResponse)
  }

  /**
   * 想定外の例外は 500 Internal Server Error
   * （Service 層が外部 API のレスポンスを zod 検証した際の素の ZodError もここに落ちる）
   */
  logger.error(
    "Unhandled exception",
    err instanceof Error ? err : new Error(String(err)),
    {
      method: req.method,
      path: req.path,
    }
  )

  const errorResponse: ErrorResponse = {
    error: "Internal Server Error",
    status_code: 500,
  }
  res.status(500).json(errorResponse)
}
