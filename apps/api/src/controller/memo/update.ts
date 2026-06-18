import { Request, Response } from "express"

import { updateMemoPathParamSchema, updateMemoRequestSchema, updateMemoResponseSchema } from "@repo/api-schema"

import { parseRequest, parseResponse } from "../../lib/parse-schema"
import { sendError } from "../../lib/send-error"
import { MemoRepository } from "../../repository/prisma"
import * as service from "../../service"

/**
 * メモ更新API
 */
export class MemoUpdateController {
  constructor(private _memoRepository: MemoRepository) {}

  public async execute(req: Request, res: Response) {
    const { id } = parseRequest(updateMemoPathParamSchema, req.params)
    const data = parseRequest(updateMemoRequestSchema, req.body)

    const result = await service.memo.updateMemo(id, data, { memoRepository: this._memoRepository })

    if (!result.ok) {
      return sendError(req, res, result.error)
    }

    const response = parseResponse(updateMemoResponseSchema, {
      body: result.value.body,
      created_at: result.value.createdAt.toISOString(),
      id: result.value.id,
      title: result.value.title,
      updated_at: result.value.updatedAt.toISOString(),
    })
    return res.status(200).json(response)
  }
}
