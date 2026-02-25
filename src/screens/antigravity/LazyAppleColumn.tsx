import { FC } from "react"
import { View, ViewStyle, TextStyle } from "react-native"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import { spacing } from "@/theme/spacing"
import type { ThemedStyle } from "@/theme/types"

const BALL_SIZE = 50

interface Props {
  bridgePos: number
  isJammed: boolean
}

export const LazyAppleColumn: FC<Props> = ({ bridgePos, isJammed }) => {
  const { themed } = useAppTheme()

  return (
    <View style={$column}>
      <View style={$indicator}>
        <Text text="MAIN JS" style={$indicatorText} />
      </View>
      <View style={[themed($ball), { transform: [{ translateY: bridgePos }] }]}>
        <Text text={isJammed ? "💀" : "🍎"} style={$emoji} />
      </View>
      <Text text="Lazy" style={$label} />
    </View>
  )
}

const $column: ViewStyle = { alignItems: "center", justifyContent: "flex-start" }
const $indicator: ViewStyle = {
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: 10,
  marginBottom: 8,
  backgroundColor: "#333",
}
const $indicatorText: TextStyle = { fontSize: 9, color: "white", fontWeight: "bold" }
const $emoji: TextStyle = { fontSize: 24 }
const $label: TextStyle = { marginTop: spacing.sm, fontSize: 10, fontWeight: "bold", color: "#999" }

const $ball: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: BALL_SIZE,
  height: BALL_SIZE,
  borderRadius: BALL_SIZE / 2,
  elevation: 8,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: colors.palette.angry500,
})
