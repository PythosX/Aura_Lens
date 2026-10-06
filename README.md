# Anime Portal — Hand Tracking (Vite + React + TS)

Real-time two-hand tracking (MediaPipe Hands) that warps an anime image into the
quad between your hands, with a neon glow border, energy particles and a cyberpunk HUD.

## Run
```bash
npm install
npm run dev      # http://localhost:5173  (camera works on localhost / https)
npm run build
```

## How it works
- `src/lib/tracker.ts` – camera + MediaPipe, split into separate steps (runtime → model → camera → detection loop).
- `src/App.tsx` – staged boot: one step at a time, each waits for a paint, so the UI never freezes.
- `src/components/HandPortal.tsx` – 60 FPS render loop (independent from detection): mirrored video, warped image, glow, particles, debug, FPS.
- `src/lib/warp.ts` – projective warp (homography → 10×10 triangle mesh on Canvas 2D).
- Corners = index tip + thumb tip of each hand.

## Customize
- Characters: built-in art is original placeholder SVG (`src/lib/presets.ts`). Use **Upload image** in the Controls drawer for your own.
- Badge link: edit `PORTFOLIO_URL` in `src/components/PythosxBadge.tsx`.
- MediaPipe model files load from the jsDelivr CDN (needs internet on first run).
