import cv2
import numpy as np


def reference_contours():
    shapes = {}
    for tips in (5, 6):
        for inner in (0.38, 0.5):
            t = np.arange(2 * tips) * np.pi / tips - np.pi / 2
            r = np.where(np.arange(2 * tips) % 2, inner, 1)
            shapes[f"Estrela de {tips} pontas:{inner}"] = np.c_[r * np.cos(t), r * np.sin(t)]
    for arm in (0.25, 0.38):
        shapes[f"Cruz:{arm}"] = np.array([[-arm,-1],[arm,-1],[arm,-arm],[1,-arm],[1,arm],[arm,arm],[arm,1],[-arm,1],[-arm,arm],[-1,arm],[-1,-arm],[-arm,-arm]])
    t = np.linspace(0, 2 * np.pi, 160, endpoint=False)
    shapes["Coração"] = np.c_[16 * np.sin(t) ** 3, -(13 * np.cos(t) - 5 * np.cos(2*t) - 2 * np.cos(3*t) - np.cos(4*t))] / 17
    t = np.linspace(0, np.pi, 100)
    shapes["Semicírculo"] = np.c_[np.cos(t), -np.sin(t)]
    for stem in (0.25, 0.4):
        shapes[f"Seta:{stem}"] = np.array([[-1,-stem],[0,-stem],[0,-0.85],[1,0],[0,0.85],[0,stem],[-1,stem]])
    shapes["Chevron"] = np.array([[-1,-1],[-0.1,-1],[1,0],[-0.1,1],[-1,1],[0,0]])
    return {name: np.round((points + 1.5) * 100).astype(np.int32).reshape(-1, 1, 2) for name, points in shapes.items()}


def mask_for(contour, size=48):
    points = contour[:, 0, :].astype(float)
    low, high = points.min(axis=0), points.max(axis=0)
    span = max(float((high - low).max()), 1)
    points = (points - (low + high) / 2) * ((size - 6) / span) + size / 2
    mask = np.zeros((size, size), dtype=np.uint8)
    cv2.fillPoly(mask, [np.round(points).astype(np.int32)], 1)
    return mask.astype(bool)


class TemplateMatcher:
    def __init__(self):
        self.references = reference_contours()
        self.bank = []
        self.labels = []
        for name, contour in self.references.items():
            center = contour[:, 0, :].mean(axis=0)
            for degrees in range(0, 360, 10):
                radians = np.deg2rad(degrees)
                rotation = np.array([[np.cos(radians), -np.sin(radians)], [np.sin(radians), np.cos(radians)]])
                rotated = (contour[:, 0, :] - center) @ rotation.T
                self.bank.append(mask_for(rotated.reshape(-1, 1, 2)))
                self.labels.append(name.split(":")[0])
        self.bank = np.asarray(self.bank)

    def classify(self, contour):
        target = mask_for(contour)
        intersections = np.logical_and(self.bank, target).sum(axis=(1, 2))
        unions = np.logical_or(self.bank, target).sum(axis=(1, 2))
        scores = intersections / np.maximum(unions, 1)
        ranked = {}
        for label, score in zip(self.labels, scores):
            ranked[label] = max(ranked.get(label, 0), float(score))
        ordered = sorted(ranked.items(), key=lambda x: x[1], reverse=True)
        label, best = ordered[0]
        if best < 0.84 or best - ordered[1][1] < 0.055:
            return None
        return label, best, 0
