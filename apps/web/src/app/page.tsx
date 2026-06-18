"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"

import { GetUserResponse } from "@repo/api-schema"

const DotLottieReact = dynamic(
  async () => import("@lottiefiles/dotlottie-react").then((mod) => mod.DotLottieReact),
  { ssr: false },
)

export default function Home() {
  const [userData, setUserData] = useState<GetUserResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // APIを呼び出す関数
  const fetchUser = async (userId: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`http://localhost:8080/api/user/${userId}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: GetUserResponse = await response.json()
      setUserData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "ユーザー情報の取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  /**
   * コンポーネントマウント時にAPIを呼び出す（例: userId='123'）
   * 初期表示の自動フェッチ用途のため、effect 内 setState を意図的に許容する
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUser("123")
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <div className="w-48 h-48">
            <DotLottieReact
              src="/kenttaki-bot.lottie"
              autoplay
              loop
            />
          </div>

          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            ユーザー情報取得サンプル
          </h1>

          {loading && <p className="text-lg text-zinc-600 dark:text-zinc-400">読み込み中...</p>}

          {error && (
            <div className="rounded-lg bg-red-100 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
              <p className="font-semibold">エラー</p>
              <p>{error}</p>
            </div>
          )}

          {userData && (
            <div className="rounded-lg bg-zinc-100 p-6 dark:bg-zinc-800">
              <h2 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">
                ユーザー情報
              </h2>
              <div className="space-y-2 text-left">
                <p className="text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium">ID:</span> {userData.id}
                </p>
                <p className="text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium">メッセージ:</span> {userData.message}
                </p>
                <p className="text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium">タイムスタンプ:</span> {userData.timestamp}
                </p>
              </div>
            </div>
          )}

          <button
            className="mt-4 rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
            type="button"
            onClick={async () => fetchUser("123")}
          >
            再取得
          </button>
        </div>
      </main>
    </div>
  )
}
