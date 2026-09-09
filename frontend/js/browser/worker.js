let engine;

async function loadOpenCV() {
  importScripts("https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js");
  const candidate = self.cv;
  if (candidate?.Mat) return { ...candidate, then: undefined };
  return new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error("Não foi possível carregar o detector de formas.")), 60000);
    if (typeof candidate?.then === "function") candidate.then(ready => { clearTimeout(deadline); resolve({ ...ready, then: undefined }); });
    else {
      candidate.onRuntimeInitialized = () => { clearTimeout(deadline); resolve(candidate); };
      candidate.onAbort = () => { clearTimeout(deadline); reject(new Error("Falha ao iniciar o detector de formas.")); };
    }
  });
}

async function initialize() {
  const base = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18";
  postMessage({ type: "progress", message: "Carregando detectores. A primeira abertura precisa de internet…" });
  const [vision, cv, handModule, faceModule, shapesModule, timelineModule] = await Promise.all([
    import(base + "/vision_bundle.mjs"), loadOpenCV(), import("./hands.js"), import("./face.js"), import("./shapes.js"), import("./timeline.js")
  ]);
  const files = await vision.FilesetResolver.forVisionTasks(base + "/wasm");
  postMessage({ type: "progress", message: "Carregando modelos de mãos e rosto…" });
  const hands = await vision.HandLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate: "CPU" },
    runningMode: "VIDEO", numHands: 2, minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5
  });
  const face = await vision.FaceLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "CPU" },
    runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
    minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5
  });
  engine = { hands, face, shapes: new shapesModule.ShapeDetector(cv), timeline: new timelineModule.Timeline(), handModule, faceModule, canvas: new OffscreenCanvas(640,480), lastTimestamp: -1 };
  engine.context = engine.canvas.getContext("2d", { willReadFrequently: true });
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === "init") { await initialize(); postMessage({ id: data.id, data: { pronto: true } }); return; }
    if (!engine) throw new Error("Os detectores ainda estão carregando.");
    const started = performance.now(), image = data.image;
    if (engine.canvas.width !== image.width || engine.canvas.height !== image.height) { engine.canvas.width=image.width; engine.canvas.height=image.height; }
    engine.context.putImageData(image,0,0);
    const timestamp = Math.max(data.timestamp, engine.lastTimestamp + 1);
    engine.lastTimestamp = timestamp;
    const hands = engine.handModule.analyzeHands(engine.hands.detectForVideo(engine.canvas,timestamp),image.width,image.height);
    const face = engine.faceModule.analyzeFace(engine.face.detectForVideo(engine.canvas,timestamp),image.width,image.height,engine.timeline,timestamp/1000);
    const exclusions = hands.map(h => h.pontos);
    if (face.presente) exclusions.push(face.pontos);
    const shapes = engine.shapes.detect(image,exclusions);
    postMessage({ id: data.id, data: {
      rosto: face, maos: hands, quantidade_maos: hands.length, formas: shapes,
      gestos_duas_maos: engine.handModule.bimanual(hands,image.width,image.height),
      processamento_ms: performance.now()-started, qualidade: { score: face.presente ? face.metricas.qualidade : 1, avisos: [] }
    } });
  } catch (error) { postMessage({ id: data.id, error: error.message || "Falha no processamento da imagem." }); }
};
