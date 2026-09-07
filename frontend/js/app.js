import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs";

const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const HAND_MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const TIP_INDEXES = [4, 8];

const elements = {
  video: document.querySelector("#camera"),
  canvas: document.querySelector("#visionCanvas"),
  startButton: document.querySelector("#startButton"),
  shapeName: document.querySelector("#shapeName"),
  eyeState: document.querySelector("#eyeState")
};

const context = elements.canvas.getContext("2d", { alpha: false });

let handLandmarker = null;
let faceLandmarker = null;
let mediaStream = null;
let cameraReady = false;
let modelsReady = false;
let lastInferenceAt = 0;
let lastVideoTime = -1;
let smoothedHands = [];
let currentShape = null;

const shapeTracker = {
  candidate: "",
  count: 0,
  stable: "NENHUMA",
  lastSeenAt: 0
};

const eyeTracker = {
  closedAt: null,
  blinkUntil: 0,
  lastFaceAt: 0,
  leftScore: 0,
  rightScore: 0
};

function setRuntime(text, state) {
  document.body.dataset.runtime = text;
  document.body.dataset.state = state;
}

function createHandOptions(delegate) {
  const baseOptions = { modelAssetPath: HAND_MODEL };

  if (delegate) {
    baseOptions.delegate = delegate;
  }

  return {
    baseOptions,
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.55,
    minHandPresenceConfidence: 0.55,
    minTrackingConfidence: 0.55
  };
}

function createFaceOptions(delegate) {
  const baseOptions = { modelAssetPath: FACE_MODEL };

  if (delegate) {
    baseOptions.delegate = delegate;
  }

  return {
    baseOptions,
    runningMode: "VIDEO",
    numFaces: 1,
    minFaceDetectionConfidence: 0.55,
    minFacePresenceConfidence: 0.55,
    minTrackingConfidence: 0.55,
    outputFaceBlendshapes: true
  };
}

async function createHandDetector(vision) {
  try {
    return await HandLandmarker.createFromOptions(vision, createHandOptions("GPU"));
  } catch {
    return HandLandmarker.createFromOptions(vision, createHandOptions());
  }
}

async function createFaceDetector(vision) {
  try {
    return await FaceLandmarker.createFromOptions(vision, createFaceOptions("GPU"));
  } catch {
    return FaceLandmarker.createFromOptions(vision, createFaceOptions());
  }
}

async function loadModels() {
  setRuntime("MODELOS", "loading");
  elements.startButton.disabled = true;
  elements.startButton.textContent = "CARREGANDO";

  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  handLandmarker = await createHandDetector(vision);
  faceLandmarker = await createFaceDetector(vision);
  modelsReady = true;

  setRuntime("PRONTO", "ready");
  elements.startButton.disabled = false;
  elements.startButton.textContent = "INICIAR";
}

async function startCamera() {
  if (!modelsReady || cameraReady) {
    return;
  }

  elements.startButton.disabled = true;
  elements.startButton.textContent = "CÂMERA";
  setRuntime("CÂMERA", "loading");

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user"
      },
      audio: false
    });

    elements.video.srcObject = mediaStream;
    await elements.video.play();
    resizeCanvas();
    cameraReady = true;
    elements.startButton.classList.add("is-hidden");
    setRuntime("ATIVO", "ready");
  } catch {
    elements.startButton.disabled = false;
    elements.startButton.textContent = "TENTAR";
    setRuntime("NEGADO", "error");
  }
}

function resizeCanvas() {
  const width = elements.video.videoWidth || 1280;
  const height = elements.video.videoHeight || 720;

  if (elements.canvas.width !== width || elements.canvas.height !== height) {
    elements.canvas.width = width;
    elements.canvas.height = height;
  }
}

function visualPoint(point) {
  return {
    x: 1 - point.x,
    y: point.y,
    z: point.z || 0
  };
}

function canvasPoint(point) {
  const visual = visualPoint(point);

  return {
    x: visual.x * elements.canvas.width,
    y: visual.y * elements.canvas.height
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function averagePoint(points) {
  const total = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 }
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length
  };
}

function palmCenter(hand) {
  return averagePoint([0, 5, 9, 13, 17].map(index => visualPoint(hand[index])));
}

