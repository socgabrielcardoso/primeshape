from io import BytesIO
import cv2
import numpy as np
from PIL import Image, UnidentifiedImageError
from .config import SETTINGS
from .geometry import ramp


def decode_frame(data):
    if not data or len(data) > SETTINGS.max_frame_bytes:
        raise ValueError("O quadro está vazio ou excede 1 MiB.")
    try:
        with Image.open(BytesIO(data)) as image:
            width, height = image.size
            if image.format != "JPEG":
                raise ValueError("Envie um quadro JPEG.")
            if width < 160 or height < 120 or width * height > SETTINGS.max_frame_pixels:
                raise ValueError("Resolução fora do intervalo permitido: mínimo 160 × 120, máximo 2 MP.")
            image.verify()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise ValueError("Não foi possível decodificar a imagem.") from error
    frame = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Quadro JPEG inválido.")
    if width > SETTINGS.frame_width:
        frame = cv2.resize(frame, (SETTINGS.frame_width, round(height * SETTINGS.frame_width / width)), interpolation=cv2.INTER_AREA)
    return frame


def frame_quality(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    brightness = float(gray.mean())
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    score = min(ramp(brightness, 20, 65), 1 - ramp(brightness, 215, 250), ramp(sharpness, 4, 50))
    warnings = []
    if brightness < 45:
        warnings.append("Pouca iluminação")
    if brightness > 225:
        warnings.append("Iluminação excessiva")
    if sharpness < 18:
        warnings.append("Imagem pouco nítida")
    return {"score": round(score, 3), "luminosidade": round(brightness, 1), "nitidez": round(sharpness, 1), "avisos": warnings}
