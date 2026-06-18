import request from "supertest"

import { MemoListController } from "../../../src/controller/memo/list"
import { PrismaMemoRepository } from "../../../src/repository/prisma/memo-repository"
import { memoRouter } from "../../../src/routes/memo-router"
import { attachUnhandledExceptionHandler, createTestApp } from "../helper"
import { cleanupTestData, disconnectTestDb, disconnectTestRedis, testPrisma } from "../setup"

const memoRepository = new PrismaMemoRepository(testPrisma)

const app = createTestApp()

app.use("/api/memo", memoRouter({ list: new MemoListController(memoRepository) }))
attachUnhandledExceptionHandler(app)

beforeEach(async () => {
  await cleanupTestData()
})

afterAll(async () => {
  await cleanupTestData()
  await disconnectTestDb()
  await disconnectTestRedis()
})

describe("GET /api/memo", () => {
  it("200 とメモ一覧を返す", async () => {
    await testPrisma.memo.createMany({
      data: [
        { body: "Body 1", title: "Title 1" },
        { body: "Body 2", title: "Title 2" },
      ],
    })

    const res = await request(app).get("/api/memo")

    expect(res.status).toBe(200)
    expect(res.body.memos).toHaveLength(2)
  })

  it("メモが存在しない場合、200 と空配列を返す", async () => {
    const res = await request(app).get("/api/memo")

    expect(res.status).toBe(200)
    expect(res.body.memos).toEqual([])
  })
})
