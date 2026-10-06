import type { Pt, ZoneId } from "./types";
import type { Lm } from "./tracker";

export type { ZoneId } from "./types";

/* ------------------------------------------------------------------ *
 * Zones — the face regions a hand can cover.
 * ------------------------------------------------------------------ */

export const ZONE_IDS: ZoneId[] = ["forehead", "eyes", "mouth", "full"];

export const ZONE_LABEL: Record<ZoneId, string> = {
  forehead: "Forehead",
  eyes: "Eyes",
  mouth: "Mouth / Lower Face",
  full: "Full Face",
};

export const ZONE_SHORT: Record<ZoneId, string> = {
  forehead: "Forehead",
  eyes: "Eyes",
  mouth: "Mouth",
  full: "Full Face",
};

/** Activation / release thresholds (fraction of the zone covered by hands). */
const COVER_ON = 0.32;
const COVER_OFF = 0.22;
const FULL_ON = 0.4;

/* ------------------------------------------------------------------ *
 * Per-frame region frame produced from face + hand landmarks.
 * ------------------------------------------------------------------ */

export interface ZoneRuntime {
  cover: number; // smoothed 0..1
  active: boolean;
}

export type ZoneRuntimeMap = Record<ZoneId, ZoneRuntime>;

export interface RegionFrame {
  faceQuad: Pt[] | null;                       // whole face box (debug outline)
  zones: Record<ZoneId, { quad: Pt[]; cover: number } | null>;
  hands: Pt[][];                               // mirrored hand skeletons
  hulls: Pt[][];                               // convex hulls of each hand
  fullHands: number;                           // hands overlapping the face box
}

export const initZoneRuntime = (): ZoneRuntimeMap => ({
  forehead: { cover: 0, active: false },
  eyes: { cover: 0, active: false },
  mouth: { cover: 0, active: false },
  full: { cover: 0, active: false },
});

const mirror = (p: Lm, W: number, H: number): Pt => ({ x: (1 - p.x) * W, y: p.y * H });

/* ------------------------------------------------------------------ *
 * Geometry helpers: convex hull, intersection (Sutherland–Hodgman), area.
 * ------------------------------------------------------------------ */

export function convexHull(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts.slice();
  const p = [...pts].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

export function polyArea(poly: Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/** Clip convex `subject` by convex `clip`; both in the same winding. */
function clipConvex(subject: Pt[], clip: Pt[]): Pt[] {
  if (subject.length < 3 || clip.length < 3) return [];
  // normalise clip winding to counter-clockwise
  let ring = clip;
  let signed = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    signed += a.x * b.y - b.x * a.y;
  }
  if (signed < 0) ring = [...ring].reverse();

  let out = subject;
  for (let i = 0; i < ring.length && out.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const inside = (p: Pt) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= 0;
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j], prev = input[(j + input.length - 1) % input.length];
      const curIn = inside(cur), prevIn = inside(prev);
      if (curIn) {
        if (!prevIn) out.push(intersect(prev, cur, a, b));
        out.push(cur);
      } else if (prevIn) {
        out.push(intersect(prev, cur, a, b));
      }
    }
  }
  return out;
}

function intersect(p1: Pt, p2: Pt, a: Pt, b: Pt): Pt {
  const x1 = p2.x - p1.x, y1 = p2.y - p1.y;
  const x2 = b.x - a.x, y2 = b.y - a.y;
  const den = x1 * y2 - y1 * x2;
  if (Math.abs(den) < 1e-9) return { ...p2 };
  const t = ((a.x - p1.x) * y2 - (a.y - p1.y) * x2) / den;
  return { x: p1.x + x1 * t, y: p1.y + y1 * t };
}

/** Fraction of `zone` covered by any of the hand hulls (0..1). */
function coverRatio(hulls: Pt[][], zone: Pt[]): number {
  const total = polyArea(zone);
  if (total < 1) return 0;
  let covered = 0;
  for (const h of hulls) {
    if (h.length < 3) continue;
    covered += polyArea(clipConvex(h, zone));
  }
  return Math.min(1, covered / total);
}

/* ------------------------------------------------------------------ *
 * Face → zone quads
 * ------------------------------------------------------------------ */

/** Rotation + shear applied to every band so overlays follow head pose. */
function placeBand(
  xL: number, xR: number, y0: number, y1: number,
  cx: number, cy: number, roll: number, shear: number
): Pt[] {
  const raw: Pt[] = [
    { x: xL, y: y0 },
    { x: xR, y: y0 },
    { x: xR, y: y1 },
    { x: xL, y: y1 },
  ];
  const cos = Math.cos(roll), sin = Math.sin(roll);
  // 1) yaw shear (perspective feel): top and bottom edges shift opposite ways
  // 2) roll rotation about the face centre so the strip aligns with head tilt
  return raw.map((p) => {
    const sx = p.x + shear * (cy - p.y);
    const dx = sx - cx, dy = p.y - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  });
}

