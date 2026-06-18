import request from "supertest"

import { AuthLogoutController } from "../../../src/controller/auth/logout"
import { generateAccessToken, generateRefreshToken } from "../../../src/lib/jwt"
import { IoRedisRefreshTokenRepository } from "../../../src/repository/redis"
import { authRouter } from "../../../src/routes/auth-router"
import { attachUnhandledExceptionHandler, createTestApp } from "../helper"
import {
  cleanupTestRedis,
  disconnectTestRedis,
  testRedis,
} from "../setup"

const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7

const refreshTokenRepository = new IoRedisRefreshTokenRepository(testRedis)

const app = createTestApp()
const authLogoutController = new AuthLogoutController(refreshTokenRepository)
app.use("/api/auth", authRouter({ logout: authLogoutController }))
attachUnhandledExceptionHandler(app)

beforeEach(async () => {
  await cleanupTestRedis()
})

afterAll(async () => {
  await cleanupTestRedis()
  await disconnectTestRedis()
})

describe("POST /api/auth/logout", () => {
  it("正常系: 200 を返し Refresh Token の jti が Redis から削除される", async () => {
    const userId = 1
    const accessToken = generateAccessToken(userId)
    const { jti, token: refreshToken } = generateRefreshToken(userId)
    await refreshTokenRepository.save(jti, userId, REFRESH_TTL_SECONDS)

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refresh_token: refreshToken })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ message: "OK" })
    expect(await refreshTokenRepository.findUserId(jti)).toBeNull()
  })

  it("ログアウト後、同じ Refresh Token は使えない（/refresh が 401）", async () => {
    const userId = 1
    const accessToken = generateAccessToken(userId)
    const { jti, token: refreshToken } = generateRefreshToken(userId)
    await refreshTokenRepository.save(jti, userId, REFRESH_TTL_SECONDS)

    await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refresh_token: refreshToken })

    /** Redis から消えていることを直接確認（/refresh の挙動は refresh.test.ts 側で網羅済み） */
    expect(await refreshTokenRepository.findUserId(jti)).toBeNull()
  })

  it("無効な Refresh Token でも冪等性のため 200 を返し、Redis 状態は変化しない", async () => {
    const userId = 1
    const accessToken = generateAccessToken(userId)

    /** 別ユーザーの jti が Redis に残っていても影響しないこと */
    const { jti: otherJti } = generateRefreshToken(2)
    await refreshTokenRepository.save(otherJti, 2, REFRESH_TTL_SECONDS)

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refresh_token: "invalid.refresh.token" })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ message: "OK" })
    expect(await refreshTokenRepository.findUserId(otherJti)).toBe(2)
  })

  it("Access Token が無い場合、401 を返す", async () => {
    const { token: refreshToken } = generateRefreshToken(1)

    const res = await request(app)
      .post("/api/auth/logout")
      .send({ refresh_token: refreshToken })

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: expect.any(String), status_code: 401 })
  })

  it("refresh_token が無い場合、400 を返す", async () => {
    const accessToken = generateAccessToken(1)

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({})

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: expect.any(String), status_code: 400 })
  })
})
