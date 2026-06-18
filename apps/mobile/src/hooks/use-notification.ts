import * as Notifications from "expo-notifications"

export function useNotification() {
  const requestPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== "granted") {
      alert("通知が許可されていません")
      return false
    }
    return true
  }

  const schedule = async (hour: number, minute: number) => {
    await Notifications.cancelAllScheduledNotificationsAsync()
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "メモを書きましょう",
        body: "今日の気づきやアイディアを記録しよう",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      }
    })
  }

  const cancelAll = async() => {
    await Notifications.cancelAllScheduledNotificationsAsync()
  }

  return { requestPermission, schedule, cancelAll }
}