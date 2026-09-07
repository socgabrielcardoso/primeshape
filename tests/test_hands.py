import numpy as np
import pytest
from primeshape.hands import analyze_hand, classify_gestures


@pytest.mark.parametrize("degrees", [0, 70, 180, 270])
def test_finger_extension_is_invariant_to_rotation(degrees):
    world = np.zeros((21,3))
    world[1:5] = [[-.025,.018,0],[-.044,.03,0],[-.061,.05,0],[-.08,.07,0]]
    for base, x in zip((5,9,13,17), (-.035,0,.03,.06)):
        world[base:base+4] = [[x,y,0] for y in (.06,.105,.13,.16)]
    t = np.deg2rad(degrees)
    rotation = np.array([[np.cos(t),-np.sin(t),0],[np.sin(t),np.cos(t),0],[0,0,1]])
    world = world @ rotation.T
    hand = analyze_hand({"world":world,"points":world*2+[.5,.5,0],"side":"Left","side_score":.98},640,480)
    assert len(hand["pontos"]) == 21
    assert hand["dedos_estendidos"] == 5
    assert hand["lado"] == "Esquerda"
    assert "mao_aberta" in [s["codigo"] for s in classify_gestures(hand)]
    hand["parcial"] = True
    assert classify_gestures(hand) == []
