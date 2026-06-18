import { RefreshTokenRepository } from "../../../src/repository/redis/refresh-token-repository"
import { logout } from "../../../src/service/auth-service"

const mockDelete = vi.fn<(_0: string) => Promise<void>>()
const mockRefreshTokenRepository: RefreshTokenRepository = {
  delete: mockDelete,
  findUserId: vi.fn(),
  save: vi.fn(),
}

describe("logout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("正常系: Refresh Token の jti を Redis から削除する", async () => {
    const result = await logout(
      { refreshToken: "valid.token" },
      { refreshTokenRepository: mockRefreshTokenRepository },
      () => ({ jti: "target-jti", userId: 1 })
    )

    expect(result.ok).toBe(true)
    expect(mockDelete).toHaveBeenCalledWith("target-jti")
  })

  it("検証失敗時、冪等性のため成功扱い（delete は呼ばれない）", async () => {
    const result = await logout(
      { refreshToken: "broken" },
      { refreshTokenRepository: mockRefreshTokenRepository },
      () => null
    )

    expect(result.ok).toBe(true)
    expect(mockDelete).not.toHaveBeenCalled()
  })
})
