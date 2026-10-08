"""Cross-runtime hand tracker regression scenarios.

Each case is also exercised by the Node.js runner using the same JSON corpus.
No camera, model downloads, network, or GPU are required.
"""
import json
from pathlib import Path

import numpy as np
import pytest

from primeshape.hand_tracking import HandTracker


SCENARIOS = json.loads(Path(__file__).with_name("tracking_scenarios.json").read_text(encoding="utf-8"))


def hand(x, side="Left", score=0.95):
    points = np.zeros((21, 3), dtype=float)
    for index in range(21):
        points[index, :2] = [x + ((index % 5) - 2) * .01, .5 + ((index // 5) - 2) * .01]
    for index, dx, dy in ((0, -.02, .03), (5, -.04, 0), (9, 0, -.01), (13, .03, 0), (17, .05, .01)):
        points[index, :2] = [x + dx, .5 + dy]
    world = points.copy()
    world[:, 0] -= x
    world[:, 1] -= .5
    world *= .5
    return {"points": points, "world": world, "side": side, "side_score": score}


def corrupt(value, kind):
    if kind == "nan":
        value["points"][0, 0] = float("nan")
    elif kind == "infinity":
        value["points"][0, 0] = float("inf")
    elif kind == "world_nan":
        value["world"][8, 1] = float("nan")
    elif kind == "short_points":
        value["points"] = value["points"][:-1]
    elif kind == "short_world":
        value["world"] = value["world"][:-1]
    elif kind == "missing_coordinate":
        value["points"] = value["points"][:, :2]
    else:
        raise AssertionError(f"Unknown corruption: {kind}")
    return value


@pytest.mark.parametrize("case", SCENARIOS, ids=lambda case: case["name"])
def test_cross_runtime_tracking_scenarios(case):
    tracker = HandTracker()
    x = case.get("x", .35)
    mode = case["mode"]
    dt = case.get("dt_ms", 100) / 1000
    if mode == "invalid":
        assert tracker.update([corrupt(hand(x), case["kind"])], 0) == []
    elif mode == "swap_order":
        a, b = case["left"], case["right"]
        tracker.update([hand(a, "Left"), hand(b, "Right")], 0)
        current = tracker.update([hand(b + case.get("dx", 0), "Right"), hand(a + case.get("dx", 0), "Left")], dt)
        assert [item["tracking"]["id"] for item in current] == [1, 2]
        assert [item["side"] for item in current] == ["Left", "Right"]
    else:
        tracker.update([hand(x)], 0)
        if mode == "continuity":
            result = tracker.update([hand(x + case.get("dx", .01))], dt)
            assert len(result) == 1
            assert result[0]["tracking"]["id"] == 1
            assert result[0]["tracking"]["recuperado"] is False
        elif mode == "hold":
            result = tracker.update([], dt)
            assert len(result) == 1
            assert result[0]["tracking"]["recuperado"] is True
        elif mode == "expiry":
            assert tracker.update([], dt) == []
        elif mode == "reacquire":
            result = tracker.update([hand(x + case.get("dx", .01))], dt)
            assert len(result) == 1
            assert result[0]["tracking"]["id"] == 2
        elif mode == "rollback":
            result = tracker.update([hand(x)], -dt)
            assert len(result) == 1
            assert result[0]["tracking"]["id"] == 1
        else:
            raise AssertionError(f"Unknown mode: {mode}")
