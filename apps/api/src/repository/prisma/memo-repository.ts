import { Prisma as PrismaTypes, PrismaClient } from "@repo/db"

import { Memo } from "../../types/domain"

/**
 * メモ作成時の入力
 */
export type CreateMemoInput = {
    body: string
    title: string
}

/**
 * メモ更新時の入力
 */
export type UpdateMemoInput = {
    body: string
    title: string
}

/**
 * メモリポジトリのインターフェース
 */
export interface MemoRepository {
    create(data: CreateMemoInput): Promise<Memo>
    deleteById(id: number): Promise<void>
    findAll(): Promise<Memo[]>
    findById(id: number): Promise<Memo | null>
    update(id: number, data: UpdateMemoInput): Promise<Memo>
}

/**
 * Prisma実装のメモリポジトリ
 */
export class PrismaMemoRepository implements MemoRepository {
  private _prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this._prisma = prisma
  }

  public async findAll(): Promise<Memo[]> {
    const memos = await this._prisma.memo.findMany({
      orderBy: { createdAt: "desc" },
    })
    return memos.map((memo) => this._toDomainMemo(memo))
  }

  public async findById(id: number): Promise<Memo | null> {
    const memo = await this._prisma.memo.findUnique({ where: { id } })
    if (!memo) return null
    return this._toDomainMemo(memo)
  }

  public async create(data: CreateMemoInput): Promise<Memo> {
    const memo = await this._prisma.memo.create({
      data: {
        body: data.body,
        title: data.title,
      },
    })
    return this._toDomainMemo(memo)
  }

  public async update(id: number, data: UpdateMemoInput): Promise<Memo> {
    const memo = await this._prisma.memo.update({
      data: {
        body: data.body,
        title: data.title,
      },
      where: { id },
    })
    return this._toDomainMemo(memo)
  }

  public async deleteById(id: number): Promise<void> {
    await this._prisma.memo.delete({ where: { id } })
  }

  /**
   * Prismaの型 → ドメインの型に変換
   */
  private _toDomainMemo(prismaMemo: PrismaTypes.MemoGetPayload<{}>): Memo {
    return {
      body: prismaMemo.body,
      createdAt: prismaMemo.createdAt,
      id: prismaMemo.id,
      title: prismaMemo.title,
      updatedAt: prismaMemo.updatedAt,
    }
  }
}
