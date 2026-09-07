import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class Settings:
    model_dir: Path = ROOT / "models"
    max_frame_bytes: int = 1_048_576
    max_frame_pixels: int = 2_073_600
    frame_width: int = 640
    max_sessions: int = 4
    session_ttl: float = 120.0
    max_observation_gap: float = 0.8
    detector_threshold: float = 0.6
    shape_min_area: float = 700.0
    shape_max_count: int = 12
    gateway_token: str = os.environ.get("PRIMESHAPE_INTERNAL_TOKEN", "")


SETTINGS = Settings()
