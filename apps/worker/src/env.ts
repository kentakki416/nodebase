import { z } from "zod"

/**
 * apps/worker の環境変数スキーマ
 *
 * このモジュールが import された時点で safeParse が走り、
 * 不正な env の場合は stderr にエラーを出力して process.exit(1) で停止する。
 */
const workerEnvSchema = z
  .object({
    /** Prisma の接続文字列。NODE_ENV !== "test" のときは必須 */
    DATABASE_URL: z.string().url().optional(),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    /** ロガー実装の選択 */
    LOGGER_TYPE: z
      .enum(["pino", "winston", "console", "silent"])
      .default("pino"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    /** Redis 接続 URL (BullMQ 用)。NODE_ENV !== "test" のときは必須 */
    REDIS_URL: z.string().optional(),
    /** Worker の並行ジョブ数 */
    WORKER_CONCURRENCY: z.coerce.number().int().positive().default(10),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "test" && !env.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DATABASE_URL is required when NODE_ENV is not 'test'",
        path: ["DATABASE_URL"],
      })
    }
    if (env.NODE_ENV !== "test" && !env.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "REDIS_URL is required when NODE_ENV is not 'test'",
        path: ["REDIS_URL"],
      })
    }
  })

const result = workerEnvSchema.safeParse(process.env)
if (!result.success) {
  console.error("Invalid environment variables:")
  console.error(JSON.stringify(result.error.format(), null, 2))
  process.exit(1)
}

export const env = result.data

export type WorkerEnv = typeof env
