import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def build_java():
    java = shutil.which("java")
    if not java:
        raise RuntimeError("Java não encontrado. Instale o JDK 17 ou superior e reabra o terminal.")
    compiler = shutil.which("javac")
    command = [compiler] if compiler else [java, "-m", "jdk.compiler/com.sun.tools.javac.Main"]
    check = subprocess.run(command + ["-version"], capture_output=True, text=True)
    if check.returncode:
        raise RuntimeError("Compilador Java não encontrado. É necessário o JDK, além do ambiente de execução Java.")
    sources = sorted((ROOT / "backend/java/src/main/java").rglob("*.java"))
    output = ROOT / "backend/java/build"
    output.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(command + ["-encoding", "UTF-8", "--release", "17", "-d", str(output), *map(str, sources)])
    if result.returncode:
        raise RuntimeError("Falha ao compilar o serviço Java. Confira a versão do JDK.")
    return java, output


if __name__ == "__main__":
    build_java()
