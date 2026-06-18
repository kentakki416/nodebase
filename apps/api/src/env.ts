import { z } from "zod"

/**
 * apps/api の環境変数スキーマ
 *
 * 起動時にこのモジュールが import された時点で safeParse が走り、
 * 不正な env の場合は stderr にエラーを出力して process.exit(1) で停止する。
 *
 * 各 app は src/env.ts に Zod スキーマと検証ロジックをインラインで定義する方針
 * （詳細は docs/spec/shared-packages/README.md「環境変数の管理」参照）。
 */
const apiEnvSchema = z.object({
  /**
   * Admin API のダミーモード（DB 不要で固定データを返す）
   */
  ADMIN_USE_DUMMY: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .default("false"),

  /**
   * Postgres 接続文字列
   * 未指定時は packages/db 側でローカル開発用デフォルトにフォールバックする
   */
  DATABASE_URL: z.string().url().optional(),

  /**
   * Postgres read replica の接続 URL
   */
  DATABASE_REPLICA_URL: z.string().url().optional(),

  /**
   * test 時に test DB へ切り替えるためのオーバーライド名
   */
  DB_NAME: z.string().optional(),

  /**
   * フロントエンドの origin（OAuth callback redirect 等で使用）
   */
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),

  /**
   * Google OAuth クライアント ID
   * dev 環境では "dummy" でも動くため optional 扱い
   */
  GOOGLE_CLIENT_ID: z.string().default("dummy"),

  /**
   * Google OAuth クライアントシークレット
   */
  GOOGLE_CLIENT_SECRET: z.string().default("dummy"),

  /**
   * Access Token 有効期限（例: "15m" / "1h"）
   */
  JWT_ACCESS_EXPIRATION: z.string().default("15m"),

  /**
   * Access Token 署名鍵
   */
  JWT_ACCESS_SECRET: z.string().min(32),

  /**
   * Refresh Token 有効期限（例: "7d" / "30d"）
   */
  JWT_REFRESH_EXPIRATION: z.string().default("7d"),

  /**
   * Refresh Token 署名鍵
   */
  JWT_REFRESH_SECRET: z.string().min(32),

  /**
   * ログレベル
   */
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  /**
   * Logger 実装の種別
   * pino / winston / console / silent
   */
  LOGGER_TYPE: z.enum(["pino", "winston", "console", "silent"]).default("pino"),

  /**
   * 実行環境
   */
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /**
   * Express サーバーの待受ポート
   */
  PORT: z.coerce.number().int().positive().default(8080),

  /**
   * Redis 番号（test では別 DB を使うことで分離）
   */
  REDIS_DB: z.coerce.number().int().min(0).optional(),

  /**
   * Redis ホスト（REDIS_URL を使う場合は不要）
   */
  REDIS_HOST: z.string().optional(),

  /**
   * Redis パスワード
   */
  REDIS_PASSWORD: z.string().optional(),

  /**
   * Redis ポート（REDIS_URL を使う場合は不要）
   */
  REDIS_PORT: z.coerce.number().int().positive().optional(),

  /**
   * Redis 接続 URL（個別指定がある場合は @repo/redis がそちらを優先）
   */
  REDIS_URL: z.string().url().optional(),
})

const result = apiEnvSchema.safeParse(process.env)
if (!result.success) {
  console.error("❌ Invalid environment variables:")
  console.error(JSON.stringify(result.error.format(), null, 2))
  process.exit(1)
}

export const env = result.data

export type ApiEnv = typeof env
