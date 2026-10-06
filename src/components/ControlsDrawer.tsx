import { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Upload, X } from "lucide-react";
import type { Preset, Settings } from "../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  presets: Preset[];
  settings: Settings;
  set: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  onUpload: (file: File) => void;
}

const SWATCHES = ["#06B6D4", "#8B5CF6", "#EC4899", "#34d399", "#fbbf24"];

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch" aria-checked={value} onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left text-base text-white/85 hover:text-white"
    >
      {label}
      <span className={`relative h-6 w-11 rounded-full transition-colors ${value ? "bg-violet-neon shadow-[0_0_14px_#8B5CF6aa]" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${value ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function Slider({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="block py-1.5 text-base text-white/85">
      <span className="flex justify-between"><span>{label}</span><span className="text-white/50">{value}</span></span>
      <input type="range" className="mt-1 w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export default function ControlsDrawer({ open, onClose, presets, settings, set, onUpload }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="glass thin-scroll fixed bottom-0 right-0 top-0 z-40 w-[min(92vw,340px)] overflow-y-auto p-5 pt-6"
          aria-label="Controls"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-white">Controls</h2>
            <button onClick={onClose} aria-label="Close controls" className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"><X size={18} /></button>
          </div>

          <h3 className="mb-2 text-sm font-semibold text-white/50">Characters</h3>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((p) => {
              const on = p.id === settings.presetId;
              return (
                <button
                  key={p.id} onClick={() => set("presetId", p.id)}
                  className="group relative overflow-hidden rounded-xl border text-left transition hover:scale-[1.03]"
                  style={{ borderColor: on ? p.accent : "rgba(255,255,255,.1)", boxShadow: on ? `0 0 18px ${p.accent}88` : "none" }}
                >
                  <img src={p.src} alt="" className="aspect-[3/2] w-full object-cover" draggable={false} />
                  <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-sm font-semibold text-white">{p.name}</span>
                </button>
              );
            })}
            <button
              onClick={() => fileRef.current?.click()}
              className="grid aspect-[3/2] place-items-center rounded-xl border border-dashed border-white/25 text-white/70 transition hover:border-cyan-neon hover:text-cyan-neon"
            >
              <span className="flex flex-col items-center gap-1 text-sm"><Upload size={18} /> Upload image</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ""; }} />
          </div>

          <h3 className="mb-1 mt-6 text-sm font-semibold text-white/50">Neon border</h3>
          <div className="mb-2 flex items-center gap-2">
            {SWATCHES.map((c) => (
              <button key={c} aria-label={`Neon color ${c}`} onClick={() => set("neon", c)} className="h-7 w-7 rounded-full border-2 transition hover:scale-110"
                style={{ background: c, borderColor: settings.neon === c ? "#fff" : "transparent", boxShadow: `0 0 12px ${c}` }} />
            ))}
            <input type="color" aria-label="Custom neon color" value={settings.neon} onChange={(e) => set("neon", e.target.value)} className="h-7 w-9 cursor-pointer rounded bg-transparent" />
          </div>
          <Slider label="Glow intensity" value={settings.glow} min={0} max={60} onChange={(v) => set("glow", v)} />
          <Slider label="Border width" value={settings.width} min={1} max={14} onChange={(v) => set("width", v)} />
          <Slider label="Image opacity" value={settings.opacity} min={0.2} max={1} step={0.05} onChange={(v) => set("opacity", v)} />

          <h3 className="mb-1 mt-5 text-sm font-semibold text-white/50">Effects & tools</h3>
          <Toggle label="Energy particles" value={settings.particles} onChange={(v) => set("particles", v)} />
          <Toggle label="Audio effects" value={settings.audio} onChange={(v) => set("audio", v)} />
          <Toggle label="FPS counter" value={settings.showFps} onChange={(v) => set("showFps", v)} />
          <Toggle label="Debug landmarks" value={settings.debug} onChange={(v) => set("debug", v)} />

          <p className="mt-6 text-sm leading-snug text-white/40">
            Make an L-shape with each hand and frame the space between them. Index fingers and thumbs become the four corners.
          </p>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
