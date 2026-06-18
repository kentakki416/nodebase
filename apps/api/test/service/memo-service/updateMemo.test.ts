import { MemoRepository, UpdateMemoInput } from "../../../src/repository/prisma/memo-repository"
import { updateMemo } from "../../../src/service/memo-service"
import { Memo } from "../../../src/types/domain"

// モック
const mockFindById = vi.fn<(_0: number) => Promise<Memo | null>>()
const mockUpdate = vi.fn<(_0: number, _1: UpdateMemoInput) => Promise<Memo>>()

const mockMemoRepository: MemoRepository = {
  create: vi.fn(),
  deleteById: vi.fn(),
  findAll: vi.fn(),
  findById: mockFindById,
  update: mockUpdate,
}

describe("updateMemo", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("メモが存在する場合、更新して ok: true で返す", async () => {
    // Arrange
    const existingMemo: Memo = {
      body: "Old Body",
      createdAt: new Date(),
      id: 1,
      title: "Old Title",
      updatedAt: new Date(),
    }

    const input: UpdateMemoInput = {
      body: "Updated Body",
      title: "Updated Title",
    }

    const updatedMemo: Memo = {
      body: "Updated Body",
      createdAt: existingMemo.createdAt,
      id: 1,
      title: "Updated Title",
      updatedAt: new Date(),
    }

    mockFindById.mockResolvedValue(existingMemo)
    mockUpdate.mockResolvedValue(updatedMemo)

    // Act
    const result = await updateMemo(1, input, { memoRepository: mockMemoRepository })

    // Assert
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual(updatedMemo)
    }
    expect(mockFindById).toHaveBeenCalledWith(1)
    expect(mockUpdate).toHaveBeenCalledWith(1, input)
  })

  it("メモが存在しない場合、ok: false と NOT_FOUND エラーを返す", async () => {
    // Arrange
    const input: UpdateMemoInput = {
      body: "Updated Body",
      title: "Updated Title",
    }

    mockFindById.mockResolvedValue(null)

    // Act
    const result = await updateMemo(999, input, { memoRepository: mockMemoRepository })

    // Assert
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe("NOT_FOUND")
      expect(result.error.statusCode).toBe(404)
      expect(result.error.message).toBe("Memo not found")
    }
    expect(mockFindById).toHaveBeenCalledWith(999)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("データベースエラー時にエラーをスローする", async () => {
    // Arrange
    const input: UpdateMemoInput = {
      body: "Updated Body",
      title: "Updated Title",
    }

    const mockError = new Error("Database connection failed")
    mockFindById.mockRejectedValue(mockError)

    // Act & Assert
    await expect(updateMemo(1, input, { memoRepository: mockMemoRepository })).rejects.toThrow(
      "Database connection failed"
    )
    expect(mockFindById).toHaveBeenCalledWith(1)
  })
})
