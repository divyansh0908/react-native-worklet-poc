/**
 * LazyAppleColumn — Runtime 1: Main JS Thread
 *
 * This column is the "bad" baseline. Its position is driven by plain React
 * state (`bridgePos`) that is updated inside a `setInterval` on the JS thread
 * (see AntigravityScreen). Every state update has to:
 *
 *   JS thread → setState → React reconciler → bridge → native layout
 *
 * That journey means:
 *   • The animation is subject to JS garbage-collection pauses.
 *   • When the JS thread is blocked (e.g. heavy sync work), the interval
 *     stops firing entirely and the ball freezes mid-air.
 *
 * The 💀 emoji swap when `isJammed` is true makes the freeze visually obvious.
 */

import { FC } from "react"
import { View, ViewStyle, TextStyle } from "react-native"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import { spacing } from "@/theme/spacing"
import type { ThemedStyle } from "@/theme/types"

// Must match the BALL_SIZE constant in the sibling columns so all three balls
// are the same diameter.
const BALL_SIZE = 50

interface Props {
  /** Current vertical offset in pixels — computed on the JS thread by a setInterval. */
  bridgePos: number
  /** True while the JS-thread freeze is in progress; swaps the apple for 💀. */
  isJammed: boolean
}

export const LazyAppleColumn: FC<Props> = ({ bridgePos, isJammed }) => {
  const { themed } = useAppTheme()

  return (
    <View style={$column}>
      {/* Badge that identifies which runtime this column belongs to */}
      <View style={$indicator}>
        <Text text="MAIN JS" style={$indicatorText} />
      </View>

      {/*
       * The translateY here is set via a normal style prop, so every position
       * change requires a full React render → bridge round-trip.
       * Compare this with RocketAppleColumn where Reanimated bypasses that
       * entirely by writing directly to the native layer on the UI thread.
       */}
      <View style={[themed($ball), { transform: [{ translateY: bridgePos }] }]}>
        {/* Emoji flips to 💀 the instant the JS thread is jammed — or rather,
            it flips ~50 ms later when the pre-freeze setState(isJammed: true)
            finally reaches the native side. */}
        <Text text={isJammed ? "💀" : "🍎"} style={$emoji} />
      </View>

      <Text text="Lazy" style={$label} />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const $column: ViewStyle = { alignItems: "center", justifyContent: "flex-start" }

// Dark pill badge — uses a hard-coded dark color so it stands out on both
// light and dark backgrounds without needing a themed style.
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

// Themed so the ball color responds to the app's light/dark color scheme.
const $ball: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: BALL_SIZE,
  height: BALL_SIZE,
  borderRadius: BALL_SIZE / 2,
  // Cross-platform shadow
  elevation: 8,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: colors.palette.angry500, // red — signals "danger / blocked"
})
