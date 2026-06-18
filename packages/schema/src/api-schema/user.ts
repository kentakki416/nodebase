import { z } from "zod"

// ========================================================
// GET /api/user - 認証中ユーザーの取得
// ========================================================

/**
 * 認証中ユーザー取得のレスポンススキーマ
 */
export const getUserResponseSchema = z.object({
  avatar_url: z.string().nullable(),
  created_at: z.string(),
  email: z.string().nullable(),
  id: z.number(),
  name: z.string().nullable(),
})

export type GetUserResponse = z.infer<typeof getUserResponseSchema>
