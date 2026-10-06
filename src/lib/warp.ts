import type { Pt } from "./types";

/**
 * Projective mapping from the unit square to a quad (Heckbert).
 * Corner order: TL, TR, BR, BL.
 */
function squareToQuad(q: Pt[]) {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  let g = 0, h = 0;
  const den = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h = (dx1 * dy3 - dx3 * dy1) / den;
  }
  const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + h * p3.x, c = p0.x;
  const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + h * p3.y, f = p0.y;
  return (u: number, v: number): Pt => {
    const w = g * u + h * v + 1;
    return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w };
  };
}

function drawTriangle(
  ctx: CanvasRenderingContext2D, img: CanvasImageSource,
  s0: Pt, s1: Pt, s2: Pt, d0: Pt, d1: Pt, d2: Pt
) {
  const det = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
  if (Math.abs(det) < 1e-9) return;
  const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / det;
  const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / det;
  const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / det;
  const d = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / det;
  const e = d0.x - a * s0.x - c * s0.y;
  const f = d0.y - b * s0.x - d * s0.y;

  // Expand the clip triangle slightly to hide hairline seams between cells.
  const cx = (d0.x + d1.x + d2.x) / 3, cy = (d0.y + d1.y + d2.y) / 3;
  const grow = (p: Pt): Pt => {
    const vx = p.x - cx, vy = p.y - cy, l = Math.hypot(vx, vy) || 1;
    return { x: p.x + (vx / l) * 0.7, y: p.y + (vy / l) * 0.7 };
  };
  const g0 = grow(d0), g1 = grow(d1), g2 = grow(d2);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(g0.x, g0.y); ctx.lineTo(g1.x, g1.y); ctx.lineTo(g2.x, g2.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/** Perspective-warp `img` into quad `q` (TL, TR, BR, BL) using a triangle mesh. */
export function warpImage(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement, q: Pt[], grid = 10
) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const map = squareToQuad(q);
  const pts: Pt[][] = [];
  for (let j = 0; j <= grid; j++) {
    const row: Pt[] = [];
    for (let i = 0; i <= grid; i++) row.push(map(i / grid, j / grid));
    pts.push(row);
  }
  for (let j = 0; j < grid; j++) {
    for (let i = 0; i < grid; i++) {
      const s00 = { x: (i / grid) * iw, y: (j / grid) * ih };
      const s10 = { x: ((i + 1) / grid) * iw, y: (j / grid) * ih };
      const s01 = { x: (i / grid) * iw, y: ((j + 1) / grid) * ih };
      const s11 = { x: ((i + 1) / grid) * iw, y: ((j + 1) / grid) * ih };
      const p00 = pts[j][i], p10 = pts[j][i + 1], p01 = pts[j + 1][i], p11 = pts[j + 1][i + 1];
      drawTriangle(ctx, img, s00, s10, s01, p00, p10, p01);
      drawTriangle(ctx, img, s10, s11, s01, p10, p11, p01);
    }
  }
}

export function quadArea(q: Pt[]) {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}
