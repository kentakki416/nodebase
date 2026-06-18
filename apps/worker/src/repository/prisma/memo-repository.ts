import type { Memo, PrismaClient } from "@repo/db"

/**
 * worker 側で必要な memo 操作の interface。
 *
 * apps/api / apps/cron の MemoRepository とは意図的に分離している。
 * 各 app は必要な操作のみを持つ独自 interface を定義する方針。
 */
export interface MemoRepository {
  findById(id: number): Promise<Memo | null>
}

/**
 * Prisma 実装の MemoRepository
 */
export class PrismaMemoRepository implements MemoRepository {
  private _prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this._prisma = prisma
  }

  public async findById(id: number): Promise<Memo | null> {
    return this._prisma.memo.findUnique({ where: { id } })
  }
}
