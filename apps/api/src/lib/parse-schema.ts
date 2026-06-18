import { ZodError, ZodSchema } from "zod"

/**
 * リクエストの Zod 検証失敗を表す独自エラー
 * グローバルエラーハンドラはこれを 400 として扱う
 */
export class RequestSchemaMismatchError extends Error {
  constructor(public readonly zodError: ZodError) {
    super("Request schema mismatch")
    this.name = "RequestSchemaMismatchError"
  }
}

/**
 * レスポンスの Zod 検証失敗を表す独自エラー
 * リクエスト検証エラーと区別するためにラップする
 * グローバルエラーハンドラはこれを 500 として扱う（サーバ起因の契約違反）
 */
export class ResponseSchemaMismatchError extends Error {
  constructor(public readonly zodError: ZodError) {
    super("Response schema mismatch")
    this.name = "ResponseSchemaMismatchError"
  }
}

/**
 * Controller でリクエスト（body / params / query）を検証するヘルパ
 * 失敗時は RequestSchemaMismatchError を throw し、グローバルエラーハンドラ経由で 400 を返す
 */
export const parseRequest = <T>(schema: ZodSchema<T>, value: unknown): T => {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new RequestSchemaMismatchError(result.error)
  }
  return result.data
}

/**
 * Controller でレスポンスを返す前にスキーマ検証するヘルパ
 * 失敗時は ResponseSchemaMismatchError を throw し、グローバルエラーハンドラ経由で 500 を返す
 */
export const parseResponse = <T>(schema: ZodSchema<T>, value: unknown): T => {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new ResponseSchemaMismatchError(result.error)
  }
  return result.data
}
