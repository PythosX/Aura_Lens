import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { Pt, Settings } from "../lib/types";
import type { TrackerEngine, Lm } from "../lib/tracker";
import { quadArea, warpImage } from "../lib/warp";
import { sfx } from "../lib/audio";

interface Props {
  engine: TrackerEngine;
  settingsRef: MutableRefObject<Settings>;
  imagesRef: MutableRefObject<Map<string, HTMLImageElement>>;
  onHandCount: (n: number) => void;
}

const PALETTE = ["#8B5CF6", "#EC4899", "#06B6D4"];
const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string }

export default function HandPortal({ engine, settingsRef, imagesRef, onHandCount }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const video = engine.video!;

    let raf = 0;
    let last = performance.now();
    let fpsT = last, frames = 0, fps = 0;
    let smooth: Pt[] | null = null;
    let alpha = 0;
    let prevCount = -1;
    let wasOpen = false;
    const particles: Particle[] = [];
    const MAX_P = 260;

    const toScreen = (h: Lm[], W: number, H: number): Pt[] =>
      h.map((p) => ({ x: (1 - p.x) * W, y: p.y * H })); // mirrored

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = settingsRef.current;

      const W = video.videoWidth || 1280, H = video.videoHeight || 720;
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }

      // 1) mirrored video frame
      ctx.save(); ctx.scale(-1, 1); ctx.drawImage(video, -W, 0, W, H); ctx.restore();
      ctx.fillStyle = "rgba(13,13,17,.22)"; ctx.fillRect(0, 0, W, H);

      // 2) hands
      const hands = engine.latest.map((h) => toScreen(h, W, H));
      if (hands.length !== prevCount) { prevCount = hands.length; onHandCount(hands.length); }

      let target: Pt[] | null = null;
      if (hands.length >= 2) {
        const two = hands.slice(0, 2).sort((a, b) => a[0].x - b[0].x); // screen-left first
        const corners = two.map((h) => {
          const a = h[8], b = h[4]; // index tip, thumb tip
          return a.y <= b.y ? { top: a, bottom: b } : { top: b, bottom: a };
        });
        target = [corners[0].top, corners[1].top, corners[1].bottom, corners[0].bottom];
        if (quadArea(target) < 2500) target = null;
      }

      if (target) {
        smooth = smooth ? smooth.map((p, i) => ({ x: p.x + (target![i].x - p.x) * 0.5, y: p.y + (target![i].y - p.y) * 0.5 })) : target.map((p) => ({ ...p }));
      }
      const goal = target ? 1 : 0;
      alpha += (goal - alpha) * Math.min(1, dt * 9);

      const open = goal === 1;
      if (open && !wasOpen && s.audio) sfx.open();
      if (!open && wasOpen && s.audio) sfx.close();
      wasOpen = open;

      if (smooth && alpha > 0.02) {
        const img = imagesRef.current.get(s.presetId);
        ctx.save();
        ctx.globalAlpha = alpha * s.opacity;
        if (img) warpImage(ctx, img, smooth, 10);
        ctx.restore();

        // glow border
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.lineJoin = "round";
        ctx.beginPath();
        smooth.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.shadowColor = s.neon; ctx.shadowBlur = s.glow;
        ctx.strokeStyle = s.neon; ctx.lineWidth = s.width;
        ctx.stroke(); ctx.stroke();
        ctx.shadowBlur = 0; ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = Math.max(1, s.width * 0.3);
        ctx.stroke();
        ctx.fillStyle = "#fff";
        smooth.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, s.width + 2, 0, 7); ctx.shadowColor = s.neon; ctx.shadowBlur = s.glow; ctx.fill(); });
        ctx.restore();

        // particles emission
        if (s.particles && target) {
          for (let k = 0; k < 5 && particles.length < MAX_P; k++) {
            const e = (Math.random() * 4) | 0, a = smooth[e], b = smooth[(e + 1) % 4], t = Math.random();
            const ang = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 90;
            particles.push({
              x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
              vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 25,
              life: 0, max: 0.5 + Math.random() * 0.7, size: 1.5 + Math.random() * 3,
              color: Math.random() < 0.45 ? s.neon : PALETTE[(Math.random() * 3) | 0],
            });
          }
        }
      }

      // particles update/draw
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

      // 3) debug landmarks
      if (s.debug) {
        ctx.save();
        ctx.lineWidth = 2;
        hands.forEach((h, hi) => {
          const c = hi ? "#EC4899" : "#06B6D4";
          ctx.strokeStyle = c; ctx.fillStyle = c;
          ctx.beginPath();
          CONNECTIONS.forEach(([a, b]) => { ctx.moveTo(h[a].x, h[a].y); ctx.lineTo(h[b].x, h[b].y); });
          ctx.stroke();
          h.forEach((p, i) => { ctx.beginPath(); ctx.arc(p.x, p.y, i === 4 || i === 8 ? 6 : 3, 0, 7); ctx.fill(); });
        });
        ctx.restore();
      }

      // 4) FPS
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
  }, [engine, settingsRef, imagesRef, onHandCount]);

  return <canvas ref={canvasRef} className="block h-full w-full object-contain" />;
}
