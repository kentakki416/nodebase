import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

import { authGoogleResponseSchema } from "@repo/api-schema"

import { env } from "@/env"
import { OAUTH_STATE_COOKIE, setAuthCookies } from "@/libs/auth"

const API_BASE_URL = env.API_URL

/**
 * Google OAuth コールバックを受け取り、Express API で code を検証して
 * Access/Refresh Token を Cookie に保存した上でリダイレクトする
 */
export const GET = async (req: NextRequest) => {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const errorParam = url.searchParams.get("error")

  if (errorParam) {
    return NextResponse.redirect(new URL("/sign-in?error=oauth_denied", req.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/sign-in?error=invalid_request", req.url))
  }

  const store = await cookies()
  const expected = store.get(OAUTH_STATE_COOKIE)?.value
  store.delete(OAUTH_STATE_COOKIE)

  if (!expected || expected !== state) {
    return NextResponse.redirect(new URL("/sign-in?error=state_mismatch", req.url))
  }

  const apiRes = await fetch(`${API_BASE_URL}/api/auth/google`, {
    body: JSON.stringify({
      code,
      redirect_uri: `${env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })

  if (!apiRes.ok) {
    return NextResponse.redirect(new URL("/sign-in?error=auth_failed", req.url))
  }

  const json = authGoogleResponseSchema.parse(await apiRes.json())
  await setAuthCookies(json.access_token, json.refresh_token)

  return NextResponse.redirect(new URL("/", req.url))
}
