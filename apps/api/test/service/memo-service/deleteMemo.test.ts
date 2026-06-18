import { MemoRepository } from "../../../src/repository/prisma/memo-repository"
import { deleteMemo } from "../../../src/service/memo-service"
import { Memo } from "../../../src/types/domain"

// モック
const mockFindById = vi.fn<(_0: number) => Promise<Memo | null>>()
const mockDeleteById = vi.fn<(_0: number) => Promise<void>>()

const mockMemoRepository: MemoRepository = {
  create: vi.fn(),
  deleteById: mockDeleteById,
  findAll: vi.fn(),
  findById: mockFindById,
  update: vi.fn(),
}

describe("deleteMemo", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("メモが存在する場合、削除して ok: true を返す", async () => {
    // Arrange
    const existingMemo: Memo = {
      body: "Test Body",
      createdAt: new Date(),
      id: 1,
      title: "Test Title",
      updatedAt: new Date(),
    }

    mockFindById.mockResolvedValue(existingMemo)
    mockDeleteById.mockResolvedValue(undefined)

    // Act
    const result = await deleteMemo(1, { memoRepository: mockMemoRepository })

    // Assert
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({ deleted: true })
    }
    expect(mockFindById).toHaveBeenCalledWith(1)
    expect(mockDeleteById).toHaveBeenCalledWith(1)
  })

  it("メモが存在しない場合、ok: false と NOT_FOUND エラーを返す", async () => {
    // Arrange
    mockFindById.mockResolvedValue(null)

    // Act
    const result = await deleteMemo(999, { memoRepository: mockMemoRepository })

    // Assert
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe("NOT_FOUND")
      expect(result.error.statusCode).toBe(404)
      expect(result.error.message).toBe("Memo not found")
    }
    expect(mockFindById).toHaveBeenCalledWith(999)
    expect(mockDeleteById).not.toHaveBeenCalled()
  })

  it("データベースエラー時にエラーをスローする", async () => {
    // Arrange
    const mockError = new Error("Database connection failed")
    mockFindById.mockRejectedValue(mockError)

    // Act & Assert
    await expect(deleteMemo(1, { memoRepository: mockMemoRepository })).rejects.toThrow(
      "Database connection failed"
    )
    expect(mockFindById).toHaveBeenCalledWith(1)
  })
})
