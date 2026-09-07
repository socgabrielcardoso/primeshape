from io import BytesIO
import cv2
import numpy as np
from PIL import Image
import pytest
from primeshape.frames import decode_frame


@pytest.mark.parametrize("data", [b"", b"invalid", b"x" * 1_048_577])
def test_rejects_invalid_payloads(data):
    with pytest.raises(ValueError):
        decode_frame(data)


def test_rejects_dimensions_before_decode():
    output = BytesIO()
    Image.new("RGB", (3000,2000)).save(output, format="JPEG")
    with pytest.raises(ValueError, match="Resolução"):
        decode_frame(output.getvalue())


def test_resize_preserves_aspect():
    source = np.zeros((720,1280,3),np.uint8)
    encoded = cv2.imencode(".jpg", source)[1].tobytes()
    assert decode_frame(encoded).shape == (360,640,3)
