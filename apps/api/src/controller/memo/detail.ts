import { Request, Response } from "express"

import { getMemoPathParamSchema, getMemoResponseSchema } from "@repo/api-schema"

import { parseRequest, parseResponse } from "../../lib/parse-schema"
import { sendError } from "../../lib/send-error"
import { MemoRepository } from "../../repository/prisma"
import * as service from "../../service"

/**
 * メモ詳細取得API
 */
export class MemoDetailController {
  constructor(private _memoRepository: MemoRepository) {}

  public async execute(req: Request, res: Response) {
    const { id } = parseRequest(getMemoPathParamSchema, req.params)

    const result = await service.memo.getMemoById(id, { memoRepository: this._memoRepository })

    if (!result.ok) {
      return sendError(req, res, result.error)
    }

    const response = parseResponse(getMemoResponseSchema, {
      body: result.value.body,
      created_at: result.value.createdAt.toISOString(),
      id: result.value.id,
      title: result.value.title,
      updated_at: result.value.updatedAt.toISOString(),
    })
    return res.status(200).json(response)
  }
}
