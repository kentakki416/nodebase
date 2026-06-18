import { Request, Response } from "express"

import { healthLivenessResponseSchema } from "@repo/api-schema"

import { parseResponse } from "../../lib/parse-schema"

/**
 * Liveness チェック
 * サーバープロセスが応答可能かを確認する
 */
export class HealthLivenessController {
  public execute(_req: Request, res: Response) {
    const response = parseResponse(healthLivenessResponseSchema, {
      status: "ok",
    })
    res.status(200).json(response)
  }
}
