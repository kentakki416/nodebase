import { z } from "zod"

// ========================================================
// 共通: エラーレスポンス
// ========================================================

/**
 * エラーレスポンススキーマ（全エンドポイント共通）
 * `{ error: "...", status_code: 400 }`
 */
export const errorResponseSchema = z.object({
  error: z.string(),
  status_code: z.number(),
})

export type ErrorResponse = z.infer<typeof errorResponseSchema>

// ========================================================
// 共通: 成功メッセージレスポンス
// ========================================================

/**
 * メッセージのみを返す成功レスポンススキーマ（DELETE 系などで使用）
 */
export const messageResponseSchema = z.object({
  message: z.string(),
})

export type MessageResponse = z.infer<typeof messageResponseSchema>

// ========================================================
// 共通: カーソルベースページネーション
// ========================================================

/**
 * カーソルベースページネーションのクエリ文字列スキーマ
 * `?cursor=10&limit=20`
 */
export const cursorPaginationQueryStringSchema = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export type CursorPaginationQueryString = z.infer<typeof cursorPaginationQueryStringSchema>

/**
 * カーソルベースページネーションのレスポンスメタ部
 * 個別エンドポイントでは `data` を該当配列スキーマに置き換えて利用する
 */
export const cursorPaginationMetaSchema = z.object({
  has_more: z.boolean(),
  next_cursor: z.number().nullable(),
})

export type CursorPaginationMeta = z.infer<typeof cursorPaginationMetaSchema>

/**
 * カーソルベースページネーションのレスポンスを生成するヘルパー
 *
 * @example
 * const getStreamListResponseSchema = paginatedResponseSchema(streamSchema)
 */
export const paginatedResponseSchema = <ItemSchema extends z.ZodTypeAny>(itemSchema: ItemSchema) =>
  z.object({
    data: z.array(itemSchema),
    has_more: z.boolean(),
    next_cursor: z.number().nullable(),
  })
