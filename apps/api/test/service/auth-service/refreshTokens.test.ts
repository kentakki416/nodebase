import { RefreshTokenRepository } from "../../../src/repository/redis/refresh-token-repository"
import { refreshTokens } from "../../../src/service/auth-service"

const mockDelete = vi.fn<(_0: string) => Promise<void>>()
const mockFindUserId = vi.fn<(_0: string) => Promise<number | null>>()
const mockSave = vi.fn<(_0: string, _1: number, _2: number) => Promise<void>>()
const mockRefreshTokenRepository: RefreshTokenRepository = {
  delete: mockDelete,
  findUserId: mockFindUserId,
  save: mockSave,
}

const mockGenerators = {
  generateAccessToken: vi.fn((_userId: number) => "new.access"),
  generateRefreshToken: vi.fn((_userId: number) => ({ jti: "new-jti", token: "new.refresh" })),
}

describe("refreshTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("正常系: 旧 jti を破棄し、新しい Access/Refresh Token を発行する", async () => {
    mockFindUserId.mockResolvedValue(1)

    const result = await refreshTokens(
      { refreshToken: "valid.token" },
      { refreshTokenRepository: mockRefreshTokenRepository },
      () => ({ jti: "old-jti", userId: 1 }),
      mockGenerators
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.accessToken).toBe("new.access")
      expect(result.value.refreshToken).toBe("new.refresh")
    }
    expect(mockDelete).toHaveBeenCalledWith("old-jti")
    expect(mockSave).toHaveBeenCalledWith("new-jti", 1, expect.any(Number))
  })

  it("検証失敗時、401 UNAUTHORIZED を返す", async () => {
    const result = await refreshTokens(
      { refreshToken: "broken" },
      { refreshTokenRepository: mockRefreshTokenRepository },
      () => null,
      mockGenerators
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.statusCode).toBe(401)
      expect(result.error.type).toBe("UNAUTHORIZED")
    }
    expect(mockDelete).not.toHaveBeenCalled()
    expect(mockSave).not.toHaveBeenCalled()
  })

  it("Redis に jti が無い場合（再利用検知）、401 UNAUTHORIZED を返す", async () => {
    mockFindUserId.mockResolvedValue(null)

    const result = await refreshTokens(
      { refreshToken: "revoked" },
      { refreshTokenRepository: mockRefreshTokenRepository },
      () => ({ jti: "old-jti", userId: 1 }),
      mockGenerators
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.statusCode).toBe(401)
      expect(result.error.type).toBe("UNAUTHORIZED")
    }
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it("userId が一致しない場合、401 UNAUTHORIZED を返す", async () => {
    mockFindUserId.mockResolvedValue(2)

    const result = await refreshTokens(
      { refreshToken: "mismatch" },
      { refreshTokenRepository: mockRefreshTokenRepository },
      () => ({ jti: "old-jti", userId: 1 }),
      mockGenerators
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.statusCode).toBe(401)
    }
    expect(mockDelete).not.toHaveBeenCalled()
  })
})
