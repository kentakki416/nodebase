import type { NativeStackNavigationOptions } from "@react-navigation/native-stack"
import { Text, TouchableOpacity, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { COLORS } from "@/constants/color"

type Props = {
  navigation: { goBack: () => void }
  options: NativeStackNavigationOptions
  back: {title?: string, href?: string } | undefined
}

export default function Header({ navigation, options, back }: Props) {
  const insets = useSafeAreaInsets()

  return (
    <View
      style={{
        backgroundColor: COLORS.surfaceElevated,
        paddingTop: insets.top,
        height: insets.top + 44,
        flexDirection: "row",
        alignItems: "center"
      }}
    >
      <View style={{ width: 80, paddingLeft: 16 }}>
        {back ? (
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "600" }}>戻る</Text>
          </TouchableOpacity>
        ) : null }
      </View>

      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "600" }}>
          {options.title ?? ""}
        </Text>
      </View>

      <View>
        {options.headerRight?.({ tintColor: COLORS.accent, canGoBack: !!back })}
      </View>
    </View>
  )
}