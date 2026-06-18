import { randomUUID } from "node:crypto"

import jwt, { type Secret, type SignOptions } from "jsonwebtoken"

const JWT_ACCESS_SECRET: Secret = process.env.JWT_ACCESS_SECRET as string
const JWT_REFRESH_SECRET: Secret = process.env.JWT_REFRESH_SECRET as string
const JWT_ACCESS_EXPIRATION = (process.env.JWT_ACCESS_EXPIRATION || "15m") as SignOptions["expiresIn"]
const JWT_REFRESH_EXPIRATION = (process.env.JWT_REFRESH_EXPIRATION || "7d") as SignOptions["expiresIn"]

export type AccessTokenPayload = {
    exp?: number
    iat?: number
    userId: number
}

export type RefreshTokenPayload = {
    exp?: number
    iat?: number
    jti: string
    userId: number
}

/**
 * Access Token を生成する
 */
export const generateAccessToken = (userId: number): string => {
  return jwt.sign({ userId }, JWT_ACCESS_SECRET, { expiresIn: JWT_ACCESS_EXPIRATION })
}

/**
 * Refresh Token を生成する
 * jti は Redis に保存し、ローテーション・ログアウト時に当該 jti を破棄する
 */
export const generateRefreshToken = (userId: number): { jti: string; token: string } => {
  const jti = randomUUID()
  const token = jwt.sign({ jti, userId }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRATION })
  return { jti, token }
}

/**
 * Access Token を検証する
 */
export const verifyAccessToken = (token: string): AccessTokenPayload | null => {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET) as AccessTokenPayload
  } catch {
    return null
  }
}

/**
 * Refresh Token を検証する
 */
export const verifyRefreshToken = (token: string): RefreshTokenPayload | null => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload
  } catch {
    return null
  }
}
