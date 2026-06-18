import type { PrismaClient } from "@repo/db"

import { PrismaMemoRepository } from "../../../src/repository/prisma"

describe("PrismaMemoRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("deleteOlderThan", () => {
    describe("正常系", () => {
      it("threshold より古い memo を deleteMany で消し、件数を返す", async () => {
        const deleteMany = vi.fn<(_args: unknown) => Promise<{ count: number }>>(
          async () => ({ count: 5 }),
        )
        const prisma = { memo: { deleteMany } } as unknown as PrismaClient
        const repository = new PrismaMemoRepository(prisma)
        const threshold = new Date("2026-03-01T00:00:00.000Z")

        const deletedCount = await repository.deleteOlderThan(threshold)

        expect(deletedCount).toBe(5)
        expect(deleteMany).toHaveBeenCalledWith({
          where: { createdAt: { lt: threshold } },
        })
      })

      it("対象がゼロ件のときも 0 を返す", async () => {
        const deleteMany = vi.fn<(_args: unknown) => Promise<{ count: number }>>(
          async () => ({ count: 0 }),
        )
        const prisma = { memo: { deleteMany } } as unknown as PrismaClient
        const repository = new PrismaMemoRepository(prisma)

        const deletedCount = await repository.deleteOlderThan(new Date())

        expect(deletedCount).toBe(0)
      })
    })

    describe("異常系", () => {
      it("Prisma が throw した場合、そのまま伝搬する", async () => {
        const deleteMany = vi.fn<(_args: unknown) => Promise<{ count: number }>>(
          async () => {
            throw new Error("db connection failed")
          },
        )
        const prisma = { memo: { deleteMany } } as unknown as PrismaClient
        const repository = new PrismaMemoRepository(prisma)

        await expect(repository.deleteOlderThan(new Date())).rejects.toThrow()
      })
    })
  })
})
