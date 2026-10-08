# PrimeShape — Project Overview

**Category:** Computer Vision Laboratory  
**Status:** Experimental, educational software (not a medical device)  
**Core stack:** JavaScript, Web Workers, MediaPipe Tasks Vision, OpenCV.js, Python, Java  
**Primary runtime:** Modern Chromium-based browser; optional local Java/Python services

## Problem and approach

A webcam produces noisy, intermittent observations. Hands can disappear behind each other, landmark points may jump in one frame and geometric forms can flicker while users move. PrimeShape explores how to make these inferences more legible **without inventing observations**.

The browser route isolates inference in a worker. A temporal hand tracker associates up to two detections, smooths landmarks, bounds implausible jumps and expires lost tracks. Recovered tracks can be displayed briefly for continuity but cannot create fresh gestures or shapes. The optional service route offers a second Java/Python implementation for study and comparison.

## Engineering focus

| Area | Implementation |
| --- | --- |
| Browser runtime | Worker-based inference, adaptive image compensation and GPU/CPU fallback |
| Hand tracking | Stable temporary track IDs, movement bounds, occlusion handling, time-based expiration |
| Geometry | Finger angles, hand-crafted polygon/ellipse approximation and object contours |
| Temporal analysis | Observation windows for blinking and apparent facial signals |
| Local services | Loopback-only Java gateway and Python computer vision service |
| Quality | Synthetic cross-runtime test corpus, Playwright end-to-end tests, Python unit tests |
| Privacy | Default camera processing in browser; no continuous capture storage feature |

## Validation philosophy

The shared tracking corpus has **100 deterministic cases** for motion, reversed detector order, short occlusion, expiration, reacquisition, malformed landmarks and clock rollback. These cases test implementation consistency, **not model accuracy**. Browser integration tests check that the page starts, performs analysis and renders results under a simulated camera.

Precision, recall, false-positive rates and performance distributions on real-world videos have **not been established**. Claims of clinical utility, emotion recognition accuracy or patient-monitoring readiness would be inappropriate.

## Project navigation

- [README](README.md) — getting started and features
- [Architecture](docs/ARCHITECTURE.md) — components and data flow
- [Testing](docs/TESTING.md) — unit and browser tests
- [Performance](docs/PERFORMANCE.md) — repeatable diagnosis
- [Privacy](docs/PRIVACY.md) — camera data and usage boundaries
- [Contributing](CONTRIBUTING.md) — changes, tests and review expectations
