import { create } from "zustand"

import { Memo } from "./memo.entity"

type MemoState = {
  memos: Memo[]
  isLoading: boolean
  addStoreMemo: (memo: Memo) => void
  deleteStoreMemo: (id: string) => void
  setStoreIsLoading: (isLoading: boolean) => void
  setStoreMemos: (memos: Memo[]) => void
  updateStoreMemo: (memo: Memo) => void
}

export const useMemoStore = create<MemoState>((set) => ({
  isLoading: false,
  memos: [],
  addStoreMemo: (memo) => set((state) => ({ memos: [...state.memos, memo] })),
  deleteStoreMemo: (id) => set((state) => ({
    memos: state.memos.filter((m) => m.id !== id),
  })),
  setStoreIsLoading: (isLoading) => set({ isLoading }),
  setStoreMemos: (memos) => set({ memos }),
  updateStoreMemo: (memo) => set((state) => ({
    memos: state.memos.map((m) => (m.id === memo.id ? memo : m)),
  })),
}))
