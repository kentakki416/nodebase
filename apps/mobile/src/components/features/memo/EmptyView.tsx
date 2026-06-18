import { StyleSheet, Text, View } from "react-native"

import { COLORS } from "@/constants/color"

export default function EmptyView() {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📝</Text>
      <Text style={styles.emptyText}>メモがありません</Text>
      <Text style={styles.emptySubText}>右上の＋から作成できます</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 120,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.subText,
    marginBottom: 4,
  },
  emptySubText: {
    fontSize: 14,
    color: COLORS.subText,
  },
})