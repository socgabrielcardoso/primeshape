#!/usr/bin/env python3
"""High-confidence credential leak gate. Dependency and SAST scans are separate controls."""
from __future__ import annotations

import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
MAX_BYTES = 2_000_000
TEXT_EXT = {".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".html",
            ".css", ".json", ".jsonl", ".toml", ".ini", ".xml", ".yaml",
            ".yml", ".md", ".txt", ".java", ".sh", ".ps1", ".env", ".properties"}
PATTERNS = {
    "github-classic-pat": re.compile(rb"ghp_[A-Za-z0-9]{30,}"),
    "github-fine-grained-pat": re.compile(rb"github_pat_[A-Za-z0-9_]{40,}"),
    "aws-access-key": re.compile(rb"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    "slack-bot-token": re.compile(rb"xoxb-[0-9]{10,}-[A-Za-z0-9-]{15,}"),
    "openai-secret": re.compile(rb"sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,}"),
    "private-key-block": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
}

def scan_bytes(content: bytes) -> list[str]:
    return [label for label, regex in PATTERNS.items() if regex.search(content)]

def tracked_files() -> list[pathlib.Path]:
    result = subprocess.run(
        ["git", "ls-files", "-z"], cwd=ROOT, check=True, capture_output=True
    )
    return [ROOT / pathlib.Path(raw.decode("utf-8", errors="replace"))
            for raw in result.stdout.split(b"\0") if raw]

def self_test() -> None:
    assert "github-classic-pat" in scan_bytes(b"ghp_" + b"A" * 36)
    assert "aws-access-key" in scan_bytes(b"AKIA" + b"0" * 16)
    assert "private-key-block" in scan_bytes(b"-----BEGIN PRIVATE KEY-----")
    assert not scan_bytes(b"token=replace_me\npassword=example-password")
    print("Credential scan self-test: OK")

def main() -> int:
    if "--self-test" in sys.argv:
        self_test()
        return 0
    checked = 0
    findings = 0
    for path in tracked_files():
        if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_BYTES:
            continue
        if path.suffix.lower() not in TEXT_EXT and path.name not in {".env", ".env.example"}:
            continue
        data = path.read_bytes()
        if b"\0" in data[:1024]:
            continue
        checked += 1
        for label in scan_bytes(data):
            # Deliberately never print matched credentials.
            print(f"::error file={path.relative_to(ROOT)}::Potential exposed {label}")
            findings += 1
    print(f"Scanned {checked} tracked text files; high-confidence findings: {findings}")
    if findings:
        print("Rotate and revoke exposed credentials; scrub history separately.")
    return 1 if findings else 0

if __name__ == "__main__":
    raise SystemExit(main())
