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
            self.hands = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
                base_options=python.BaseOptions(model_asset_path=str(SETTINGS.model_dir / "hand_landmarker.task")),
                running_mode=vision.RunningMode.IMAGE,
                num_hands=2,
                min_hand_detection_confidence=SETTINGS.detector_threshold,
                min_hand_presence_confidence=SETTINGS.detector_threshold,
            ))
        except Exception:
            self.face.close()
            raise

    def detect(self, frame):
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        with self.lock:
            face_result = self.face.detect(image)
            hand_result = self.hands.detect(image)
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
