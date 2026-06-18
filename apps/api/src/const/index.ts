/**
 * production 以外でのみ公開する dev 専用パス
 *
 * /api/auth/dev-login は seed で投入した dev ユーザーで token を発行する API。
 * production では index.ts でコントローラを生成しないためルート自体が存在しない
 * が、念のため PUBLIC_PATHS からも除外する。
 */
const DEV_ONLY_PUBLIC_PATHS = process.env.NODE_ENV !== "production"
  ? ["/api/auth/dev-login"]
  : []

/**
 * 認証をスキップする公開パス
 * これらのパスではauthMiddlewareが認証チェックをスキップします
 */
export const PUBLIC_PATHS: readonly string[] = [
  "/api/auth/google",
  "/api/auth/refresh",
  "/api/health",
  "/api/memo",
  ...DEV_ONLY_PUBLIC_PATHS,
]

/**
 * リクエストログを除外するパス
 * これらのパスではrequestLoggerがログを記録しません
 */
export const LOG_EXCLUDE_PATHS = [
  "/api/health",
  "/api/health/ready",
] as const
