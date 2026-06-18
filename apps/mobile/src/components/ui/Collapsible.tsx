import { PropsWithChildren, useState } from "react"
import { StyleSheet, TouchableOpacity } from "react-native"

import { IconSymbol } from "@/components/ui/IconSymbol"
import { ThemedText } from "@/components/ui/ThemedText"
import { ThemedView } from "@/components/ui/ThemedView"
import { Colors } from "@/constants/theme"
import { useColorScheme } from "@/hooks/use-color-scheme"

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const theme = useColorScheme() ?? "light"

  return (
    <ThemedView>
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.heading}
        onPress={() => setIsOpen((value) => !value)}>
        <IconSymbol
          color={theme === "light" ? Colors.light.icon : Colors.dark.icon}
          name="chevron.right"
          size={18}
          style={{ transform: [{ rotate: isOpen ? "90deg" : "0deg" }] }}
          weight="medium"
        />

        <ThemedText type="defaultSemiBold">{title}</ThemedText>
      </TouchableOpacity>
      {isOpen && <ThemedView style={styles.content}>{children}</ThemedView>}
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  content: {
    marginTop: 6,
    marginLeft: 24,
  },
})
