import type { Memo } from "@repo/db"
import type { JobMessage, ProcessMemoJobData } from "@repo/queue"

import { processMemo } from "../../src/jobs/process-memo"

const buildMessage = (memoId: number): JobMessage<ProcessMemoJobData> => ({
  attemptsMade: 0,
  data: { memoId },
  id: `job-${memoId}`,
})

const buildMemo = (overrides: Partial<Memo> = {}): Memo => ({
  body: "body",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  id: 1,
  title: "title",
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
})

describe("processMemo", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("正常系", () => {
    it("memo が存在するとき Repository.findById を呼び、例外を投げずに完了する", async () => {
      const findById = vi.fn<(_: number) => Promise<Memo | null>>(
        async () => buildMemo({ id: 7, title: "hello" }),
      )
      const handler = processMemo({ memoRepository: { findById } })

      await handler(buildMessage(7))

      expect(findById).toHaveBeenCalledWith(7)
    })

    it("memo が見つからないときも throw せずに終わる (read-only なので冪等)", async () => {
      const findById = vi.fn<(_: number) => Promise<Memo | null>>(async () => null)
      const handler = processMemo({ memoRepository: { findById } })

      await expect(handler(buildMessage(999))).resolves.toBeUndefined()
    })
  })

  describe("異常系", () => {
    it("Repository が throw した場合、そのまま伝搬する (Queue のリトライに任せる)", async () => {
      const findById = vi.fn<(_: number) => Promise<Memo | null>>(async () => {
        throw new Error("db connection failed")
      })
      const handler = processMemo({ memoRepository: { findById } })

      await expect(handler(buildMessage(1))).rejects.toThrow()
    })
  })
})
