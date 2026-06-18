import { Request, Response } from "express"

import { authLogoutRequestSchema, authLogoutResponseSchema } from "@repo/api-schema"
import { logger } from "@repo/logger"

import { verifyRefreshToken } from "../../lib/jwt"
import { parseRequest, parseResponse } from "../../lib/parse-schema"
import { sendError } from "../../lib/send-error"
import { RefreshTokenRepository } from "../../repository/redis"
import * as service from "../../service"

/**
 * Refresh Token を無効化してログアウトする API
 * 冪等性のため、無効なトークンでも 200 を返す
 */
export class AuthLogoutController {
  constructor(private _refreshTokenRepository: RefreshTokenRepository) {}

  public async execute(req: Request, res: Response) {
    logger.info("AuthLogoutController: Logging out")

    const { refresh_token: refreshToken } = parseRequest(authLogoutRequestSchema, req.body)

    const result = await service.auth.logout(
      { refreshToken },
      { refreshTokenRepository: this._refreshTokenRepository },
      (token) => {
        const payload = verifyRefreshToken(token)
        return payload ? { jti: payload.jti, userId: payload.userId } : null
      }
    )

    if (!result.ok) {
      return sendError(req, res, result.error)
    }

    return res.status(200).json(parseResponse(authLogoutResponseSchema, { message: "OK" }))
  }
}
