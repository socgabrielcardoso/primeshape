import numpy as np
from primeshape.hand_tracking import HandTracker


PALM = [0, 5, 9, 13, 17]


def raw_hand(center_x, side="Left", score=.95):
    points = np.zeros((21, 3), dtype=float)
    for index in range(21):
        points[index, :2] = [center_x + ((index % 5) - 2) * .01, .5 + ((index // 5) - 2) * .01]
    for index, dx, dy in ((0, -.02, .03), (5, -.04, 0), (9, 0, -.01), (13, .03, 0), (17, .05, .01)):
        points[index, :2] = [center_x + dx, .5 + dy]
    world = points.copy()
    world[:, 0] -= center_x
    world[:, 1] -= .5
    world *= .5
    return {"points": points, "world": world, "side": side, "side_score": score}


def center_x(hand):
    return float(np.asarray(hand["points"])[PALM, 0].mean())


def test_tracker_keeps_identity_when_detection_order_flips():
    tracker = HandTracker()
    first = tracker.update([raw_hand(.2, "Left"), raw_hand(.8, "Right")], 0.0)
    assert [hand["tracking"]["id"] for hand in first] == [1, 2]

    second = tracker.update([raw_hand(.78, "Right"), raw_hand(.22, "Left")], .1)
    assert [hand["tracking"]["id"] for hand in second] == [1, 2]
    assert [hand["side"] for hand in second] == ["Left", "Right"]
    assert center_x(second[0]) < center_x(second[1])


def test_short_dropout_is_held_then_expires():
    tracker = HandTracker()
    tracker.update([raw_hand(.35)], 0.0)
    tracker.update([raw_hand(.36)], .1)

    held = tracker.update([], .2)
    assert len(held) == 1
    assert held[0]["tracking"]["recuperado"] is True
    assert held[0]["tracking"]["frames_ausentes"] == 1
    assert held[0]["tracking"]["atraso_ms"] == 100.0

    assert tracker.update([], .5) == []


def test_large_single_frame_jump_is_clamped_without_duplicate_track():
    tracker = HandTracker()
    tracker.update([raw_hand(.2)], 0.0)
    before = tracker.update([raw_hand(.21)], .1)[0]
    after = tracker.update([raw_hand(.9)], .2)

    assert len(after) == 1
    assert after[0]["tracking"]["id"] == before["tracking"]["id"]
    assert center_x(after[0]) - center_x(before) < .30


def test_low_confidence_handedness_flip_does_not_change_identity():
    tracker = HandTracker()
    tracker.update([raw_hand(.4, "Left", .96)], 0.0)
    output = tracker.update([raw_hand(.41, "Right", .55)], .1)

    assert output[0]["side"] == "Left"
    assert output[0]["tracking"]["id"] == 1


def test_invalid_landmarks_are_ignored():
    tracker = HandTracker()
    invalid = raw_hand(.5)
    invalid["points"][0, 0] = np.nan
    assert tracker.update([invalid], 0.0) == []


def test_single_corrupted_fingertip_is_clamped_without_moving_palm():
    tracker = HandTracker()
    tracker.update([raw_hand(.35)], 0.0)
    baseline = tracker.update([raw_hand(.36)], .1)[0]
    noisy = raw_hand(.37)
    noisy["points"][8, 0] += .8
    updated = tracker.update([noisy], .2)[0]
    assert updated["tracking"]["id"] == 1
    assert updated["points"][8, 0] - baseline["points"][8, 0] < .20
    assert abs(center_x(updated) - center_x(baseline)) < .08
