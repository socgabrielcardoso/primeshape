from download_models import ROOT, download_manifest


if __name__ == "__main__":
    download_manifest(ROOT / "tests/assets")
