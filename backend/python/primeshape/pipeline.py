import threading
import time
from dataclasses import dataclass, field
from .config import SETTINGS
from .expressions import classify_expressions
from .face_metrics import measure_face
from .frames import decode_frame, frame_quality
from .geometry import serial_points
from .hands import analyze_hand, bimanual_gestures, classify_gestures
from .landmarks import LandmarkEngine
from .shapes import ShapeDetector
from .temporal import FaceTimeline


@dataclass
class Session:
    timeline: FaceTimeline = field(default_factory=FaceTimeline)
    lock: threading.Lock = field(default_factory=threading.Lock)
    last_used: float = field(default_factory=time.monotonic)
    last_frame: int = -1


class VisionPipeline:
    def __init__(self):
        self.landmarks = LandmarkEngine()
        self.shapes = ShapeDetector()
        self.sessions = {}
        self.lock = threading.Lock()
        self.capacity = threading.BoundedSemaphore(2)

    def session(self, session_id):
        now = time.monotonic()
        with self.lock:
            stale = [key for key, value in self.sessions.items() if now - value.last_used > SETTINGS.session_ttl and not value.lock.locked()]
            for key in stale:
                del self.sessions[key]
            if session_id not in self.sessions:
                if len(self.sessions) >= SETTINGS.max_sessions:
                    raise RuntimeError("Limite de sessões atingido.")
                self.sessions[session_id] = Session()
            return self.sessions[session_id]

    def remove(self, session_id):
        with self.lock:
            session = self.sessions.get(session_id)
            if session is not None and not session.lock.locked():
                del self.sessions[session_id]

    def analyze(self, data, session_id, frame_id):
        session = self.session(session_id)
        if not session.lock.acquire(blocking=False):
            raise BlockingIOError("Aguarde a análise do quadro anterior.")
        acquired = False
        try:
            if frame_id <= session.last_frame:
                raise ValueError("Quadro repetido ou fora de ordem.")
            acquired = self.capacity.acquire(blocking=False)
            if not acquired:
                raise BlockingIOError("Processamento ocupado. Reduza a frequência de quadros.")
            started = time.perf_counter()
            frame = decode_frame(data)
            now = time.monotonic()
            height, width = frame.shape[:2]
            quality = frame_quality(frame)
            raw_face, raw_hands = self.landmarks.detect(frame)
            hands = [analyze_hand(hand, width, height) for hand in raw_hands]
            for hand in hands:
                hand["gestos"] = classify_gestures(hand)
            exclusions = [hand["points"] for hand in raw_hands]
            face = {"presente": False, "pontos": [], "sinais": [], "metricas": None, "temporal": session.timeline.update(None, now) if raw_face is None else None}
            if raw_face is not None:
                metrics = measure_face(raw_face, width, height, quality)
                timeline = session.timeline.update(metrics, now)
                face = {
                    "presente": True,
                    "pontos": serial_points(raw_face["points"]),
                    "metricas": metrics,
                    "temporal": timeline,
                    "sinais": session.timeline.affect.update(classify_expressions(metrics, raw_face["blendshapes"], timeline), now),
                    "coeficientes": {key: round(value, 4) for key, value in raw_face["blendshapes"].items()},
                }
                exclusions.append(raw_face["points"])
                if metrics["qualidade"] < 0.4:
                    quality["avisos"].append("Rosto pequeno, lateral ou com baixa qualidade; estados suspensos")
            shapes = self.shapes.detect(frame, exclusions)
            session.last_frame = frame_id
            session.last_used = time.monotonic()
            return {
                "versao": "1.0",
                "quadro_id": frame_id,
                "dimensoes": {"largura": width, "altura": height},
                "qualidade": quality,
                "rosto": face,
                "maos": hands,
                "quantidade_maos": len(hands),
                "gestos_duas_maos": bimanual_gestures(hands, width, height),
                "formas": shapes,
                "processamento_ms": round((time.perf_counter() - started) * 1000, 1),
            }
        finally:
            if acquired:
                self.capacity.release()
            session.lock.release()

    def close(self):
        self.landmarks.close()
        self.sessions.clear()
