import type { MemoRepository } from "../../../src/repository/prisma"
import { cleanupOldMemos } from "../../../src/service/memo/cleanup-old-memos"

describe("cleanupOldMemos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("正常系", () => {
    it("now - olderThanDays から計算した threshold で deleteOlderThan を呼び、件数と閾値を返す", async () => {
      const deleteOlderThan = vi.fn<(_: Date) => Promise<number>>(async () => 7)
      const memoRepository: MemoRepository = { deleteOlderThan }

      const now = new Date("2026-06-06T00:00:00.000Z")
      const result = await cleanupOldMemos(
        { now, olderThanDays: 90 },
        { memoRepository },
      )

      const expectedThreshold = new Date("2026-03-08T00:00:00.000Z")
      expect(result).toEqual({
        deletedCount: 7,
        threshold: expectedThreshold,
      })
      expect(deleteOlderThan).toHaveBeenCalledWith(expectedThreshold)
    })

    it("対象がゼロ件のときも threshold と deletedCount=0 を返す", async () => {
      const deleteOlderThan = vi.fn<(_: Date) => Promise<number>>(async () => 0)
      const memoRepository: MemoRepository = { deleteOlderThan }

      const result = await cleanupOldMemos(
        { now: new Date("2026-06-06T00:00:00.000Z"), olderThanDays: 30 },
        { memoRepository },
      )

      expect(result.deletedCount).toBe(0)
    })
  })

  describe("異常系", () => {
    it("Repository が throw した場合、そのまま伝搬する", async () => {
      const deleteOlderThan = vi.fn<(_: Date) => Promise<number>>(async () => {
        throw new Error("db connection failed")
      })
      const memoRepository: MemoRepository = { deleteOlderThan }

      await expect(
        cleanupOldMemos(
          { now: new Date(), olderThanDays: 90 },
          { memoRepository },
        ),
      ).rejects.toThrow()
    })
  })
})