/**
 * Build the four zone quads + hand hulls for this frame.
 * Returns null when there is no usable face.
 */
export function computeRegions(
  face: Lm[] | null, hands: Lm[][], W: number, H: number
): RegionFrame | null {
  const handPts = hands.map((h) => h.map((p) => mirror(p, W, H)));
  const hulls = handPts.map(convexHull).filter((h) => h.length >= 3 && polyArea(h) > 400);

  if (!face || face.length < 460) return null;

  const P = (i: number) => mirror(face[i], W, H);
  const top = P(10), bot = P(152), left = P(234), right = P(454);
  const faceH = bot.y - top.y;
  const faceW = Math.abs(right.x - left.x);
  if (faceH < 60 || faceW < 60) return null;

  const faceL = Math.min(left.x, right.x);
  const faceR = Math.max(left.x, right.x);
  const cx = (faceL + faceR) / 2;
  const cy = (top.y + bot.y) / 2;

  // Eye line anchors (all well-established FaceMesh indices)
  const eyeTopY = Math.min(P(159).y, P(386).y);
  const eyeBotY = Math.max(P(145).y, P(374).y);
  const browY = eyeTopY - 0.055 * faceH;

  // Head pose. The eye-line vector can point either way in mirrored space,
  // so fold the angle into [-90°, 90°] — we want the tilt, not the direction.
  let roll = Math.atan2(P(263).y - P(33).y, P(263).x - P(33).x);
  if (roll > Math.PI / 2) roll -= Math.PI;
  else if (roll < -Math.PI / 2) roll += Math.PI;
  const eyeSpan = Math.abs(P(263).x - P(33).x) || 1;
  const yaw = (P(168).x - (P(133).x + P(362).x) / 2) / eyeSpan;
  const shear = Math.max(-1, Math.min(1, yaw)) * 0.4;

  // Vertical bands (fractions anchored to real eye landmarks, so pitch-safe)
  const mouthTop = eyeBotY + 0.34 * (bot.y - eyeBotY);
  const bands: Record<ZoneId, { y0: number; y1: number; inset: number }> = {
    forehead: { y0: top.y + 0.03 * faceH, y1: browY, inset: 0.07 },
    eyes: { y0: browY, y1: eyeBotY + 0.03 * faceH, inset: 0.02 },
    mouth: { y0: mouthTop, y1: bot.y, inset: 0.14 },
    full: { y0: top.y, y1: bot.y, inset: -0.05 },
  };

  const frame: RegionFrame = {
    faceQuad: placeBand(faceL, faceR, top.y, bot.y, cx, cy, roll, shear),
    zones: { forehead: null, eyes: null, mouth: null, full: null },
    hands: handPts,
    hulls,
    fullHands: 0,
  };

  for (const id of ZONE_IDS) {
    const b = bands[id];
    if (b.y1 - b.y0 < 0.04 * faceH) continue; // band collapsed (extreme pitch)
    const x0 = faceL + b.inset * faceW;
    const x1 = faceR - b.inset * faceW;
    if (x1 - x0 < 0.1 * faceW) continue;
    const quad = placeBand(x0, x1, b.y0, b.y1, cx, cy, roll, shear);
    frame.zones[id] = { quad, cover: coverRatio(hulls, quad) };
  }

  // How many hands overlap the whole face box (full-face needs both hands)
  if (frame.faceQuad) {
    frame.fullHands = hulls.filter((h) => polyArea(clipConvex(h, frame.faceQuad!)) > polyArea(h) * 0.35).length;
  }
  return frame;
}

/* ------------------------------------------------------------------ *
 * Temporal smoothing + activation (used by the hook AND the renderer)
 * ------------------------------------------------------------------ */

/**
 * Mutates `rt` toward the raw coverage of this frame with hysteresis, then
 * applies priority: Full Face wins — only the covered zone stays active.
 */
export function stepZones(rt: ZoneRuntimeMap, frame: RegionFrame | null, dt: number): void {
  const k = Math.min(1, dt * 10);
  for (const id of ZONE_IDS) {
    const raw = frame?.zones[id]?.cover ?? 0;
    const r = rt[id];
    r.cover += (raw - r.cover) * k;

    const on = id === "full" ? FULL_ON : COVER_ON;
    const off = id === "full" ? FULL_ON - 0.12 : COVER_OFF;
    const triggered =
      id === "full"
        ? (frame?.fullHands ?? 0) >= 2 && (frame?.zones.full?.cover ?? 0) >= on
        : raw >= on;
    r.active = triggered || (r.active && r.cover >= off);
  }

  // "ONLY" — a full-face cover suppresses the individual zone strips.
  if (rt.full.active) {
    rt.forehead.active = false;
    rt.eyes.active = false;
    rt.mouth.active = false;
  }
}
