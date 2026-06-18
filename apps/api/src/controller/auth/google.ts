import { Request, Response } from "express"

import { authGoogleRequestSchema, authGoogleResponseSchema } from "@repo/api-schema"
import { logger } from "@repo/logger"

import { IGoogleOAuthClient } from "../../client/google-oauth"
import { generateAccessToken, generateRefreshToken } from "../../lib/jwt"
import { parseRequest, parseResponse } from "../../lib/parse-schema"
import { sendError } from "../../lib/send-error"
import {
  AuthAccountRepository,
  TransactionRunner,
  UserRepository,
} from "../../repository/prisma"
import { RefreshTokenRepository } from "../../repository/redis"
import * as service from "../../service"

/**
 * Google OAuth 認証コードを検証し、Access/Refresh Token を発行する API
 */
export class AuthGoogleController {
  constructor(
    private _authAccountRepository: AuthAccountRepository,
    private _userRepository: UserRepository,
    private _refreshTokenRepository: RefreshTokenRepository,
    private _transactionRunner: TransactionRunner,
    private _googleOAuthClient: IGoogleOAuthClient
  ) {}

  public async execute(req: Request, res: Response) {
    logger.info("AuthGoogleController: Verifying Google authorization code")

    const { code, redirect_uri: redirectUri } = parseRequest(authGoogleRequestSchema, req.body)

    const result = await service.auth.authenticateWithGoogle(
      { code, redirectUri },
      {
        authAccountRepository: this._authAccountRepository,
        refreshTokenRepository: this._refreshTokenRepository,
        transactionRunner: this._transactionRunner,
        userRepository: this._userRepository,
      },
      this._googleOAuthClient,
      { generateAccessToken, generateRefreshToken }
    )

    if (!result.ok) {
      return sendError(req, res, result.error)
    }

    const { accessToken, isNewUser, refreshToken, user } = result.value

    const response = parseResponse(authGoogleResponseSchema, {
      access_token: accessToken,
      is_new_user: isNewUser,
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
