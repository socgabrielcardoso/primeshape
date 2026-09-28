import hashlib
import json
import threading
import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from .config import SETTINGS


def points_of(landmarks):
    return np.array([[p.x, p.y, p.z] for p in landmarks], dtype=np.float64)


def hand_frame_for_detection(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    p10, p50, p90 = np.percentile(gray, (10, 50, 90))
    deep_shadows = p10 < 58 and p90 > 145
    low_light = p50 < 105 or p90 < 165
    flat_scene = p90 - p10 < 78
    if not (deep_shadows or low_light or flat_scene):
        return frame
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    light, a, b = cv2.split(lab)
    light = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(light)
    if p50 < 85:
        gamma = 0.68 if p50 < 55 else 0.78
        lut = np.array([min(255, round(((i / 255.0) ** gamma) * 255)) for i in range(256)], dtype=np.uint8)
        light = cv2.LUT(light, lut)
    return cv2.cvtColor(cv2.merge((light, a, b)), cv2.COLOR_LAB2BGR)


class LandmarkEngine:
    def __init__(self):
        self.lock = threading.Lock()
        manifest = json.loads((SETTINGS.model_dir / "manifest.json").read_text(encoding="utf-8"))
        for name, metadata in manifest.items():
            path = SETTINGS.model_dir / name
            if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != metadata["sha256"]:
                raise RuntimeError(f"Modelo ausente ou inválido: {name}. Execute python scripts/download_models.py.")
        self.face = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
            base_options=python.BaseOptions(model_asset_path=str(SETTINGS.model_dir / "face_landmarker.task")),
            running_mode=vision.RunningMode.IMAGE,
            num_faces=1,
            min_face_detection_confidence=SETTINGS.detector_threshold,
            min_face_presence_confidence=SETTINGS.detector_threshold,
            output_face_blendshapes=True,
            output_facial_transformation_matrixes=True,
        ))
        try:
            hand_threshold = max(0.38, SETTINGS.detector_threshold - 0.20)
            self.hands = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
                base_options=python.BaseOptions(model_asset_path=str(SETTINGS.model_dir / "hand_landmarker.task")),
                running_mode=vision.RunningMode.IMAGE,
                num_hands=2,
                min_hand_detection_confidence=hand_threshold,
                min_hand_presence_confidence=max(0.40, hand_threshold),
            ))
        except Exception:
            self.face.close()
            raise

    def detect(self, frame):
        hand_frame = hand_frame_for_detection(frame)
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        hand_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(hand_frame, cv2.COLOR_BGR2RGB))
        with self.lock:
            face_result = self.face.detect(image)
            hand_result = self.hands.detect(hand_image)
        face = None
        if face_result.face_landmarks:
            face = {
                "points": points_of(face_result.face_landmarks[0]),
                "blendshapes": {c.category_name: float(c.score) for c in face_result.face_blendshapes[0]},
                "matrix": np.asarray(face_result.facial_transformation_matrixes[0]),
            }
        hands = []
        for index, hand in enumerate(hand_result.hand_landmarks):
            category = hand_result.handedness[index][0]
            hands.append({
                "points": points_of(hand),
                "world": points_of(hand_result.hand_world_landmarks[index]),
                "side": category.category_name,
                "side_score": float(category.score),
            })
        return face, hands

    def close(self):
        with self.lock:
            self.face.close()
            self.hands.close()
