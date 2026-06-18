import { err, notFoundError, ok, Result } from "@repo/errors"
import { logger } from "@repo/logger"

import { UserRepository } from "../repository/prisma"
import { User } from "../types/domain"

/**
 * ユーザーIDからユーザー情報を取得
 */
export const getUserById = async (
  userId: number,
  repo: { userRepository: UserRepository }
): Promise<Result<User>> => {
  logger.debug("UserService: Fetching user by ID", {
    userId,
  })
  const user = await repo.userRepository.findById(userId)
  if (!user) {
    logger.debug("UserService: User not found", {
      userId,
    })
    return err(notFoundError("User not found"))
  }
  logger.debug("UserService: User found", {
    userId: user.id,
  })
  return ok(user)
}
