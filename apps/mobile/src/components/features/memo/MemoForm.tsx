import { Stack } from "expo-router"
import { useState } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { COLORS } from "@/constants/color"
import { Memo } from "@/features/memo/memo.entity"

type Props = {
  onSave: (title: string, body: string) => Promise<void>
  memo?: Memo
}

export default function MemoForm({ onSave, memo }: Props) {
  const [title, setTitle] = useState(memo?.title || "")
  const [body, setBody] = useState(memo?.body || "")

  const canSave = title.trim().length > 0

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity onPress={() => { onSave(title, body) }} disabled={!canSave}>
              <Text style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}>保存</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView style={styles.container} edges={["bottom"]}>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="タイトル"
            placeholderTextColor={COLORS.subText}
          />
          <TextInput
            style={styles.bodyInput}
            value={body}
            onChangeText={setBody}
            placeholder="本文"
            placeholderTextColor={COLORS.subText}
            multiline
            textAlignVertical="top"
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </>
  )
}

const styles = StyleSheet.create({
  saveButton: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: "600",
    marginRight: 16,
  },
  saveButtonDisabled: {
    color: COLORS.subText,
    fontWeight: "400",
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
  },
  bodyInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 10,
    textAlignVertical: "top",
  },
})