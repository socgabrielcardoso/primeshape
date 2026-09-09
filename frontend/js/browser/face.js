import { bounds, distance, point, ramp, signal } from "./geometry.js";
import { LABELS } from "./face-labels.js";

function eyeRatio(points, indices) {
  const [a,b,c,d,e,f] = indices.map(i => points[i]);
  return (distance(b,f) + distance(c,e)) / Math.max(2 * distance(a,d), 1e-8);
}

export function analyzeFace(result, width, height, timeline, now) {
  if (!result?.faceLandmarks.length) return { presente: false, pontos: [], metricas: null, sinais: [], temporal: timeline.update(null, now) };
  const points = result.faceLandmarks[0].map(point);
  const pixels = points.map(p => [p[0] * width, p[1] * height]);
  const blends = Object.fromEntries(result.faceBlendshapes[0].categories.map(b => [b.categoryName, b.score]));
  const b = name => blends[name] || 0;
  const pair = name => Math.min(b(name + "Left"), b(name + "Right"));
  const leftEar = eyeRatio(pixels, [362,385,387,263,373,380]);
  const rightEar = eyeRatio(pixels, [33,160,158,133,153,144]);
  const mouthRatio = distance(pixels[13], pixels[14]) / Math.max(distance(pixels[61], pixels[291]), 1e-8);
  const matrix = result.facialTransformationMatrixes[0]?.data;
  const degrees = value => value * 180 / Math.PI;
  const yaw = matrix ? degrees(Math.atan2(-matrix[2], Math.hypot(matrix[0], matrix[1]))) : 0;
  const pitch = matrix ? degrees(Math.atan2(matrix[6], matrix[10])) : 0;
  const roll = matrix ? degrees(Math.atan2(matrix[1], matrix[0])) : 0;
  const quality = Math.min(ramp(distance(pixels[33], pixels[263]), 24, 65), 1 - ramp(Math.abs(yaw), 30, 65));
  const left = (b("eyeBlinkLeft") > 0.55 && leftEar < 0.25) || leftEar < 0.14;
  const right = (b("eyeBlinkRight") > 0.55 && rightEar < 0.25) || rightEar < 0.14;
  const smile = pair("mouthSmile"), mouth = mouthRatio > 0.13 && b("jawOpen") > 0.1;
  const metrics = {
    olho_esquerdo_ear: leftEar, olho_direito_ear: rightEar, abertura_boca: mouthRatio,
    olho_esquerdo_fechado: left, olho_direito_fechado: right, boca_aberta: mouth,
    boca_ampla: mouthRatio > 0.43 && b("jawOpen") > 0.48 && smile < 0.35,
    orientacao: { horizontal_graus: yaw, vertical_graus: pitch, inclinacao_graus: roll },
    qualidade: quality, caixa: bounds(points)
  };
  const t = timeline.update(metrics, now), signals = [];
  const add = (code, condition, score = 1, kind = "medicao") => { if (condition && quality >= 0.4) signals.push(signal(code, LABELS[code], Math.min(score, quality), kind)); };
  const opened = !left && !right, closed = left && right;
  const squint = pair("eyeSquint"), wide = pair("eyeWide"), browDown = pair("browDown"), press = pair("mouthPress"), sneer = pair("noseSneer");
  const browUp = Math.max(b("browInnerUp"), pair("browOuterUp"));
  const lateral = Math.max(Math.min(b("eyeLookInLeft"), b("eyeLookOutRight")), Math.min(b("eyeLookOutLeft"), b("eyeLookInRight")));
  const gazeAway = Math.max(lateral, pair("eyeLookUp"), pair("eyeLookDown"));
  add("olhos_abertos", opened);
  add("olhos_fechados", closed);
  add("olho_esquerdo_fechado", left && !right);
  add("olho_direito_fechado", right && !left);
  add("piscando", closed && t.olhos_fechados_s < 0.5, 0.65, "inferencia");
  add("piscou", t.piscada_recente);
  add("olhos_semicerrados", !closed && squint > 0.45, squint);
  add("olhos_arregalados", opened && wide > 0.45, wide);
  add("boca_aberta", mouth);
  add("boca_fechada", !mouth && mouthRatio < 0.08);
  add("boca_muito_aberta", metrics.boca_ampla);
  add("labios_franzidos", b("mouthPucker") > 0.5, b("mouthPucker"));
  add("labios_projetados", b("mouthFunnel") > 0.5, b("mouthFunnel"));
  add("labios_pressionados", press > 0.4 && !mouth, press);
  add("sorrindo", smile >= 0.55, smile);
  add("sorriso_leve", smile >= 0.25 && smile < 0.55, smile);
  const asymmetry = Math.abs(b("mouthSmileLeft") - b("mouthSmileRight"));
  add("sorriso_assimetrico", asymmetry > 0.35 && Math.max(b("mouthSmileLeft"), b("mouthSmileRight")) > 0.55, asymmetry);
  add("sobrancelhas_elevadas", browUp > 0.45, browUp);
  add("sobrancelhas_franzidas", browDown > 0.45, browDown);
  add("sobrancelha_esquerda_elevada", b("browOuterUpLeft") > 0.5 && b("browOuterUpLeft") - b("browOuterUpRight") > 0.3, b("browOuterUpLeft"));
  add("sobrancelha_direita_elevada", b("browOuterUpRight") > 0.5 && b("browOuterUpRight") - b("browOuterUpLeft") > 0.3, b("browOuterUpRight"));
  add("nariz_franzido", sneer > 0.45, sneer);
  add("bochechas_infladas", b("cheekPuff") > 0.55, b("cheekPuff"));
  add("mandibula_esquerda", b("jawLeft") > 0.45, b("jawLeft"));
  add("mandibula_direita", b("jawRight") > 0.45, b("jawRight"));
  add("olhar_lateral", opened && lateral > 0.45, lateral);
  add("olhar_acima", opened && pair("eyeLookUp") > 0.45, pair("eyeLookUp"));
  add("olhar_abaixo", opened && pair("eyeLookDown") > 0.45, pair("eyeLookDown"));
  add("cabeca_girada", Math.abs(yaw) > 22, ramp(Math.abs(yaw), 12, 35));
  add("cabeca_inclinada", Math.abs(roll) > 18, ramp(Math.abs(roll), 10, 30));
  add("cabeca_frontal", Math.abs(yaw) < 15 && Math.abs(pitch) < 18 && Math.abs(roll) < 15);
  add("fechamento_prolongado", t.olhos_fechados_s >= 1.5);
  add("possivel_bocejo", t.possivel_bocejo, 0.7, "inferencia");
  const sleep = t.olhos_fechados_s >= 10 && t.perclos_observado !== null && t.perclos_observado > 0.8;
  add("possivel_sono", sleep, 0.65, "estado_aparente");
  add("possivel_sonolencia", !sleep && t.cobertura_s >= 20 && t.perclos_observado > 0.35 && (t.olhos_fechados_s > 1.5 || t.possiveis_bocejos_60s > 0), 0.6, "estado_aparente");
  add("vigilia_aparente", opened && gazeAway < 0.45, 0.6, "estado_aparente");
  add("surpresa_aparente", wide > 0.4 && browUp > 0.4 && mouth, Math.min(wide, browUp, b("jawOpen")), "estado_aparente");
  add("tensao_aparente", browDown > 0.4 && press > 0.3 && squint > 0.3, Math.min(browDown, press, squint), "estado_aparente");
  const frown = pair("mouthFrown");
  add("tristeza_aparente", frown > 0.4 && b("browInnerUp") > 0.35 && smile < 0.2, Math.min(frown, b("browInnerUp")), "estado_aparente");
  add("irritacao_aparente", browDown > 0.5 && sneer > 0.35 && press > 0.3, Math.min(browDown, sneer, press), "estado_aparente");
  add("preocupacao_aparente", b("browInnerUp") > 0.4 && browDown > 0.3 && press > 0.3, Math.min(b("browInnerUp"), browDown, press), "estado_aparente");
  add("desconforto_aparente", squint > 0.5 && browDown > 0.45 && (sneer > 0.35 || press > 0.45), Math.min(squint, browDown, Math.max(sneer, press)), "estado_aparente");
  add("atencao_aparente", opened && Math.abs(yaw) < 12 && Math.abs(pitch) < 15 && gazeAway < 0.25, 0.55, "estado_aparente");
  const neutral = opened && !mouth && Math.max(smile, squint, browDown, browUp, press, sneer, frown, b("mouthPucker")) < 0.25;
  add("neutra", neutral, 1 - Math.max(smile, browDown, browUp, press));
  add("relaxada_aparente", neutral && Math.abs(yaw) < 15 && Math.abs(roll) < 12, 0.5, "estado_aparente");
  return { presente: true, pontos: points, metricas: metrics, temporal: t, sinais: signals };
}
