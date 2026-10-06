import type { Preset } from "./types";

/**
 * Original, stylised placeholder art (SVG) for each preset — no copyrighted
 * artwork is bundled. Use "Upload" in the drawer to drop in your own images.
 */
const W = 960, H = 640;
const wrap = (inner: string, defs = "") =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}${inner}</svg>`
  )}`;

const gojo = wrap(
  `<rect width="${W}" height="${H}" fill="url(#g)"/>
   <g fill="none" stroke="#bfe9ff" stroke-opacity=".55">${Array.from({ length: 9 }, (_, i) =>
     `<circle cx="480" cy="320" r="${40 + i * 38}" stroke-width="${i % 2 ? 1 : 2}"/>`).join("")}</g>
   <circle cx="480" cy="320" r="70" fill="#fff" opacity=".95"/>
   <circle cx="480" cy="320" r="120" fill="url(#c)"/>
   <text x="480" y="585" text-anchor="middle" font-family="Orbitron,Arial" font-weight="800" font-size="46" fill="#e8f7ff" letter-spacing="14">INFINITY</text>`,
  `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1b4d"/><stop offset=".6" stop-color="#2563eb"/><stop offset="1" stop-color="#7dd3fc"/></linearGradient>
   <radialGradient id="c"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#38bdf8" stop-opacity="0"/></radialGradient></defs>`
);

const sukuna = wrap(
  `<rect width="${W}" height="${H}" fill="url(#g)"/>
   ${Array.from({ length: 14 }, (_, i) =>
     `<path d="M${-60 + i * 85} ${H} L${140 + i * 85} 0" stroke="#fca5a5" stroke-opacity="${0.08 + (i % 3) * 0.07}" stroke-width="${3 + (i % 4) * 3}"/>`).join("")}
   <circle cx="480" cy="300" r="150" fill="#000" opacity=".5"/>
   <path d="M330 300 Q480 170 630 300 Q480 430 330 300Z" fill="#7f1d1d" stroke="#fecaca" stroke-width="5"/>
   <circle cx="480" cy="300" r="46" fill="#111"/><circle cx="480" cy="300" r="16" fill="#ef4444"/>
   <text x="480" y="585" text-anchor="middle" font-family="Orbitron,Arial" font-weight="800" font-size="46" fill="#fecaca" letter-spacing="14">MALEVOLENT</text>`,
  `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a0505"/><stop offset=".6" stop-color="#7f1d1d"/><stop offset="1" stop-color="#dc2626"/></linearGradient></defs>`
);

const naruto = wrap(
  `<rect width="${W}" height="${H}" fill="url(#g)"/>
   <path d="M480 320 m0 0 a20 20 0 1 1 40 0 a40 40 0 1 1 -80 0 a60 60 0 1 1 120 0 a80 80 0 1 1 -160 0 a100 100 0 1 1 200 0 a120 120 0 1 1 -240 0 a140 140 0 1 1 280 0"
         transform="translate(-20 0)" fill="none" stroke="#fff7ed" stroke-opacity=".85" stroke-width="10" stroke-linecap="round"/>
   <circle cx="480" cy="320" r="26" fill="#fff"/>
   <text x="480" y="585" text-anchor="middle" font-family="Orbitron,Arial" font-weight="800" font-size="46" fill="#fff7ed" letter-spacing="14">RASENGAN</text>`,
  `<defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#9a3412"/><stop offset=".55" stop-color="#f97316"/><stop offset="1" stop-color="#fde047"/></linearGradient></defs>`
);

const cyber = wrap(
  `<rect width="${W}" height="${H}" fill="url(#g)"/>
   ${Array.from({ length: 12 }, (_, i) =>
     `<rect x="${i * 80}" y="${300 + Math.sin(i) * 120}" width="60" height="${300}" fill="#0D0D11" opacity=".55"/>`).join("")}
   <circle cx="720" cy="170" r="90" fill="#fff" opacity=".85"/>
   <text x="480" y="585" text-anchor="middle" font-family="Orbitron,Arial" font-weight="800" font-size="46" fill="#fff" letter-spacing="14">NEON CITY</text>`,
  `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8B5CF6"/><stop offset=".55" stop-color="#EC4899"/><stop offset="1" stop-color="#06B6D4"/></linearGradient></defs>`
);

export const BUILTIN_PRESETS: Preset[] = [
  { id: "gojo", name: "Gojo", src: gojo, accent: "#38bdf8" },
  { id: "sukuna", name: "Sukuna", src: sukuna, accent: "#ef4444" },
  { id: "naruto", name: "Naruto", src: naruto, accent: "#f97316" },
  { id: "neon", name: "Neon City", src: cyber, accent: "#EC4899" },
];

/** Decode one image (used by the staged loader, one at a time). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
  });
}
