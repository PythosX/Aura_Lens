let ctx: AudioContext | null = null;

function ac() {
  if (!ctx) {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new C();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq: number, to: number, dur: number, type: OscillatorType, vol = 0.05) {
  try {
    const a = ac(), o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, a.currentTime);
    o.frequency.exponentialRampToValueAtTime(to, a.currentTime + dur);
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g).connect(a.destination);
    o.start(); o.stop(a.currentTime + dur);
  } catch { /* audio is optional */ }
}

export const sfx = {
  open: () => { tone(220, 880, 0.35, "sawtooth", 0.04); tone(440, 1320, 0.3, "sine", 0.03); },
  close: () => tone(700, 160, 0.25, "triangle", 0.04),
  switch: () => tone(520, 780, 0.12, "square", 0.025),
  glitch: () => {
    for (let i = 0; i < 4; i++) setTimeout(() => tone(120 + Math.random() * 900, 60 + Math.random() * 400, 0.07, "square", 0.04), i * 55);
  },
};