function smoothDetectedHands(landmarks) {
  const orderedHands = landmarks
    .map(hand => hand.map(point => ({ x: point.x, y: point.y, z: point.z || 0 })))
    .sort((first, second) => palmCenter(first).x - palmCenter(second).x);

  if (orderedHands.length !== smoothedHands.length) {
    smoothedHands = orderedHands;
    return smoothedHands;
  }

  smoothedHands = orderedHands.map((hand, handIndex) =>
    hand.map((point, pointIndex) => {
      const previous = smoothedHands[handIndex][pointIndex];
      const weight = 0.58;

      return {
        x: previous.x + (point.x - previous.x) * weight,
        y: previous.y + (point.y - previous.y) * weight,
        z: previous.z + (point.z - previous.z) * weight
      };
    })
  );

  return smoothedHands;
}

function describeHand(hand) {
  const index = visualPoint(hand[8]);
  const thumb = visualPoint(hand[4]);
  const topIsIndex = index.y <= thumb.y;

  return {
    hand,
    index,
    thumb,
    top: topIsIndex ? index : thumb,
    bottom: topIsIndex ? thumb : index,
    center: palmCenter(hand),
    palmWidth: distance(visualPoint(hand[5]), visualPoint(hand[17])),
    fingerSpan: distance(index, thumb)
  };
}

function boundsOf(points) {
  const xValues = points.map(point => point.x);
  const yValues = points.map(point => point.y);
  const left = Math.min(...xValues);
  const right = Math.max(...xValues);
  const top = Math.min(...yValues);
  const bottom = Math.max(...yValues);

  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
    center: {
      x: (left + right) / 2,
      y: (top + bottom) / 2
    }
  };
}

function sortClockwise(points) {
  const center = averagePoint(points);

  return [...points].sort(
    (first, second) =>
      Math.atan2(first.y - center.y, first.x - center.x) -
      Math.atan2(second.y - center.y, second.x - center.x)
  );
}

function vertexAngle(previous, current, next) {
  const first = {
    x: previous.x - current.x,
    y: previous.y - current.y
  };
  const second = {
    x: next.x - current.x,
    y: next.y - current.y
  };
  const dot = first.x * second.x + first.y * second.y;
  const magnitude = Math.hypot(first.x, first.y) * Math.hypot(second.x, second.y);
  const cosine = Math.max(-1, Math.min(1, dot / magnitude));

  return Math.acos(cosine) * 180 / Math.PI;
}

function lineDirection(first, second) {
  return Math.atan2(second.y - first.y, second.x - first.x);
}

function parallelDifference(first, second) {
  let difference = Math.abs(first - second) % Math.PI;

  if (difference > Math.PI / 2) {
    difference = Math.PI - difference;
  }

  return difference * 180 / Math.PI;
}

function classifyQuadrilateral(points) {
  const ordered = sortClockwise(points);
  const sides = ordered.map((point, index) =>
    distance(point, ordered[(index + 1) % ordered.length])
  );
  const angles = ordered.map((point, index) =>
    vertexAngle(
      ordered[(index + ordered.length - 1) % ordered.length],
      point,
      ordered[(index + 1) % ordered.length]
    )
  );
  const longestSide = Math.max(...sides);
  const shortestSide = Math.max(Math.min(...sides), 0.0001);
  const sideRatio = longestSide / shortestSide;
  const averageAngleError = angles.reduce((sum, angle) => sum + Math.abs(90 - angle), 0) / 4;
  const oppositeBalance = Math.max(
    sides[0] / Math.max(sides[2], 0.0001),
    sides[2] / Math.max(sides[0], 0.0001),
    sides[1] / Math.max(sides[3], 0.0001),
    sides[3] / Math.max(sides[1], 0.0001)
  );
  const firstParallel = parallelDifference(
    lineDirection(ordered[0], ordered[1]),
    lineDirection(ordered[2], ordered[3])
  );
  const secondParallel = parallelDifference(
    lineDirection(ordered[1], ordered[2]),
    lineDirection(ordered[3], ordered[0])
  );

  if (averageAngleError < 18 && sideRatio < 1.28) {
    return { label: "QUADRADO", points: ordered };
  }

  if (averageAngleError < 22 && oppositeBalance < 1.38) {
    return { label: "RETÂNGULO", points: ordered };
  }

  if (sideRatio < 1.34) {
    return { label: "LOSANGO", points: ordered };
  }

  if ((firstParallel < 18) !== (secondParallel < 18)) {
    return { label: "TRAPÉZIO", points: ordered };
  }

  return { label: "QUADRILÁTERO", points: ordered };
}

