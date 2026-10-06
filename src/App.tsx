import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SlidersHorizontal } from "lucide-react";
import Header from "./components/Header";
import LoadingScreen from "./components/LoadingScreen";
import FaceCanvasOverlay from "./components/FaceCanvasOverlay";
import ControlsDrawer from "./components/ControlsDrawer";
import ZoneHud from "./components/ZoneHud";
import PermissionFallback from "./components/PermissionFallback";
import PythosxBadge from "./components/PythosxBadge";
import { TrackerEngine, type CameraError } from "./lib/tracker";
import { useMultiRegionTracker } from "./hooks/useMultiRegionTracker";
import { ZONE_IDS } from "./lib/regions";
import { BUILTIN_PRESETS, loadImage } from "./lib/presets";
import { sfx } from "./lib/audio";
import { DEFAULT_SETTINGS, type Preset, type Settings, type ZoneId } from "./lib/types";

/** Each stage runs alone; the next one starts only after the UI has painted. */
const STAGES = [
  "Preparing interface",
  "Decoding anime strips",
  "Loading vision runtime",
  "Warming up face & hand models",
  "Starting webcam",
  "Syncing tracking",
];

const nextPaint = (ms = 180) =>
  new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, ms)));

export default function App() {
  const [stage, setStage] = useState(0);        // index of the stage currently running
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<CameraError | "model" | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [drawer, setDrawer] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState("");

  const engine = useMemo(() => new TrackerEngine(), []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const imagesRef = useRef(new Map<string, HTMLImageElement>());
  const booting = useRef(false);
  const runtimeLoaded = useRef(false);
  const modelLoaded = useRef(false);

  const region = useMultiRegionTracker(engine, ready);

  const set = useCallback(<K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v })), []);

  const boot = useCallback(async () => {
    if (booting.current) return;
    booting.current = true;
    setError(null);
    try {
      // 0 — interface
      setStage(0); await nextPaint(300);

      // 1 — images, decoded one at a time
      setStage(1);
      if (!imagesRef.current.size) {
        for (const p of BUILTIN_PRESETS) {
          imagesRef.current.set(p.id, await loadImage(p.src));
          await nextPaint(60);
        }
        setPresets(BUILTIN_PRESETS);
      }

      // 2 — MediaPipe vision runtime (wasm fileset)
      setStage(2); await nextPaint();
      if (!runtimeLoaded.current) {
        try { await engine.loadRuntime(); runtimeLoaded.current = true; }
        catch { setError("model"); booting.current = false; return; }
      }

      // 3 — face landmarker + hand landmarker weights
      setStage(3); await nextPaint();
      if (!modelLoaded.current) {
        try { await engine.initModel(); modelLoaded.current = true; }
        catch { setError("model"); booting.current = false; return; }
      }

      // 4 — camera
      setStage(4); await nextPaint();
      try { await engine.startCamera(videoRef.current!); }
      catch (e) { setError((typeof e === "string" ? e : "unknown") as CameraError); booting.current = false; return; }

      // 5 — detection loop
      setStage(5); await nextPaint();
      engine.startDetection();
      setCamId(engine.deviceId);
      engine.listCameras().then(setCameras);
      await nextPaint(350);
      setStage(STAGES.length);
      setReady(true);
    } finally {
      booting.current = false;
    }
  }, [engine]);

  useEffect(() => { boot(); return () => engine.stop(); }, [boot, engine]);

  const switchCam = async (id: string) => {
    if (!id || id === engine.deviceId) return;
    try { await engine.startCamera(videoRef.current!, id); setCamId(engine.deviceId); }
    catch { /* keep the current camera */ }
  };

  const upload = (file: File, zone: ZoneId) => {
    const url = URL.createObjectURL(file);
    loadImage(url).then((img) => {
      const id = "custom-" + Date.now();
      imagesRef.current.set(id, img);
      setPresets((p) => [...p, { id, name: file.name.replace(/\.[^.]+$/, "").slice(0, 14) || "Custom", src: url, accent: "#06B6D4" }]);
      set("zones", { ...settingsRef.current.zones, [zone]: id });
    });
  };

  const anyZone = ZONE_IDS.some((z) => region.zones[z].active);
  const hint = !region.faceFound
    ? "Position your face in the frame"
    : anyZone
      ? null
      : region.handCount === 0
        ? "Cover a face zone with your hands — eyes, mouth or forehead"
        : "Keep covering to lock the overlay — both hands = full face";

  return (
    <div className="relative flex h-full flex-col items-center justify-center bg-ink bg-grid px-3">
      <Header active={ready} handCount={region.handCount} faceFound={region.faceFound} />

      {/* Video element stays mounted (hidden) so the camera can start during loading */}
      <video ref={videoRef} className="pointer-events-none absolute h-px w-px opacity-0" playsInline muted />

      <main className="relative mt-14 flex w-full max-w-5xl flex-1 items-center justify-center pb-24 pt-4">
        {error ? (
          <PermissionFallback kind={error} onRetry={boot} />
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: ready ? 1 : 0, scale: ready ? 1 : 0.97 }}
            transition={{ duration: 0.6 }}
            className="relative aspect-video max-h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-black"
            style={{ boxShadow: `0 0 60px ${settings.neon}33, 0 0 0 1px ${settings.neon}22` }}
          >
            {ready && (
              <FaceCanvasOverlay
                engine={engine}
                settingsRef={settingsRef}
                imagesRef={imagesRef}
                presets={presets}
              />
            )}

            {ready && (
              <ZoneHud
                zones={region.zones}
                faceFound={region.faceFound}
                handCount={region.handCount}
                cameras={cameras}
                cameraId={camId}
                onCamera={switchCam}
                debug={settings.debug}
                onDebug={() => set("debug", !settings.debug)}
              />
            )}

            {ready && hint && (
              <motion.p
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="glass absolute bottom-4 left-1/2 max-w-[70%] -translate-x-1/2 rounded-full px-4 py-1.5 text-center text-base text-white/85"
              >
                {hint}
              </motion.p>
            )}
          </motion.div>
        )}
      </main>

      <motion.button
        initial={{ scale: 0, rotate: -90 }} animate={{ scale: ready ? 1 : 0, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.2 }}
        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}
        onClick={() => setDrawer(true)} aria-label="Open controls"
        className="fixed bottom-6 right-5 z-30 grid h-12 w-12 place-items-center rounded-full bg-violet-neon text-white shadow-[0_0_28px_#8B5CF6aa]"
      >
        <SlidersHorizontal size={20} />
      </motion.button>

      <ControlsDrawer open={drawer} onClose={() => setDrawer(false)} presets={presets} settings={settings} set={set} onUpload={upload} />

      <div className="fixed bottom-5 left-1/2 z-20 -translate-x-1/2">
        <PythosxBadge audio={settings.audio} />
      </div>

      <AnimatePresence>{!ready && !error && <LoadingScreen stages={STAGES} current={stage} />}</AnimatePresence>
    </div>
  );
}
