import { MemoRepository } from "../../../src/repository/prisma/memo-repository"
import { getAllMemos } from "../../../src/service/memo-service"
import { Memo } from "../../../src/types/domain"

// モック
const mockFindAll = vi.fn<() => Promise<Memo[]>>()

const mockMemoRepository: MemoRepository = {
  create: vi.fn(),
  deleteById: vi.fn(),
  findAll: mockFindAll,
  findById: vi.fn(),
  update: vi.fn(),
}

describe("getAllMemos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("成功時は ok: true とメモ一覧を返す", async () => {
    // Arrange
    const mockMemos: Memo[] = [
      {
        body: "Body 1",
        createdAt: new Date(),
        id: 1,
        title: "Title 1",
        updatedAt: new Date(),
      },
      {
        body: "Body 2",
        createdAt: new Date(),
        id: 2,
        title: "Title 2",
        updatedAt: new Date(),
      },
    ]

    mockFindAll.mockResolvedValue(mockMemos)

    // Act
    const result = await getAllMemos({ memoRepository: mockMemoRepository })

    // Assert
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual(mockMemos)
      expect(result.value).toHaveLength(2)
    }
    expect(mockFindAll).toHaveBeenCalledTimes(1)
  })

  it("メモが存在しない場合、ok: true と空配列を返す", async () => {
    // Arrange
    mockFindAll.mockResolvedValue([])

    // Act
    const result = await getAllMemos({ memoRepository: mockMemoRepository })

    // Assert
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual([])
      expect(result.value).toHaveLength(0)
    }
    expect(mockFindAll).toHaveBeenCalledTimes(1)
  })

  it("データベースエラー時にエラーをスローする", async () => {
    // Arrange
    const mockError = new Error("Database connection failed")
    mockFindAll.mockRejectedValue(mockError)

    // Act & Assert
    await expect(getAllMemos({ memoRepository: mockMemoRepository })).rejects.toThrow(
      "Database connection failed"
    )
  })
})
