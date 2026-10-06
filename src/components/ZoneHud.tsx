import { motion } from "framer-motion";
import { ScanLine, Video } from "lucide-react";
import { ZONE_IDS, ZONE_SHORT, type ZoneId } from "../lib/regions";

export interface ZoneStatus { cover: number; active: boolean }

interface Props {
  zones: Record<ZoneId, ZoneStatus>;
  faceFound: boolean;
  handCount: number;
  cameras: MediaDeviceInfo[];
  cameraId: string;
  onCamera: (id: string) => void;
  debug: boolean;
  onDebug: () => void;
}

const ACCENT: Record<ZoneId, string> = {
  forehead: "#fbbf24",
  eyes: "#06B6D4",
  mouth: "#EC4899",
  full: "#8B5CF6",
};

/** Live HUD: camera source, wireframe toggle and per-zone cover status. */
export default function ZoneHud({
  zones, faceFound, handCount, cameras, cameraId, onCamera, debug, onDebug,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.45, type: "spring", stiffness: 180, damping: 22 }}
      className="glass absolute right-3 top-3 z-20 w-[210px] rounded-2xl p-3"
      aria-label="Tracking HUD"
    >
      {/* camera source */}
      <div className="mb-2 flex items-center gap-1.5">
        <Video size={13} className="shrink-0 text-cyan-neon" />
        <select
          aria-label="Camera source"
          value={cameraId}
          onChange={(e) => onCamera(e.target.value)}
          className="min-w-0 flex-1 cursor-pointer truncate rounded-md bg-black/40 px-1.5 py-1 text-xs text-white/80 outline-none ring-cyan-neon/50 focus:ring-1"
        >
          {cameras.length === 0 && <option value="">Default camera</option>}
          {cameras.map((c, i) => (
            <option key={c.deviceId || i} value={c.deviceId}>{c.label || `Camera ${i + 1}`}</option>
          ))}
        </select>
        <button
          onClick={onDebug}
          aria-pressed={debug}
          aria-label="Toggle wireframe debug"
          title="Wireframe debug"
          className={`rounded-md p-1.5 transition ${debug ? "bg-violet-neon text-white shadow-[0_0_12px_#8B5CF6aa]" : "bg-black/40 text-white/55 hover:text-white"}`}
        >
          <ScanLine size={13} />
        </button>
      </div>

      {/* face / hand status */}
      <div className="mb-2 flex items-center justify-between rounded-lg bg-black/35 px-2 py-1.5 text-xs font-semibold">
        <span className={faceFound ? "text-emerald-300" : "text-white/40"}>
          {faceFound ? "Face locked" : "No face"}
        </span>
        <span className={handCount >= 2 ? "text-emerald-300" : handCount === 1 ? "text-amber-300" : "text-white/40"}>
          Hands {handCount}/2
        </span>
      </div>

      {/* active zone indicators */}
      <ul className="space-y-1">
        {ZONE_IDS.map((z) => {
          const on = zones[z].active;
          const pct = Math.round(zones[z].cover * 100);
          const c = ACCENT[z];
          return (
            <li
              key={z}
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-semibold transition-colors"
              style={{
                background: on ? c + "1f" : "rgba(0,0,0,.28)",
                color: on ? c : "rgba(255,255,255,.42)",
                boxShadow: on ? `inset 0 0 0 1px ${c}66, 0 0 12px ${c}33` : "inset 0 0 0 1px rgba(255,255,255,.05)",
              }}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${on ? "animate-pulse" : ""}`}
                style={{ background: on ? c : "rgba(255,255,255,.3)" }}
              />
              <span className="flex-1 truncate">{ZONE_SHORT[z]}</span>
              <span className="tabular-nums">{on ? "Covered" : `${pct}%`}</span>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}
