import math
import numpy as np
from .geometry import bounds, distance, ramp, clamp

RIGHT_EYE = (33, 160, 158, 133, 153, 144)
LEFT_EYE = (362, 385, 387, 263, 373, 380)


def eye_ratio(points, indices):
    a, b, c, d, e, f = [points[i, :2] for i in indices]
    return (distance(b, f) + distance(c, e)) / max(2 * distance(a, d), 1e-8)


def orientation(matrix):
    rotation = matrix[:3, :3]
    rotation = rotation / np.maximum(np.linalg.norm(rotation, axis=0), 1e-8)
    yaw = math.degrees(math.atan2(-rotation[2, 0], math.hypot(rotation[0, 0], rotation[1, 0])))
    pitch = math.degrees(math.atan2(rotation[2, 1], rotation[2, 2]))
    roll = math.degrees(math.atan2(rotation[1, 0], rotation[0, 0]))
    return {"horizontal_graus": round(yaw, 1), "vertical_graus": round(pitch, 1), "inclinacao_graus": round(roll, 1)}


def measure_face(face, width, height, quality):
    normalized = face["points"]
    pixels = normalized * np.array([width, height, width])
    scores = face["blendshapes"]
    left_ear, right_ear = eye_ratio(pixels, LEFT_EYE), eye_ratio(pixels, RIGHT_EYE)
    mouth_ratio = distance(pixels[13, :2], pixels[14, :2]) / max(distance(pixels[61, :2], pixels[291, :2]), 1e-8)
    head = orientation(face["matrix"])
    eye_span = distance(pixels[33, :2], pixels[263, :2])
    pose_quality = 1 - ramp(abs(head["horizontal_graus"]), 30, 65)
    face_quality = min(quality["score"], ramp(eye_span, 24, 65), pose_quality)
    left_closed = (scores.get("eyeBlinkLeft", 0) > 0.55 and left_ear < 0.25) or left_ear < 0.14
    right_closed = (scores.get("eyeBlinkRight", 0) > 0.55 and right_ear < 0.25) or right_ear < 0.14
    jaw = scores.get("jawOpen", 0)
    smile = min(scores.get("mouthSmileLeft", 0), scores.get("mouthSmileRight", 0))
    mouth_open = mouth_ratio > 0.13 and jaw > 0.1
    mouth_wide = mouth_ratio > 0.43 and jaw > 0.48 and smile < 0.35
    return {
        "olho_esquerdo_ear": round(left_ear, 4),
        "olho_direito_ear": round(right_ear, 4),
        "abertura_boca": round(mouth_ratio, 4),
        "olho_esquerdo_fechado": bool(left_closed),
        "olho_direito_fechado": bool(right_closed),
        "boca_aberta": bool(mouth_open),
        "boca_ampla": bool(mouth_wide),
        "orientacao": head,
        "qualidade": round(clamp(face_quality), 3),
        "caixa": bounds(normalized),
        "largura_olhos_px": round(eye_span, 1),
    }
