import { z } from "zod"

// ========================================================
// POST /api/auth/google - Google OAuth 認証コードの検証
// ========================================================

/**
 * Google OAuth 認証リクエストのスキーマ
 * Next.js 側で取得した Authorization Code と、リダイレクト時に使用した
 * redirect_uri を受け取り、API が token 交換 + UserInfo 取得を行う。
 */
export const authGoogleRequestSchema = z.object({
  code: z.string().min(1),
  redirect_uri: z.string().url(),
})

export type AuthGoogleRequest = z.infer<typeof authGoogleRequestSchema>

/**
 * Google OAuth 認証レスポンスのスキーマ
 */
export const authGoogleResponseSchema = z.object({
  access_token: z.string(),
  is_new_user: z.boolean(),
  refresh_token: z.string(),
  user: z.object({
    avatar_url: z.string().nullable(),
    email: z.string().nullable(),
    id: z.number(),
    name: z.string().nullable(),
    created_at: z.string(),
  }),
})

export type AuthGoogleResponse = z.infer<typeof authGoogleResponseSchema>

// ========================================================
// POST /api/auth/refresh - Access/Refresh Token のローテーション
// ========================================================

/**
 * Refresh Token によるトークン更新リクエストのスキーマ
 */
export const authRefreshRequestSchema = z.object({
  refresh_token: z.string().min(1),
})

export type AuthRefreshRequest = z.infer<typeof authRefreshRequestSchema>

/**
 * Refresh Token によるトークン更新レスポンスのスキーマ
 */
export const authRefreshResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
})

export type AuthRefreshResponse = z.infer<typeof authRefreshResponseSchema>

// ========================================================
// POST /api/auth/dev-login - 開発環境専用ログイン
// ========================================================

/**
 * dev-login リクエストのスキーマ
 *
 * production 環境では受け付けない（API 側で 404 を返す）。
 * email は seed で投入済みの dev ユーザー (例: alice@dev.local) を想定。
 */
export const authDevLoginRequestSchema = z.object({
  email: z.string().email(),
})

export type AuthDevLoginRequest = z.infer<typeof authDevLoginRequestSchema>

/**
 * dev-login レスポンスのスキーマ
 *
 * authGoogleResponseSchema と互換にして Web 側で同じ setAuthCookies に渡せるようにする
 * （is_new_user は dev-login では常に false なので含めない）
 */
export const authDevLoginResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  user: z.object({
    avatar_url: z.string().nullable(),
    email: z.string().nullable(),
    id: z.number(),
    name: z.string().nullable(),
    created_at: z.string(),
  }),
})

export type AuthDevLoginResponse = z.infer<typeof authDevLoginResponseSchema>

// ========================================================
// POST /api/auth/logout - Refresh Token を無効化
// ========================================================

/**
 * ログアウトリクエストのスキーマ
 */
export const authLogoutRequestSchema = z.object({
  refresh_token: z.string().min(1),
})

export type AuthLogoutRequest = z.infer<typeof authLogoutRequestSchema>

/**
 * ログアウトレスポンスのスキーマ
 */
export const authLogoutResponseSchema = z.object({
  message: z.literal("OK"),
})

export type AuthLogoutResponse = z.infer<typeof authLogoutResponseSchema>
