export type Pt = { x: number; y: number };

export interface Settings {
  presetId: string;
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
  presetId: "gojo",
  neon: "#06B6D4",
  glow: 24,
  width: 4,
  opacity: 0.95,
  particles: true,
  audio: true,
  showFps: true,
  debug: false,
};
