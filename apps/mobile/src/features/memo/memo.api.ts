import axios from "axios"

import { Memo } from "./memo.entity"

const client = axios.create({ baseURL: process.env.EXPO_PUBLIC_API_URL })

export const memoApi = {
  /** メモ一覧の取得 */
  async getAll(): Promise<Memo[]> {
    const result = await client.get("/api/memo")
    return result.data.memos.map((memo: Memo) => new Memo(memo))
  },

  /** メモの作成 */
  async create(title: string, body: string): Promise<Memo> {
    const result = await client.post("/api/memo", { title, body })
    return new Memo(result.data) // 型安全ではない
  },

  /** メモの編集 */
  async update(id: string, title: string, body: string): Promise<Memo> {
    const result = await client.put(`/api/memo/${id}`, { title, body })
    return new Memo(result.data)
  },

  /** メモの削除 */
  async delete(id: string): Promise<void> {
    await client.delete(`/api/memo/${id}`)
    return
  }
}