import { AsyncLocalStorage } from "async_hooks"

/**
 * ログコンテキスト
 * リクエストごとに保持される情報
 */
export interface LogContext {
  requestId?: string
  userId?: number | string
}

/**
 * AsyncLocalStorage インスタンス
 * リクエストごとに独立したコンテキストを保持
 */
export const logContext = new AsyncLocalStorage<LogContext>()
