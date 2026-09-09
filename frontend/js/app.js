import { VisionAPI } from "./api.js";
import { BrowserVision } from "./browser-api.js";
import { Camera } from "./camera.js";
import { Overlay } from "./overlay.js";
import { Presentation } from "./presentation.js";

const byId = id => document.getElementById(id);
let api = new BrowserVision(message => status("CARREGANDO DETECTORES", message));
const camera = new Camera(byId("camera"));
const overlay = new Overlay(byId("visionCanvas"), byId("camera"));
const presentation = new Presentation();
let active = false;
let starting = false;
let controller = null;
let timer = null;
let result = null;
let capturedAt = 0;
let lastLatency = 0;
let generation = 0;
let staleCleared = false;

function status(text, note) {
  byId("backendStatus").textContent = text;
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
    const frame = engine.local ? camera.pixels() : await camera.capture();
    if (!frame) throw new Error("A câmera ainda não disponibilizou um quadro.");
    const captureTime = performance.now();
    const response = await engine.analyze(frame, AbortSignal.any([signal, AbortSignal.timeout(15000)]));
    if (!active || current !== generation) return;
    result = response;
    capturedAt = captureTime;
    staleCleared = false;
    const latency = performance.now() - captureTime;
    lastLatency = latency;
    presentation.update(result, latency, overlay.mirror);
    status(engine.local ? "DETECÇÃO NO NAVEGADOR" : "JAVA + PYTHON CONECTADOS", result.qualidade.avisos.join(" · ") || "Processamento local · Estados aparentes não são diagnósticos.");
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
  byId("startButton").textContent = "ABRINDO CÂMERA";
  try {
    await camera.start();
    if (current !== generation) { camera.stop(); return; }
    active = true;
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
    byId("startButton").textContent = "INICIAR CÂMERA";
  }
}

function stop(message = "Câmera encerrada. Nenhuma imagem foi gravada.") {
  active = false;
  generation++;
  controller?.abort();
  clearTimeout(timer);
  camera.stop();
  api.close();
  result = null;
  presentation.clear("PARADO");
  byId("startArea").hidden = false;
  byId("stopButton").hidden = true;
  status("PARADO", message);
}

function toggleDetails(open) {
  byId("detailPanel").hidden = !open;
  byId("detailsButton").setAttribute("aria-expanded", String(open));
  if (open) byId("closeDetails").focus();
  else byId("detailsButton").focus();
}

function render(now) {
  const fresh = result && now - capturedAt < 1000;
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
  if (result && performance.now() - capturedAt < 1000) presentation.update(result, lastLatency, overlay.mirror);
});
byId("pointsToggle").addEventListener("change", event => { overlay.showPoints = event.target.checked; });
byId("engineSelect").addEventListener("change", event => {
  stop();
  api = event.target.value === "services" ? new VisionAPI() : new BrowserVision(message => status("CARREGANDO DETECTORES", message));
  status("PRONTO PARA INICIAR", api.local ? "Clique em INICIAR CÂMERA. Os detectores carregam automaticamente." : "Execute iniciar.bat antes de iniciar a análise pelos serviços.");
});
document.addEventListener("keydown", event => { if (event.key === "Escape" && !byId("detailPanel").hidden) toggleDetails(false); });
document.addEventListener("visibilitychange", () => { if (document.hidden && (active || starting)) stop("Câmera pausada ao sair da aba. Clique em iniciar para retomar."); });
window.addEventListener("pagehide", () => stop());
requestAnimationFrame(render);
