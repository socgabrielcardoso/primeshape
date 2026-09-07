import cv2
import numpy as np
from .config import SETTINGS
from .geometry import signal
from .shape_geometry import POLYGONS, classify_convex
from .shape_templates import TemplateMatcher

SHAPE_CATALOG = ["Círculo", "Oval", "Quadrado", "Retângulo", "Losango", "Trapézio", "Paralelogramo", "Deltoide", *POLYGONS.values(), "Estrela de 5 pontas", "Estrela de 6 pontas", "Cruz", "Coração", "Semicírculo", "Seta", "Chevron"]


def overlap(a, b):
    x = max(0, min(a[0]+a[2], b[0]+b[2]) - max(a[0], b[0]))
    y = max(0, min(a[1]+a[3], b[1]+b[3]) - max(a[1], b[1]))
    return x * y / max(min(a[2] * a[3], b[2] * b[3]), 1)


class ShapeDetector:
    def __init__(self):
        self.matcher = TemplateMatcher()

    def detect(self, frame, exclusions=()):
        height, width = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        _, binary = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        edges = cv2.morphologyEx(cv2.Canny(blur, 55, 130), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
        candidates = []
        for mask in (binary, cv2.bitwise_not(binary), edges):
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            candidates.extend(contours)
        blocked = np.zeros((height, width), np.uint8)
        for points in exclusions:
            pixels = np.asarray(points)[:, :2] * [width, height]
            cv2.fillConvexPoly(blocked, cv2.convexHull(pixels.astype(np.int32)), 1)
        detected = []
        visited = []
        for contour in sorted(candidates, key=cv2.contourArea, reverse=True)[:100]:
            area = cv2.contourArea(contour)
            if area < SETTINGS.shape_min_area or area > width * height * 0.85:
                continue
            x, y, w, h = cv2.boundingRect(contour)
            if x <= 1 or y <= 1 or x+w >= width-1 or y+h >= height-1 or min(w, h) < 20:
                continue
            if any(overlap((x,y,w,h), box) > 0.85 for box in visited):
                continue
            region = np.zeros((h, w), np.uint8)
            cv2.drawContours(region, [contour - [x, y]], -1, 1, cv2.FILLED)
            if np.count_nonzero(region & blocked[y:y+h, x:x+w]) / max(area, 1) > 0.2:
                continue
            answer = classify_convex(contour)
            if answer is None:
                answer = self.matcher.classify(contour)
            if answer is None:
                continue
            label, score, vertices = answer
            visited.append((x,y,w,h))
            simplified = cv2.approxPolyDP(contour, cv2.arcLength(contour, True) * 0.003, True)
            detected.append({
                **signal("forma", label, score, "medicao", ["Contorno segmentado e geometria comparada; score não calibrado"]),
                "caixa": [x / width, y / height, w / width, h / height],
                "contorno": [[round(float(p[0][0])/width, 5), round(float(p[0][1])/height, 5)] for p in simplified],
                "vertices": vertices,
                "area_px": round(area),
            })
            if len(detected) >= SETTINGS.shape_max_count:
                break
        return detected
