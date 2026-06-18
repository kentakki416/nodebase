import { Ionicons } from "@expo/vector-icons"
import { Tabs } from "expo-router"
import React from "react"

import { COLORS } from "@/constants/color"

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.subText,
        tabBarStyle: {
          backgroundColor: COLORS.surfaceElevated,
          borderTopColor: COLORS.separator
        },
        headerStyle: { backgroundColor: COLORS.surfaceElevated },
        headerTintColor: COLORS.text,
        headerTitleStyle: { color: COLORS.text }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "メモ",
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="document-text" size={size} />,
        }}
      />

      <Tabs.Screen
        name="setting"
        options={{
          title: "設定",
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="settings" size={size} />,
        }}
      />
    </Tabs>
  )
}
