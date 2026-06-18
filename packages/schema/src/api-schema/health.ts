import { z } from "zod"

// ========================================================
// GET /api/health
// ========================================================

/**
 * Liveness チェックのレスポンススキーマ
 * サーバープロセスが応答可能かを確認する
 */
export const healthLivenessResponseSchema = z.object({
  status: z.literal("ok"),
})

export type HealthLivenessResponse = z.infer<typeof healthLivenessResponseSchema>

// ========================================================
// GET /api/health/ready
// ========================================================

/**
 * 外部サービスの接続状態
 */
const serviceStatusSchema = z.object({
  latency_ms: z.number(),
  status: z.enum(["ok", "error"]),
})

/**
 * Readiness チェックのレスポンススキーマ
 * 外部サービス（DB等）への接続状態を確認する
 */
export const healthReadinessResponseSchema = z.object({
  services: z.object({
    database: serviceStatusSchema,
    redis: serviceStatusSchema,
  }),
  status: z.enum(["ok", "degraded"]),
})

export type HealthReadinessResponse = z.infer<typeof healthReadinessResponseSchema>
