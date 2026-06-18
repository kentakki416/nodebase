import AsyncStorage from "@react-native-async-storage/async-storage"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { COLORS } from "@/constants/color"
import { useNotification } from "@/hooks/use-notification"

const STORAGE_KEY = "notificatoin_settings"

type NotificationSettings = {
  enabled: boolean
  hour: number
  minute: number
}

export default function SettingsScreen() {
  const { requestPermission, schedule, cancelAll } = useNotification()

  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: false,
    hour: 9,
    minute: 0,
  })

  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setIsLoading(true)
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw) {
      setSettings(JSON.parse(raw))
    }
    setIsLoading(false)
  }

  const toggleNotification = async (value: boolean) => {
    if (value) {
      const granted = await requestPermission()
      if (!granted) return
      const newSettings = { ...settings, enabled: true }
      setSettings(newSettings)
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
      await schedule(newSettings.hour, newSettings.minute)
    } else {
      const newSettings = { ...settings, enabled: false }
      setSettings(newSettings)
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
      await cancelAll()
    }
  }

  const changeHour = async (delta: number) => {
    if (!settings.enabled) return
    const newSettings = {
      ...settings,
      hour: (settings.hour + delta + 24) % 24,
    }
    setSettings(newSettings)
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    await schedule(newSettings.hour, newSettings.minute)
  }

  const changeMinute = async (delta: number) => {
    if (!settings.enabled) return
    const newSettings = {
      ...settings,
      minute: (settings.minute + delta + 60) % 60,
    }
    setSettings(newSettings)
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    await schedule(newSettings.hour, newSettings.minute)
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ローディング表示 */}
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : (
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>毎日の通知</Text>
            <Switch
              value={settings.enabled}
              onValueChange={toggleNotification}
              trackColor={{ false: COLORS.separator, true: COLORS.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.separator} />
          {/* 通知時刻行 */}
          <View style={[styles.row, !settings.enabled && styles.disabled]}>
            <Text style={[styles.label, !settings.enabled && styles.disabledText]}>
              通知時刻
            </Text>
            <View style={styles.timePicker}>
              <View style={styles.timeUnit}>
                <TouchableOpacity onPress={() => { changeHour(1) }} disabled={!settings.enabled}>
                  <Text style={[styles.arrow, !settings.enabled && styles.disabledText]}>
                    ▲
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.timeValue, !settings.enabled && styles.disabledText]}>
                  {String(settings.hour).padStart(2, "0")}
                </Text>
                <TouchableOpacity onPress={() => { changeHour(-1) }} disabled={!settings.enabled}>
                  <Text style={[styles.arrow, !settings.enabled && styles.disabledText]}>
                    ▼
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.colon, !settings.enabled && styles.disabledText]}>:</Text>

              <View style={styles.timeUnit}>
                <TouchableOpacity onPress={() => { changeMinute(1) }} disabled={!settings.enabled}>
                  <Text style={[styles.arrow, !settings.enabled && styles.disabledText]}>
                    ▲
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.timeValue, !settings.enabled && styles.disabledText]}>
                  {String(settings.minute).padStart(2, "0")}
                </Text>
                <TouchableOpacity onPress={() => { changeMinute(-1) }} disabled={!settings.enabled}>
                  <Text style={[styles.arrow, !settings.enabled && styles.disabledText]}>
                    ▼
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  label: {
    fontSize: 16,
    color: COLORS.text,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.separator,
    marginLeft: 16,
  },
  disabled: {
    opacity: 0.4,
  },
  disabledText: {
    color: COLORS.subText,
  },
  timePicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeUnit: {
    alignItems: "center",
    gap: 4,
  },
  arrow: {
    fontSize: 14,
    color: COLORS.accent,
    paddingHorizontal: 10,
  },
  timeValue: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
    minWidth: 44,
    textAlign: "center",
  },
  colon: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
  },
})