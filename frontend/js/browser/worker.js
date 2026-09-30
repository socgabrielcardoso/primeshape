let engine;

const clampByte = value => Math.max(0, Math.min(255, Math.round(value)));
const luma = (r,g,b) => 0.2126*r + 0.7152*g + 0.0722*b;

function percentile(histogram, samples, ratio) {
  const target = samples * ratio;
  let seen = 0;
  for (let value=0; value<histogram.length; value++) {
    seen += histogram[value];
    if (seen >= target) return value;
  }
  return 255;
}

function lightingStats(image) {
  const histogram = new Uint32Array(256);
  const data = image.data;
  let samples = 0;
  for (let i=0; i<data.length; i+=48) {
    histogram[Math.max(0,Math.min(255,Math.round(luma(data[i],data[i+1],data[i+2]))))]++;
    samples++;
  }
  const p05=percentile(histogram,samples,0.05);
  const p10=percentile(histogram,samples,0.10);
  const p50=percentile(histogram,samples,0.50);
  const p90=percentile(histogram,samples,0.90);
  const p95=percentile(histogram,samples,0.95);
  return { p05,p10,p50,p90,p95,dynamic:p95-p05 };
}

function shouldCompensate(stats) {
  const lowLight = stats.p50 < 105 || stats.p90 < 165;
  const deepShadows = stats.p10 < 58 && stats.p90 > 145;
  const flatScene = stats.dynamic < 78;
  return lowLight || deepShadows || flatScene;
}

function compensateForHands(image) {
  const stats=lightingStats(image);
  if (!shouldCompensate(stats)) {
    engine.handLight={ ...stats,compensated:false };
    return engine.canvas;
  }
  if (engine.handCanvas.width!==image.width || engine.handCanvas.height!==image.height) {
    engine.handCanvas.width=image.width;
    engine.handCanvas.height=image.height;
  }
  const source=image.data,output=new Uint8ClampedArray(source);
  const black=Math.max(0,stats.p05-10);
  const white=Math.min(255,Math.max(black+86,stats.p95+18));
  const range=Math.max(86,white-black);
  const gamma=stats.p50<60?0.60:stats.p50<90?0.70:stats.p10<50?0.78:0.86;
  const shadowBias=stats.p10<48 && stats.p90>165?0.18:0.08;
  for (let i=0;i<source.length;i+=4) {
    const y=luma(source[i],source[i+1],source[i+2]);
    const normalized=Math.max(0,Math.min(1,(y-black)/range));
    let mapped=255*Math.pow(normalized,gamma);
    if (y<105) mapped+=((105-y)/105)*255*shadowBias;
    mapped=0.82*mapped+0.18*y;
    const gain=Math.max(0.78,Math.min(2.35,mapped/Math.max(y,8)));
    output[i]=clampByte(source[i]*gain);
    output[i+1]=clampByte(source[i+1]*gain);
    output[i+2]=clampByte(source[i+2]*gain);
  }
  engine.handContext.putImageData(new ImageData(output,image.width,image.height),0,0);
  engine.handLight={ ...stats,compensated:true };
  return engine.handCanvas;
}

async function loadOpenCV() {
  importScripts("https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js");
  const candidate=self.cv;
  if (candidate?.Mat) return { ...candidate,then:undefined };
  return new Promise((resolve,reject)=>{
    const deadline=setTimeout(()=>reject(new Error("Não foi possível carregar o detector de objetos.")),60000);
    const ready=value=>{ clearTimeout(deadline);resolve({ ...value,then:undefined }); };
    if (typeof candidate?.then==="function") candidate.then(ready);
    else candidate.onRuntimeInitialized=()=>ready(candidate);
  });
}

function preferredDelegate() {
  const canvas=new OffscreenCanvas(1,1),gl=canvas.getContext("webgl2");
  if (!gl) return "CPU";
  const info=gl.getExtension("WEBGL_debug_renderer_info");
  const renderer=String(gl.getParameter(info?info.UNMASKED_RENDERER_WEBGL:gl.RENDERER));
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return /swiftshader|llvmpipe|software|basic render/i.test(renderer)?"CPU":"GPU";
}

async function createTask(type,options) {
  let delegate=engine.delegate;
  const create=mode=>type.createFromOptions(engine.files,{ ...options,baseOptions:{ ...options.baseOptions,delegate:mode } });
  let instance;
  try { instance=await create(delegate); }
  catch (error) { if (delegate==="CPU") throw error;delegate="CPU";instance=await create(delegate); }
  return { instance,delegate,create };
}

async function detect(task,canvas,timestamp) {
  try { return task.instance.detectForVideo(canvas,timestamp); }
  catch (error) {
    if (task.delegate!=="GPU") throw error;
    try { task.instance.close(); } catch {}
    task.delegate="CPU";
    task.instance=await task.create("CPU");
    return task.instance.detectForVideo(canvas,timestamp);
  }
}

