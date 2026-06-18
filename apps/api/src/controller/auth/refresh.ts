import { Request, Response } from "express"

import { authRefreshRequestSchema, authRefreshResponseSchema } from "@repo/api-schema"
import { logger } from "@repo/logger"

import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../lib/jwt"
import { parseRequest, parseResponse } from "../../lib/parse-schema"
import { sendError } from "../../lib/send-error"
import { RefreshTokenRepository } from "../../repository/redis"
import * as service from "../../service"

/**
 * Refresh Token をローテーションして新しい Access/Refresh Token を発行する API
 */
export class AuthRefreshController {
  constructor(private _refreshTokenRepository: RefreshTokenRepository) {}

  public async execute(req: Request, res: Response) {
    logger.info("AuthRefreshController: Rotating refresh token")

    const { refresh_token: refreshToken } = parseRequest(authRefreshRequestSchema, req.body)

    const result = await service.auth.refreshTokens(
      { refreshToken },
      { refreshTokenRepository: this._refreshTokenRepository },
      (token) => {
        const payload = verifyRefreshToken(token)
        return payload ? { jti: payload.jti, userId: payload.userId } : null
      },
      { generateAccessToken, generateRefreshToken }
    )

    if (!result.ok) {
      return sendError(req, res, result.error)
    }

    const response = parseResponse(authRefreshResponseSchema, {
      access_token: result.value.accessToken,
      refresh_token: result.value.refreshToken,
    })

    return res.status(200).json(response)
  }
}
