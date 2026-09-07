import math
import numpy as np


def clamp(value, lower=0.0, upper=1.0):
    return float(max(lower, min(upper, value)))


def ramp(value, low, high):
    return clamp((value - low) / max(high - low, 1e-8))


def distance(a, b):
    return float(np.linalg.norm(np.asarray(a) - np.asarray(b)))


def angle(a, b, c):
    u = np.asarray(a) - np.asarray(b)
    v = np.asarray(c) - np.asarray(b)
    denominator = np.linalg.norm(u) * np.linalg.norm(v)
    if denominator < 1e-8:
        return 0.0
    return math.degrees(math.acos(clamp(float(u @ v / denominator), -1, 1)))


def bounds(points):
    points = np.asarray(points)
    low, high = points[:, :2].min(axis=0), points[:, :2].max(axis=0)
    return [float(low[0]), float(low[1]), float(high[0] - low[0]), float(high[1] - low[1])]


def serial_points(points):
    return [[round(float(v), 5) for v in p] for p in points]


def signal(code, label, score, kind="medicao", evidence=None):
    return {
        "codigo": code,
        "rotulo": label,
        "score": round(clamp(score), 3),
        "tipo": kind,
        "evidencias": evidence or [],
    }
