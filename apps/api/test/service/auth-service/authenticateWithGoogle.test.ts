import { GoogleUserInfo, IGoogleOAuthClient } from "../../../src/client/google-oauth"
import { AuthAccountRepository } from "../../../src/repository/prisma/auth-account-repository"
import {
  TransactionContext,
  TransactionRunner,
} from "../../../src/repository/prisma/transaction-runner"
import { UserRepository } from "../../../src/repository/prisma/user-repository"
import { RefreshTokenRepository } from "../../../src/repository/redis/refresh-token-repository"
import { authenticateWithGoogle } from "../../../src/service/auth-service"
import { AuthAccountWithUser, User } from "../../../src/types/domain"

const mockGetUserInfo = vi.fn<(_0: string, _1: string) => Promise<GoogleUserInfo>>()
const mockGoogleOAuthClient: IGoogleOAuthClient = {
  getUserInfo: mockGetUserInfo,
}

const mockFindByProvider = vi.fn<(_0: string, _1: string) => Promise<AuthAccountWithUser | null>>()
const mockAuthAccountCreate = vi.fn<(
  _0: Parameters<AuthAccountRepository["create"]>[0],
  _1?: TransactionContext,
) => Promise<unknown>>()
const mockAuthAccountRepository: AuthAccountRepository = {
  create: mockAuthAccountCreate as never,
  findByProvider: mockFindByProvider,
}

const mockUserCreate = vi.fn<(
  _0: Parameters<UserRepository["create"]>[0],
  _1?: TransactionContext,
) => Promise<User>>()
const mockUserRepository: UserRepository = {
  create: mockUserCreate,
  findByEmail: vi.fn(),
  findById: vi.fn(),
}

const mockRefreshTokenSave = vi.fn<(_0: string, _1: number, _2: number) => Promise<void>>()
const mockRefreshTokenRepository: RefreshTokenRepository = {
  delete: vi.fn(),
  findUserId: vi.fn(),
  save: mockRefreshTokenSave,
}

/**
 * Fake TransactionRunner: tx を渡さずそのまま callback を実行する。
 * 単体テストでは実 tx の atomicity を検証する必要が無いため、tx 引数として
 * undefined を渡し、Repository が tx 無し経路で動作することを確認する。
 */
const mockTransactionRunner: TransactionRunner = {
  run: vi.fn(async (fn) => fn(undefined as unknown as TransactionContext)),
}

const mockRepository = {
  authAccountRepository: mockAuthAccountRepository,
  refreshTokenRepository: mockRefreshTokenRepository,
  transactionRunner: mockTransactionRunner,
  userRepository: mockUserRepository,
}

const mockTokenGenerators = {
  generateAccessToken: vi.fn((_userId: number) => "access.jwt"),
  generateRefreshToken: vi.fn((_userId: number) => ({ jti: "uuid-1", token: "refresh.jwt" })),
}

const REDIRECT_URI = "http://localhost:3000/api/auth/callback/google"

describe("authenticateWithGoogle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("既存ユーザーの場合、isNewUser=false で Access/Refresh Token を発行する", async () => {
    const mockGoogleUser: GoogleUserInfo = {
      email: "test@example.com",
      id: "google-123",
      name: "Test User",
      picture: "https://example.com/avatar.jpg",
    }

    const mockExistingUser: User = {
      avatarUrl: "https://example.com/avatar.jpg",
      createdAt: new Date(),
      email: "test@example.com",
      id: 1,
      name: "Test User",
      updatedAt: new Date(),
    }

    const mockExistingAccount: AuthAccountWithUser = {
      createdAt: new Date(),
      id: 1,
      provider: "google",
      providerAccountId: "google-123",
      updatedAt: new Date(),
      user: mockExistingUser,
      userId: 1,
    }

    mockGetUserInfo.mockResolvedValue(mockGoogleUser)
    mockFindByProvider.mockResolvedValue(mockExistingAccount)

    const result = await authenticateWithGoogle(
      { code: "auth-code", redirectUri: REDIRECT_URI },
      mockRepository,
      mockGoogleOAuthClient,
      mockTokenGenerators
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({
        accessToken: "access.jwt",
        isNewUser: false,
        refreshToken: "refresh.jwt",
        user: mockExistingUser,
      })
    }
    expect(mockGetUserInfo).toHaveBeenCalledWith("auth-code", REDIRECT_URI)
    /** 既存ユーザーなのでトランザクションは走らない */
    expect(mockTransactionRunner.run).not.toHaveBeenCalled()
    expect(mockUserCreate).not.toHaveBeenCalled()
    expect(mockAuthAccountCreate).not.toHaveBeenCalled()
    expect(mockRefreshTokenSave).toHaveBeenCalledWith("uuid-1", 1, expect.any(Number))
  })

  it("新規ユーザーの場合、tx 内で User + AuthAccount を作成し Access/Refresh Token を発行する", async () => {
    const mockGoogleUser: GoogleUserInfo = {
      email: "newuser@example.com",
      id: "google-456",
      name: "New User",
      picture: "https://example.com/new-avatar.jpg",
    }

    const mockNewUser: User = {
      avatarUrl: "https://example.com/new-avatar.jpg",
      createdAt: new Date(),
      email: "newuser@example.com",
      id: 2,
      name: "New User",
      updatedAt: new Date(),
    }

    mockGetUserInfo.mockResolvedValue(mockGoogleUser)
    mockFindByProvider.mockResolvedValue(null)
    mockUserCreate.mockResolvedValue(mockNewUser)
    mockAuthAccountCreate.mockResolvedValue(undefined)

    const result = await authenticateWithGoogle(
      { code: "auth-code", redirectUri: REDIRECT_URI },
      mockRepository,
      mockGoogleOAuthClient,
      mockTokenGenerators
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({
        accessToken: "access.jwt",
        isNewUser: true,
        refreshToken: "refresh.jwt",
        user: mockNewUser,
      })
    }
    expect(mockTransactionRunner.run).toHaveBeenCalledTimes(1)
    /** fake runner は tx として undefined を渡すので、第2引数は undefined */
    expect(mockUserCreate).toHaveBeenCalledWith(
      {
        avatarUrl: "https://example.com/new-avatar.jpg",
        email: "newuser@example.com",
        name: "New User",
      },
      undefined,
    )
    expect(mockAuthAccountCreate).toHaveBeenCalledWith(
      {
        provider: "google",
        providerAccountId: "google-456",
        userId: 2,
      },
      undefined,
    )
    expect(mockRefreshTokenSave).toHaveBeenCalledWith("uuid-1", 2, expect.any(Number))
  })

  it("Google 認証エラー時に例外が伝播する", async () => {
    mockGetUserInfo.mockRejectedValue(new Error("network"))

    await expect(
      authenticateWithGoogle(
        { code: "invalid", redirectUri: REDIRECT_URI },
        mockRepository,
        mockGoogleOAuthClient,
        mockTokenGenerators
      )
    ).rejects.toThrow()
  })
})
