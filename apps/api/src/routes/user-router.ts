import { Router } from "express"

import { UserGetController } from "../controller/user/get"

type UserRouterControllers = {
  get?: UserGetController
}

/**
 * 認証中ユーザー（自分自身）に関するルーター
 * グローバルに authMiddleware が適用済みのため、ここでは認証チェックを行わない。
 */
export const userRouter = (controllers: UserRouterControllers): Router => {
  const router = Router()

  /** GET /api/user */
  if (controllers.get) {
    const controller = controllers.get
    router.get("/", async (req, res) => controller.execute(req, res))
  }

  return router
}
