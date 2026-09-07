import cv2
import numpy as np
import pytest
from primeshape.shapes import SHAPE_CATALOG, ShapeDetector

QUADS = {
    "Quadrado": [(-1,-1),(1,-1),(1,1),(-1,1)],
    "Retângulo": [(-1,-.55),(1,-.55),(1,.55),(-1,.55)],
    "Losango": [(0,-1),(.65,0),(0,1),(-.65,0)],
    "Trapézio": [(-.6,-.7),(.6,-.7),(1,.7),(-1,.7)],
    "Paralelogramo": [(-.6,-.5),(1,-.5),(.6,.5),(-1,.5)],
    "Deltoide": [(0,-1),(.7,.25),(0,1),(-.7,.25)],
}
SIDES = {"Triângulo":3,"Pentágono":5,"Hexágono":6,"Heptágono":7,"Octógono":8,"Nonágono":9,"Decágono":10,"Undecágono":11,"Dodecágono":12}


def fixture_frame(name, degrees=0):
    if name in QUADS:
        points = np.array(QUADS[name])
    elif name in SIDES or name.startswith("Estrela"):
        n = SIDES.get(name, 5 if "5" in name else 6)
        star = name.startswith("Estrela")
        t = np.linspace(-np.pi/2, 3*np.pi/2, n*(2 if star else 1), endpoint=False)
        radius = np.where(np.arange(len(t)) % 2, .44, 1) if star else np.ones(n)
        points = np.c_[np.cos(t),np.sin(t)] * radius[:,None]
    elif name == "Cruz":
        points = np.array([(-.32,-1),(.32,-1),(.32,-.32),(1,-.32),(1,.32),(.32,.32),(.32,1),(-.32,1),(-.32,.32),(-1,.32),(-1,-.32),(-.32,-.32)])
    elif name == "Seta":
        points = np.array([(-1,-.32),(-.05,-.32),(-.05,-.85),(1,0),(-.05,.85),(-.05,.32),(-1,.32)])
    elif name == "Chevron":
        points = np.array([(-1,-1),(-.1,-1),(1,0),(-.1,1),(-1,1),(0,0)])
    elif name == "Coração":
        t = np.linspace(0,2*np.pi,200,endpoint=False)
        points = np.c_[16*np.sin(t)**3, -(13*np.cos(t)-5*np.cos(2*t)-2*np.cos(3*t)-np.cos(4*t))]/17
    else:
        t = np.linspace(0,np.pi if name == "Semicírculo" else 2*np.pi,200)
        points = np.c_[np.cos(t),-np.sin(t)]
        if name == "Oval": points[:,1] *= .58
    t = np.deg2rad(degrees)
    rotation = np.array([[np.cos(t),-np.sin(t)],[np.sin(t),np.cos(t)]])
    pixels = np.round(points @ rotation.T * 95 + [320,240]).astype(np.int32)
    image = np.full((480,640,3),235,np.uint8)
    cv2.fillPoly(image,[pixels],(20,20,20),cv2.LINE_AA)
    return cv2.imdecode(cv2.imencode(".jpg",image,[cv2.IMWRITE_JPEG_QUALITY,85])[1],cv2.IMREAD_COLOR)


@pytest.fixture(scope="module")
def detector():
    return ShapeDetector()


@pytest.mark.parametrize("name", SHAPE_CATALOG)
@pytest.mark.parametrize("rotation", [0,27])
def test_all_catalog_shapes_in_raster_images(detector, name, rotation):
    results = detector.detect(fixture_frame(name, rotation))
    assert name in [result["rotulo"] for result in results]
    assert len(results) == 1


def test_blank_frame_has_no_shapes(detector):
    assert detector.detect(np.full((480,640,3),128,np.uint8)) == []


def test_exclusion_and_multiple_shapes(detector):
    image = np.full((480,640,3),255,np.uint8)
    cv2.circle(image,(160,240),75,(0,0,0),-1)
    cv2.rectangle(image,(390,165),(540,315),(0,0,0),-1)
    assert {s["rotulo"] for s in detector.detect(image)} == {"Círculo","Quadrado"}
    exclusions = [np.array([[.1,.2],[.45,.2],[.45,.8],[.1,.8]])]
    assert [s["rotulo"] for s in detector.detect(image, exclusions)] == ["Quadrado"]
