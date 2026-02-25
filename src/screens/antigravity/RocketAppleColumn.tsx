import { FC } from "react"
// eslint-disable-next-line no-restricted-imports
import { TextInput, View, ViewStyle, TextStyle } from "react-native"
import Animated, {
  SharedValue,
  interpolate,
  useAnimatedStyle,
  useAnimatedProps,
} from "react-native-reanimated"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import { spacing } from "@/theme/spacing"
import type { ThemedStyle } from "@/theme/types"

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

const BALL_SIZE = 50

// Any function marked 'worklet' is compiled by the Babel plugin to run on the
// UI thread. It can be called from useAnimatedStyle, useAnimatedProps, etc.
// without touching the JS bridge.
const getAngle = (pos: number, maxHeight: number): number => {
  "worklet"
  return Math.round(interpolate(pos, [0, maxHeight], [0, 360]))
}

interface Props {
  rocketPos: SharedValue<number>
  bounceHeight: number
}

export const RocketAppleColumn: FC<Props> = ({ rocketPos, bounceHeight }) => {
  const { themed } = useAppTheme()

  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: rocketPos.value }],
  }))

  const appleRotation = useAnimatedStyle(() => ({
    transform: [{ rotate: `${getAngle(rocketPos.value, bounceHeight)}deg` }],
  }))

  // useAnimatedProps lets the worklet write directly to a native prop —
  // this TextInput's value updates every frame with zero JS involvement.
  const angleLabelProps = useAnimatedProps(() => ({
    text: `${getAngle(rocketPos.value, bounceHeight)}°`,
    defaultValue: "",
  }))

  return (
    <View style={$column}>
      <View style={themed($indicator)}>
        <Text text="UI THREAD" style={$indicatorText} />
      </View>
      <Animated.View style={[themed($ball), ballStyle]}>
        <Animated.Text style={[$emoji, appleRotation]}>🍎</Animated.Text>
      </Animated.View>
      <AnimatedTextInput animatedProps={angleLabelProps} editable={false} style={$liveAngle} />
      <Text text="Rocket" style={$label} />
    </View>
  )
}

const $column: ViewStyle = { alignItems: "center", justifyContent: "flex-start" }
const $indicatorText: TextStyle = { fontSize: 9, color: "white", fontWeight: "bold" }
const $emoji: TextStyle = { fontSize: 24 }
const $liveAngle: TextStyle = {
  marginTop: 4,
  fontSize: 11,
  fontWeight: "bold",
  color: "#666",
  textAlign: "center",
  minWidth: 40,
}
const $label: TextStyle = { marginTop: spacing.xs, fontSize: 10, fontWeight: "bold", color: "#999" }

const $indicator: ThemedStyle<ViewStyle> = ({ colors }) => ({
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: 10,
  marginBottom: 8,
  backgroundColor: colors.palette.angry500,
})

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
  backgroundColor: colors.palette.neutral700,
})
