import request from "supertest"

import { HealthLivenessController } from "../../../src/controller/health/liveness"
import { healthRouter } from "../../../src/routes/health-router"
import { attachUnhandledExceptionHandler, createTestApp } from "../helper"
import { disconnectTestDb, disconnectTestRedis } from "../setup"

const app = createTestApp()

const livenessController = new HealthLivenessController()

app.use("/api/health", healthRouter({ liveness: livenessController }))
attachUnhandledExceptionHandler(app)

afterAll(async () => {
  await disconnectTestDb()
  await disconnectTestRedis()
})

describe("GET /api/health", () => {
  it("200 と status: ok を返す", async () => {
    const res = await request(app).get("/api/health")

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: "ok" })
  })
})
