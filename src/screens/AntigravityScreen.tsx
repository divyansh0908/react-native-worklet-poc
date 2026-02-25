import { useState, useEffect, useRef, FC } from "react"
import { View, TextStyle, ViewStyle, useWindowDimensions } from "react-native"
import { useSharedValue, withRepeat, withTiming, Easing } from "react-native-reanimated"

import { Button } from "@/components/Button"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import { spacing } from "@/theme/spacing"
import type { ThemedStyle } from "@/theme/types"

import { LazyAppleColumn } from "./antigravity/LazyAppleColumn"
import { RocketAppleColumn } from "./antigravity/RocketAppleColumn"
import { WorkerColumn } from "./antigravity/WorkerColumn"

const BALL_SIZE = 50

export const AntigravityScreen: FC = () => {
  const { themed } = useAppTheme()
  const { height: SCREEN_HEIGHT } = useWindowDimensions()

  const BOUNCE_HEIGHT = SCREEN_HEIGHT > 0 ? SCREEN_HEIGHT * 0.35 : 250
  const [isJammed, setIsJammed] = useState(false)

  // --- THREAD 1: Main JS ---
  const [bridgePos, setBridgePos] = useState(0)
  const bridgeDirection = useRef(1)

  useEffect(() => {
    const interval = setInterval(() => {
      setBridgePos((prev) => {
        const next = prev + 5 * bridgeDirection.current
        if (next >= BOUNCE_HEIGHT || next <= 0) bridgeDirection.current *= -1
        return next
      })
    }, 16)
    return () => clearInterval(interval)
  }, [BOUNCE_HEIGHT])

  // --- THREAD 2: UI Thread (Rocket Apple) ---
  const rocketPos = useSharedValue(0)
  useEffect(() => {
    if (BOUNCE_HEIGHT > 0) {
      rocketPos.value = withRepeat(
        withTiming(BOUNCE_HEIGHT, { duration: 1000, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      )
    }
  }, [BOUNCE_HEIGHT])

  const jamJSThread = () => {
    setIsJammed(true)
    setTimeout(() => {
      const start = Date.now()
      while (Date.now() - start < 3000) {}
      setIsJammed(false)
    }, 50)
  }

  return (
    <Screen style={$root} preset="scroll">
      <View style={$header}>
        <Text preset="heading" text="The Three Runtimes" style={$title} />
      </View>

      <View style={[$ballContainer, { height: BOUNCE_HEIGHT + BALL_SIZE + 40 }]}>
        <LazyAppleColumn bridgePos={bridgePos} isJammed={isJammed} />
        <RocketAppleColumn rocketPos={rocketPos} bounceHeight={BOUNCE_HEIGHT} />
        <WorkerColumn bounceHeight={BOUNCE_HEIGHT} />
      </View>

      <View style={$buttonContainer}>
        <Button
          text={isJammed ? "JS THREAD IS FROZEN" : "JAM MAIN JS THREAD"}
          onPress={jamJSThread}
          style={[$button, themed(isJammed ? $buttonFrozen : $buttonActive)]}
          textStyle={$buttonText}
        />
      </View>

      <View style={$explanation}>
        <Text style={$explanationTitle} text="Thread Roles:" />
        <Text style={$explanationText}>
          <Text style={themed($lazyLabel)}>Lazy Apple:</Text> Freezes instantly.
        </Text>
        <Text style={$explanationText}>
          <Text style={themed($rocketLabel)}>Rocket Apple:</Text> Bounces during freeze.
        </Text>
        <Text style={$explanationText}>
          <Text style={themed($scientistLabel)}>Scientist:</Text> Heavy computation on a dedicated
          worker thread. Pulses when a job completes.
        </Text>
      </View>
    </Screen>
  )
}

const $root: ViewStyle = { flex: 1, marginTop: 20 }
const $header: ViewStyle = {
  paddingTop: spacing.xl,
  paddingHorizontal: spacing.lg,
  alignItems: "center",
}
const $title: TextStyle = { marginBottom: spacing.xs, textAlign: "center" }
const $ballContainer: ViewStyle = {
  flexDirection: "row",
  width: "100%",
  justifyContent: "space-around",
  paddingVertical: spacing.xl,
}
const $buttonContainer: ViewStyle = { paddingHorizontal: spacing.xl, marginTop: spacing.md }
const $button: ViewStyle = { borderRadius: 12, height: 60 }
const $buttonText: TextStyle = { color: "#FFFFFF", fontWeight: "bold", fontSize: 17 }
const $explanation: ViewStyle = { padding: spacing.lg, marginTop: spacing.md }
const $explanationTitle: TextStyle = { fontWeight: "bold", marginBottom: spacing.sm, fontSize: 18 }
const $explanationText: TextStyle = { fontSize: 14, marginBottom: 4 }

const $buttonActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.angry500,
})
const $buttonFrozen: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.neutral400,
})
const $lazyLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontWeight: "bold",
  color: colors.palette.angry500,
})
const $rocketLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontWeight: "bold",
  color: colors.palette.neutral700,
})
const $scientistLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontWeight: "bold",
  color: colors.palette.secondary500,
})
