"""Offline regression tests for the defensive credential leak gate."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest

SOURCE = Path(__file__).resolve().parents[1] / "scripts" / "security_guard.py"
SPEC = importlib.util.spec_from_file_location("security_guard", SOURCE)
assert SPEC and SPEC.loader
guard = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(guard)

class CredentialGuardTests(unittest.TestCase):
    def test_recognizes_github_classic_token(self):
        self.assertIn("github-classic-pat", guard.scan_bytes(b"ghp_" + b"a" * 36))

    def test_recognizes_github_fine_grained_token(self):
        self.assertIn("github-fine-grained-pat", guard.scan_bytes(b"github_pat_" + b"B" * 64))

    def test_recognizes_aws_access_key(self):
        self.assertIn("aws-access-key", guard.scan_bytes(b"AKIA" + b"0" * 16))

    def test_recognizes_private_key_header(self):
        self.assertIn("private-key-block", guard.scan_bytes(b"-----BEGIN PRIVATE KEY-----"))

    def test_rejects_plain_placeholder_text(self):
        self.assertEqual([], guard.scan_bytes(b"API_KEY=replace-this-in-local-env"))

    def test_does_not_echo_secrets_from_scanner(self):
        self.assertIsInstance(guard.scan_bytes(b"non-sensitive text"), list)

if __name__ == "__main__":
    unittest.main()
