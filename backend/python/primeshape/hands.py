import numpy as np
import cv2
from .geometry import angle, bounds, clamp, distance, serial_points, signal
from .shape_geometry import quadrilateral

FINGERS = (("polegar", 1, 2, 3, 4), ("indicador", 5, 6, 7, 8), ("medio", 9, 10, 11, 12), ("anelar", 13, 14, 15, 16), ("minimo", 17, 18, 19, 20))


def analyze_hand(hand, width, height):
    points, world = hand["points"], hand["world"]
    palm = max(distance(world[0], world[9]), 1e-6)
    fingers = []
    for name, base, joint, distal, tip in FINGERS:
        proximal_angle = angle(world[base], world[joint], world[distal])
        distal_angle = angle(world[joint], world[distal], world[tip])
        reach = distance(world[tip], world[0]) / max(distance(world[joint], world[0]), 1e-6)
        if name == "polegar":
            spread = distance(world[tip], world[5]) / palm
            extended = proximal_angle > 145 and distal_angle > 145 and spread > 0.45
        else:
            extended = proximal_angle > 150 and distal_angle > 145 and reach > 1.15
        straightness = clamp((min(proximal_angle, distal_angle) - 100) / 65)
        fingers.append({"nome": name, "estendido": bool(extended), "angulo_graus": round(proximal_angle, 1), "extensao": round(straightness, 3)})
    center = points[[0, 5, 9, 13, 17], :2].mean(axis=0)
    vertical = "acima" if center[1] < 0.33 else "abaixo" if center[1] > 0.67 else "ao centro"
    horizontal = "esquerda" if center[0] < 0.33 else "direita" if center[0] > 0.67 else "centro"
    clipped = bool(np.any(points[:, :2] < 0.015) or np.any(points[:, :2] > 0.985))
    finger_spread = distance(world[8], world[12]) / palm
    pinch = distance(world[4], world[8]) / palm
    return {
        "lado": "Esquerda" if hand["side"] == "Left" else "Direita",
        "score_lateralidade": round(hand["side_score"], 3),
        "pontos": serial_points(points),
        "pontos_mundo": serial_points(world),
        "caixa": bounds(points),
        "centro": [round(float(v), 4) for v in center],
        "posicao_imagem": {"horizontal": horizontal, "vertical": vertical},
        "dedos": fingers,
        "dedos_estendidos": sum(f["estendido"] for f in fingers),
        "parcial": clipped,
        "razao_pinca": round(pinch, 3),
        "abertura_indicador_medio": round(finger_spread, 3),
        "gestos": [],
    }


def classify_gestures(hand):
    if hand["parcial"]:
        return []
    thumb, index, middle, ring, little = [f["estendido"] for f in hand["dedos"]]
    score = min(0.85, hand["score_lateralidade"])
    candidates = []

    def add(code, label, condition):
        if condition:
            candidates.append(signal(code, label, score, "inferencia", ["Geometria das articulações e distâncias dos 21 pontos"] ))

    add("mao_aberta", "Mão aberta", all((thumb, index, middle, ring, little)))
    add("punho_fechado", "Punho fechado", not any((thumb, index, middle, ring, little)))
    add("apontando", "Indicador apontando", index and not any((middle, ring, little)))
    add("vitoria", "Gesto de vitória", index and middle and not ring and not little and hand["abertura_indicador_medio"] > 0.35)
    add("tres_dedos", "Três dedos estendidos", sum((thumb, index, middle, ring, little)) == 3)
    add("quatro_dedos", "Quatro dedos estendidos", not thumb and all((index, middle, ring, little)))
    add("pinca", "Pinça entre polegar e indicador", hand["razao_pinca"] < 0.2)
    add("ok", "Gesto de OK", hand["razao_pinca"] < 0.25 and all((middle, ring, little)))
    add("telefone", "Gesto de telefone", thumb and little and not any((index, middle, ring)))
    add("indicador_minimo", "Indicador e mínimo estendidos", index and little and not middle and not ring)
    thumb_only = thumb and not any((index, middle, ring, little))
    tip, base = hand["pontos"][4], hand["pontos"][2]
    add("polegar_acima", "Polegar para cima", thumb_only and tip[1] < base[1] - 0.035)
    add("polegar_abaixo", "Polegar para baixo", thumb_only and tip[1] > base[1] + 0.035)
    return candidates


def bimanual_gestures(hands, width, height):
    if len(hands) != 2 or any(h["parcial"] for h in hands):
        return []
    a, b = [np.asarray(h["pontos"]) * np.array([width, height, width]) for h in hands]
    scale = max(distance(a[0, :2], a[9, :2]), distance(b[0, :2], b[9, :2]), 1)
    index_close = distance(a[8, :2], b[8, :2]) / scale < 0.45
    thumb_close = distance(a[4, :2], b[4, :2]) / scale < 0.45
    span_a = distance(a[8, :2], a[4, :2]) / scale
    span_b = distance(b[8, :2], b[4, :2]) / scale
    if min(span_a, span_b) < 0.55:
        return []
    points = []
    if index_close and not thumb_close:
        points = [(a[8] + b[8]) / 2, a[4], b[4]]
        label = "Triângulo com as mãos"
    elif thumb_close and not index_close:
        points = [a[8], b[8], (a[4] + b[4]) / 2]
        label = "Triângulo com as mãos"
    elif index_close and thumb_close:
        arc = np.concatenate([a[[8,7,6,5,2,3,4]], b[[8,7,6,5,2,3,4]]])
        low, high = arc.min(axis=0), arc.max(axis=0)
        center = (low + high) / 2
        radius = (high - low) / 2
        t = np.linspace(0, 2 * np.pi, 40, endpoint=False)
        points = np.c_[center[0] + radius[0] * np.cos(t), center[1] + radius[1] * np.sin(t), np.zeros(40)]
        ratio = radius[0] / max(radius[1], 1)
        label = "Círculo aproximado com as mãos" if .85 < ratio < 1.18 else "Oval aproximado com as mãos"
    else:
        tips = np.array([a[8], b[8], b[4], a[4]])
        center = tips[:, :2].mean(axis=0)
        tips = tips[np.argsort(np.arctan2(tips[:,1]-center[1], tips[:,0]-center[0]))]
        polygon = tips[:, :2].astype(np.float32).reshape(-1,1,2)
        if cv2.contourArea(polygon) > scale ** 2 * .4 and cv2.isContourConvex(polygon):
            classified = quadrilateral(tips[:, :2])
            if classified:
                label = classified[0] + " aproximado com as mãos"
                points = tips
    if len(points) == 0:
        return []
    normalized = np.asarray(points) / np.array([width, height, width])
    return [{**signal("forma_bimanual", label, 0.65, "inferencia", ["Proximidade dos indicadores e polegares das duas mãos"]), "pontos": serial_points(normalized)}]
