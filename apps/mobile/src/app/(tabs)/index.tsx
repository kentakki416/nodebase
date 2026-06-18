import { useFocusEffect } from "@react-navigation/native"
import * as Haptics from "expo-haptics"
import { Stack, useRouter } from "expo-router"
import { memo, useCallback } from "react"
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import EmptyView from "@/components/features/memo/EmptyView"
import MemoListItem from "@/components/features/memo/MemoListItem"
import { COLORS } from "@/constants/color"
import { memoApi } from "@/features/memo/memo.api"
import { useMemoStore } from "@/features/memo/memo.state"

export default function MemoListScreen() {
  const router = useRouter()
  const { isLoading, memos, setStoreIsLoading, setStoreMemos, deleteStoreMemo } = useMemoStore()

  useFocusEffect(
    useCallback(() => {
      const fetchMemos = async () => {
        setStoreIsLoading(true)
        try {
          const data = await memoApi.getAll()
          setStoreMemos(data)
        } catch (err) {
          console.error("Failed to fetch memos:", err)
        } finally {
          setStoreIsLoading(false)
        }
      }
      fetchMemos()
    }, [setStoreIsLoading, setStoreMemos])
  )

  const deleteMemo = async (id: string) => {
    try {
      await memoApi.delete(id)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      deleteStoreMemo(id)
    } catch (err) {
      alert(err)
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "メモ",
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push("/memo/new")}>
              <Text style={styles.addButton}>+</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        {isLoading ? (
          <View style={styles.loaderContainer}>
            <Text>Loading...</Text>
          </View>
        ) : memos.length === 0 ? (
          <EmptyView />
        ) : (
          <FlatList
            data={memos}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <MemoListItem
                memo={item}
                onPress={() => router.push(`/memo/${item.id}`)}
                onDelete={deleteMemo}
              />
            )}
          />
        )}
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 12,
  },
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    fontSize: 26,
    color: COLORS.accent,
    fontWeight: "300",
    marginRight: 16,
  },
})