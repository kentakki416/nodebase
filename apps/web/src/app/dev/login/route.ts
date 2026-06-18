import { NextRequest, NextResponse } from "next/server"

import { authDevLoginResponseSchema } from "@repo/api-schema"

import { env } from "@/env"
import { setAuthCookies } from "@/libs/auth"

const API_BASE_URL = env.API_URL

/**
 * dev-login で使えるショートネーム → email のマッピング
 * apps/api/src/prisma/seed.ts の dev ユーザーと一致させる
 */
const DEV_USERS: Record<string, string> = {
  alice: "alice@dev.local",
  bob: "bob@dev.local",
}

/**
 * 開発環境専用ログイン Route Handler
 *
 * 使い方:
 *   GET /dev/login?as=alice → alice@dev.local で API の dev-login を叩いて
 *   Access/Refresh Token を Cookie に保存して / にリダイレクトする
 *
 * Server Component から cookies().set() できない制約があるため Route Handler
 * として実装している。production では 404 を返す。
 *
 * 多重ガード:
 * 1. ここで NODE_ENV === "production" なら 404
 * 2. proxy.ts で /dev/login は production 以外のみ PUBLIC_PATHS に含める
 * 3. API 側でも production では dev-login 自体が存在しない
 */
export const GET = async (req: NextRequest) => {
  if (env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 })
  }

  const as = req.nextUrl.searchParams.get("as")
  if (!as || !(as in DEV_USERS)) {
    const usage = `Usage: /dev/login?as=${Object.keys(DEV_USERS).join("|")}`
    return new NextResponse(usage, { status: 400 })
  }

  const email = DEV_USERS[as]

  const apiRes = await fetch(`${API_BASE_URL}/api/auth/dev-login`, {
    body: JSON.stringify({ email }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })

  if (!apiRes.ok) {
    const message = `dev-login failed (status=${apiRes.status}). Did you run \`pnpm --filter api db:seed\`?`
    return new NextResponse(message, { status: 500 })
  }

  const json = authDevLoginResponseSchema.parse(await apiRes.json())
  await setAuthCookies(json.access_token, json.refresh_token)

  return NextResponse.redirect(new URL("/", req.url))
}
