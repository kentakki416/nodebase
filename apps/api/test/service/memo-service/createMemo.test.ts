import { CreateMemoInput, MemoRepository } from "../../../src/repository/prisma/memo-repository"
import { createMemo } from "../../../src/service/memo-service"
import { Memo } from "../../../src/types/domain"

// モック
const mockCreate = vi.fn<(_0: CreateMemoInput) => Promise<Memo>>()

const mockMemoRepository: MemoRepository = {
  create: mockCreate,
  deleteById: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
}

describe("createMemo", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("メモを作成して ok: true で返す", async () => {
    // Arrange
    const input: CreateMemoInput = {
      body: "New Body",
      title: "New Title",
    }

    const mockMemo: Memo = {
      body: "New Body",
      createdAt: new Date(),
      id: 1,
      title: "New Title",
      updatedAt: new Date(),
    }

    mockCreate.mockResolvedValue(mockMemo)

    // Act
    const result = await createMemo(input, { memoRepository: mockMemoRepository })

    // Assert
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual(mockMemo)
    }
    expect(mockCreate).toHaveBeenCalledWith(input)
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it("データベースエラー時にエラーをスローする", async () => {
    // Arrange
    const input: CreateMemoInput = {
      body: "New Body",
      title: "New Title",
    }

    const mockError = new Error("Database connection failed")
    mockCreate.mockRejectedValue(mockError)

    // Act & Assert
    await expect(createMemo(input, { memoRepository: mockMemoRepository })).rejects.toThrow(
      "Database connection failed"
    )
    expect(mockCreate).toHaveBeenCalledWith(input)
  })
})
