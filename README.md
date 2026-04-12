# Hand Playground

A hand-tracking interaction pattern lab built with MediaPipe, React, and Canvas 2D. Seven exercises exploring the full gesture vocabulary for spatial UIs — research for [Passion Interactive](https://github.com/DareDev256), an AR operating system.

## Exercises

| # | Exercise | Pattern | What You Learn |
|---|----------|---------|---------------|
| 1 | **Shape Tracer** | Path tracing | Index finger traces shapes (circle, triangle, star). Completion triggers sparkle effects. |
| 2 | **3D Cube** | Spatial rotation | Hand position rotates a wireframe cube. Pinch to zoom in. |
| 3 | **Piano Keys** | Hover zones | 8 keys (C4-C5). Hover to play tones via Web Audio. Pinch to sustain. |
| 4 | **Particle Magnet** | Physics fields | 200 particles. Point to attract (orbit effect). Pinch to repel. Open palm to freeze. |
| 5 | **Swipe Navigator** | Velocity gestures | Swipe left/right to browse cards. Speed-based detection with visual velocity feedback. |
| 6 | **Grab & Toss** | Drag & momentum | Pinch to grab balls, drag to move, release to toss with physics. Gravity, collision, bouncing. |
| 7 | **Depth Control** | Z-axis navigation | Hand distance from camera controls depth layers. Calibrates automatically. Push in = deeper layers. |

## Gesture Vocabulary

These exercises validate a complete gesture set for single-hand spatial interaction:

- **Point** — index fingertip as cursor
- **Pinch** — thumb + index = click / grab / zoom / confirm
- **Open Palm** — all fingers extended = stop / freeze / dismiss
- **Swipe** — velocity-based directional flick = navigate
- **Grab** — pinch + drag + release = manipulate with momentum
- **Depth** — hand distance from camera = z-axis control

## Tech Stack

- **Vite** + **React 19** + **TypeScript**
- **@mediapipe/tasks-vision** — GPU-accelerated hand landmark detection
- **One Euro Filter** — jitter reduction for smooth tracking ([paper](http://cristal.univ-lille.fr/~casiez/1euro/))
- **Canvas 2D** — all rendering, no Three.js or WebGL dependencies
- **Web Audio API** — piano tone generation

## Getting Started

```bash
git clone https://github.com/DareDev256/hand-playground.git
cd hand-playground
npm install
npm run dev
```

Open `http://localhost:5173` in Chrome. Grant camera access when prompted. Hold one hand in front of your webcam.

## Key Technical Details

- **One Euro Filter** tuning: `freq=30, minCutoff=1.5, beta=0.01` — critical for usable tracking
- **Single hand** — `numHands: 1` is the right default. Dual-hand was tested and rejected.
- **Mirrored input** — X-axis flipped for natural interaction
- **Depth calibration** — 30-frame baseline capture required for z-axis to work reliably

## Project Structure

```
src/
  exercises/
    ShapeTracer.tsx      # Path tracing + completion detection
    CubeController.tsx   # 3D rotation + pinch zoom
    PianoKeys.tsx        # Hover zones + Web Audio
    ParticleMagnet.tsx   # Attract/repel/freeze physics
    SwipeNavigator.tsx   # Velocity swipe + card carousel
    GrabAndToss.tsx      # Grab/drag/toss + ball physics
    DepthControl.tsx     # Z-axis calibration + layer navigation
  useHandTracking.ts     # MediaPipe hand landmarker hook
  oneEuroFilter.ts       # One Euro Filter implementation
  App.tsx                # Tab navigation shell
```

## Why This Exists

This is a research lab for building gesture-based interfaces. Each exercise isolates one interaction pattern so it can be understood, tuned, and reused. The learnings feed directly into Passion Interactive — an AR overlay OS that uses hand tracking as its primary input.

## Author

**James Olusoga** ([@DareDev256](https://github.com/DareDev256)) — AI Solutions Engineer & Creative Technologist, Toronto
