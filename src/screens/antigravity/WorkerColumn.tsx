import { FC, useRef } from "react"
// eslint-disable-next-line no-restricted-imports
import { TextInput, View, ViewStyle, TextStyle } from "react-native"
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  withTiming,
  Easing,
} from "react-native-reanimated"
import { createWorkletRuntime, createSynchronizable } from "react-native-worklets"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import { spacing } from "@/theme/spacing"
import type { ThemedStyle } from "@/theme/types"

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

const BALL_SIZE = 50

interface Props {
  bounceHeight: number
}

export const WorkerColumn: FC<Props> = ({ bounceHeight }) => {
  const { themed } = useAppTheme()

  // Synchronizable crosses runtime boundaries — unlike Reanimated SharedValue
  // which is only shared between JS and Reanimated's UI runtime, this is
  // visible to our custom worklet runtime too.
  const bgCount = useRef(createSynchronizable(0)).current

  // Written by the UI thread (via useFrameCallback). Reanimated CAN observe
  // changes to this, so useAnimatedProps works as expected.
  const displayCount = useSharedValue(0)

  const ballY = useSharedValue(0)

  // Create the background runtime once. The initializer uses setInterval so
  // it returns immediately — no JS-thread blocking.
  const runtimeRef = useRef<ReturnType<typeof createWorkletRuntime> | null>(null)
  if (!runtimeRef.current) {
    runtimeRef.current = createWorkletRuntime({
      name: "BlogWorker",
      initializer: () => {
        "worklet"
        setInterval(() => {
          // CPU-heavy work — runs on a dedicated thread, never touches JS or UI
          for (let i = 0; i < 2000000; i++) {
            Math.sqrt(i)
          }
          bgCount.setBlocking((prev) => {
            console.log("⚗️ worker tick", prev + 1)
            return prev + 1
          })
        }, 1500)
      },
    })
  }

  // Poll bgCount every frame on the UI thread. useFrameCallback is the
  // official Reanimated API for per-frame UI-thread logic — it's wired into
  // the same mapper system that drives useAnimatedProps, so writes to
  // displayCount here are immediately observable by all animated hooks.
  useFrameCallback(() => {
    const current = bgCount.getDirty()
    console.log("::::💧", current, displayCount.value)
    if (displayCount.value !== current) {
      displayCount.value = current
      ballY.value = withTiming(
        bounceHeight,
        { duration: 500, easing: Easing.inOut(Easing.quad) },
        () => {
          "worklet"
          ballY.value = withTiming(0, { duration: 500, easing: Easing.inOut(Easing.quad) })
        },
      )
    }
  })

  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ballY.value }],
  }))

  const counterProps = useAnimatedProps(() => ({
    text: `${displayCount.value} runs`,
    defaultValue: "0 runs",
  }))

  return (
    <View style={$column}>
      <View style={themed($indicator)}>
        <Text text="WORKER" style={$indicatorText} />
      </View>
      <Animated.View style={[themed($ball), ballStyle]}>
        <Text text="⚗️" style={$emoji} />
      </Animated.View>
      <AnimatedTextInput animatedProps={counterProps} editable={false} style={$counter} />
      <Text text="Scientist" style={$label} />
    </View>
  )
}

const $column: ViewStyle = { alignItems: "center", justifyContent: "flex-start" }
const $indicatorText: TextStyle = { fontSize: 9, color: "white", fontWeight: "bold" }
const $emoji: TextStyle = { fontSize: 24, textAlign: "center" }
const $counter: TextStyle = {
  marginTop: 4,
  fontSize: 11,
  fontWeight: "bold",
  color: "#666",
  textAlign: "center",
  minWidth: 60,
}
const $label: TextStyle = { marginTop: spacing.xs, fontSize: 10, fontWeight: "bold", color: "#999" }

const $indicator: ThemedStyle<ViewStyle> = ({ colors }) => ({
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: 10,
  marginBottom: 8,
  backgroundColor: colors.palette.secondary500,
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
  backgroundColor: colors.palette.secondary500,
})
