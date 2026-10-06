import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { Pt, Settings, Preset } from "../lib/types";
import type { TrackerEngine, Lm } from "../lib/tracker";
import {
  ZONE_IDS,
  computeRegions,
  initZoneRuntime,
  stepZones,
  type ZoneId,
} from "../lib/regions";
import { warpImage } from "../lib/warp";
import { sfx } from "../lib/audio";

interface Props {
  engine: TrackerEngine;
  settingsRef: MutableRefObject<Settings>;
  imagesRef: MutableRefObject<Map<string, HTMLImageElement>>;
  presets: Preset[];
}

const PALETTE = ["#8B5CF6", "#EC4899", "#06B6D4"];
const HAND_CONN = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

/** Keep the last face briefly so overlays survive momentary occlusion. */
const FACE_HOLD_MS = 700;

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
}

/**
 * High-performance 60 FPS canvas: mirrored video + one anime strip warped
 * onto each hand-covered facial zone, with neon borders, sparks and debug
 * wireframes. Runs the exact same region math as useMultiRegionTracker.
 */
export default function FaceCanvasOverlay({ engine, settingsRef, imagesRef, presets }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const video = engine.video!;

    let raf = 0;
    let last = performance.now();
    let fpsT = last, frames = 0, fps = 0;
    let heldFace: Lm[] | null = null;
    let heldAt = 0;
    let wasActive = false;

    const runtime = initZoneRuntime();
    const alpha: Record<ZoneId, number> = { forehead: 0, eyes: 0, mouth: 0, full: 0 };
    const particles: Particle[] = [];
    const MAX_P = 300;

    const accentFor = (s: Settings, zone: ZoneId) =>
      presets.find((p) => p.id === s.zones[zone])?.accent ?? s.neon;

    /** Scale the quad about its own centre (entrance pop driven by alpha). */
    const scaleQuad = (q: Pt[], k: number): Pt[] => {
      if (k === 1) return q;
      let cx = 0, cy = 0;
      for (const p of q) { cx += p.x; cy += p.y; }
      cx /= q.length; cy /= q.length;
      return q.map((p) => ({ x: cx + (p.x - cx) * k, y: cy + (p.y - cy) * k }));
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = settingsRef.current;

      const W = video.videoWidth || 1280, H = video.videoHeight || 720;
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }

      // 1) mirrored video frame + dim
      ctx.save(); ctx.scale(-1, 1); ctx.drawImage(video, -W, 0, W, H); ctx.restore();
      ctx.fillStyle = "rgba(13,13,17,.25)"; ctx.fillRect(0, 0, W, H);

      // 2) regions (hold the last face through brief occlusions)
      if (engine.face) { heldFace = engine.face; heldAt = now; }
      const face = engine.face ?? (now - heldAt < FACE_HOLD_MS ? heldFace : null);
      const frame = computeRegions(face, engine.hands, W, H);
      stepZones(runtime, frame, dt);

      // seam transition sound
      const anyActive = ZONE_IDS.some((z) => runtime[z].active);
      if (anyActive !== wasActive && s.audio) { anyActive ? sfx.open() : sfx.close(); }
      wasActive = anyActive;

      // 3) anime strips — one per covered zone only
      for (const zone of ZONE_IDS) {
        const target = runtime[zone].active ? 1 : 0;
        alpha[zone] += (target - alpha[zone]) * Math.min(1, dt * 8);
        const a = alpha[zone];
        const z = frame?.zones[zone];
        if (a < 0.02 || !z) continue;

        const img = imagesRef.current.get(s.zones[zone]);
        const quad = scaleQuad(z.quad, 0.9 + 0.1 * a);
        const color = accentFor(s, zone);

        if (img) {
          ctx.save();
          ctx.globalAlpha = a * s.opacity;
          warpImage(ctx, img, quad, 10);
          ctx.restore();
        }

        // neon border
        ctx.save();
        ctx.globalAlpha = a;
        ctx.lineJoin = "round";
        ctx.beginPath();
        quad.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.shadowColor = color; ctx.shadowBlur = s.glow;
        ctx.strokeStyle = color; ctx.lineWidth = s.width;
        ctx.stroke(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,.85)";
        ctx.lineWidth = Math.max(1, s.width * 0.3);
        ctx.stroke();
        ctx.restore();

        // sparks along the boundary where hands meet the face
        if (s.particles && runtime[zone].active) {
          for (let k = 0; k < 4 && particles.length < MAX_P; k++) {
            const e = (Math.random() * 4) | 0;
            const p0 = quad[e], p1 = quad[(e + 1) % 4], t = Math.random();
            const ang = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 90;
            particles.push({
              x: p0.x + (p1.x - p0.x) * t,
              y: p0.y + (p1.y - p0.y) * t,
              vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 25,
              life: 0, max: 0.5 + Math.random() * 0.7, size: 1.5 + Math.random() * 3,
              color: Math.random() < 0.45 ? color : PALETTE[(Math.random() * 3) | 0],
            });
          }
        }
      }

      // 4) particles
      if (particles.length) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.life += dt;
          if (p.life >= p.max) { particles.splice(i, 1); continue; }
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt;
          const k = 1 - p.life / p.max;
          ctx.globalAlpha = k;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * k + 0.5, 0, 7); ctx.fill();
        }
        ctx.restore();
      }

      // 5) debug wireframes: face mesh, zone quads, hands, hulls
      if (s.debug && frame) {
        ctx.save();
        ctx.lineWidth = 1.5;

        if (face) {
          ctx.fillStyle = "rgba(52,211,153,.85)";
          for (let i = 0; i < face.length; i += 3) {
            const x = (1 - face[i].x) * W, y = face[i].y * H;
            ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill();
          }
        }

        ZONE_IDS.forEach((z) => {
          const zone = frame.zones[z];
          if (!zone) return;
          const c = accentFor(s, z);
          ctx.strokeStyle = runtime[z].active ? c : "rgba(255,255,255,.35)";
          ctx.setLineDash(runtime[z].active ? [] : [6, 6]);
          ctx.beginPath();
          zone.quad.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.closePath(); ctx.stroke();
        });
        ctx.setLineDash([]);

        frame.hulls.forEach((h) => {
          ctx.strokeStyle = "#EC4899";
          ctx.beginPath();
          h.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.closePath(); ctx.stroke();
        });

        frame.hands.forEach((h, hi) => {
          const c = hi ? "#EC4899" : "#06B6D4";
          ctx.strokeStyle = c; ctx.fillStyle = c;
          ctx.beginPath();
          HAND_CONN.forEach(([a, b]) => { ctx.moveTo(h[a].x, h[a].y); ctx.lineTo(h[b].x, h[b].y); });
          ctx.stroke();
          h.forEach((p, i) => {
            ctx.beginPath(); ctx.arc(p.x, p.y, i === 4 || i === 8 ? 5 : 2.5, 0, 7); ctx.fill();
          });
        });
        ctx.restore();
      }

      // 6) FPS
      frames++;
      if (now - fpsT >= 500) { fps = Math.round((frames * 1000) / (now - fpsT)); frames = 0; fpsT = now; }
      if (s.showFps) {
        ctx.save();
        ctx.font = "600 22px Orbitron, monospace";
        ctx.fillStyle = "rgba(13,13,17,.7)"; ctx.fillRect(14, 14, 118, 36);
        ctx.fillStyle = fps >= 50 ? "#34d399" : fps >= 30 ? "#fbbf24" : "#f87171";
        ctx.fillText(`${fps} FPS`, 24, 40);
        ctx.restore();
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, settingsRef, imagesRef, presets]);

  return <canvas ref={canvasRef} className="block h-full w-full object-contain" />;
}
