import request from "supertest"

import { UserGetController } from "../../../src/controller/user/get"
import { generateAccessToken } from "../../../src/lib/jwt"
import { PrismaUserRepository } from "../../../src/repository/prisma/user-repository"
import { userRouter } from "../../../src/routes/user-router"
import { attachUnhandledExceptionHandler, createTestApp } from "../helper"
import { cleanupTestData, disconnectTestDb, disconnectTestRedis, testPrisma } from "../setup"

const userRepository = new PrismaUserRepository(testPrisma)

const app = createTestApp()

const userGetController = new UserGetController(userRepository)

app.use("/api/user", userRouter({ get: userGetController }))
attachUnhandledExceptionHandler(app)

beforeEach(async () => {
  await cleanupTestData()
})

afterAll(async () => {
  await cleanupTestData()
  await disconnectTestDb()
  await disconnectTestRedis()
})

describe("GET /api/user", () => {
  it("認証済みユーザーの場合、200 とユーザー情報を返す", async () => {
    const user = await testPrisma.user.create({
      data: {
        avatarUrl: "https://example.com/avatar.jpg",
        email: "test@example.com",
        name: "Test User",
      },
    })

    const token = generateAccessToken(user.id)

    const res = await request(app)
      .get("/api/user")
      .set("Authorization", `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      avatar_url: "https://example.com/avatar.jpg",
      created_at: expect.any(String),
      email: "test@example.com",
      id: user.id,
      name: "Test User",
    })
  })

  it("ユーザーが存在しない場合、404 を返す", async () => {
    const token = generateAccessToken(999999)

    const res = await request(app)
      .get("/api/user")
      .set("Authorization", `Bearer ${token}`)

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: expect.any(String), status_code: 404 })
  })

  it("トークンがない場合、401 を返す", async () => {
    const res = await request(app).get("/api/user")

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: expect.any(String), status_code: 401 })
  })

  it("無効なトークンの場合、401 を返す", async () => {
    const res = await request(app)
      .get("/api/user")
      .set("Authorization", "Bearer invalid-token")

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: expect.any(String), status_code: 401 })
  })
})
