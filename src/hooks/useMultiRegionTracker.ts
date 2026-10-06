import { useEffect, useRef, useState } from "react";
import type { TrackerEngine } from "../lib/tracker";
import {
  computeRegions,
  initZoneRuntime,
  stepZones,
  type ZoneId,
} from "../lib/regions";

export interface ZoneStatus {
  cover: number; // smoothed 0..1
  active: boolean;
}

export interface MultiRegionState {
  faceFound: boolean;
  handCount: number;
  zones: Record<ZoneId, ZoneStatus>;
}

const IDLE: MultiRegionState = {
  faceFound: false,
  handCount: 0,
  zones: {
    forehead: { cover: 0, active: false },
    eyes: { cover: 0, active: false },
    mouth: { cover: 0, active: false },
    full: { cover: 0, active: false },
  },
};

const SAMPLE_MS = 90;

/**
 * Samples the MediaPipe pipelines at ~11 Hz and exposes which facial zones the
 * user's hands currently cover. The canvas renderer runs the same
 * computeRegions/stepZones math per frame at 60 FPS — this hook only feeds the
 * React HUD (zone chips, header status) without re-rendering every frame.
 */
export function useMultiRegionTracker(engine: TrackerEngine, active: boolean): MultiRegionState {
  const [state, setState] = useState<MultiRegionState>(IDLE);
  const runtime = useRef(initZoneRuntime());

  useEffect(() => {
    if (!active) {
      runtime.current = initZoneRuntime();
      setState(IDLE);
      return;
    }
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;

      const v = engine.video;
      const W = v?.videoWidth || 1280;
      const H = v?.videoHeight || 720;
      const frame = computeRegions(engine.face, engine.hands, W, H);
      stepZones(runtime.current, frame, dt);

      const zones: Record<ZoneId, ZoneStatus> = {
        forehead: { ...runtime.current.forehead },
        eyes: { ...runtime.current.eyes },
        mouth: { ...runtime.current.mouth },
        full: { ...runtime.current.full },
      };
      setState({ faceFound: !!frame, handCount: engine.hands.length, zones });
    }, SAMPLE_MS);

    return () => window.clearInterval(id);
  }, [engine, active]);

  return state;
}
