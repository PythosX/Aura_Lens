import { FilesetResolver, FaceLandmarker, HandLandmarker } from "@mediapipe/tasks-vision";
import pkg from "../../package.json";

export type Lm = { x: number; y: number; z: number };

/** Keep the CDN wasm pinned to the installed package version. */
const VISION_VER =
  String((pkg.dependencies as Record<string, string>)["@mediapipe/tasks-vision"] ?? "").replace(/^[\^~]/, "") ||
  "0.10.14";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VER}/wasm`;
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export type CameraError = "denied" | "none" | "busy" | "unknown";

/**
 * Owns the camera stream + the MediaPipe pipelines (Face Landmarker for the
 * 478-point face mesh, Hand Landmarker for up to two hands). Each boot step is
 * its own method so the app can run them one after another.
 */
export class TrackerEngine {
  video: HTMLVideoElement | null = null;
  hands: Lm[][] = [];        // latest hand landmarks (21 points per hand)
  face: Lm[] | null = null;  // latest face mesh (478 points), null when no face
  deviceId = "";             // active camera input ("" = default)

  private vision: any = null;
  private faceLm: FaceLandmarker | null = null;
  private handLm: HandLandmarker | null = null;
  private stream: MediaStream | null = null;
  private running = false;
  private lastTs = 0;

  /** Step 1: fetch the MediaPipe vision wasm runtime. */
  async loadRuntime() {
    this.vision = await FilesetResolver.forVisionTasks(WASM);
  }

  /** Step 2: build both landmarker models and download their weights. */
  async initModel() {
    const withFallback = async <T>(create: (delegate: "GPU" | "CPU") => Promise<T>): Promise<T> => {
      try { return await create("GPU"); } catch { return await create("CPU"); }
    };

    this.faceLm = await withFallback((delegate) =>
      FaceLandmarker.createFromOptions(this.vision, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate },
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
    );

    this.handLm = await withFallback((delegate) =>
      HandLandmarker.createFromOptions(this.vision, {
        baseOptions: { modelAssetPath: HAND_MODEL, delegate },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
    );
  }

  /** Step 3: open the webcam (optionally a specific device). Throws a CameraError string on failure. */
  async startCamera(video: HTMLVideoElement, deviceId?: string) {
    this.video = video;
    if (!navigator.mediaDevices?.getUserMedia) throw "none" as CameraError;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
    } catch (e: any) {
      const n = e?.name;
      if (n === "NotAllowedError" || n === "SecurityError") throw "denied" as CameraError;
      if (n === "NotFoundError" || n === "OverconstrainedError") throw "none" as CameraError;
      if (n === "NotReadableError") throw "busy" as CameraError;
      throw "unknown" as CameraError;
    }

    // Only release the previous camera once the new one is open (safe to switch).
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = stream;
    this.deviceId = stream.getVideoTracks()[0]?.getSettings?.().deviceId ?? deviceId ?? "";

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
  }

  /** List available video inputs (call after permission so labels are populated). */
  async listCameras(): Promise<MediaDeviceInfo[]> {
    try {
      return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
    } catch { return []; }
  }

  /**
   * Step 4: detection loop for both pipelines. Runs independently of rendering,
   * awaiting each frame, so slow inference never blocks the 60 FPS draw loop.
   */
  startDetection() {
    if (this.running || !this.video) return;
    this.running = true;
    let lastTime = -1;
    const tick = async () => {
      if (!this.running) return;
      const v = this.video!;
      if (v.readyState >= 2 && v.currentTime !== lastTime && this.faceLm && this.handLm) {
        lastTime = v.currentTime;
        // VIDEO mode requires strictly increasing, monotonic timestamps.
        const now = performance.now();
        const ts = now > this.lastTs + 1 ? now : this.lastTs + 1;
        this.lastTs = ts;
        try {
          const f = this.faceLm.detectForVideo(v, ts);
          this.face = f.faceLandmarks?.[0]?.length ? f.faceLandmarks[0] : null;
        } catch { /* keep last face for this frame */ }
        try {
          const h = this.handLm.detectForVideo(v, ts);
          this.hands = h.landmarks?.length ? h.landmarks : [];
        } catch { /* keep last hands for this frame */ }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.face = null;
    this.hands = [];
    this.faceLm?.close?.();
    this.handLm?.close?.();
    this.faceLm = null;
    this.handLm = null;
  }
}
