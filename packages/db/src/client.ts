import { PrismaPg } from "@prisma/adapter-pg"
import { readReplicas } from "@prisma/extension-read-replicas"

import { PrismaClient } from "../generated/client"

const DEFAULT_URL = "postgresql://postgres:password@localhost:5432/nodebase_dev"

/**
 * DATABASE_URL を取得しつつ、DB_NAME が指定されていれば DB 名部分を上書きする
 * テスト実行時の DB 切り替え（DB_NAME=nodebase_test）に対応
 */
const buildConnectionString = (): string => {
  const baseUrl = process.env.DATABASE_URL ?? DEFAULT_URL
  const dbName = process.env.DB_NAME
  if (!dbName) return baseUrl
  return baseUrl.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`)
}

export type CreatePrismaClientOptions = {
  /**
   * 接続文字列を明示指定する。省略時は process.env.DATABASE_URL (+ DB_NAME 上書き)
   */
  url?: string
  /**
   * read replica の接続文字列。省略時は process.env.DATABASE_REPLICA_URL を読み、
   * それも無ければ replica を使わない（primary のみで read/write 両方を扱う）
   */
  replicaUrl?: string
}

/**
 * PrismaClient のファクトリ
 * 各 app の src/index.ts で 1 回呼び、Repository コンストラクタに渡す。
 *
 * read replica が設定されている場合は @prisma/extension-read-replicas で自動振り分け：
 *   - findMany / findUnique / count / aggregate などの read → replica
 *   - create / update / delete / $transaction / $executeRaw → primary
 * 強整合性が必要な read は (prisma as any).$primary().user.findUnique(...) で primary 強制可能
 *
 * 戻り値は PrismaClient 型に揃えている（extension の戻り値は別型になるため、
 * Repository コンストラクタの互換性確保のためにキャストしている）。
 */
export const createPrismaClient = (options: CreatePrismaClientOptions = {}): PrismaClient => {
  const adapter = new PrismaPg(options.url ?? buildConnectionString())
  const base = new PrismaClient({ adapter })
  const replicaUrl = options.replicaUrl ?? process.env.DATABASE_REPLICA_URL
  if (!replicaUrl) return base
  const replicaAdapter = new PrismaPg(replicaUrl)
  const replica = new PrismaClient({ adapter: replicaAdapter })
  /** eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion */
  return base.$extends(readReplicas({ replicas: [replica] })) as unknown as PrismaClient
}
