import type { PrismaClient } from "@repo/db"

/**
 * cron 側 (cleanup batch) で必要な memo 操作のインターフェース
 *
 * apps/api 側の MemoRepository と意図的に分離している:
 *   - api 側は CRUD ベース（findAll / findById / create / update / deleteById）
 *   - cron 側は一括削除など batch 系の操作だけ持つ
 * 共有 interface を作ると不要なメソッドが両方に漏れ出すため、それぞれの app で必要な
 * 操作のみを持つ独自 interface とする方針。
 */
export interface MemoRepository {
  /**
   * `threshold` より前に作成された memo をすべて削除し、削除件数を返す。
   */
  deleteOlderThan(threshold: Date): Promise<number>
}

/**
 * Prisma 実装の MemoRepository
 */
export class PrismaMemoRepository implements MemoRepository {
  private _prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this._prisma = prisma
  }

  public async deleteOlderThan(threshold: Date): Promise<number> {
    const result = await this._prisma.memo.deleteMany({
      where: {
        createdAt: { lt: threshold },
      },
    })
    return result.count
  }
}
