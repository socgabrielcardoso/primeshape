import os
import secrets
import signal
import socket
import subprocess
import sys
import time
from urllib.request import build_opener, ProxyHandler
from build_java import ROOT, build_java
from download_models import download_models


def available(port):
    with socket.socket() as connection:
        try:
            connection.bind(("127.0.0.1", port))
        except OSError as error:
            raise RuntimeError(f"A porta {port} está ocupada. Encerre a outra instância do PrimeShape e tente novamente.") from error


def wait_ready(url, processes, timeout=40):
    opener = build_opener(ProxyHandler({}))
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if any(p.poll() is not None for p in processes):
            raise RuntimeError("Um serviço encerrou durante a inicialização. Veja a mensagem no terminal.")
        try:
            with opener.open(url, timeout=1) as response:
                if response.status == 200:
                    return
        except OSError:
            pass
        time.sleep(0.2)
    raise RuntimeError("O serviço não ficou pronto a tempo. Confira os modelos e as dependências.")


def run():
    processes = []
    environment = os.environ.copy()
    environment["PRIMESHAPE_INTERNAL_TOKEN"] = secrets.token_hex(32)
    environment["PYTHONPATH"] = str(ROOT / "backend/python")
    environment["PYTHONUNBUFFERED"] = "1"
    environment["TF_CPP_MIN_LOG_LEVEL"] = "2"
    environment["GLOG_minloglevel"] = "2"
    api_port = int(environment.get("PRIMESHAPE_API_PORT", "8080"))
    vision_port = int(environment.get("PRIMESHAPE_VISION_PORT", "8765"))
    if not (1024 <= api_port <= 65535 and 1024 <= vision_port <= 65535) or api_port == vision_port:
        raise RuntimeError("Portas inválidas para os serviços.")
    available(api_port)
    available(vision_port)
    java, build = build_java()
    download_models()
    try:
        processes.append(subprocess.Popen([sys.executable, "-m", "uvicorn", "primeshape.api:app", "--host", "127.0.0.1", "--port", str(vision_port), "--no-access-log", "--limit-concurrency", "12"], cwd=ROOT, env=environment))
        wait_ready(f"http://127.0.0.1:{vision_port}/health", processes)
        processes.append(subprocess.Popen([java, "-cp", str(build), "br.com.primeshape.Gateway"], cwd=ROOT, env=environment))
        wait_ready(f"http://127.0.0.1:{api_port}/api/health", processes)
        print("\nPrimeShape pronto. Abra index.html com Live Server e clique em INICIAR CÂMERA.\nCtrl+C encerra os dois serviços.\n", flush=True)
        while all(p.poll() is None for p in processes):
            time.sleep(0.5)
        raise RuntimeError("Um serviço foi encerrado. A análise foi interrompida.")
    finally:
        for process in reversed(processes):
            if process.poll() is None:
                process.terminate()
        for process in processes:
            try:
                process.wait(timeout=6)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=3)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    try:
        run()
    except KeyboardInterrupt:
        print("\nPrimeShape encerrado.")
    except (RuntimeError, OSError, ValueError) as error:
        print(f"\nErro: {error}", file=sys.stderr)
        sys.exit(1)
