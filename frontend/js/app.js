import { VisionAPI } from "./api.js";
import { BrowserVision } from "./browser-api.js";
import { Camera } from "./camera.js";
import { Overlay } from "./overlay.js";
import { Presentation } from "./presentation.js";
import { HAND_SHAPES, HandShapeTracker } from "./hand-shapes.js";

const byId = id => document.getElementById(id);
let api = new BrowserVision(message => status("CARREGANDO DETECTORES", message));
const camera = new Camera(byId("camera"));
const overlay = new Overlay(byId("visionCanvas"), byId("camera"));
overlay.mirror = byId("mirrorToggle").checked;
overlay.showPoints = byId("pointsToggle").checked;
const presentation = new Presentation();
const handShapes = new HandShapeTracker();
let active = false;
let starting = false;
let controller = null;
let timer = null;
let result = null;
let capturedAt = 0;
let lastLatency = 0;
let generation = 0;
let staleCleared = false;
let lastVideoTime = -1;
const SETTINGS_KEY = "primeshape.ui.v1";
document.body.dataset.running = "false";

function loadPreferences() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  } catch {
    return {};
  }
}

function savePreferences() {
  const settings = {
    mirror: byId("mirrorToggle").checked,
    points: byId("pointsToggle").checked,
    objects: byId("objectsToggle").checked,
    fps: byId("fpsSelect").value
  };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

const preferences = loadPreferences();
if (typeof preferences.mirror === "boolean") byId("mirrorToggle").checked = preferences.mirror;
if (typeof preferences.points === "boolean") byId("pointsToggle").checked = preferences.points;
if (["5", "10", "15"].includes(String(preferences.fps))) byId("fpsSelect").value = String(preferences.fps);

for (const name of HAND_SHAPES) {
  const chip=document.createElement("span");
  chip.dataset.handShape=name;
  chip.textContent=name;
  byId("handShapeCatalog").append(chip);
}

function status(text, note) {
  byId("backendStatus").textContent = text;
  document.body.dataset.runtime = text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (note) byId("notice").textContent = note;
}

async function step(current) {
  if (!active || current !== generation) return;
  const engine = api;
  const started = performance.now();
  let delay = 1000 / Number(byId("fpsSelect").value);
  try {
    const signal = controller.signal;
    if (!engine.session) {
      status("CARREGANDO DETECTORES", engine.local ? "Preparando a detecção no navegador…" : "Conectando Python e Java…");
      await engine.connect(engine.local ? signal : AbortSignal.any([signal, AbortSignal.timeout(10000)]));
      if (!active || current !== generation) { await engine.close(); return; }
    }
    if (camera.video.currentTime===lastVideoTime) return;
    lastVideoTime=camera.video.currentTime;
    engine.objects=byId("objectsToggle").checked;
    const frame = engine.local ? camera.pixels(engine.objects?640:480) : await camera.capture();
    if (!frame) throw new Error("A câmera ainda não disponibilizou um quadro.");
    const captureTime = performance.now();
    const response = await engine.analyze(frame, AbortSignal.any([signal, AbortSignal.timeout(15000)]));
    if (!active || current !== generation) return;
    result = response;
    const tracked=handShapes.update(result.maos,camera.video.videoWidth,camera.video.videoHeight,performance.now());
    result.maos=tracked.hands;
    result.formas_maos=tracked.shapes;
    capturedAt = captureTime;
    staleCleared = false;
    const latency = performance.now() - captureTime;
    lastLatency = latency;
    delay=Math.max(delay,result.intervalo_sugerido_ms||0);
    presentation.update(result, latency, overlay.mirror);
    status(engine.local ? "DETECÇÃO NO NAVEGADOR" : "JAVA + PYTHON CONECTADOS", result.qualidade.avisos.join(" · ") || "Afaste os polegares e indicadores para formar os cantos. Expressões são estimativas.");
  } catch (error) {
    if (!active || current !== generation) return;
    result = null;
    presentation.clear("SEM ANÁLISE");
    if (engine.local) {
      stop(error.message);
      status("DETECÇÃO INTERROMPIDA", error.message);
    } else if (error.status === 429) {
      status("PROCESSAMENTO OCUPADO", error.message);
      delay = 500;
    } else {
      await engine.close();
      if (!active || current !== generation) return;
      status("BACKEND DESCONECTADO", error.status ? error.message : "Câmera disponível. Execute iniciar.bat; a conexão será tentada novamente.");
      delay = 2500;
    }
  } finally {
    if (active && current === generation) timer = setTimeout(() => step(current), Math.max(40, delay - (performance.now() - started)));
  }
}

async function start() {
  if (active || starting) return;
  starting = true;
  const current = ++generation;
  byId("startButton").disabled = true;
  byId("startButton").setAttribute("aria-busy", "true");
  byId("startButton").textContent = "ABRINDO CÂMERA";
  try {
    await camera.start();
    if (current !== generation) { camera.stop(); return; }
    active = true;
    document.body.dataset.running = "true";
    controller = new AbortController();
    byId("startArea").hidden = true;
    byId("stopButton").hidden = false;
    camera.stream.getVideoTracks()[0].addEventListener("ended", () => stop("Câmera desconectada."), { once: true });
    step(current);
  } catch (error) {
    camera.stop();
    const messages = { NotAllowedError: "Permita o acesso à câmera nas configurações do navegador.", NotFoundError: "Nenhuma câmera encontrada.", NotReadableError: "A câmera está ocupada por outro aplicativo." };
    status("CÂMERA INDISPONÍVEL", messages[error.name] || error.message);
  } finally {
    starting = false;
    byId("startButton").disabled = false;
    byId("startButton").setAttribute("aria-busy", "false");
    byId("startButton").textContent = "INICIAR CÂMERA";
  }
}

function stop(message = "Câmera encerrada. Nenhuma imagem foi gravada.") {
  active = false;
  document.body.dataset.running = "false";
  generation++;
  controller?.abort();
  clearTimeout(timer);
  camera.stop();
  api.close();
  result = null;
  handShapes.reset();
  lastVideoTime=-1;
  presentation.clear("PARADO");
  byId("startArea").hidden = false;
  byId("stopButton").hidden = true;
  status("PARADO", message);
}

function toggleDetails(open) {
  document.body.dataset.details = String(open);
  byId("detailPanel").hidden = !open;
  byId("detailsButton").setAttribute("aria-expanded", String(open));
  if (open) byId("closeDetails").focus();
  else byId("detailsButton").focus();
  if (open && isFresh(performance.now())) presentation.update(result,lastLatency,overlay.mirror,true);
}

function isFresh(now) {
  return result && now - capturedAt < Math.min(1500, Math.max(500, lastLatency * 2 + 200));
}

function render(now) {
  const fresh = isFresh(now);
  overlay.render(fresh ? result : null);
  if (result && !fresh && !staleCleared) {
    presentation.clear("ATUALIZANDO");
    staleCleared = true;
  }
  requestAnimationFrame(render);
}

byId("startButton").addEventListener("click", start);
byId("stopButton").addEventListener("click", () => stop());
byId("detailsButton").addEventListener("click", () => toggleDetails(byId("detailPanel").hidden));
byId("closeDetails").addEventListener("click", () => toggleDetails(false));
byId("mirrorToggle").addEventListener("change", event => {
  overlay.mirror = event.target.checked;
  savePreferences();
  if (isFresh(performance.now())) presentation.update(result, lastLatency, overlay.mirror);
});
byId("pointsToggle").addEventListener("change", event => {
  overlay.showPoints = event.target.checked;
  savePreferences();
});
byId("fpsSelect").addEventListener("change", () => {
  savePreferences();
  status(active ? "DETECÇÃO NO NAVEGADOR" : "PRONTO PARA INICIAR", `Limite de análise ajustado para ${byId("fpsSelect").value} quadros por segundo.`);
});

byId("objectsToggle").addEventListener("change", event => {
  savePreferences();
  const note = event.target.checked
    ? "Detecção de objetos ativada. O consumo de processamento pode aumentar."
    : "Detecção de objetos desativada. O modo leve continua ativo.";
  status(active ? "DETECÇÃO NO NAVEGADOR" : "PRONTO PARA INICIAR", note);
});

byId("engineSelect").addEventListener("change", event => {
  stop();
  api = event.target.value === "services" ? new VisionAPI() : new BrowserVision(message => status("CARREGANDO DETECTORES", message));
  status("PRONTO PARA INICIAR", api.local ? "Clique em INICIAR CÂMERA. Os detectores carregam automaticamente." : "Execute iniciar.bat antes de iniciar a análise pelos serviços.");
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !byId("detailPanel").hidden) toggleDetails(false);
  if (event.code !== "Space" || event.repeat) return;
  if (event.target.closest("button, input, select, summary, a")) return;
  event.preventDefault();
  if (active || starting) stop();
  else start();
});
document.addEventListener("visibilitychange", () => { if (document.hidden && (active || starting)) stop("Câmera pausada ao sair da aba. Clique em iniciar para retomar."); });
window.addEventListener("pagehide", () => stop());
requestAnimationFrame(render);
