import { NextRequest, NextResponse } from "next/server"

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/libs/auth"

/**
 * production 以外でのみ公開する dev 専用パス
 * `/dev/login?as=alice` を踏むだけでログイン状態にできる開発支援機能
 */
const DEV_ONLY_PUBLIC_PATHS = process.env.NODE_ENV !== "production"
  ? ["/dev/login"]
  : []

const PUBLIC_PATHS = [
  "/sign-in",
  "/api/auth/callback/google",
  ...DEV_ONLY_PUBLIC_PATHS,
]

/**
 * 完全一致 or path セグメント境界での prefix 一致をチェックする。
 *
 * 単純な `pathname.startsWith(p)` は `/sign-in` が `/sign-in-foo` も通してしまうため、
 * 登録されたページと意図しないパスが衝突するリスクがある。`/` 区切り
 * (= path segment 境界) で一致するもののみ通す。
 *
 * 例 (p = "/sign-in"):
 * - "/sign-in"           → true (完全一致)
 * - "/sign-in/google"    → true (segment 境界の prefix)
 * - "/sign-in-foo"       → false (segment 境界ではない)
 */
const matchesPathPrefix = (pathname: string, p: string): boolean =>
  pathname === p || pathname.startsWith(`${p}/`)

/**
 * Edge ランタイムで動くため JWT 検証は行わず、Cookie の有無だけで判断する
 * （実検証は API 側で行う）
 *
 * hasRefresh だけでも入場を許可する理由:
 * Server Component 側で apiClient が 401 → refresh → 再試行する設計のため、
 * access が切れている状態で proxy で蹴ると refresh の機会が失われる。
 */
export const proxy = (req: NextRequest) => {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some(p => matchesPathPrefix(pathname, p))) {
    return NextResponse.next()
  }

  const hasAccess = req.cookies.has(ACCESS_TOKEN_COOKIE)
  const hasRefresh = req.cookies.has(REFRESH_TOKEN_COOKIE)

  if (!hasAccess && !hasRefresh) {
    const url = new URL("/sign-in", req.url)
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  /** _next, _next/static, _next/image, favicon, public 配下を除外 */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
}
