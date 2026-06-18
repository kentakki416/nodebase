import request from "supertest"

import { AuthRefreshController } from "../../../src/controller/auth/refresh"
import { generateRefreshToken, verifyRefreshToken } from "../../../src/lib/jwt"
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
const authRefreshController = new AuthRefreshController(refreshTokenRepository)
app.use("/api/auth", authRouter({ refresh: authRefreshController }))
attachUnhandledExceptionHandler(app)

beforeEach(async () => {
  await cleanupTestRedis()
})

afterAll(async () => {
  await cleanupTestRedis()
  await disconnectTestRedis()
})

describe("POST /api/auth/refresh", () => {
  it("正常系: 旧 jti が Redis から削除され、新 jti が保存される", async () => {
    const userId = 1
    const { jti: oldJti, token } = generateRefreshToken(userId)
    await refreshTokenRepository.save(oldJti, userId, REFRESH_TTL_SECONDS)

    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refresh_token: token })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      access_token: expect.any(String),
      refresh_token: expect.any(String),
    })

    /** 旧 jti は Redis から削除されている */
    expect(await refreshTokenRepository.findUserId(oldJti)).toBeNull()

    /** 新 jti は Redis に保存されている */
    const newPayload = verifyRefreshToken(res.body.refresh_token)
    expect(newPayload).not.toBeNull()
    expect(await refreshTokenRepository.findUserId(newPayload!.jti)).toBe(userId)
  })

  it("同じ Refresh Token を 2 回連続で使うと 2 回目は 401（再利用検知）", async () => {
    const userId = 1
    const { jti, token } = generateRefreshToken(userId)
    await refreshTokenRepository.save(jti, userId, REFRESH_TTL_SECONDS)

    const first = await request(app)
      .post("/api/auth/refresh")
      .send({ refresh_token: token })
    expect(first.status).toBe(200)

    const second = await request(app)
      .post("/api/auth/refresh")
      .send({ refresh_token: token })
    expect(second.status).toBe(401)
    expect(second.body).toEqual({ error: expect.any(String), status_code: 401 })
  })

  it("Refresh Token が改ざんされている場合、401 を返す", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refresh_token: "invalid.refresh.token" })

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: expect.any(String), status_code: 401 })
  })

  it("Redis に jti が無い場合（再利用検知）、401 を返す", async () => {
    const { token } = generateRefreshToken(1)

    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refresh_token: token })

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: expect.any(String), status_code: 401 })
  })

  it("refresh_token が無い場合、400 を返す", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({})

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: expect.any(String), status_code: 400 })
  })
})
