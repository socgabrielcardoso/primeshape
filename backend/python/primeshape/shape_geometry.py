import math
import cv2
import numpy as np
from .geometry import angle, clamp

POLYGONS = {3: "Triângulo", 5: "Pentágono", 6: "Hexágono", 7: "Heptágono", 8: "Octógono", 9: "Nonágono", 10: "Decágono", 11: "Undecágono", 12: "Dodecágono"}


def parallel(a, b):
    return abs(float(np.cross(a, b))) / max(float(np.linalg.norm(a) * np.linalg.norm(b)), 1e-8) < 0.15


def quadrilateral(points):
    points = points.astype(float)
    edges = np.roll(points, -1, axis=0) - points
    lengths = np.linalg.norm(edges, axis=1)
    angles = [angle(points[(i - 1) % 4], points[i], points[(i + 1) % 4]) for i in range(4)]
    right = max(abs(v - 90) for v in angles) < 13
    equal = max(lengths) / max(min(lengths), 1) < 1.18
    pairs = [parallel(edges[0], edges[2]), parallel(edges[1], edges[3])]
    if right:
        return ("Quadrado" if equal else "Retângulo"), 0.94
    if equal and all(pairs):
        return "Losango", 0.88
    if all(pairs):
        return "Paralelogramo", 0.87
    if sum(pairs) == 1:
        return "Trapézio", 0.86
    close = lambda a, b: abs(a - b) / max(a, b, 1) < 0.14
    if (close(lengths[0], lengths[1]) and close(lengths[2], lengths[3])) or (close(lengths[1], lengths[2]) and close(lengths[3], lengths[0])):
        return "Deltoide", 0.82
    return None


def classify_convex(contour):
    perimeter = cv2.arcLength(contour, True)
    if perimeter < 25:
        return None
    approximations = [cv2.approxPolyDP(contour, perimeter * epsilon, True) for epsilon in (0.004, 0.006, 0.008)]
    polygon = approximations[1]
    count = len(polygon)
    area = cv2.contourArea(contour)
    hull_area = cv2.contourArea(cv2.convexHull(contour))
    if area / max(hull_area, 1) < 0.965:
        return None
    if count == 4 and cv2.isContourConvex(polygon):
        result = quadrilateral(polygon[:, 0, :])
        if result:
            return (*result, count)
    if count in POLYGONS and all(len(p) == count for p in approximations) and cv2.isContourConvex(polygon):
        points = polygon[:, 0, :].astype(float)
        sides = np.linalg.norm(np.roll(points, -1, axis=0) - points, axis=1)
        regularity = float(np.std(sides) / max(np.mean(sides), 1))
        if count == 3 or regularity < 0.28:
            return POLYGONS[count], clamp(0.94 - regularity * 0.4), count
    if len(contour) >= 12 and count >= 7:
        (cx, cy), (a, b), degrees = cv2.fitEllipse(contour)
        if min(a, b) < 12:
            return None
        theta = math.radians(degrees)
        p = contour[:, 0, :].astype(float) - [cx, cy]
        x = p[:, 0] * math.cos(theta) + p[:, 1] * math.sin(theta)
        y = -p[:, 0] * math.sin(theta) + p[:, 1] * math.cos(theta)
        error = float(np.mean(np.abs(np.sqrt((2 * x / a) ** 2 + (2 * y / b) ** 2) - 1)))
        if error < 0.035:
            return ("Círculo" if max(a, b) / min(a, b) < 1.13 else "Oval"), clamp(0.95 - 4 * error), 0
    return None
