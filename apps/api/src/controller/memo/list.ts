import { Request, Response } from "express"

import { getMemoListResponseSchema } from "@repo/api-schema"

import { parseResponse } from "../../lib/parse-schema"
import { sendError } from "../../lib/send-error"
import { MemoRepository } from "../../repository/prisma"
import * as service from "../../service"

/**
 * メモ一覧取得API
 * 業務エラーは Result の statusCode をそのまま返却
 * 予期しない例外はグローバルエラーハンドラに委譲（throw を catch しない）
 */
export class MemoListController {
  constructor(private _memoRepository: MemoRepository) {}

  public async execute(req: Request, res: Response) {
    const result = await service.memo.getAllMemos({ memoRepository: this._memoRepository })

    if (!result.ok) {
      return sendError(req, res, result.error)
    }

    const response = parseResponse(getMemoListResponseSchema, {
      memos: result.value.map((memo) => ({
        body: memo.body,
        created_at: memo.createdAt.toISOString(),
        id: memo.id,
        title: memo.title,
        updated_at: memo.updatedAt.toISOString(),
      })),
    })
    return res.status(200).json(response)
  }
}
