import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]


def download_manifest(directory):
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    for name, info in manifest.items():
        target = directory / name
        if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == info["sha256"]:
            print(f"Arquivo validado: {name}")
            continue
        temporary = target.with_suffix(".download")
        try:
            with urlopen(info["url"], timeout=60) as response, temporary.open("wb") as output:
                total = 0
                while chunk := response.read(65536):
                    total += len(chunk)
                    if total > info["bytes"]:
                        raise ValueError(f"Tamanho inesperado: {name}")
                    output.write(chunk)
            if total != info["bytes"] or hashlib.sha256(temporary.read_bytes()).hexdigest() != info["sha256"]:
                raise ValueError(f"Integridade inválida: {name}")
            temporary.replace(target)
            print(f"Arquivo instalado: {name}")
        finally:
            temporary.unlink(missing_ok=True)


def download_models():
    download_manifest(ROOT / "models")


if __name__ == "__main__":
    download_models()