async function initialize() {
  const base="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18";
  postMessage({ type:"progress",message:"Carregando mãos e expressões…" });
  const [vision,handModule,faceModule,timelineModule,trackingModule]=await Promise.all([
    import(base+"/vision_bundle.mjs"),import("./hands.js"),import("./face.js"),import("./timeline.js"),import("./hand-tracking.js")
  ]);
  engine={
    files:await vision.FilesetResolver.forVisionTasks(base+"/wasm"),
    delegate:preferredDelegate(),
    handModule,
    faceModule,
    timeline:new timelineModule.Timeline(),
    handTracker:new trackingModule.HandTracker(),
    canvas:new OffscreenCanvas(640,480),
    handCanvas:new OffscreenCanvas(640,480),
    lastTimestamp:-1,
    lastFaceAt:-Infinity,
    lastShapesAt:-Infinity,
    handMs:25,
    shapes:null,
    objectsFailed:false,
    warning:"",
    handLight:null
  };
  engine.context=engine.canvas.getContext("2d");
  engine.handContext=engine.handCanvas.getContext("2d");
  engine.hands=await createTask(vision.HandLandmarker,{
    baseOptions:{ modelAssetPath:"https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" },
    runningMode:"VIDEO",numHands:2,minHandDetectionConfidence:0.38,minHandPresenceConfidence:0.40,minTrackingConfidence:0.45
  });
  try {
    engine.face=await createTask(vision.FaceLandmarker,{
      baseOptions:{ modelAssetPath:"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" },
      runningMode:"VIDEO",numFaces:1,outputFaceBlendshapes:true,outputFacialTransformationMatrixes:true,
      minFaceDetectionConfidence:0.5,minFacePresenceConfidence:0.5,minTrackingConfidence:0.5
    });
  } catch { engine.warning="Análise facial indisponível. As mãos continuam ativas."; }
  engine.faceResult=faceModule.analyzeFace(null,640,480,engine.timeline,0);
}

self.onmessage=async ({data})=>{
  try {
    if (data.type==="init") { await initialize();postMessage({ id:data.id,data:{ pronto:true } });return; }
    if (!engine) throw new Error("Os detectores ainda estão carregando.");
    const started=performance.now(),image=data.image;
    if (engine.canvas.width!==image.width || engine.canvas.height!==image.height) {
      engine.canvas.width=image.width;
      engine.canvas.height=image.height;
    }
    engine.context.putImageData(image,0,0);
    const timestamp=Math.max(data.timestamp,engine.lastTimestamp+1);
    engine.lastTimestamp=timestamp;
    const handInput=compensateForHands(image);
    const rawHands=await detect(engine.hands,handInput,timestamp);
    const stableHands=engine.handTracker.update(rawHands,timestamp);
    const hands=engine.handModule.analyzeHands(stableHands,image.width,image.height);
    engine.handMs=0.8*engine.handMs+0.2*(performance.now()-started);
    if (engine.face && timestamp-engine.lastFaceAt>=Math.max(200,Math.min(450,engine.handMs*3))) {
      try {
        const raw=await detect(engine.face,engine.canvas,timestamp);
        engine.faceResult=engine.faceModule.analyzeFace(raw,image.width,image.height,engine.timeline,timestamp/1000);
      } catch {
        try { engine.face.instance.close(); } catch {}
        engine.face=null;
        engine.faceResult=engine.faceModule.analyzeFace(null,image.width,image.height,engine.timeline,timestamp/1000);
        engine.warning="Análise facial interrompida. As mãos continuam ativas; reinicie para tentar novamente.";
      }
      engine.lastFaceAt=timestamp;
    }
    let shapes=[];
    if (data.objects && !engine.objectsFailed) {
      if (!engine.shapes) {
        postMessage({ type:"progress",message:"Carregando o detector opcional de formas em objetos…" });
        try {
          const [cv,{ShapeDetector}]=await Promise.all([loadOpenCV(),import("./shapes.js")]);
          engine.shapes=new ShapeDetector(cv);
        } catch { engine.objectsFailed=true;engine.warning="Detector de objetos indisponível. As formas com as mãos continuam ativas."; }
      }
      if (engine.shapes && timestamp-engine.lastShapesAt>=500) {
        const exclusions=hands.map(h=>h.pontos);
        if (engine.faceResult.presente) exclusions.push(engine.faceResult.pontos);
        try { shapes=engine.shapes.detect(image,exclusions); }
        catch { engine.objectsFailed=true;engine.warning="Detector de objetos interrompido. As mãos continuam ativas."; }
        engine.cachedShapes=shapes;
        engine.lastShapesAt=timestamp;
      }
      shapes=timestamp-engine.lastShapesAt<800?engine.cachedShapes||[]:[];
    } else { engine.cachedShapes=[];engine.lastShapesAt=-Infinity; }
    const face=engine.faceResult;
    const warnings=[];
    if (engine.warning) warnings.push(engine.warning);
    if (engine.handLight?.compensated && engine.handLight.p50<58) warnings.push("Baixa luz: compensação adaptativa ativa para as mãos.");
    else if (engine.handLight?.compensated && engine.handLight.p10<42 && engine.handLight.p90>170) warnings.push("Sombras fortes: contraste adaptativo ativo para as mãos.");
    postMessage({ id:data.id,data:{
      rosto:{ ...face,numero_pontos:face.pontos.length,pontos:[] },maos:hands,quantidade_maos:hands.length,quantidade_maos_detectadas:stableHands.detectedCount,formas:shapes,gestos_duas_maos:[],
      processamento_ms:performance.now()-started,intervalo_sugerido_ms:Math.max(65,Math.min(190,engine.handMs*1.25)),
      qualidade:{ score:face.presente?face.metricas.qualidade:1,avisos:warnings },
      iluminacao_maos:engine.handLight
    } });
  } catch (error) { postMessage({ id:data.id,error:error.message||"Falha no processamento da imagem." }); }
};
