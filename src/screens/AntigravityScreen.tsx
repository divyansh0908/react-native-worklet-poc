/**
 * AntigravityScreen — "The Three Runtimes" demo
 *
 * This screen is the root orchestrator for the side-by-side runtime comparison.
 * It owns:
 *   1. The JS-thread bouncing ball state (`bridgePos`) — fed into LazyAppleColumn
 *   2. The Reanimated SharedValue (`rocketPos`) — fed into RocketAppleColumn
 *   3. The "Jam JS thread" button that intentionally blocks the JS thread for 3s
 *
 * WorkerColumn manages its own internal runtime and state independently.
 *
 * Thread ownership at a glance:
 *   ┌─────────────────┬──────────────────────────────────────────┐
 *   │ LazyAppleColumn │ Driven by React state on the JS thread   │
 *   │ RocketAppleColumn│ Driven by a Reanimated SharedValue on   │
 *   │                 │ the UI thread                            │
 *   │ WorkerColumn    │ Driven by react-native-worklets on a     │
 *   │                 │ dedicated background thread              │
 *   └─────────────────┴──────────────────────────────────────────┘
 */

import { useState, useEffect, useRef, FC } from "react"
import { View, TextStyle, ViewStyle, useWindowDimensions } from "react-native"
import { useSharedValue, withRepeat, withTiming, Easing } from "react-native-reanimated"

import { LazyAppleColumn } from "@/components/antigravity/LazyAppleColumn"
import { RocketAppleColumn } from "@/components/antigravity/RocketAppleColumn"
import { WorkerColumn } from "@/components/antigravity/WorkerColumn"
import { Button } from "@/components/Button"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import { spacing } from "@/theme/spacing"
import type { ThemedStyle } from "@/theme/types"

// Size of the animated ball — shared as a layout constant across columns.
const BALL_SIZE = 50

export const AntigravityScreen: FC = () => {
  const { themed } = useAppTheme()

  // SCREEN_HEIGHT drives the vertical travel distance of each ball so the demo
  // scales correctly across device sizes.
  const { height: SCREEN_HEIGHT } = useWindowDimensions()

  // 35% of screen height gives a comfortable bounce range on any device.
  const BOUNCE_HEIGHT = SCREEN_HEIGHT > 0 ? SCREEN_HEIGHT * 0.35 : 250

  // isJammed is true while the intentional JS-freeze is in progress.
  // It turns the button grey and swaps the Lazy Apple emoji to 💀.
  const [isJammed, setIsJammed] = useState(false)

  // ─────────────────────────────────────────────────────────────────────────
  // RUNTIME 1 — Main JS Thread
  //
  // `bridgePos` is plain React state. Every 16 ms (~60 fps) a setInterval on
  // the JS thread increments/decrements the value and calls setBridgePos.
  // React schedules a re-render, and the new translateY reaches the native
  // view only after crossing the JS bridge.
  //
  // Consequence: the moment the JS thread is blocked, the interval stops
  // firing, setState is never called, and the ball freezes in place.
  // ─────────────────────────────────────────────────────────────────────────
  const [bridgePos, setBridgePos] = useState(0)
  const bridgeDirection = useRef(1) // mutable ref avoids re-render on direction flip

  useEffect(() => {
    const interval = setInterval(() => {
      setBridgePos((prev) => {
        const next = prev + 5 * bridgeDirection.current
        // Reverse direction when the ball hits either end of the travel range.
        if (next >= BOUNCE_HEIGHT || next <= 0) bridgeDirection.current *= -1
        return next
      })
    }, 16) // ~60 fps tick on the JS thread
    return () => clearInterval(interval)
  }, [BOUNCE_HEIGHT])

  // ─────────────────────────────────────────────────────────────────────────
  // RUNTIME 2 — Reanimated UI Thread
  //
  // `rocketPos` is a Reanimated SharedValue. Its animation is driven entirely
  // by Reanimated's internal C++ engine which runs on the UI thread — it never
  // goes through the JS bridge during each frame.
  //
  // withRepeat + withTiming produces a smooth ping-pong between 0 and
  // BOUNCE_HEIGHT. Because the UI thread is separate from the JS thread,
  // jamming JS has zero effect on this animation.
  // ─────────────────────────────────────────────────────────────────────────
  const rocketPos = useSharedValue(0)
  useEffect(() => {
    if (BOUNCE_HEIGHT > 0) {
      rocketPos.value = withRepeat(
        withTiming(BOUNCE_HEIGHT, { duration: 1000, easing: Easing.inOut(Easing.quad) }),
        -1, // repeat indefinitely
        true, // reverse (ping-pong) each iteration
      )
    }
  }, [BOUNCE_HEIGHT])

  // ─────────────────────────────────────────────────────────────────────────
  // JS Thread Jammer
  //
  // Simulates a heavy synchronous task (e.g. expensive JSON parsing, crypto,
  // image processing) that blocks the JS thread for 3 seconds.
  //
  // The 50 ms setTimeout gives React just enough time to re-render the button
  // into its "frozen" state before the blocking loop kicks in.
  // ─────────────────────────────────────────────────────────────────────────
  const jamJSThread = () => {
    setIsJammed(true)
    setTimeout(() => {
      const start = Date.now()
      // Busy-wait: intentionally occupies the JS thread for exactly 3 seconds.
      while (Date.now() - start < 3000) {}
      setIsJammed(false)
    }, 50)
  }

  return (
    <Screen style={$root} preset="scroll">
      {/* ── Header ── */}
      <View style={$header}>
        <Text preset="heading" text="The Three Runtimes" style={$title} />
      </View>

      {/* ── Three columns, one per runtime ── */}
      <View style={[$ballContainer, { height: BOUNCE_HEIGHT + BALL_SIZE + 40 }]}>
        {/* Column 1: JS thread — freezes when jammed */}
        <LazyAppleColumn bridgePos={bridgePos} isJammed={isJammed} />

        {/* Column 2: Reanimated UI thread — survives JS freeze */}
        <RocketAppleColumn rocketPos={rocketPos} bounceHeight={BOUNCE_HEIGHT} />

        {/* Column 3: react-native-worklets worker — CPU work on its own thread */}
        <WorkerColumn bounceHeight={BOUNCE_HEIGHT} />
      </View>

      {/* ── Jam button ── */}
      <View style={$buttonContainer}>
        <Button
          text={isJammed ? "JS THREAD IS FROZEN" : "JAM MAIN JS THREAD"}
          onPress={jamJSThread}
          style={[$button, themed(isJammed ? $buttonFrozen : $buttonActive)]}
          textStyle={$buttonText}
        />
      </View>

      {/* ── Legend ── */}
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

// Themed styles reference the app's design token palette so they respond to
// light/dark mode automatically.
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
