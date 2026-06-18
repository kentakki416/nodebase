import { Router } from "express"

import { MemoCreateController } from "../controller/memo/create"
import { MemoDeleteController } from "../controller/memo/delete"
import { MemoDetailController } from "../controller/memo/detail"
import { MemoListController } from "../controller/memo/list"
import { MemoUpdateController } from "../controller/memo/update"

type MemoRouterControllers = {
  create?: MemoCreateController
  delete?: MemoDeleteController
  detail?: MemoDetailController
  list?: MemoListController
  update?: MemoUpdateController
}

/**
 * メモ関連のルーター
 * 渡されたコントローラーのルートのみ登録する
 */
export const memoRouter = (controllers: MemoRouterControllers): Router => {
  const router = Router()

  // GET /api/memo
  if (controllers.list) {
    const controller = controllers.list
    router.get("/", async (req, res) => controller.execute(req, res))
  }

  // GET /api/memo/:id
  if (controllers.detail) {
    const controller = controllers.detail
    router.get("/:id", async (req, res) => controller.execute(req, res))
  }

  // POST /api/memo
  if (controllers.create) {
    const controller = controllers.create
    router.post("/", async (req, res) => controller.execute(req, res))
  }

  // PUT /api/memo/:id
  if (controllers.update) {
    const controller = controllers.update
    router.put("/:id", async (req, res) => controller.execute(req, res))
  }

  // DELETE /api/memo/:id
  if (controllers.delete) {
    const controller = controllers.delete
    router.delete("/:id", async (req, res) => controller.execute(req, res))
  }

  return router
}
