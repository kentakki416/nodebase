import { Request, Response } from "express"

import {
  authDevLoginRequestSchema,
  authDevLoginResponseSchema,
} from "@repo/api-schema"
import { logger } from "@repo/logger"

import { generateAccessToken, generateRefreshToken } from "../../lib/jwt"
import { parseRequest, parseResponse } from "../../lib/parse-schema"
import { sendError } from "../../lib/send-error"
import { UserRepository } from "../../repository/prisma"
import { RefreshTokenRepository } from "../../repository/redis"
import * as service from "../../service"

/**
 * 開発環境専用ログイン API
 *
 * seed で投入済みの dev ユーザー（例: alice@dev.local）の email を受け取り
 * Google OAuth と同じ形の Access/Refresh Token を発行する。
 *
 * 多重ガード:
 * 1. index.ts で本番時はインスタンス化しない
 * 2. auth-router.ts で controller 未指定ならルート登録しない
 * 3. ここでも NODE_ENV を見て 404 を返す
 */
export class AuthDevLoginController {
  constructor(
    private _userRepository: UserRepository,
    private _refreshTokenRepository: RefreshTokenRepository,
  ) {}

  public async execute(req: Request, res: Response) {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ error: "Not Found", status_code: 404 })
    }

    logger.info("AuthDevLoginController: dev-login")

    const { email } = parseRequest(authDevLoginRequestSchema, req.body)

    const result = await service.auth.loginAsDevUser(
      { email },
      {
        refreshTokenRepository: this._refreshTokenRepository,
        userRepository: this._userRepository,
      },
      { generateAccessToken, generateRefreshToken },
    )

    if (!result.ok) {
      return sendError(req, res, result.error)
    }

    const { accessToken, refreshToken, user } = result.value

    const response = parseResponse(authDevLoginResponseSchema, {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        avatar_url: user.avatarUrl,
        created_at: user.createdAt.toISOString(),
        email: user.email,
        id: user.id,
        name: user.name,
      },
    })

    return res.status(200).json(response)
  }
}
