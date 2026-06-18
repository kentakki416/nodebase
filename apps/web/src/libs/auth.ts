import { cookies } from "next/headers"

export const ACCESS_TOKEN_COOKIE = "app_access_token"
export const REFRESH_TOKEN_COOKIE = "app_refresh_token"
export const OAUTH_STATE_COOKIE = "app_oauth_state"

const isProduction = process.env.NODE_ENV === "production"

const ACCESS_TOKEN_MAX_AGE = 60 * 15
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7

/**
 * sameSite="lax" を使う理由:
 * OAuth コールバック（google.com → /api/auth/callback/google → /）は cross-site 起点の
 * 連鎖ナビゲーションになるため、strict だと最終遷移先で cookie が送信されず
 * proxy が認証無しと判定してしまう。CSRF は state パラメータで対策済み。
 */
export const setAuthCookies = async (accessToken: string, refreshToken: string) => {
  const store = await cookies()
  store.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    maxAge: ACCESS_TOKEN_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: isProduction,
  })
  store.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: isProduction,
  })
}

export const clearAuthCookies = async () => {
  const store = await cookies()
  store.delete(ACCESS_TOKEN_COOKIE)
  store.delete(REFRESH_TOKEN_COOKIE)
}

export const getAccessToken = async (): Promise<string | null> => {
  const store = await cookies()
  return store.get(ACCESS_TOKEN_COOKIE)?.value ?? null
}

export const getRefreshToken = async (): Promise<string | null> => {
  const store = await cookies()
  return store.get(REFRESH_TOKEN_COOKIE)?.value ?? null
}
