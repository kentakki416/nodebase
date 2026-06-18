import { Request, Response } from "express"

import { createMemoRequestSchema, createMemoResponseSchema } from "@repo/api-schema"

import { parseRequest, parseResponse } from "../../lib/parse-schema"
import { sendError } from "../../lib/send-error"
import { MemoRepository } from "../../repository/prisma"
import * as service from "../../service"

/**
 * メモ作成API
 */
export class MemoCreateController {
  constructor(private _memoRepository: MemoRepository) {}

  public async execute(req: Request, res: Response) {
    const data = parseRequest(createMemoRequestSchema, req.body)

    const result = await service.memo.createMemo(data, { memoRepository: this._memoRepository })

    if (!result.ok) {
      return sendError(req, res, result.error)
    }

    const response = parseResponse(createMemoResponseSchema, {
      body: result.value.body,
      created_at: result.value.createdAt.toISOString(),
      id: result.value.id,
      title: result.value.title,
      updated_at: result.value.updatedAt.toISOString(),
    })
    return res.status(201).json(response)
  }
}