function createEllipseShape(hands) {
  const arcIndexes = [8, 7, 6, 5, 2, 3, 4];
  const arcPoints = hands.flatMap(hand => arcIndexes.map(index => visualPoint(hand[index])));
  const bounds = boundsOf(arcPoints);
  const width = bounds.width * 1.06;
  const height = bounds.height * 1.08;
  const aspect = width / Math.max(height, 0.0001);
  const label = aspect >= 0.78 && aspect <= 1.28 ? "CÍRCULO" : "OVAL";

  return {
    label,
    kind: "ellipse",
    center: bounds.center,
    radiusX: width / 2,
    radiusY: height / 2
  };
}

function classifyOneHandShape(hand) {
  const description = describeHand(hand);
  const pinchRatio = distance(description.index, description.thumb) / Math.max(description.palmWidth, 0.0001);

  if (pinchRatio > 0.38) {
    return null;
  }

  return createEllipseShape([hand]);
}

function classifyTwoHandShape(hands) {
  const descriptions = hands.map(describeHand).sort((first, second) => first.center.x - second.center.x);
  const left = descriptions[0];
  const right = descriptions[1];
  const bridge = distance(left.center, right.center);
  const palmScale = Math.max(left.palmWidth, right.palmWidth, 0.0001);

  if (bridge < Math.max(0.11, palmScale * 1.05)) {
    return null;
  }

  if (left.fingerSpan < left.palmWidth * 0.62 || right.fingerSpan < right.palmWidth * 0.62) {
    return null;
  }

  const topRatio = distance(left.top, right.top) / bridge;
  const bottomRatio = distance(left.bottom, right.bottom) / bridge;
  const topNear = topRatio < 0.48;
  const bottomNear = bottomRatio < 0.48;
  const topFar = topRatio > 0.66;
  const bottomFar = bottomRatio > 0.66;

  if (topNear && bottomNear) {
    return createEllipseShape(hands);
  }

  if (bottomNear && topFar) {
    return {
      label: "TRIÂNGULO",
      kind: "polygon",
      points: sortClockwise([
        left.top,
        right.top,
        averagePoint([left.bottom, right.bottom])
      ])
    };
  }

  if (topNear && bottomFar) {
    return {
      label: "TRIÂNGULO",
      kind: "polygon",
      points: sortClockwise([
        averagePoint([left.top, right.top]),
        right.bottom,
        left.bottom
      ])
    };
  }

  const quadrilateral = classifyQuadrilateral([
    left.top,
    right.top,
    right.bottom,
    left.bottom
  ]);

  return {
    ...quadrilateral,
    kind: "polygon"
  };
}

function classifyShape(hands) {
  if (hands.length === 1) {
    return classifyOneHandShape(hands[0]);
  }

  if (hands.length >= 2) {
    return classifyTwoHandShape(hands.slice(0, 2));
  }

  return null;
}

function stabilizeShape(observation, now) {
  if (observation) {
    shapeTracker.lastSeenAt = now;

    if (shapeTracker.candidate === observation.label) {
      shapeTracker.count += 1;
    } else {
      shapeTracker.candidate = observation.label;
      shapeTracker.count = 1;
    }

    if (shapeTracker.count >= 3) {
      shapeTracker.stable = observation.label;
    }
  } else if (now - shapeTracker.lastSeenAt > 450) {
    shapeTracker.candidate = "";
    shapeTracker.count = 0;
    shapeTracker.stable = "NENHUMA";
  }

  elements.shapeName.textContent = shapeTracker.stable;
}

function categoryScore(categories, name) {
  const category = categories.find(item => item.categoryName === name);
  return category ? category.score : 0;
}

function setEyeOutput(state) {
  elements.eyeState.textContent = state;
  elements.eyeState.style.color = state === "DORMINDO" ? "#c62828" : "#111";
}

function updateEyeState(faceResult, now) {
  const face = faceResult.faceLandmarks?.[0];
  const categories = faceResult.faceBlendshapes?.[0]?.categories;

  if (!face || !categories) {
    if (now - eyeTracker.lastFaceAt > 500) {
      eyeTracker.closedAt = null;
      setEyeOutput("AUSENTE");
    }
    return;
  }

  eyeTracker.lastFaceAt = now;

  const rawLeft = categoryScore(categories, "eyeBlinkLeft");
  const rawRight = categoryScore(categories, "eyeBlinkRight");
  eyeTracker.leftScore += (rawLeft - eyeTracker.leftScore) * 0.5;
  eyeTracker.rightScore += (rawRight - eyeTracker.rightScore) * 0.5;

  const bothClosed = eyeTracker.leftScore > 0.48 && eyeTracker.rightScore > 0.48;
  const oneClosed = Math.max(eyeTracker.leftScore, eyeTracker.rightScore) > 0.68;

  if (bothClosed) {
    if (eyeTracker.closedAt === null) {
      eyeTracker.closedAt = now;
    }

    const closedDuration = now - eyeTracker.closedAt;
    setEyeOutput(closedDuration >= 1100 ? "DORMINDO" : "PISCANDO");
    return;
  }

  if (eyeTracker.closedAt !== null) {
    const closedDuration = now - eyeTracker.closedAt;

    if (closedDuration >= 70 && closedDuration < 900) {
      eyeTracker.blinkUntil = now + 430;
    }

    eyeTracker.closedAt = null;
  }

  if (oneClosed) {
    setEyeOutput("PISCANDO");
  } else if (now < eyeTracker.blinkUntil) {
    setEyeOutput("PISCOU");
  } else {
    setEyeOutput("ACORDADO");
  }
}

