import { resolve } from "node:path"

import { defineConfig } from "vitest/config"

/**
 * Vitest 設定（Jest からの全面移行版）。
 *
 * Jest 設定との主な差分:
 *   - .js 拡張子の moduleNameMapper ハックは Vite resolver が .ts へ
 *     自動フォールバックするため不要
 *   - ts-jest 経由の transpile が不要（esbuild ベース）で
 *     TS151002 警告との闘いから解放される
 *   - tsconfig の paths は Vite 7+ の resolve.tsconfigPaths でネイティブ解決
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    /**
     * Jest 互換 globals（describe / it / expect / beforeEach / vi 等）を
     * グローバルに展開し、既存テストの import 文を最小限に保つ
     */
    globals: true,

    /**
     * Jest の testEnvironment: "node" に相当
     */
    environment: "node",

    /**
     * service ユニットテスト + controller インテグレーションテストを全て対象にする
     */
    include: ["test/**/*.test.ts"],

    /**
     * 実 DB を共有する controller テストの競合を避けるため、
     * 旧 Jest 設定の maxWorkers: 1 と同じく直列実行する
     */
    fileParallelism: false,

    /**
     * テストの timeout（ミリ秒）。Jest 設定の testTimeout: 3000 と一致
     */
    testTimeout: 3000,

    /**
     * カバレッジは V8 ベース。Jest の collectCoverageFrom と同等の除外を指定
     */
    coverage: {
      exclude: ["src/**/*.d.ts", "src/index.ts"],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "coverage",
    },

    /**
     * 環境変数の初期化はテストモジュールの import より前に行う必要があるため
     * setupFiles で実行する（src/ 配下が読み込まれる前に DB_NAME 等を確定させる）
     */
    setupFiles: [resolve(__dirname, "test/vitest.setup.ts")],
  },
})
