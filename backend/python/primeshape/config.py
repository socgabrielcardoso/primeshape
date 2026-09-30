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
    hand_hold_s: float = 0.24
    hand_match_gate: float = 3.0
    hand_jump_base: float = 0.16
    hand_jump_per_s: float = 0.95
    hand_smoothing_min: float = 0.30
    hand_smoothing_max: float = 0.84
    shape_min_area: float = 700.0
    shape_max_count: int = 12
    gateway_token: str = os.environ.get("PRIMESHAPE_INTERNAL_TOKEN", "")


SETTINGS = Settings()
