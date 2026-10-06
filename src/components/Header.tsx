import { motion } from "framer-motion";
import { Hand, Sparkles } from "lucide-react";

interface Props { active: boolean; handCount: number; }

export default function Header({ active, handCount }: Props) {
  const label = !active ? "Webcam Inactive" : `Hand Detected [${handCount}/2]`;
  const color = !active ? "#6b7280" : handCount === 2 ? "#34d399" : handCount === 1 ? "#fbbf24" : "#06B6D4";
  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 140, damping: 18 }}
      className="glass pointer-events-auto fixed left-1/2 top-4 z-30 flex w-[min(94vw,820px)] -translate-x-1/2 items-center justify-between rounded-full px-5 py-2.5"
    >
      <div className="flex items-center gap-2 font-display text-sm font-bold text-white sm:text-base">
        <Sparkles size={18} className="text-violet-neon" />
        <span>ANIME<span className="text-cyan-neon">PORTAL</span></span>
      </div>
      <div
        className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold"
        style={{ borderColor: color + "88", color, background: color + "14" }}
        role="status" aria-live="polite"
      >
        <span className="relative flex h-2.5 w-2.5">
          {active && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: color }} />}
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        </span>
        <Hand size={14} /> {label}
      </div>
    </motion.header>
  );
}
