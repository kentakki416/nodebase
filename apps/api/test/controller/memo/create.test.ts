import request from "supertest"

import { MemoCreateController } from "../../../src/controller/memo/create"
import { PrismaMemoRepository } from "../../../src/repository/prisma/memo-repository"
import { memoRouter } from "../../../src/routes/memo-router"
import { attachUnhandledExceptionHandler, createTestApp } from "../helper"
import { cleanupTestData, disconnectTestDb, disconnectTestRedis, testPrisma } from "../setup"

const memoRepository = new PrismaMemoRepository(testPrisma)

const app = createTestApp()

app.use("/api/memo", memoRouter({ create: new MemoCreateController(memoRepository) }))
attachUnhandledExceptionHandler(app)

beforeEach(async () => {
  await cleanupTestData()
})

afterAll(async () => {
  await cleanupTestData()
  await disconnectTestDb()
  await disconnectTestRedis()
})

describe("POST /api/memo", () => {
  it("201 と作成されたメモを返す", async () => {
    const res = await request(app)
      .post("/api/memo")
      .send({ body: "New Body", title: "New Title" })

    expect(res.status).toBe(201)
    expect(res.body.title).toBe("New Title")
    expect(res.body.body).toBe("New Body")
    expect(res.body.id).toBeDefined()

    // DBに実際に保存されていることを確認
    const memo = await testPrisma.memo.findUnique({ where: { id: res.body.id } })
    expect(memo).not.toBeNull()
    expect(memo!.title).toBe("New Title")
  })

  it("リクエストボディが不正な場合、400 を返す", async () => {
    const res = await request(app)
      .post("/api/memo")
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })

  it("titleが空の場合、400 を返す", async () => {
    const res = await request(app)
      .post("/api/memo")
      .send({ body: "Body", title: "" })

    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })
})
