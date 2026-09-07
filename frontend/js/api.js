export class VisionAPI {
  constructor() {
    this.base = "http://127.0.0.1:8080/api";
    this.session = null;
    this.frame = 0;
  }

  async request(path, options = {}) {
    const response = await fetch(this.base + path, { cache: "no-store", ...options });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.erro || "Não foi possível concluir a análise.");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async connect(signal) {
    const health = await this.request("/health", { signal });
    if (health.java !== "pronto" || health.visao?.status !== "pronto") throw new Error("Os serviços ainda estão iniciando.");
    const result = await this.request("/sessions", { method: "POST", signal });
    this.session = result.sessao_id;
    this.frame = 0;
    return health;
  }

  analyze(blob, signal) {
    return this.request("/analyze", {
      method: "POST",
      headers: { "Content-Type": "image/jpeg", "X-Session-Id": this.session, "X-Frame-Id": String(++this.frame) },
      body: blob,
      signal
    });
  }

  async close() {
    const session = this.session;
    this.session = null;
    if (!session) return;
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const response = await fetch(this.base + "/sessions", { method: "DELETE", headers: { "X-Session-Id": session }, keepalive: true, signal: AbortSignal.timeout(3000) });
        if (response.status !== 409) return;
      } catch { return; }
      await new Promise(resolve => setTimeout(resolve, Math.min(250 * (attempt + 1), 1500)));
    }
  }
}
