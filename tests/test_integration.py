import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import cv2
import httpx
import matplotlib
import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@pytest.fixture(scope="module")
def server(tmp_path_factory):
    if not all((ROOT / "models" / name).is_file() for name in ("face_landmarker.task", "hand_landmarker.task")):
        pytest.skip("Execute python scripts/download_models.py antes dos testes de integração.")
    api_port, vision_port = free_port(), free_port()
    while api_port == vision_port:
        vision_port = free_port()
    env = os.environ.copy()
    env.update(PRIMESHAPE_API_PORT=str(api_port), PRIMESHAPE_VISION_PORT=str(vision_port))
    log_path = tmp_path_factory.mktemp("services") / "services.log"
    with log_path.open("w") as output:
        process = subprocess.Popen([sys.executable, str(ROOT / "scripts/run.py")], cwd=ROOT, env=env, stdout=output, stderr=output)
        client = httpx.Client(base_url=f"http://127.0.0.1:{api_port}/api", timeout=12, trust_env=False)
        ready = False
        try:
            deadline = time.monotonic() + 40
            while time.monotonic() < deadline and process.poll() is None:
                try:
                    ready = client.get("/health").status_code == 200
                    if ready: break
                except httpx.RequestError:
                    pass
                time.sleep(.2)
            assert ready, log_path.read_text()
            yield client, vision_port
        finally:
            client.close()
            process.terminate()
            try:
                process.wait(timeout=12)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


def jpeg(blank=False):
    image = np.full((480,640,3),240,np.uint8)
    if not blank:
        cv2.circle(image,(240,220),80,(10,10,10),-1)
    return cv2.imencode(".jpg",image)[1].tobytes()


def test_real_java_python_flow_and_session_lifecycle(server):
    client, _ = server
    health = client.get("/health").json()
    assert health["java"] == "pronto" and health["visao"]["status"] == "pronto"
    catalog = client.get("/capabilities").json()
    assert len(catalog["formas"]) >= 20 and len(catalog["sinais_faciais"]) > 20
    token = client.post("/sessions").json()["sessao_id"]
    headers = {"X-Session-Id":token,"X-Frame-Id":"1","Content-Type":"image/jpeg"}
    reply = client.post("/analyze",content=jpeg(),headers=headers)
    assert reply.status_code == 200, reply.text
    result = reply.json()
    assert result["quantidade_maos"] == 0
    assert result["rosto"]["presente"] is False
    assert result["formas"][0]["rotulo"] == "Círculo"
    assert reply.headers["X-Session-Frames"] == "1"
    assert client.post("/analyze",content=jpeg(),headers=headers).status_code == 409
    headers["X-Frame-Id"] = "2"
    result = client.post("/analyze",content=jpeg(True),headers=headers).json()
    assert result["formas"] == [] and result["rosto"]["sinais"] == []
    assert client.delete("/sessions",headers={"X-Session-Id":token}).status_code == 200
    assert client.post("/analyze",content=jpeg(),headers=headers).status_code == 401


def test_face_landmarks_through_gateway(server):
    client, _ = server
    portrait = Path(matplotlib.get_data_path()) / "sample_data/grace_hopper.jpg"
    token = client.post("/sessions").json()["sessao_id"]
    try:
        response = client.post("/analyze",content=portrait.read_bytes(),headers={"X-Session-Id":token,"X-Frame-Id":"1","Content-Type":"image/jpeg"})
        assert response.status_code == 200, response.text
        face = response.json()["rosto"]
        assert face["presente"] and len(face["pontos"]) == 478
        assert face["metricas"]["qualidade"] >= .4
        assert face["sinais"]
    finally:
        client.delete("/sessions",headers={"X-Session-Id":token})


def test_live_server_cors_and_internal_boundary(server):
    client, vision_port = server
    origin = "http://127.0.0.1:5500"
    result = client.options("/analyze",headers={"Origin":origin,"Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"content-type,x-session-id,x-frame-id"})
    assert result.status_code == 204
    assert result.headers["Access-Control-Allow-Origin"] == origin
    assert client.get("/health",headers={"Origin":"https://example.org"}).status_code == 403
    assert client.get("/health",headers={"Host":"evil.example"}).status_code == 403
    assert httpx.post(f"http://127.0.0.1:{vision_port}/analyze",content=jpeg(),trust_env=False).status_code == 403


def test_invalid_requests_do_not_poison_next_frame(server):
    client, _ = server
    token = client.post("/sessions").json()["sessao_id"]
    headers = {"X-Session-Id":token,"X-Frame-Id":"1","Content-Type":"image/jpeg"}
    try:
        assert client.post("/analyze",content=b"invalid",headers=headers).status_code == 400
        assert client.post("/analyze",content=b"x"*1_048_577,headers=headers).status_code == 413
        assert client.post("/analyze",content=jpeg(),headers=headers).status_code == 200
    finally:
        client.delete("/sessions",headers={"X-Session-Id":token})


def test_missing_session(server):
    client, _ = server
    assert client.post("/analyze",content=jpeg(),headers={"Content-Type":"image/jpeg","X-Frame-Id":"1"}).status_code == 401
