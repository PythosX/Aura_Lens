import { motion } from "framer-motion";
import { CameraOff, RefreshCw } from "lucide-react";
import type { CameraError } from "../lib/tracker";

const COPY: Record<string, { title: string; body: string }> = {
  denied: { title: "Camera access is blocked", body: "Allow camera access from the lock icon in your address bar, then try again." },
  none: { title: "No camera found", body: "Connect a webcam, or open this page on a device that has one." },
  busy: { title: "Camera is in use", body: "Close other apps or tabs using the camera, then try again." },
  unknown: { title: "Couldn't start the camera", body: "Check your browser permissions and try again." },
  model: { title: "Couldn't load hand tracking", body: "The tracking model didn't download. Check your connection and try again." },
};

export default function PermissionFallback({ kind, onRetry }: { kind: CameraError | "model"; onRetry: () => void }) {
  const c = COPY[kind] ?? COPY.unknown;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="glass mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl p-8 text-center"
    >
      <div className="grid h-16 w-16 place-items-center rounded-full bg-pink-neon/15 text-pink-neon shadow-[0_0_30px_#EC489955]">
        <CameraOff size={30} />
      </div>
      <h2 className="font-display text-lg font-bold text-white">{c.title}</h2>
      <p className="text-lg leading-snug text-white/70">{c.body}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 rounded-full bg-violet-neon px-5 py-2 font-semibold text-white shadow-[0_0_24px_#8B5CF688] transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-neon"
      >
        <RefreshCw size={16} /> Try again
      </button>
    </motion.div>
  );
}
