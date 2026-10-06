export type Lm = { x: number; y: number; z: number };

const CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/";

function loadScript(src: string) {
  return new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.crossOrigin = "anonymous";
    s.onload = () => res();
    s.onerror = () => rej(new Error("Could not load " + src));
    document.head.appendChild(s);
  });
}

export type CameraError = "denied" | "none" | "busy" | "unknown";

/**
 * Owns the camera stream + MediaPipe model. Each step is its own method so the
 * app can run them one after another instead of all at once.
 */
export class TrackerEngine {
  video: HTMLVideoElement | null = null;
  latest: Lm[][] = [];
  private Ctor: any = null;
  private hands: any = null;
  private stream: MediaStream | null = null;
  private running = false;

  /** Step 1: load the MediaPipe runtime (npm package, CDN script as fallback). */
  async loadRuntime() {
    let H: any = null;
    try {
      const mod: any = await import("@mediapipe/hands");
      H = mod.Hands ?? mod.default?.Hands;
    } catch { /* fall through to CDN */ }
    if (!H) {
      await loadScript(CDN + "hands.js");
      H = (window as any).Hands;
    }
    if (!H) throw new Error("MediaPipe Hands runtime unavailable");
    this.Ctor = H;
  }

  /** Step 2: build the model and download its weights/WASM. */
  async initModel() {
    this.hands = new this.Ctor({ locateFile: (f: string) => CDN + f });
    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
      selfieMode: false,
    });
    this.hands.onResults((r: any) => { this.latest = r.multiHandLandmarks ?? []; });
    await this.hands.initialize();
  }

  /** Step 3: open the webcam. Throws a CameraError string on failure. */
  async startCamera(video: HTMLVideoElement) {
    this.video = video;
    if (!navigator.mediaDevices?.getUserMedia) throw "none" as CameraError;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
    } catch (e: any) {
      const n = e?.name;
      if (n === "NotAllowedError" || n === "SecurityError") throw "denied" as CameraError;
      if (n === "NotFoundError" || n === "OverconstrainedError") throw "none" as CameraError;
      if (n === "NotReadableError") throw "busy" as CameraError;
      throw "unknown" as CameraError;
    }
    video.srcObject = this.stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
  }

  /**
   * Step 4: detection loop. Runs independently of rendering, awaiting each
   * frame, so a slow inference never blocks the 60 FPS draw loop.
   */
  startDetection() {
    if (this.running || !this.video) return;
    this.running = true;
    let lastTime = -1;
    const tick = async () => {
      if (!this.running) return;
      const v = this.video!;
      if (v.readyState >= 2 && v.currentTime !== lastTime) {
        lastTime = v.currentTime;
        try { await this.hands.send({ image: v }); } catch { /* skip frame */ }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.hands?.close?.();
  }
}
