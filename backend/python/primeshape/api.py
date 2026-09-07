from contextlib import asynccontextmanager
import logging
import re
import secrets
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from .config import SETTINGS
from .expressions import CATALOG
from .pipeline import VisionPipeline
from .shapes import SHAPE_CATALOG

logger = logging.getLogger("primeshape")


@asynccontextmanager
async def lifespan(app):
    if len(SETTINGS.gateway_token) < 32:
        raise RuntimeError("Inicie pelo comando python scripts/run.py para configurar a comunicação interna.")
    app.state.pipeline = VisionPipeline()
    yield
    app.state.pipeline.close()


app = FastAPI(title="PrimeShape — Visão", version="1.0.0", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


def internal_access(x_internal_token: str = Header(default="")):
    if not SETTINGS.gateway_token or not secrets.compare_digest(x_internal_token, SETTINGS.gateway_token):
        raise HTTPException(403, "Comunicação interna não autorizada.")


@app.exception_handler(HTTPException)
async def handle_http_error(request, error):
    return JSONResponse(status_code=error.status_code, content={"erro": error.detail})


@app.get("/health")
def health(request: Request):
    return {"status": "pronto", "servico": "Python", "modelos": "carregados", "versao": "1.0.0"}


@app.get("/capabilities", dependencies=[Depends(internal_access)])
def capabilities():
    return {
        "formas": SHAPE_CATALOG,
        "sinais_faciais": CATALOG,
        "maximo_maos": 2,
        "maximo_rostos": 1,
        "pontos_por_mao": 21,
        "pontos_faciais": 478,
        "scores": "Scores geométricos e intensidades de regras; não são probabilidades calibradas.",
        "limites": [
            "Base experimental de observação visual; sem validação para uso clínico ou alarmes de segurança.",
            "Sono, vigília, atenção, emoções e desconforto são hipóteses visuais, não diagnósticos.",
            "Dor, lágrimas, consciência e a causa de uma expressão não são identificadas de forma confiável.",
            "Formas são contornos planos visíveis, preferencialmente contrastados e sem oclusão.",
            "Quadrados girados continuam quadrados; losangos requerem ângulos não retos.",
            "A análise temporal reinicia após perda do rosto, baixa qualidade ou intervalo excessivo.",
            "Um rosto é acompanhado; a aplicação não identifica pessoas nem vincula pacientes.",
            "Amostragem baixa pode perder piscadas curtas; PERCLOS usa somente tempo efetivamente observado.",
        ],
        "fontes": [
            "https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/python",
            "https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/python",
            "https://docs.opencv.org/4.x/dd/d49/tutorial_py_contour_features.html",
        ],
    }


@app.post("/analyze", dependencies=[Depends(internal_access)])
async def analyze(request: Request, x_session_id: str = Header(default=""), x_frame_id: str = Header(default="")):
    if not re.fullmatch(r"[a-f0-9]{32,64}", x_session_id):
        raise HTTPException(400, "Sessão inválida.")
    if not x_frame_id.isdigit() or len(x_frame_id) > 12:
        raise HTTPException(400, "Identificador do quadro inválido.")
    if request.headers.get("content-type", "").split(";")[0] != "image/jpeg":
        raise HTTPException(415, "Envie image/jpeg.")
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > SETTINGS.max_frame_bytes:
            raise HTTPException(413, "Quadro maior que 1 MiB.")
    try:
        return await run_in_threadpool(request.app.state.pipeline.analyze, bytes(data), x_session_id, int(x_frame_id))
    except BlockingIOError as error:
        raise HTTPException(429, str(error)) from error
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
    except RuntimeError as error:
        logger.error("Falha no processamento: %s", type(error).__name__)
        raise HTTPException(503, "Visão indisponível. Consulte o terminal e reinicie a sessão.") from error
    except Exception as error:
        logger.exception("Falha inesperada no detector")
        raise HTTPException(500, "Falha ao analisar o quadro.") from error


@app.delete("/sessions/{session_id}", dependencies=[Depends(internal_access)])
def delete_session(session_id: str, request: Request):
    request.app.state.pipeline.remove(session_id)
    return {"status": "encerrada"}
