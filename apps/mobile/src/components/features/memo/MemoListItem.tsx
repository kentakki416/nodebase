import { StyleSheet, Text, TouchableOpacity, View } from "react-native"
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable"

import { COLORS } from "@/constants/color"
import { Memo } from "@/features/memo/memo.entity"

type Props = {
  memo: Memo
  onPress: () => void
  onDelete: (id: string) => void
}

export default function MemoListItem({ memo, onPress, onDelete }: Props) {
  const formatedDate = new Date(memo.created_at).toLocaleDateString("ja-JP")
  return (
    <ReanimatedSwipeable renderRightActions={() => (
      <TouchableOpacity style={styles.deleteButton} onPress={() => { onDelete(memo.id) }}>
        <Text style={styles.deleteButtonText}>削除</Text>
      </TouchableOpacity>
    )

    }>
      <TouchableOpacity style={styles.item} onPress={onPress}>
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {memo.title}
          </Text>
          <Text style={styles.itemDate}>{formatedDate}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    </ReanimatedSwipeable>
  )
}

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    // iOS shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    // Android elevation
    elevation: 4,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  itemDate: {
    fontSize: 12,
    color: COLORS.subText,
  },
  chevron: {
    fontSize: 18,
    color: COLORS.subText,
    marginLeft: 8,
  },
  deleteButton: {
    backgroundColor: COLORS.danger,
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 14,
    marginVertical: 6,
    marginRight: 16,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
})