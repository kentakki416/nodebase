import { NextFunction, Request, Response } from "express"

import { ErrorResponse } from "@repo/api-schema"

import { PUBLIC_PATHS } from "../const"
import { verifyAccessToken } from "../lib/jwt"

export interface AuthRequest extends Request {
  userId?: number
}

/**
 * 完全一致 or path セグメント境界での prefix 一致をチェックする。
 *
 * 単純な `path.startsWith(p)` は `/api/auth/github` が `/api/auth/github-foo` も
 * 通してしまうため、登録されたエンドポイントと意図しないパスが衝突するリスクがある。
 * `/` 区切り (= path segment 境界) で一致するもののみ通す。
 *
 * 例 (p = "/api/auth/github"):
 * - "/api/auth/github"          → true (完全一致)
 * - "/api/auth/github/callback" → true (segment 境界の prefix)
 * - "/api/auth/github-foo"      → false (segment 境界ではない)
 */
const matchesPathPrefix = (path: string, p: string): boolean =>
  path === p || path.startsWith(`${p}/`)

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  /**
   * 公開パスは認証不要
   */
  if (PUBLIC_PATHS.some(p => matchesPathPrefix(req.path, p))) {
    return next()
  }

  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const errorResponse: ErrorResponse = {
        error: "No token provided",
        status_code: 401,
      }
      return res.status(401).json(errorResponse)
    }

    const token = authHeader.substring(7)
    const payload = verifyAccessToken(token)

    if (!payload) {
      const errorResponse: ErrorResponse = {
        error: "Invalid or expired token",
        status_code: 401,
      }
      return res.status(401).json(errorResponse)
    }

    req.userId = payload.userId
    return next()
  } catch {
    const errorResponse: ErrorResponse = {
      error: "Authentication failed",
      status_code: 500,
    }
    res.status(500).json(errorResponse)
  }
}