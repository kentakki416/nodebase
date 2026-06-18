import "react-native-reanimated"

import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native"
import * as Notifications from "expo-notifications"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"

import Header from "@/components/layout/Header"
import { COLORS } from "@/constants/color"
import { useColorScheme } from "@/hooks/use-color-scheme"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  })
})

export const unstable_settings = {
  anchor: "(tabs)",
}

export default function RootLayout() {
  const colorScheme = useColorScheme()

  return (
    <GestureHandlerRootView>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            header: ({ navigation, options, back }) => (
              <Header navigation={navigation} options={options} back={back} />
            ),
            contentStyle: { backgroundColor: COLORS.background }
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="memo/new" options={{ title: "新規作成" }} />
          <Stack.Screen name="memo/[id]" options={{ title: "編集" }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}
