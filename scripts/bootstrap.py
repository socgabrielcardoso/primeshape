import hashlib
import os
from pathlib import Path
import subprocess
import sys
import venv

ROOT = Path(__file__).resolve().parents[1]


def bootstrap():
    if not ((3, 10) <= sys.version_info[:2] <= (3, 12)):
        raise RuntimeError("Use Python 3.10, 3.11 ou 3.12. Os modelos deste projeto foram fixados para essas versões.")
    directory = ROOT / ".venv"
    executable = directory / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not executable.exists():
        print("Preparando ambiente Python…", flush=True)
        venv.EnvBuilder(with_pip=True).create(directory)
    requirements = ROOT / "backend/python/requirements.txt"
    digest = hashlib.sha256(requirements.read_bytes()).hexdigest()
    stamp = directory / "primeshape-dependencies.sha256"
    if not stamp.exists() or stamp.read_text() != digest:
        subprocess.run([str(executable), "-m", "pip", "install", "-r", str(requirements)], check=True)
        stamp.write_text(digest)
    subprocess.run([str(executable), str(ROOT / "scripts/run.py")], cwd=ROOT, check=True)


if __name__ == "__main__":
    try:
        bootstrap()
    except KeyboardInterrupt:
        print("\nEncerrado.")
    except (RuntimeError, OSError, subprocess.CalledProcessError) as error:
        print(f"\nNão foi possível iniciar: {error}", file=sys.stderr)
        sys.exit(1)
