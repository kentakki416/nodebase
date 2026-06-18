import { Prisma, PrismaClient } from "@repo/db"

/**
 * トランザクション内で実行される Prisma client。
 * Repository の tx 引数として受け取る型。通常の PrismaClient と互換のメソッド集を持つ。
 */
export type TransactionContext = Prisma.TransactionClient

/**
 * 業務ロジック単位でトランザクション境界を制御する抽象。
 *
 * Service 層が複数の Repository をまたぐ操作を atomic に実行するために使う。
 * Repository は受け取った `tx` を使って書き込めば、`run` の callback 内すべてが同一 tx で実行される。
 */
export interface TransactionRunner {
    run<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>
}

/**
 * Prisma 実装。`prisma.$transaction` をそのままラップする。
 */
export class PrismaTransactionRunner implements TransactionRunner {
  private _prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this._prisma = prisma
  }

  public async run<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return this._prisma.$transaction(fn)
  }
}
