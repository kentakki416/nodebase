import { defineConfig } from "vitest/config"

/**
 * apps/worker 用 Vitest 設定
 *
 * Repository / job ハンドラの unit test は Prisma / Redis を mock するため DB / Redis 不要。
 * 並列実行（デフォルト）で問題ない。
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["test/**/*.test.ts"],
  },
})
