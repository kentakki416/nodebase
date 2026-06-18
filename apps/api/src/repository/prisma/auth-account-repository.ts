import { PrismaClient, Prisma as PrismaTypes } from "@repo/db"

import { AuthAccount, AuthAccountWithUser, User } from "../../types/domain"

import { TransactionContext } from "./transaction-runner"

/**
 * 認証アカウント作成時の入力
 *
 * provider は "google" | "github" | "credentials" などの文字列を受ける（schema 側は String 型）。
 * OAuth トークン系は本アプリでは保持しないため input に含めない。
 */
export type CreateAuthAccountInput = {
    provider: string
    providerAccountId: string
    userId: number
}

/**
 * 認証アカウントリポジトリのインターフェース
 */
export interface AuthAccountRepository {
    create(data: CreateAuthAccountInput, tx?: TransactionContext): Promise<AuthAccount>
    findByProvider(
        provider: string,
        providerAccountId: string
    ): Promise<AuthAccountWithUser | null>
}

/**
 * Prismaの型
 */
type PrismaAuthAccountWithUser = PrismaTypes.AuthAccountGetPayload<{
    include: { user: true }
}>

/**
 * Prisma実装の認証アカウントリポジトリ
 */
export class PrismaAuthAccountRepository implements AuthAccountRepository {
  private _prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this._prisma = prisma
  }

  public async findByProvider(
    provider: string,
    providerAccountId: string
  ): Promise<AuthAccountWithUser | null> {
    const prismaAuthAccount = await this._prisma.authAccount.findUnique({
      include: {
        user: true,
      },
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
    })

    if (!prismaAuthAccount) return null

    return this._toDomainAuthAccountWithUser(prismaAuthAccount)
  }

  public async create(data: CreateAuthAccountInput, tx?: TransactionContext): Promise<AuthAccount> {
    const client = tx ?? this._prisma
    const prismaAuthAccount = await client.authAccount.create({
      data: {
        provider: data.provider,
        providerAccountId: data.providerAccountId,
        userId: data.userId,
      },
    })

    return this._toDomainAuthAccount(prismaAuthAccount)
  }

  /**
   * Prismaの型 → ドメインの型に変換
   */
  private _toDomainUser(prismaUser: PrismaTypes.UserGetPayload<{}>): User {
    return {
      avatarUrl: prismaUser.avatarUrl,
      createdAt: prismaUser.createdAt,
      email: prismaUser.email,
      id: prismaUser.id,
      name: prismaUser.name,
      updatedAt: prismaUser.updatedAt,
    }
  }

  private _toDomainAuthAccount(
    prismaAuthAccount: PrismaTypes.AuthAccountGetPayload<{}>
  ): AuthAccount {
    return {
      createdAt: prismaAuthAccount.createdAt,
      id: prismaAuthAccount.id,
      provider: prismaAuthAccount.provider,
      providerAccountId: prismaAuthAccount.providerAccountId,
      updatedAt: prismaAuthAccount.updatedAt,
      userId: prismaAuthAccount.userId,
    }
  }

  private _toDomainAuthAccountWithUser(
    prismaAuthAccount: PrismaAuthAccountWithUser
  ): AuthAccountWithUser {
    return {
      ...this._toDomainAuthAccount(prismaAuthAccount),
      user: this._toDomainUser(prismaAuthAccount.user),
    }
  }
}
