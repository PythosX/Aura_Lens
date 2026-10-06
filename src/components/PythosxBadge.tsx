import { useState } from "react";
import { motion } from "framer-motion";
import { Terminal } from "lucide-react";
import { sfx } from "../lib/audio";

const PORTFOLIO_URL = "https://github.com/pythosx"; // change to your portfolio / GitHub

export default function PythosxBadge({ audio }: { audio: boolean }) {
  const [glitch, setGlitch] = useState(false);

  const click = () => {
    setGlitch(true);
    if (audio) sfx.glitch();
    setTimeout(() => setGlitch(false), 450);
    setTimeout(() => window.open(PORTFOLIO_URL, "_blank", "noopener,noreferrer"), 380);
  };

  return (
    <motion.button
      onClick={click}
      aria-label="Developed by Pythosx — open developer profile"
      initial={{ y: 60, opacity: 0, scale: 0.85 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.3 }}
      whileHover={{ scale: 1.07 }}
      whileTap={{ scale: 0.96 }}
      className={`pyth-badge glass flex items-center gap-2.5 px-5 py-2 backdrop-blur-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-neon ${glitch ? "glitching" : ""}`}
    >
      <span className="beam" />
      <Terminal size={16} className="text-cyan-neon drop-shadow-[0_0_6px_#06B6D4]" />
      <span className="font-display text-xs tracking-wide text-white/50">
        Developed by <b className="grad-text ml-1 text-sm font-black">Pythosx</b>
      </span>
    </motion.button>
  );
}
