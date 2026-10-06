import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Upload, X } from "lucide-react";
import type { Preset, Settings, ZoneId } from "../lib/types";
import { ZONE_IDS, ZONE_LABEL } from "../lib/regions";

interface Props {
  open: boolean;
  onClose: () => void;
  presets: Preset[];
  settings: Settings;
  set: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  onUpload: (file: File, zone: ZoneId) => void;
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
  const [zone, setZone] = useState<ZoneId>("eyes");

  const assign = (presetId: string) => set("zones", { ...settings.zones, [zone]: presetId });
  const assignedName = presets.find((p) => p.id === settings.zones[zone])?.name ?? "—";

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

          {/* ---- Anime asset selector: one asset per facial region ---- */}
          <h3 className="mb-2 text-sm font-semibold text-white/50">Face region</h3>
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            {ZONE_IDS.map((z) => {
              const on = z === zone;
              const preset = presets.find((p) => p.id === settings.zones[z]);
              return (
                <button
                  key={z} onClick={() => setZone(z)}
                  className={`rounded-xl border px-2 py-1.5 text-left transition ${on ? "border-cyan-neon bg-cyan-neon/10 shadow-[0_0_16px_#06B6D455]" : "border-white/10 bg-black/25 hover:border-white/25"}`}
                >
                  <span className={`block text-xs font-bold ${on ? "text-cyan-neon" : "text-white/75"}`}>{ZONE_LABEL[z]}</span>
                  <span className="block truncate text-xs text-white/45">{preset?.name ?? "—"}</span>
                </button>
              );
            })}
          </div>
          <p className="mb-3 text-xs text-white/45">
            Overlay for <b className="text-white/75">{ZONE_LABEL[zone]}</b>: <b style={{ color: presets.find((p) => p.id === settings.zones[zone])?.accent }}>{assignedName}</b>. Pick an asset below or upload your own.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {presets.map((p) => {
              const on = p.id === settings.zones[zone];
              return (
                <button
                  key={p.id} onClick={() => assign(p.id)}
                  className="group relative overflow-hidden rounded-xl border text-left transition hover:scale-[1.03]"
                  style={{ borderColor: on ? p.accent : "rgba(255,255,255,.1)", boxShadow: on ? `0 0 18px ${p.accent}88` : "none" }}
                >
                  <img src={p.src} alt="" className="aspect-[3/2] w-full object-cover" draggable={false} />
                  <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-sm font-semibold text-white">{p.name}</span>
                  {on && <span className="absolute right-1 top-1 rounded-full px-1.5 text-[10px] font-black text-black" style={{ background: p.accent }}>IN USE</span>}
                </button>
              );
            })}
            <button
              onClick={() => fileRef.current?.click()}
              className="grid aspect-[3/2] place-items-center rounded-xl border border-dashed border-white/25 text-white/70 transition hover:border-cyan-neon hover:text-cyan-neon"
            >
              <span className="flex flex-col items-center gap-1 text-sm"><Upload size={18} /> Upload image</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f, zone); e.currentTarget.value = ""; }} />
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
          <Toggle label="Debug wireframe" value={settings.debug} onChange={(v) => set("debug", v)} />

          <p className="mt-6 text-sm leading-snug text-white/40">
            Cover a facial zone with your hands — eyes, mouth, forehead, or both hands around the whole face — and that region&apos;s anime strip appears.
          </p>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
