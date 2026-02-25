/**
 * WorkerColumn — Runtime 3: react-native-worklets Background Thread
 *
 * This column demonstrates a third, fully independent JavaScript runtime
 * created with `createWorkletRuntime` from `react-native-worklets`. Unlike
 * the Reanimated UI thread (which shares the native UI loop), this runtime
 * runs on its own OS thread — so CPU-heavy work here never blocks either
 * the JS thread or the UI thread.
 *
 * Data flow:
 *
 *   Worker thread                UI thread              JS thread
 *   ─────────────────────────    ──────────────────     ──────────────
 *   setInterval fires            useFrameCallback       (can be jammed)
 *   → 2M Math.sqrt calls         polls bgCount
 *   → bgCount.setBlocking(n+1)   → detects change
 *                                → updates displayCount
 *                                → triggers bounce via
 *                                  withTiming on ballY
 *
 * Key primitives used:
 *   • `createWorkletRuntime`  — spawns the background thread
 *   • `createSynchronizable`  — a cross-runtime observable value
 *   • `useFrameCallback`      — per-frame UI-thread hook from Reanimated
 *   • `useAnimatedProps`      — writes to a native prop each frame (0 re-renders)
 */

import { FC, useRef } from "react"
// TextInput imported directly so we can wrap it with createAnimatedComponent.
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

/**
 * Wrapping TextInput lets Reanimated write its `value` prop every frame
 * directly from the UI thread — no React render, no bridge crossing.
 */
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

const BALL_SIZE = 50

interface Props {
  /** Maximum vertical travel in pixels — used to size the bounce animation. */
  bounceHeight: number
}

export const WorkerColumn: FC<Props> = ({ bounceHeight }) => {
  const { themed } = useAppTheme()

  /**
   * bgCount — Synchronizable<number>
   *
   * `createSynchronizable` creates a value that is visible across ALL
   * runtimes: the JS thread, Reanimated's UI thread, and any custom worklet
   * runtime. This is the key difference from a plain Reanimated `SharedValue`,
   * which is only shared between JS and the Reanimated UI thread.
   *
   * The worker thread increments this value; the UI thread reads it.
   *
   * Wrapped in useRef so the Synchronizable is created only once and survives
   * re-renders without being recreated.
   */
  const bgCount = useRef(createSynchronizable(0)).current

  /**
   * displayCount — SharedValue<number>
   *
   * A Reanimated SharedValue that mirrors bgCount on the UI thread. It is
   * written by `useFrameCallback` (UI thread) and read by `useAnimatedProps`
   * (also UI thread), so there is no JS involvement after the initial setup.
   */
  const displayCount = useSharedValue(0)

  /**
   * ballY — SharedValue<number>
   *
   * Drives the vertical position of the ball. Animated with `withTiming` in
   * response to new worker results detected in `useFrameCallback`.
   */
  const ballY = useSharedValue(0)

  /**
   * Worker runtime — created once via a ref guard.
   *
   * `createWorkletRuntime` spins up a new OS thread with its own JS engine
   * context. The `initializer` worklet runs immediately on that thread.
   *
   * Inside the initializer:
   *   1. A `setInterval` fires every 1.5 s on the worker thread.
   *   2. Each tick performs 2 million `Math.sqrt` calls (simulated CPU work).
   *   3. `bgCount.setBlocking` atomically increments the shared counter.
   *
   * Because `initializer` is a worklet (note the `"worklet"` directive), the
   * Babel plugin serializes it at build time and ships it to the new runtime.
   * The JS thread only allocates the runtime; it never runs the heavy loop.
   */
  const runtimeRef = useRef<ReturnType<typeof createWorkletRuntime> | null>(null)
  if (!runtimeRef.current) {
    runtimeRef.current = createWorkletRuntime({
      name: "BlogWorker",
      initializer: () => {
        "worklet"
        setInterval(() => {
          // Simulate expensive CPU work (image processing, crypto, etc.)
          // that would freeze the JS thread if run there instead.
          for (let i = 0; i < 2000000; i++) {
            Math.sqrt(i)
          }
          // Atomically increment the shared counter so the UI thread can
          // detect that a new result is ready.
          bgCount.setBlocking((prev) => {
            console.log("⚗️ worker tick", prev + 1)
            return prev + 1
          })
        }, 1500)
      },
    })
  }

  /**
   * useFrameCallback — UI-thread polling loop
   *
   * Runs once per animation frame on the Reanimated UI thread. It calls
   * `bgCount.getDirty()` which returns the latest value written by the worker
   * (or the cached value if nothing changed since the last read).
   *
   * When the counter has advanced, we:
   *   1. Sync `displayCount` so `counterProps` shows the new number.
   *   2. Trigger a down-then-up bounce on `ballY` to signal a completed job.
   *
   * `useFrameCallback` is wired into Reanimated's mapper system, so writes to
   * `displayCount` here are immediately visible to `useAnimatedProps` on the
   * same frame — no extra synchronization needed.
   */
  useFrameCallback(() => {
    const current = bgCount.getDirty()
    console.log("::::💧", current, displayCount.value)
    if (displayCount.value !== current) {
      displayCount.value = current
      // Animate down to bounceHeight, then back to 0 in a chained callback —
      // all running on the UI thread with no JS involvement.
      ballY.value = withTiming(
        bounceHeight,
        { duration: 500, easing: Easing.inOut(Easing.quad) },
        () => {
          "worklet" // this completion callback also runs on the UI thread
          ballY.value = withTiming(0, { duration: 500, easing: Easing.inOut(Easing.quad) })
        },
      )
    }
  })

  /**
   * ballStyle — translates the ball vertically each frame.
   * Reads `ballY` on the UI thread; no JS bridge crossing.
   */
  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ballY.value }],
  }))

  /**
   * counterProps — writes the completed-job count to the TextInput label.
   * Updates every frame on the UI thread via useAnimatedProps; zero re-renders.
   */
  const counterProps = useAnimatedProps(() => ({
    text: `${displayCount.value} runs`,
    defaultValue: "0 runs",
  }))

  return (
    <View style={$column}>
      {/* Badge identifying this column's runtime */}
      <View style={themed($indicator)}>
        <Text text="WORKER" style={$indicatorText} />
      </View>

      {/* Ball bounces once each time the worker completes a job */}
      <Animated.View style={[themed($ball), ballStyle]}>
        <Text text="⚗️" style={$emoji} />
      </Animated.View>

      {/*
       * Live job counter — updated by useAnimatedProps on the UI thread.
       * `editable={false}` prevents the keyboard from appearing on tap.
       */}
      <AnimatedTextInput animatedProps={counterProps} editable={false} style={$counter} />

      <Text text="Scientist" style={$label} />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const $column: ViewStyle = { alignItems: "center", justifyContent: "flex-start" }
const $indicatorText: TextStyle = { fontSize: 9, color: "white", fontWeight: "bold" }
const $emoji: TextStyle = { fontSize: 24, textAlign: "center" }

// Job counter sits just below the ball, updating live without re-renders.
const $counter: TextStyle = {
  marginTop: 4,
  fontSize: 11,
  fontWeight: "bold",
  color: "#666",
  textAlign: "center",
  minWidth: 60,
}
const $label: TextStyle = { marginTop: spacing.xs, fontSize: 10, fontWeight: "bold", color: "#999" }

// secondary500 (teal/purple) visually distinguishes the worker from the two
// apple columns, which both use angry500 (red) as their accent.
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
