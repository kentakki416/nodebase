import { createPrismaClient } from "@repo/db"
import { createRedisClient } from "@repo/redis"

/**
 * DB_NAME / REDIS_DB / JWT 系の環境変数は test/vitest.setup.ts で
 * setupFiles 経由で先に設定されているため、ここで再設定する必要はない。
 * createPrismaClient / createRedisClient は process.env を読むので、
 * setupFiles で設定済みの値を拾ってテスト用 DB / Redis DB 1 に接続する。
 */
const prisma = createPrismaClient()
const redis = createRedisClient()

export { prisma as testPrisma }
export { redis as testRedis }

/**
 * テスト用 DB の public スキーマ配下に存在するテーブル名一覧。
 * Prisma 7 では `Prisma.dmmf` がランタイム公開されないため、PostgreSQL の system catalog から取得する。
 * `_prisma_migrations` は Prisma の管理テーブルなので除外する。
 * テストプロセス全体で一度だけ取得し、以降はキャッシュを使い回す。
 */
let cachedTableNames: string[] | null = null

const fetchTableNames = async (): Promise<string[]> => {
  if (cachedTableNames) return cachedTableNames
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `
  cachedTableNames = rows.map((row) => row.tablename)
  return cachedTableNames
}

/**
 * テスト間でデータをクリーンアップする（全テーブルを TRUNCATE CASCADE する）
 * PostgreSQL の TRUNCATE ... CASCADE で FK 制約を含めて一括削除する
 * 各テストは beforeEach で呼び出し、必要なデータは自分で seed する方針
 */
export const cleanupTestData = async (): Promise<void> => {
  const names = await fetchTableNames()
  if (names.length === 0) return
  const tables = names.map((name) => `"${name}"`).join(", ")
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE`)
}

/**
 * テスト間でRedisデータをクリーンアップする
 * FLUSHDB はテスト用DB番号のみをクリアするため、開発用データに影響しない
 */
export const cleanupTestRedis = async (): Promise<void> => {
  await redis.flushdb()
}

/**
 * テスト終了時にDB接続を切断する
 */
export const disconnectTestDb = async (): Promise<void> => {
  await prisma.$disconnect()
}

/**
 * テスト終了時にRedis接続を切断する
 */
export const disconnectTestRedis = async (): Promise<void> => {
  await redis.quit()
}
