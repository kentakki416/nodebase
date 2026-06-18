import { z } from "zod"

/**
 * apps/cron の環境変数スキーマ
 *
 * このモジュールが import された時点で safeParse が走り、
 * 不正な env の場合は stderr にエラーを出力して process.exit(1) で停止する。
 *
 * 各 task (src/task/*.ts) は最初に `import { env } from "../env"` するだけで
 * 起動前に env 検証が済む。
 */
const cronEnvSchema = z
  .object({
    /** 起動環境。test の場合は DATABASE_URL の必須化を緩める */
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    /** Prisma の接続文字列。NODE_ENV !== "test" のときは必須 */
    DATABASE_URL: z.string().url().optional(),
    /** ロガー実装の選択（pino / winston / console / silent） */
    LOGGER_TYPE: z
      .enum(["pino", "winston", "console", "silent"])
      .default("pino"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    /**
     * cleanup-old-memos が削除対象とする「何日以上前の memo か」の閾値。
     * デフォルトは 90 日。
     */
    CLEANUP_MEMO_OLDER_THAN_DAYS: z.coerce.number().int().positive().default(90),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "test" && !env.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DATABASE_URL is required when NODE_ENV is not 'test'",
        path: ["DATABASE_URL"],
      })
    }
  })

const result = cronEnvSchema.safeParse(process.env)
if (!result.success) {
  console.error("Invalid environment variables:")
  console.error(JSON.stringify(result.error.format(), null, 2))
  process.exit(1)
}

export const env = result.data

export type CronEnv = typeof env
