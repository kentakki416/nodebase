import { useLocalSearchParams, useRouter } from "expo-router"

import MemoForm from "@/components/features/memo/MemoForm"
import { memoApi } from "@/features/memo/memo.api"
import { useMemoStore } from "@/features/memo/memo.state"

export default function MemoEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const memo = useMemoStore((state) => state.memos.find((m) => String(m.id) === id))

  const router = useRouter()

  const updateStoreMemo = useMemoStore((state) => state.updateStoreMemo)

  const updateMemo = async (title: string, body: string) => {
    try {
      const updatedMemo = await memoApi.update(memo!.id, title, body)
      updateStoreMemo(updatedMemo)
      router.back()
    } catch (err) {
      alert(err)
    }
  }

  return (
    <MemoForm memo={memo} onSave={updateMemo} />
  )
}