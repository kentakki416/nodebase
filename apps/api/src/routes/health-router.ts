import { Router } from "express"

import { HealthLivenessController } from "../controller/health/liveness"
import { HealthReadinessController } from "../controller/health/readiness"

type HealthRouterControllers = {
  liveness?: HealthLivenessController
  readiness?: HealthReadinessController
}

/**
 * ヘルスチェック関連のルーター
 * 渡されたコントローラーのルートのみ登録する
 */
export const healthRouter = (controllers: HealthRouterControllers): Router => {
  const router = Router()

  // GET /api/health
  if (controllers.liveness) {
    const controller = controllers.liveness
    router.get("/", (req, res) => controller.execute(req, res))
  }

  // GET /api/health/ready
  if (controllers.readiness) {
    const controller = controllers.readiness
    router.get("/ready", async (req, res) => controller.execute(req, res))
  }

  return router
}
