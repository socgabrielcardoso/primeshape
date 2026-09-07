import pytest
from primeshape.temporal import FaceTimeline
from primeshape.expressions import CATALOG, classify_expressions


def metrics(closed=False, wide=False, quality=1):
    return {"qualidade": quality, "caixa": [0.2,0.2,0.3,0.4], "olho_esquerdo_fechado": closed, "olho_direito_fechado": closed, "boca_ampla": wide, "boca_aberta": wide, "abertura_boca": 0.6 if wide else 0.01, "orientacao": {"horizontal_graus":0,"vertical_graus":0,"inclinacao_graus":0}}


def test_blink_requires_reopening_and_sleep_requires_time():
    state = FaceTimeline()
    state.update(metrics(), 0)
    first = state.update(metrics(True), .1)
    assert not first["piscada_recente"]
    assert "possivel_sono" not in [s["codigo"] for s in classify_expressions(metrics(True), {}, first)]
    reopened = state.update(metrics(), .3)
    assert reopened["piscada_recente"]
    assert reopened["piscadas_60s"] == 1
    for i in range(4, 125):
        last = state.update(metrics(True), i / 10)
    assert "possivel_sono" in [s["codigo"] for s in classify_expressions(metrics(True), {}, last)]


@pytest.mark.parametrize("interruption", [None, metrics(True, quality=0.1)])
def test_invalid_observation_cannot_accumulate_sleep(interruption):
    state = FaceTimeline()
    for i in range(30):
        state.update(metrics(True), i / 10)
    state.update(interruption, 3)
    result = state.update(metrics(True), 3.1)
    assert result["olhos_fechados_s"] == 0
    assert result["perclos_observado"] is None


def test_gaps_reset_and_short_mouth_opening_is_not_yawn():
    state = FaceTimeline()
    for i in range(10):
        result = state.update(metrics(wide=True), i / 10)
    assert not result["possivel_bocejo"]
    result = state.update(metrics(wide=True), 8)
    assert result["boca_ampla_s"] == 0
    for i in range(81, 101):
        result = state.update(metrics(wide=True), i / 10)
    assert result["possivel_bocejo"]
    assert result["possiveis_bocejos_60s"] == 1


def test_catalog_and_low_quality_abstention():
    assert len(CATALOG) > 20
    state = FaceTimeline().result(0)
    assert classify_expressions(metrics(quality=.2), {"mouthSmileLeft":1,"mouthSmileRight":1}, state) == []
    outputs = classify_expressions(metrics(), {}, state)
    assert all(0 <= item["score"] <= 1 for item in outputs)
    assert not any(s["codigo"] in ("possivel_sono", "tristeza_aparente", "desconforto_aparente") for s in outputs)


def test_emotion_candidate_requires_multiple_signals():
    state = FaceTimeline().result(0)
    blends = {"mouthFrownLeft":.9,"mouthFrownRight":.9}
    assert "tristeza_aparente" not in [s["codigo"] for s in classify_expressions(metrics(), blends, state)]
    blends["browInnerUp"] = .8
    candidate = next(s for s in classify_expressions(metrics(), blends, state) if s["codigo"] == "tristeza_aparente")
    assert candidate["tipo"] == "estado_aparente"
    assert candidate["evidencias"]
