import { Router } from "express"

import { AuthDevLoginController } from "../controller/auth/dev-login"
import { AuthGoogleController } from "../controller/auth/google"
import { AuthLogoutController } from "../controller/auth/logout"
import { AuthRefreshController } from "../controller/auth/refresh"

type AuthRouterControllers = {
  devLogin?: AuthDevLoginController
  google?: AuthGoogleController
  logout?: AuthLogoutController
  refresh?: AuthRefreshController
}

/**
 * 認証関連のルーター
 * 渡されたコントローラーのルートのみ登録する
 */
export const authRouter = (controllers: AuthRouterControllers): Router => {
  const router = Router()

  /** POST /api/auth/google */
  if (controllers.google) {
    const controller = controllers.google
    router.post("/google", async (req, res) => controller.execute(req, res))
  }

  /**
   * POST /api/auth/dev-login（NODE_ENV !== "production" のみ）
   * index.ts で本番時は controllers.devLogin に undefined を渡すため
   * ルート自体が登録されない
   */
  if (controllers.devLogin) {
    const controller = controllers.devLogin
    router.post("/dev-login", async (req, res) => controller.execute(req, res))
  }

  /** POST /api/auth/refresh（PUBLIC_PATHS に含まれるため認証不要） */
  if (controllers.refresh) {
    const controller = controllers.refresh
    router.post("/refresh", async (req, res) => controller.execute(req, res))
  }

  /** POST /api/auth/logout（authMiddleware で Access Token 必須） */
  if (controllers.logout) {
    const controller = controllers.logout
    router.post("/logout", async (req, res) => controller.execute(req, res))
  }

  return router
}
