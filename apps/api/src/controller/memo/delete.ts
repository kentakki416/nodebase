import { Request, Response } from "express"

import { deleteMemoPathParamSchema, deleteMemoResponseSchema } from "@repo/api-schema"

import { parseRequest, parseResponse } from "../../lib/parse-schema"
import { sendError } from "../../lib/send-error"
import { MemoRepository } from "../../repository/prisma"
import * as service from "../../service"

/**
 * メモ削除API
 */
export class MemoDeleteController {
  constructor(private _memoRepository: MemoRepository) {}

  public async execute(req: Request, res: Response) {
    const { id } = parseRequest(deleteMemoPathParamSchema, req.params)

    const result = await service.memo.deleteMemo(id, { memoRepository: this._memoRepository })

    if (!result.ok) {
      return sendError(req, res, result.error)
    }

    const response = parseResponse(deleteMemoResponseSchema, { message: "Memo deleted successfully" })
    return res.status(200).json(response)
  }
}
