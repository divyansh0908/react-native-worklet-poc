/**
 * RocketAppleColumn — Runtime 2: Reanimated UI Thread
 *
 * Every animated value here is driven by Reanimated's SharedValue system,
 * which executes entirely on the native UI thread. The JS thread is only
 * involved at setup time (to start the animation and register the worklet functions).
 * After that, each frame is handled in C++ with zero bridge involvement.
 *
 * What this column demonstrates:
 *   • `useAnimatedStyle` — derives a translateY from a SharedValue each frame
 *   • `"worklet"` directive — compiles a plain function to run on the UI thread
 *   • `useAnimatedProps` — writes a native prop (TextInput.value) each frame
 *     without going through React's render cycle
 *
 * Result: tap "JAM MAIN JS THREAD" and this ball keeps bouncing without a hitch.
 */

import { FC } from "react"
// TextInput is imported directly (not from @/components) because we need to
// wrap the raw RN component with Animated.createAnimatedComponent below.
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

/**
 * Wrapping TextInput with createAnimatedComponent lets Reanimated write to its
 * `value` prop directly from a worklet every frame — bypassing React's render
 * cycle and the JS bridge entirely.
 */
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

const BALL_SIZE = 50

interface Props {
  /** SharedValue driven by withRepeat(withTiming()) on the UI thread. */
  rocketPos: SharedValue<number>
  /** Maximum vertical travel in pixels — used to normalize the rotation angle. */
  bounceHeight: number
}

/**
 * getAngle — worklet helper
 *
 * The `"worklet"` directive tells the Reanimated Babel plugin to serialize
 * this function and ship it to the UI thread at build time. It can then be
 * called from any worklet context (useAnimatedStyle, useAnimatedProps, etc.)
 * without crossing the JS bridge.
 *
 * Maps the ball's vertical position [0 → bounceHeight] to a rotation angle
 * [0° → 360°] so the apple spins as it travels.
 */
const getAngle = (pos: number, maxHeight: number): number => {
  "worklet"
  return Math.round(interpolate(pos, [0, maxHeight], [0, 360]))
}

export const RocketAppleColumn: FC<Props> = ({ rocketPos, bounceHeight }) => {
  const { themed } = useAppTheme()

  /**
   * Ball position — translates the outer Animated.View vertically.
   * Runs on the UI thread; never triggers a React re-render.
   */
  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: rocketPos.value }],
  }))

  /**
   * Apple spin — rotates the emoji as the ball moves.
   * Calls the `getAngle` worklet to convert position → degrees.
   * Both the position read and the angle calculation happen on the UI thread.
   */
  const appleRotation = useAnimatedStyle(() => ({
    transform: [{ rotate: `${getAngle(rocketPos.value, bounceHeight)}deg` }],
  }))

  /**
   * Live angle label — useAnimatedProps lets the worklet write directly to
   * TextInput's `value` prop every frame. The text updates at 60 fps with
   * absolutely zero JS involvement after the initial setup.
   *
   * This is the canonical pattern for displaying a live number without
   * triggering React re-renders (no useState, no bridge, no frame drops).
   */
  const angleLabelProps = useAnimatedProps(() => ({
    text: `${getAngle(rocketPos.value, bounceHeight)}°`,
    defaultValue: "",
  }))

  return (
    <View style={$column}>
      {/* Badge identifying this column's runtime */}
      <View style={themed($indicator)}>
        <Text text="UI THREAD" style={$indicatorText} />
      </View>

      {/* Outer view moves vertically; inner Animated.Text rotates independently */}
      <Animated.View style={[themed($ball), ballStyle]}>
        <Animated.Text style={[$emoji, appleRotation]}>🍎</Animated.Text>
      </Animated.View>

      {/*
       * AnimatedTextInput displays the live rotation angle.
       * `editable={false}` prevents the keyboard from appearing on tap.
       * The value is driven entirely by `angleLabelProps` on the UI thread.
       */}
      <AnimatedTextInput animatedProps={angleLabelProps} editable={false} style={$liveAngle} />

      <Text text="Rocket" style={$label} />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const $column: ViewStyle = { alignItems: "center", justifyContent: "flex-start" }
const $indicatorText: TextStyle = { fontSize: 9, color: "white", fontWeight: "bold" }
const $emoji: TextStyle = { fontSize: 24 }

// The live angle readout sits just below the ball.
const $liveAngle: TextStyle = {
  marginTop: 4,
  fontSize: 11,
  fontWeight: "bold",
  color: "#666",
  textAlign: "center",
  minWidth: 40,
}
const $label: TextStyle = { marginTop: spacing.xs, fontSize: 10, fontWeight: "bold", color: "#999" }

// Themed badge — uses angry500 (red) to match the LazyAppleColumn ball color
// and reinforce the visual connection between the two apple columns.
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
  backgroundColor: colors.palette.neutral700, // dark — contrasts with the red Lazy ball
})
