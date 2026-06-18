import { PrismaClient } from "@repo/db"

/**
 * データベースのヘルスチェック用リポジトリのインターフェース
 */
export interface DatabaseHealthRepository {
  ping(): Promise<void>
}

/**
 * Prisma実装のデータベースヘルスチェックリポジトリ
 */
export class PrismaDatabaseHealthRepository implements DatabaseHealthRepository {
  private _prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this._prisma = prisma
  }

  public async ping(): Promise<void> {
    await this._prisma.$queryRaw`SELECT 1`
  }
}
