let engine;

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
  const [vision,handModule,faceModule,timelineModule]=await Promise.all([
    import(base+"/vision_bundle.mjs"),import("./hands.js"),import("./face.js"),import("./timeline.js")
  ]);
  engine={ files:await vision.FilesetResolver.forVisionTasks(base+"/wasm"),delegate:preferredDelegate(),handModule,faceModule,timeline:new timelineModule.Timeline(),canvas:new OffscreenCanvas(480,360),lastTimestamp:-1,lastFaceAt:-Infinity,lastShapesAt:-Infinity,handMs:25,shapes:null,objectsFailed:false,warning:"" };
  engine.context=engine.canvas.getContext("2d");
  engine.hands=await createTask(vision.HandLandmarker,{
    baseOptions:{ modelAssetPath:"https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" },
    runningMode:"VIDEO",numHands:2,minHandDetectionConfidence:0.5,minHandPresenceConfidence:0.5,minTrackingConfidence:0.5
  });
  try {
    engine.face=await createTask(vision.FaceLandmarker,{
      baseOptions:{ modelAssetPath:"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" },
      runningMode:"VIDEO",numFaces:1,outputFaceBlendshapes:true,outputFacialTransformationMatrixes:true,
      minFaceDetectionConfidence:0.5,minFacePresenceConfidence:0.5,minTrackingConfidence:0.5
    });
  } catch { engine.warning="Análise facial indisponível. As mãos continuam ativas."; }
  engine.faceResult=faceModule.analyzeFace(null,480,360,engine.timeline,0);
}

self.onmessage=async ({data})=>{
  try {
    if (data.type==="init") { await initialize();postMessage({ id:data.id,data:{ pronto:true } });return; }
    if (!engine) throw new Error("Os detectores ainda estão carregando.");
    const started=performance.now(),image=data.image;
    if (engine.canvas.width!==image.width || engine.canvas.height!==image.height) { engine.canvas.width=image.width;engine.canvas.height=image.height; }
    engine.context.putImageData(image,0,0);
    const timestamp=Math.max(data.timestamp,engine.lastTimestamp+1);
    engine.lastTimestamp=timestamp;
    const hands=engine.handModule.analyzeHands(await detect(engine.hands,engine.canvas,timestamp),image.width,image.height);
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
    postMessage({ id:data.id,data:{
      rosto:{ ...face,numero_pontos:face.pontos.length,pontos:[] },maos:hands,quantidade_maos:hands.length,formas:shapes,gestos_duas_maos:[],
      processamento_ms:performance.now()-started,intervalo_sugerido_ms:Math.max(65,Math.min(180,engine.handMs*1.2)),
      qualidade:{ score:face.presente?face.metricas.qualidade:1,avisos:engine.warning?[engine.warning]:[] }
    } });
  } catch (error) { postMessage({ id:data.id,error:error.message||"Falha no processamento da imagem." }); }
};
