import type { Metadata } from "next"
import Link from "next/link"

import { startGoogleOAuth } from "./actions"

export const metadata: Metadata = {
  title: "サインイン",
}

const isProduction = process.env.NODE_ENV === "production"

/**
 * dev-login で使えるショートネーム
 * apps/api/src/prisma/seed.ts と apps/web/src/app/dev/login/route.ts と一致させる
 */
const DEV_LOGIN_USERS = ["alice", "bob"] as const

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "認証に失敗しました。もう一度お試しください。",
  invalid_request: "リクエストが不正です。",
  oauth_denied: "Google アカウントへのアクセスが拒否されました。",
  state_mismatch: "セッションが切れました。もう一度お試しください。",
}

type Props = {
  searchParams: Promise<{ error?: string }>
}

export default async function SignInPage({ searchParams }: Props) {
  const { error } = await searchParams
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "エラーが発生しました。" : null

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">サインイン</h1>
          <p className="text-sm text-gray-500">アカウントに接続して始めましょう</p>
        </div>

        {errorMessage && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <form action={startGoogleOAuth}>
          <button
            className="w-full rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
            type="submit"
          >
            Google でサインイン
          </button>
        </form>

        {!isProduction && (
          <div className="space-y-2 border-t border-dashed border-gray-200 pt-4">
            <p className="text-center text-xs font-medium text-gray-500">
              Dev Login (NODE_ENV !== &quot;production&quot;)
            </p>
            <div className="flex gap-2">
              {DEV_LOGIN_USERS.map((user) => (
                <Link
                  className="flex-1 rounded border border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-900 hover:bg-amber-100"
                  href={`/dev/login?as=${user}`}
                  key={user}
                >
                  Login as {user}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
