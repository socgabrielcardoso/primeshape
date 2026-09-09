import json
from pathlib import Path
from .geometry import signal

RULES = json.loads((Path(__file__).resolve().parents[3] / "config/affect-rules.json").read_text(encoding="utf-8"))


def apparent_affect(blends, quality):
    if quality < 0.4:
        return []
    pair = lambda names: min(blends.get(name, 0) for name in names)
    result = []
    for code, rule in RULES.items():
        if max(blends.get("mouthSmileLeft", 0), blends.get("mouthSmileRight", 0)) >= rule["max_smile"]:
            continue
        if rule.get("max_brow_down") and pair(["browDownLeft", "browDownRight"]) >= rule["max_brow_down"]:
            continue
        values = [max(pair(names) for names in group["features"]) for group in rule["groups"]]
        if all(value >= group["threshold"] for value, group in zip(values, rule["groups"])):
            result.append(signal(code, rule["rotulo"], min(quality, sum(values) / len(values)), "estado_aparente", rule["evidencias"]))
    return result


class AffectTracker:
    def __init__(self):
        self.candidates = {}
        self.last_at = None

    def update(self, signals, now):
        if self.last_at is not None and (now <= self.last_at or now - self.last_at > 0.8):
            self.candidates.clear()
        self.last_at = now
        codes = {item["codigo"] for item in signals}
        self.candidates = {code: value for code, value in self.candidates.items() if code in codes}
        result = []
        for item in signals:
            rule = RULES.get(item["codigo"])
            if rule is None or now - self.candidates.setdefault(item["codigo"], now) >= rule["min_seconds"]:
                result.append(item)
        return result
