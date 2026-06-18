"use server"

import { randomBytes } from "node:crypto"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { env } from "@/env"
import { OAUTH_STATE_COOKIE } from "@/libs/auth"

const isProduction = env.NODE_ENV === "production"

const STATE_COOKIE_MAX_AGE = 60 * 5

/**
 * Google OAuth 認可フローの開始
 * state を Cookie に保存して CSRF 対策しつつ、Google 認可エンドポイントにリダイレクト
 */
export const startGoogleOAuth = async () => {
  const state = randomBytes(16).toString("hex")
  const store = await cookies()
  store.set(OAUTH_STATE_COOKIE, state, {
    /**
     * Google からのトップレベルリダイレクトで Cookie を送信させるため
     * lax にする（state 照合のみに使うため攻撃対象は限定的）
     */
    httpOnly: true,
    maxAge: STATE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: isProduction,
  })

  const params = new URLSearchParams({
    access_type: "offline",
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`,
    response_type: "code",
    scope: "openid email profile",
    state,
  })
  redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}
