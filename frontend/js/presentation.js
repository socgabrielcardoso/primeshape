const TYPES = { medicao: "Medição", inferencia: "Inferência", estado_aparente: "Estado aparente" };
const STATE_ORDER = ["possivel_sono", "possivel_sonolencia", "possivel_bocejo", "fechamento_prolongado", "piscando", "piscou", "vigilia_aparente", "olhos_fechados", "olhos_abertos"];
const EXPRESSION_ORDER = ["desconforto_aparente", "surpresa_aparente", "irritacao_aparente", "tensao_aparente", "tristeza_aparente", "preocupacao_aparente", "sorrindo", "sorriso_leve", "sorriso_assimetrico", "neutra"];

export class Presentation {
  constructor() {
    this.nodes = Object.fromEntries(["shapeName", "eyeState", "expressionName", "handCount", "faceMetrics", "signalsList", "handsDetails", "shapesList", "performance"].map(id => [id, document.getElementById(id)]));
  }

  set(id, text) {
    this.nodes[id].textContent = text;
    this.nodes[id].title = text;
  }

  list(id, items) {
    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const node = document.createElement("li");
      const label = document.createElement("strong");
      label.textContent = item.rotulo;
      const detail = document.createElement("span");
      detail.textContent = `${TYPES[item.tipo]} · score ${item.score.toFixed(2)}`;
      node.append(label, detail);
      if (item.evidencias?.length) node.title = item.evidencias.join(". ");
      fragment.append(node);
    }
    this.nodes[id].replaceChildren(fragment);
  }

  clear(message = "SEM ANÁLISE") {
    for (const id of ["shapeName", "eyeState", "expressionName", "handCount"]) this.set(id, message);
    this.set("faceMetrics", "Nenhuma análise disponível.");
    this.set("handsDetails", "Nenhuma análise disponível.");
    this.set("performance", "Aguardando quadros.");
    this.list("signalsList", []);
    this.list("shapesList", []);
  }

  update(result, latency, mirror) {
    const face = result.rosto;
    const choose = order => order.map(code => face.sinais.find(s => s.codigo === code)).find(Boolean)?.rotulo;
    this.set("shapeName", result.formas.map(s => s.rotulo).join(" · ") || "NENHUMA");
    this.set("eyeState", face.presente ? choose(STATE_ORDER) || "INDETERMINADO" : "ROSTO AUSENTE");
    this.set("expressionName", face.presente ? choose(EXPRESSION_ORDER) || "INDETERMINADA" : "ROSTO AUSENTE");
    this.set("handCount", `${result.quantidade_maos} DETECTADAS`);
    this.set("performance", `Análise: ${result.processamento_ms.toFixed(0)} ms · Ida e volta: ${latency.toFixed(0)} ms · Qualidade: ${result.qualidade.score.toFixed(2)}`);
    if (face.metricas) {
      const m = face.metricas, t = face.temporal;
      const closure = t.perclos_observado === null ? "coletando" : `${(t.perclos_observado * 100).toFixed(0)}%`;
      this.set("faceMetrics", `${face.pontos.length} pontos · Abertura da boca: ${m.abertura_boca.toFixed(2)} · Olhos fechados: ${t.olhos_fechados_s.toFixed(1)} s · Piscadas observadas: ${t.piscadas_60s} · Fechamento ocular: ${closure} em ${t.cobertura_s.toFixed(0)} s observados.`);
    } else this.set("faceMetrics", "Rosto ausente; acompanhamento temporal reiniciado.");
    this.list("signalsList", face.sinais);
    this.list("shapesList", result.formas);
    const hands = document.createDocumentFragment();
    const count = document.createElement("p");
    count.textContent = `Mãos detectadas: ${result.quantidade_maos}`;
    hands.append(count);
    for (const hand of result.maos) {
      const p = document.createElement("p");
      const raw = hand.posicao_imagem.horizontal;
      const horizontal = mirror ? ({ esquerda: "direita", direita: "esquerda", centro: "centro" })[raw] : raw;
      const gestures = hand.gestos.map(g => g.rotulo).join(", ") || "Gesto indeterminado";
      p.textContent = `Mão ${hand.lado.toLowerCase()} · ${hand.dedos_estendidos} dedos estendidos · ${horizontal}, ${hand.posicao_imagem.vertical} na tela · ${gestures}${hand.parcial ? " · mão parcialmente fora do quadro" : ""}.`;
      hands.append(p);
    }
    for (const gesture of result.gestos_duas_maos) {
      const p = document.createElement("p");
      p.textContent = gesture.rotulo;
      hands.append(p);
    }
    this.nodes.handsDetails.replaceChildren(hands);
  }
}
