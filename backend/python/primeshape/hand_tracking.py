from dataclasses import dataclass
import math
import numpy as np
from .config import SETTINGS

PALM_POINTS = np.array([0, 5, 9, 13, 17])


def _center(points):
    return np.asarray(points, dtype=np.float64)[PALM_POINTS, :2].mean(axis=0)


def _scale(points):
    points = np.asarray(points, dtype=np.float64)
    palm = np.linalg.norm(points[0, :2] - points[9, :2])
    spread = np.linalg.norm(points[5, :2] - points[17, :2])
    return max(float(palm), float(spread), 0.045)


def _valid_detection(detection):
    try:
        points = np.asarray(detection["points"], dtype=np.float64)
        world = np.asarray(detection["world"], dtype=np.float64)
    except (KeyError, TypeError, ValueError):
        return False
    return points.shape == (21, 3) and world.shape == (21, 3) and np.isfinite(points).all() and np.isfinite(world).all()


@dataclass
class _Track:
    id: int
    points: np.ndarray
    world: np.ndarray
    side: str
    side_score: float
    last_seen: float
    age: int = 1
    missed: int = 0
    stability: float = 1.0


class HandTracker:
    """Temporal hand tracker that stabilizes MediaPipe detections per session."""

    def __init__(self):
        self.tracks = []
        self.next_id = 1

    def reset(self):
        self.tracks.clear()
        self.next_id = 1

    @staticmethod
    def _cost(track, detection):
        points = np.asarray(detection["points"], dtype=np.float64)
        center_distance = float(np.linalg.norm(_center(points) - _center(track.points)))
        scale_ratio = _scale(points) / max(_scale(track.points), 1e-6)
        scale_penalty = abs(math.log(max(scale_ratio, 1e-6))) * 0.28
        detection_score = float(detection.get("side_score", 0.0))
        side_penalty = 0.0
        if (
            track.side in {"Left", "Right"}
            and detection.get("side") in {"Left", "Right"}
            and track.side != detection.get("side")
            and min(track.side_score, detection_score) >= 0.72
        ):
            side_penalty = 0.9
        missed_penalty = min(track.missed, 3) * 0.08
        return center_distance * 3.2 + scale_penalty + side_penalty + missed_penalty

    def _metadata(self, track, recovered=False, stale_s=0.0):
        return {
            "id": track.id,
            "recuperado": bool(recovered),
            "frames_ausentes": int(track.missed),
            "estabilidade": round(float(np.clip(track.stability, 0.0, 1.0)), 3),
            "atraso_ms": round(max(0.0, stale_s) * 1000.0, 1),
        }

    def _snapshot(self, track, recovered=False, stale_s=0.0):
        confidence = track.side_score * (0.92 ** track.missed if recovered else 1.0)
        return {
            "points": track.points.copy(),
            "world": track.world.copy(),
            "side": track.side,
            "side_score": float(np.clip(confidence, 0.0, 1.0)),
            "tracking": self._metadata(track, recovered, stale_s),
        }

    def _new_track(self, detection, now):
        track = _Track(
            id=self.next_id,
            points=np.asarray(detection["points"], dtype=np.float64).copy(),
            world=np.asarray(detection["world"], dtype=np.float64).copy(),
            side=detection.get("side", "Unknown"),
            side_score=float(detection.get("side_score", 0.0)),
            last_seen=now,
        )
        self.next_id += 1
        self.tracks.append(track)
        return track

    def _update_track(self, track, detection, now):
        candidate = np.asarray(detection["points"], dtype=np.float64).copy()
        candidate_world = np.asarray(detection["world"], dtype=np.float64).copy()
        old_center = _center(track.points)
        new_center = _center(candidate)
        dt = max(1 / 120, min(now - track.last_seen, 0.35))
        jump = float(np.linalg.norm(new_center - old_center))
        max_jump = SETTINGS.hand_jump_base + SETTINGS.hand_jump_per_s * dt

        if track.age >= 2 and jump > max_jump:
            direction = (new_center - old_center) / max(jump, 1e-9)
            corrected_center = old_center + direction * max_jump
            candidate[:, :2] += corrected_center - new_center
            jump = max_jump

        motion = float(np.clip(jump / 0.20, 0.0, 1.0))
        alpha = SETTINGS.hand_smoothing_min + (SETTINGS.hand_smoothing_max - SETTINGS.hand_smoothing_min) * motion
        if track.missed:
            alpha = min(alpha, 0.58)

        residual = float(np.mean(np.linalg.norm(candidate[:, :2] - track.points[:, :2], axis=1)))
        track.points = (1.0 - alpha) * track.points + alpha * candidate
        track.world = (1.0 - alpha) * track.world + alpha * candidate_world

        detection_side = detection.get("side", "Unknown")
        detection_score = float(detection.get("side_score", 0.0))
        if detection_side == track.side:
            track.side_score = 0.72 * track.side_score + 0.28 * detection_score
        elif track.age <= 2 and detection_score >= 0.92:
            track.side = detection_side
            track.side_score = detection_score
        else:
            track.side_score *= 0.96

        jitter_score = 1.0 - min(1.0, residual / 0.12)
        track.stability = 0.78 * track.stability + 0.22 * jitter_score
        track.last_seen = now
        track.age += 1
        track.missed = 0
        return track

    def update(self, detections, now):
        detections = [d for d in detections if _valid_detection(d)]
        assigned_tracks = set()
        assigned_detections = set()

        candidates = []
        for track_index, track in enumerate(self.tracks):
            for detection_index, detection in enumerate(detections):
                candidates.append((self._cost(track, detection), track_index, detection_index))
        candidates.sort(key=lambda item: item[0])

        for cost, track_index, detection_index in candidates:
            if cost > SETTINGS.hand_match_gate:
                break
            if track_index in assigned_tracks or detection_index in assigned_detections:
                continue
            self._update_track(self.tracks[track_index], detections[detection_index], now)
            assigned_tracks.add(track_index)
            assigned_detections.add(detection_index)

        for detection_index, detection in enumerate(detections):
            if detection_index in assigned_detections:
                continue
            if len(self.tracks) >= 2:
                break
            track = self._new_track(detection, now)
            assigned_tracks.add(self.tracks.index(track))
            assigned_detections.add(detection_index)

        output = []
        survivors = []
        for track_index, track in enumerate(self.tracks):
            if track_index in assigned_tracks:
                output.append(self._snapshot(track))
                survivors.append(track)
                continue

            stale_s = max(0.0, now - track.last_seen)
            if stale_s <= SETTINGS.hand_hold_s:
                track.missed += 1
                track.stability *= 0.94
                output.append(self._snapshot(track, recovered=True, stale_s=stale_s))
                survivors.append(track)

        self.tracks = survivors
        output.sort(key=lambda item: item["tracking"]["id"])
        return output
