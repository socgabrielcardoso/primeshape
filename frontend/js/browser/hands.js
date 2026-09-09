import { angle, bounds, clamp, distance, point, signal } from "./geometry.js";

const FINGERS = [["polegar",1,2,3,4],["indicador",5,6,7,8],["médio",9,10,11,12],["anelar",13,14,15,16],["mínimo",17,18,19,20]];

export function analyzeHands(result, width, height) {
  return result.landmarks.map((landmarks, i) => {
    const points = landmarks.map(point);
    const world = result.worldLandmarks[i].map(point);
    const projected = points.map(p => [p[0] * width, p[1] * height]);
    const palm = Math.max(distance(world[0], world[9]), 1e-6);
    const fingers = FINGERS.map(([nome, base, joint, distal, tip]) => {
      const proximalAngle = angle(world[base], world[joint], world[distal]);
      const distalAngle = angle(world[joint], world[distal], world[tip]);
      const reach = distance(world[tip], world[0]) / Math.max(distance(world[joint], world[0]), 1e-6);
      const projectedAngle = angle(projected[base], projected[joint], projected[distal]);
      const projectedDistal = angle(projected[joint], projected[distal], projected[tip]);
      const projectedReach = distance(projected[tip], projected[0]) / Math.max(distance(projected[joint], projected[0]), 1e-6);
      const estendido = nome === "polegar"
        ? proximalAngle > 145 && distalAngle > 145 && distance(world[tip], world[5]) / palm > 0.45
        : (proximalAngle > 150 && distalAngle > 145 && reach > 1.15) || (projectedAngle > 160 && projectedDistal > 155 && projectedReach > 1.2);
      return { nome, estendido, angulo_graus: proximalAngle, extensao_3d: clamp((Math.min(proximalAngle, distalAngle) - 100) / 65) };
    });
    const center = [0,1].map(axis => [0,5,9,13,17].reduce((sum, index) => sum + points[index][axis], 0) / 5);
    const side = (result.handedness || result.handednesses)[i][0];
    const hand = {
      lado: side.categoryName === "Left" ? "Esquerda" : "Direita",
      score_lateralidade: side.score, pontos: points, pontos_mundo: world, caixa: bounds(points), centro: center,
      posicao_imagem: { horizontal: center[0] < 0.33 ? "esquerda" : center[0] > 0.67 ? "direita" : "centro", vertical: center[1] < 0.33 ? "acima" : center[1] > 0.67 ? "abaixo" : "ao centro" },
      dedos: fingers, dedos_estendidos: fingers.filter(f => f.estendido).length,
      parcial: points.some(p => p[0] < 0.015 || p[1] < 0.015 || p[0] > 0.985 || p[1] > 0.985),
      gestos: []
    };
    const [thumb, index, middle, ring, little] = fingers.map(f => f.estendido);
    const pinch = distance(world[4], world[8]) / palm;
    const add = (code, label, condition) => { if (condition && !hand.parcial) hand.gestos.push(signal(code, label, Math.min(0.85, side.score), "inferencia")); };
    add("mao_aberta", "Mão aberta", hand.dedos_estendidos === 5);
    add("punho_fechado", "Punho fechado", hand.dedos_estendidos === 0);
    add("apontando", "Indicador apontando", index && !middle && !ring && !little);
    add("vitoria", "Gesto de vitória", index && middle && !ring && !little && distance(world[8], world[12]) / palm > 0.35);
    add("tres_dedos", "Três dedos estendidos", hand.dedos_estendidos === 3);
    add("quatro_dedos", "Quatro dedos estendidos", !thumb && index && middle && ring && little);
    add("pinca", "Pinça entre polegar e indicador", pinch < 0.2);
    add("ok", "Gesto de OK", pinch < 0.25 && middle && ring && little);
    add("telefone", "Gesto de telefone", thumb && little && !index && !middle && !ring);
    add("indicador_minimo", "Indicador e mínimo estendidos", index && little && !middle && !ring);
    add("polegar_acima", "Polegar para cima", thumb && hand.dedos_estendidos === 1 && points[4][1] < points[2][1] - 0.035);
    add("polegar_abaixo", "Polegar para baixo", thumb && hand.dedos_estendidos === 1 && points[4][1] > points[2][1] + 0.035);
    return hand;
  });
}

export function bimanual(hands, width, height) {
  if (hands.length !== 2 || hands.some(h => h.parcial)) return [];
  const [a, b] = hands.map(h => h.pontos.map(p => [p[0] * width, p[1] * height]));
  const scale = Math.max(distance(a[0], a[9]), distance(b[0], b[9]), 1);
  if (Math.min(distance(a[8], a[4]), distance(b[8], b[4])) / scale < 0.55) return [];
  const indexClose = distance(a[8], b[8]) / scale < 0.45;
  const thumbClose = distance(a[4], b[4]) / scale < 0.45;
  if (indexClose === thumbClose) return [];
  const middle = (p, q) => p.map((value, i) => (value + q[i]) / 2);
  const points = indexClose ? [middle(a[8], b[8]), a[4], b[4]] : [a[8], b[8], middle(a[4], b[4])];
  return [{ ...signal("forma_bimanual", "Triângulo com as mãos", 0.65, "inferencia"), pontos: points.map(p => [p[0] / width, p[1] / height]) }];
}
