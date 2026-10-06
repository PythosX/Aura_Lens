export type Pt = { x: number; y: number };

/** A facial region a hand can cover, each with its own anime overlay. */
export type ZoneId = "forehead" | "eyes" | "mouth" | "full";

export interface Settings {
  /** Preset id assigned to each facial zone. */
  zones: Record<ZoneId, string>;
  neon: string;
  glow: number;      // shadow blur
  width: number;     // border width
  opacity: number;   // image opacity
  particles: boolean;
  audio: boolean;
  showFps: boolean;
  debug: boolean;
}

export interface Preset {
  id: string;
  name: string;
  src: string;
  accent: string;
}

export const DEFAULT_SETTINGS: Settings = {
  zones: { forehead: "naruto", eyes: "gojo", mouth: "sukuna", full: "neon" },
  neon: "#06B6D4",
  glow: 24,
  width: 4,
  opacity: 0.95,
  particles: true,
  audio: true,
  showFps: true,
  debug: false,
};