function drawCameraFrame() {
  const width = elements.canvas.width;
  const height = elements.canvas.height;

  context.save();
  context.translate(width, 0);
  context.scale(-1, 1);
  context.drawImage(elements.video, 0, 0, width, height);
  context.restore();
}

function createShapePath(shape) {
  const path = new Path2D();

  if (shape.kind === "ellipse") {
    path.ellipse(
      shape.center.x * elements.canvas.width,
      shape.center.y * elements.canvas.height,
      shape.radiusX * elements.canvas.width,
      shape.radiusY * elements.canvas.height,
      0,
      0,
      Math.PI * 2
    );
    return path;
  }

  const points = shape.points.map(point => ({
    x: point.x * elements.canvas.width,
    y: point.y * elements.canvas.height
  }));

  path.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach(point => path.lineTo(point.x, point.y));
  path.closePath();
  return path;
}

function drawShapeOverlay(shape) {
  const path = createShapePath(shape);

  context.save();
  context.fillStyle = "rgba(255, 255, 255, 0.1)";
  context.fill(path);
  context.lineWidth = Math.max(3, elements.canvas.width * 0.003);
  context.strokeStyle = "rgba(255, 255, 255, 0.95)";
  context.shadowColor = "rgba(0, 0, 0, 0.5)";
  context.shadowBlur = 5;
  context.stroke(path);
  context.restore();
}

function drawHands(hands) {
  context.save();

  hands.forEach(hand => {
    TIP_INDEXES.forEach(index => {
      const point = canvasPoint(hand[index]);
      context.beginPath();
      context.arc(point.x, point.y, 5, 0, Math.PI * 2);
      context.fillStyle = "#fff";
      context.fill();
      context.lineWidth = 2;
      context.strokeStyle = "rgba(0, 0, 0, 0.55)";
      context.stroke();
    });
  });

  context.restore();
}

function runInference(now) {
  if (!modelsReady || !cameraReady || elements.video.readyState < 2) {
    return;
  }

  if (now - lastInferenceAt < 58 || elements.video.currentTime === lastVideoTime) {
    return;
  }

  lastInferenceAt = now;
  lastVideoTime = elements.video.currentTime;

  const handResult = handLandmarker.detectForVideo(elements.video, now);
  const faceResult = faceLandmarker.detectForVideo(elements.video, now);
  const hands = smoothDetectedHands(handResult.landmarks || []);
  const observation = classifyShape(hands);

  currentShape = observation;
  stabilizeShape(observation, now);
  updateEyeState(faceResult, now);
}

function render(now) {
  if (cameraReady) {
    resizeCanvas();
    runInference(now);
    drawCameraFrame();

    if (currentShape) {
      drawShapeOverlay(currentShape);
    }

    drawHands(smoothedHands);
  } else {
    context.fillStyle = "#111";
    context.fillRect(0, 0, elements.canvas.width, elements.canvas.height);
  }

  requestAnimationFrame(render);
}

function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
  }
}

async function boot() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setRuntime("INCOMPATÍVEL", "error");
    elements.startButton.textContent = "INCOMPATÍVEL";
    elements.startButton.disabled = true;
    return;
  }

  try {
    await loadModels();
    await startCamera();
  } catch {
    setRuntime("ERRO", "error");
    elements.startButton.textContent = "RECARREGAR";
    elements.startButton.disabled = false;
  }
}

elements.startButton.addEventListener("click", async () => {
  if (!modelsReady) {
    window.location.reload();
    return;
  }

  await startCamera();
});

elements.video.addEventListener("loadedmetadata", resizeCanvas);
window.addEventListener("beforeunload", stopCamera);
window.addEventListener("resize", resizeCanvas);

requestAnimationFrame(render);
boot();
