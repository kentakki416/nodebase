import { Response } from "express"

import { getUserResponseSchema } from "@repo/api-schema"
import { logger } from "@repo/logger"

import { parseResponse } from "../../lib/parse-schema"
import { sendError } from "../../lib/send-error"
import { AuthRequest } from "../../middleware/auth"
import { UserRepository } from "../../repository/prisma"
import * as service from "../../service"

/**
 * GET /api/user
 *
 * 認証中ユーザー自身の情報を返す。req.userId は authMiddleware が確定済みの前提。
 */
export class UserGetController {
  constructor(private _userRepository: UserRepository) {}

  public async execute(req: AuthRequest, res: Response) {
    logger.info("UserGetController: Fetching authenticated user", {
      requestedUserId: req.userId,
    })

    const result = await service.user.getUserById(req.userId!, { userRepository: this._userRepository })

    if (!result.ok) {
      return sendError(req, res, result.error)
    }

    const response = parseResponse(getUserResponseSchema, {
      avatar_url: result.value.avatarUrl,
      created_at: result.value.createdAt.toISOString(),
      email: result.value.email,
      id: result.value.id,
      name: result.value.name,
    })

    return res.status(200).json(response)
  }
}
