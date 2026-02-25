# React Native Worklet POC

> A visual proof-of-concept that demonstrates all **three JavaScript runtimes** available in a modern React Native app — and shows exactly what happens to each when the main JS thread is blocked.

---

## The Demo

The app renders three animated balls side-by-side, each driven by a different runtime:

| Column | Name | Runtime | What happens on JS freeze |
|---|---|---|---|
| 🍎 **Lazy Apple** | Main JS | React Native JS thread | **Freezes instantly** |
| 🍎 **Rocket Apple** | UI Thread | Reanimated's UI worklet runtime | **Keeps animating** |
| ⚗️ **Scientist** | Worker | `react-native-worklets` custom runtime | **Keeps computing & pulsing** |

Tap **"JAM MAIN JS THREAD"** to block the JS thread for 3 seconds and watch the difference live.

---

## Blog Post

This project accompanies the article:

**[Stop Letting Your API Calls Kill Your UI — A Multithreading Guide to React Native Worklets](https://medium.com/@divyanshblog09/stop-letting-your-api-calls-kill-your-ui-a-multithreading-guide-to-react-native-worklets-d972816d02e0)**

The article walks through the mental model, explains why the Reanimated UI thread survives a JS freeze, and dives into how `react-native-worklets` unlocks a fully separate background thread for CPU-heavy work.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  React Native App                                                │
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐ │
│  │  Main JS Thread│  │  UI Thread     │  │  Worker Runtime    │ │
│  │  (Hermes / JSC)│  │  (Reanimated)  │  │  (react-native-    │ │
│  │                │  │                │  │   worklets)        │ │
│  │  setState()    │  │  SharedValue   │  │  createWorklet-    │ │
│  │  useEffect()   │  │  useAnimated-  │  │  Runtime()         │ │
│  │  setInterval() │  │    Style()     │  │                    │ │
│  │                │  │  useAnimated-  │  │  CPU work runs on  │ │
│  │  ⚠ Freezes on  │  │    Props()     │  │  its own thread — │ │
│  │  heavy sync    │  │                │  │  never blocks JS   │ │
│  │  work          │  │  ✓ Survives JS │  │  or UI             │ │
│  │                │  │  thread freeze │  │                    │ │
│  └────────────────┘  └────────────────┘  └────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Runtime 1 — Main JS Thread (`LazyAppleColumn`)

The position is computed inside a `setInterval` on the JS thread and pushed to React state via `setState`. When the JS thread is jammed, the interval stops firing and the ball freezes.

### Runtime 2 — Reanimated UI Thread (`RocketAppleColumn`)

The animation is driven by a `SharedValue` and `withRepeat(withTiming(...))`. Reanimated compiles the style worklets to native code that runs on the UI thread — completely independent of the JS thread. Freezing JS has zero effect.

The apple rotation and the live angle label (an `AnimatedTextInput`) are both updated every frame without ever touching the JS bridge.

### Runtime 3 — `react-native-worklets` Worker (`WorkerColumn`)

`createWorkletRuntime` spins up a brand-new background thread. A `setInterval` inside that runtime loops over 2 million `Math.sqrt` calls to simulate CPU work, then increments a `Synchronizable` counter.

On the UI thread, `useFrameCallback` polls the counter every frame and triggers a bounce animation when it changes. Neither the JS thread nor the UI thread are ever blocked by the heavy work.

---

## Key Concepts

### `"worklet"` directive

Any function annotated with `"worklet"` as its first statement is compiled by the Reanimated Babel plugin into a serialisable form that can be sent to — and executed on — the UI thread (or a custom worklet runtime) without going through the JS bridge.

```ts
const getAngle = (pos: number, maxHeight: number): number => {
  "worklet"
  return Math.round(interpolate(pos, [0, maxHeight], [0, 360]))
}
```

### `SharedValue` vs `Synchronizable`

| | `SharedValue` (Reanimated) | `Synchronizable` (react-native-worklets) |
|---|---|---|
| Shared between | JS ↔ UI thread | JS ↔ UI thread ↔ **any custom runtime** |
| Typical use | Driving animated styles | Passing data between a worker and the UI thread |
| Read on UI thread | `value` property in worklets | `getDirty()` in `useFrameCallback` |

### `useFrameCallback`

Reanimated's official hook for running arbitrary worklet logic every animation frame on the UI thread. Writes to `SharedValue`s here are picked up immediately by `useAnimatedStyle` / `useAnimatedProps` on the same frame.

### `AnimatedTextInput` (live label trick)

`useAnimatedProps` can write directly to a native component's props without going through React's render cycle. Wrapping `TextInput` lets us display a number that updates at 60 fps with zero JS involvement.

---

## Project Structure

```
src/
├── components/
│   └── antigravity/
│       ├── LazyAppleColumn.tsx     # Runtime 1: Main JS thread animation
│       ├── RocketAppleColumn.tsx   # Runtime 2: Reanimated UI thread animation
│       └── WorkerColumn.tsx        # Runtime 3: react-native-worklets background thread
└── screens/
    └── antigravity/
        └── AntigravityScreen.tsx   # Root screen — owns shared state & jam button
```

---

## Getting Started

### Prerequisites

- Node >= 20
- pnpm >= 10
- Xcode (for iOS) or Android Studio (for Android)

### Install

```bash
pnpm install
```

### Run (requires a dev build — see below)

```bash
pnpm start          # Start the Metro bundler
pnpm ios            # Run on iOS simulator
pnpm android        # Run on Android emulator
```

> **Note:** `react-native-worklets` contains native code, so this app cannot run in Expo Go. You need a development build.

### Build a development client

```bash
pnpm run build:ios:sim      # iOS simulator
pnpm run build:ios:device   # iOS device
pnpm run build:android:sim  # Android emulator
```

---

## Tech Stack

| Package | Purpose |
|---|---|
| `expo` ~54 | Managed workflow + dev tooling |
| `expo-router` ~6 | File-based navigation |
| `react-native-reanimated` ~4.1 | UI-thread animations (`SharedValue`, worklets) |
| `react-native-worklets` 0.6 | Custom worklet runtimes (background threads) |
| `react-native` 0.81 | Core framework |

---

## Further Reading

- [react-native-worklets — official docs](https://margelo.github.io/react-native-worklets/)
- [react-native-reanimated — official docs](https://docs.swmansion.com/react-native-reanimated/)
- [Blog post: Stop Letting Your API Calls Kill Your UI](https://medium.com/@divyanshblog09/stop-letting-your-api-calls-kill-your-ui-a-multithreading-guide-to-react-native-worklets-d972816d02e0)

---

## License

MIT
