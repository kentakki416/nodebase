"use server"

import { redirect } from "next/navigation"

import { apiClient } from "./api-client"
import { clearAuthCookies, getRefreshToken } from "./auth"

/**
 * ログアウト Server Action
 * 複数ページから呼ばれるため、ページ固有の actions.ts ではなく共通 libs に配置
 */
export const logoutAction = async () => {
  const refreshToken = await getRefreshToken()
  if (refreshToken) {
    try {
      await apiClient.post("/api/auth/logout", { refresh_token: refreshToken })
    } catch {
      /** API 失敗時も Cookie はクリアする */
    }
  }
  await clearAuthCookies()
  redirect("/sign-in")
}
