# Contributing to PrimeShape

PrimeShape is an educational computer-vision laboratory. Small, reviewable changes are preferred to large rewrites without a test plan.

## Development checklist

1. Reproduce the problem and record OS, browser, model mode, lighting, camera settings and expected behavior.
2. Keep browser and Python tracking contracts coherent when touching shared features; add a case to `tests/tracking_scenarios.json` for behavioral changes.
3. Avoid assumptions based on one webcam, one person, one skin tone or one lighting condition.
4. Validate unit tests and, for UI/worker changes, Playwright browser tests. See [Testing](docs/TESTING.md).
5. Describe the trade-offs: accuracy vs smoothing, latency vs resource usage, false positives vs missed detections.
6. Update documentation and note known limitations rather than claiming production-grade detection.

## Local checks

```bash
node --test tests/browser/logic.test.mjs tests/browser/tracker-regression.test.mjs
```

```bash
# Linux/macOS, after installing required packages
PYTHONPATH=backend/python python -m pytest -q tests/test_hand_tracking.py tests/test_hands.py tests/test_tracker_scenarios.py
```

Windows PowerShell equivalent: `$env:PYTHONPATH = "backend/python"` then run the pytest command.

## Pull requests

A useful PR includes the observed failure, behavioral fix, regression test, impact on the two runtimes (when applicable), and the outcome of CI/manual checks. Keep changes focused; do not generate empty or arbitrary commits merely to increase activity.

Use concise conventional messages: `fix(tracking): ...`, `test(browser): ...`, `docs: ...`, `ci: ...`.

## Security, ethics and privacy

- Do not commit credentials, private recordings, personal identifiers, or copied images without rights.
- The default browser mode must not silently transmit camera frames to third-party services.
- Do not weaken loopback binding, CORS, host checks or integrity validation to make setup faster.
- This project is not suitable for medical, psychological or surveillance decisions.
- Report security issues privately as described in [Security Policy](SECURITY.md).

## Code review criteria

Prefer implementations with explicit invalid-input handling, bounded memory/time complexity, recoverable failures, deterministic tests and honest documentation. An elegant animation is not evidence of more accurate computer vision.
