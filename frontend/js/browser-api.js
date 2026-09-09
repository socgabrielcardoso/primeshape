export class BrowserVision {
  constructor(onProgress = () => {}) {
    this.onProgress = onProgress;
    this.session = null;
    this.worker = null;
    this.pending = new Map();
    this.sequence = 0;
    this.local = true;
  }

  async connect(signal) {
    if (!window.Worker || !window.OffscreenCanvas || !window.WebAssembly) throw new Error("Use uma versão atual do Chrome ou Edge no Windows.");
    this.worker = new Worker(new URL("./browser/worker.js", import.meta.url));
    this.worker.onmessage = ({ data }) => {
      if (data.type === "progress") { this.onProgress(data.message); return; }
      const pending = this.pending.get(data.id);
      if (pending) data.error ? pending.reject(new Error(data.error)) : pending.resolve(data.data);
    };
    this.worker.onerror = () => this.fail(new Error("Não foi possível carregar os detectores. Confira a internet e abra index.html pelo Live Server."));
    try {
      await this.request({ type: "init" }, signal, 120000);
      this.session = "navegador";
    } catch (error) { this.close(); throw error; }
  }

  request(data, signal, timeout = 15000, transfer = []) {
    return new Promise((resolve, reject) => {
      if (!this.worker || signal?.aborted) { reject(new DOMException("Processamento interrompido.", "AbortError")); return; }
      const id = ++this.sequence;
      const finish = (fn, value) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        this.pending.delete(id);
        fn(value);
      };
      const abort = () => finish(reject, new DOMException("Processamento interrompido.", "AbortError"));
      const timer = setTimeout(() => finish(reject, new Error("O carregamento demorou demais. Confira a internet e tente iniciar novamente.")), timeout);
      this.pending.set(id, { resolve: value => finish(resolve,value), reject: error => finish(reject,error) });
      signal?.addEventListener("abort",abort,{ once: true });
      try { this.worker.postMessage({ ...data, id },transfer); }
      catch (error) { finish(reject,error); }
    });
  }

  analyze(image, signal) {
    return this.request({ type: "frame", image, timestamp: performance.now() },signal,15000,[image.data.buffer]);
  }

  fail(error) {
    for (const pending of [...this.pending.values()]) pending.reject(error);
    this.worker?.terminate();
    this.worker = null;
    this.session = null;
  }

  close() { this.fail(new DOMException("Processamento encerrado.", "AbortError")); }
}
