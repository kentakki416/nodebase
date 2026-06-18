import { env } from "@/env"

import { clearAuthCookies, getAccessToken, getRefreshToken, setAuthCookies } from "./auth"

const API_BASE_URL = env.API_URL

/**
 * apiClient が non-2xx レスポンスを受けたときに投げるエラー型
 *
 * 元の status と （取得できれば）レスポンスボディを保持するため、
 * 呼び出し側（Route Handler 等）が `instanceof ApiClientError` で判別して
 * 元の status / error メッセージをそのままクライアントに返せる。
 *
 * generic Error にしていた頃は status が捨てられて Route Handler が一律 500 に
 * 丸めてしまい、フロントから 4xx (schema 違反 / not-found 等) と 5xx (server error)
 * を区別できなくなっていた。
 */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(`API error: ${status}`)
    this.name = "ApiClientError"
  }
}

const buildHeaders = async (extra?: HeadersInit): Promise<HeadersInit> => {
  const token = await getAccessToken()
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
    ...extra,
  }
}

const tryRefresh = async (): Promise<boolean> => {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) return false
  const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    body: JSON.stringify({ refresh_token: refreshToken }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })
  if (!res.ok) {
    await clearAuthCookies()
    return false
  }
  const json = await res.json() as { access_token: string; refresh_token: string }
  await setAuthCookies(json.access_token, json.refresh_token)
  return true
}

const fetchWithAuth = async (input: string, init: RequestInit, retry = true): Promise<Response> => {
  const headers = await buildHeaders(init.headers)
  const res = await fetch(`${API_BASE_URL}${input}`, { ...init, headers })
  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh()
    if (refreshed) return fetchWithAuth(input, init, false)
  }
  return res
}

/**
 * non-2xx の Response を ApiClientError として throw する
 * （ボディは JSON でなければ undefined）
 */
const throwApiError = async (res: Response): Promise<never> => {
  const body = await res.json().catch(() => undefined)
  throw new ApiClientError(res.status, body)
}

export const apiClient = {
  delete: async <T = unknown>(path: string): Promise<T> => {
    const res = await fetchWithAuth(path, { method: "DELETE" })
    if (!res.ok) await throwApiError(res)
    return res.json() as Promise<T>
  },
  get: async <T>(path: string): Promise<T> => {
    const res = await fetchWithAuth(path, { method: "GET" })
    if (!res.ok) await throwApiError(res)
    return res.json() as Promise<T>
  },
  post: async <T>(path: string, body: unknown): Promise<T> => {
    const res = await fetchWithAuth(path, { body: JSON.stringify(body), method: "POST" })
    if (!res.ok) await throwApiError(res)
    return res.json() as Promise<T>
  },
  put: async <T>(path: string, body: unknown): Promise<T> => {
    const res = await fetchWithAuth(path, { body: JSON.stringify(body), method: "PUT" })
    if (!res.ok) await throwApiError(res)
    return res.json() as Promise<T>
  },
}
