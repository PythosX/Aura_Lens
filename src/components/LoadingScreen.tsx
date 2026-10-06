import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

interface Props { stages: string[]; current: number; }

export default function LoadingScreen({ stages, current }: Props) {
  const pct = Math.min(100, Math.round((current / stages.length) * 100));
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink bg-grid"
      exit={{ opacity: 0, scale: 1.03 }}
      transition={{ duration: 0.5 }}
    >
      {/* portal rings */}
      <div className="relative mb-10 h-40 w-40">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute inset-0 rounded-full border-2"
            style={{ borderColor: ["#06B6D4", "#8B5CF6", "#EC4899"][i], boxShadow: `0 0 24px ${["#06B6D4", "#8B5CF6", "#EC4899"][i]}88` }}
            animate={{ rotate: i % 2 ? -360 : 360, scale: [1 - i * 0.18, 1 - i * 0.18 + 0.06, 1 - i * 0.18] }}
            transition={{ rotate: { duration: 6 - i * 1.4, repeat: Infinity, ease: "linear" }, scale: { duration: 2, repeat: Infinity } }}
          />
        ))}
        <div className="absolute inset-0 grid place-items-center font-display text-2xl font-bold text-white">{pct}%</div>
      </div>

      <h1 className="font-display text-xl font-bold tracking-wide text-white">Opening the portal</h1>

      <div className="mt-5 h-1.5 w-72 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg,#06B6D4,#8B5CF6,#EC4899)" }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
        />
      </div>

      <ul className="mt-6 space-y-2 text-base">
        {stages.map((s, i) => {
          const done = i < current, active = i === current;
          return (
            <li key={s} className={`flex items-center gap-2 transition-colors ${done ? "text-emerald-300" : active ? "text-white" : "text-white/30"}`}>
              {done ? <Check size={16} /> : active ? <Loader2 size={16} className="animate-spin" /> : <span className="h-4 w-4 rounded-full border border-white/20" />}
              {s}
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}
