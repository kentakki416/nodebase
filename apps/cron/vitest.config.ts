import { defineConfig } from "vitest/config"

/**
 * apps/cron 用 Vitest 設定
 *
 * Repository / Service の unit test は Prisma を mock するため DB 不要。
 * 並列実行（デフォルト）で問題ない。
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["test/**/*.test.ts"],
  },
})
