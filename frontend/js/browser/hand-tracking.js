const PALM = [0, 5, 9, 13, 17];

const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const point = value => [Number(value?.x), Number(value?.y), Number(value?.z)];
const toObject = value => ({ x: value[0], y: value[1], z: value[2] });
const distance2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function center(points) {
  const sum = PALM.reduce((acc, index) => [acc[0] + points[index][0], acc[1] + points[index][1]], [0, 0]);
  return [sum[0] / PALM.length, sum[1] / PALM.length];
}

function scale(points) {
  return Math.max(distance2(points[0], points[9]), distance2(points[5], points[17]), 0.045);
}

function mixPoints(previous, next, alpha) {
  return previous.map((p, index) => p.map((value, axis) => value * (1 - alpha) + next[index][axis] * alpha));
}

function validPoints(points) {
  return Array.isArray(points) && points.length === 21 && points.every(p => p.length >= 3 && p.every(Number.isFinite));
}

export class HandTracker {
  constructor(options = {}) {
    this.holdMs = options.holdMs ?? 240;
    this.matchGate = options.matchGate ?? 3.0;
    this.jumpBase = options.jumpBase ?? 0.16;
    this.jumpPerSecond = options.jumpPerSecond ?? 0.95;
    this.smoothingMin = options.smoothingMin ?? 0.30;
    this.smoothingMax = options.smoothingMax ?? 0.84;
    this.reset();
  }

  reset() {
    this.tracks = [];
    this.nextId = 1;
  }

  detections(result) {
    const landmarks = result?.landmarks || [];
    const world = result?.worldLandmarks || [];
    const handedness = result?.handedness || result?.handednesses || [];
    const detections = [];
    for (let index = 0; index < landmarks.length; index++) {
      const points = landmarks[index]?.map(point) || [];
      const worldPoints = world[index]?.map(point) || [];
      if (!validPoints(points) || !validPoints(worldPoints)) continue;
      const side = handedness[index]?.[0] || { categoryName: "Unknown", score: 0 };
      detections.push({
        points,
        world: worldPoints,
        side: ["Left", "Right"].includes(side.categoryName) ? side.categoryName : "Unknown",
        sideScore: clamp(Number(side.score) || 0)
      });
    }
    return detections;
  }

  cost(track, detection) {
    const centerDistance = distance2(center(track.points), center(detection.points));
    const scaleRatio = scale(detection.points) / Math.max(scale(track.points), 1e-6);
    const scalePenalty = Math.abs(Math.log(Math.max(scaleRatio, 1e-6))) * 0.28;
    const sidePenalty = track.side !== detection.side
      && [track.side, detection.side].every(side => side === "Left" || side === "Right")
      && Math.min(track.sideScore, detection.sideScore) >= 0.72 ? 0.9 : 0;
    return centerDistance * 3.2 + scalePenalty + sidePenalty + Math.min(track.missed, 3) * 0.08;
  }

  newTrack(detection, timestamp) {
    const track = {
      id: this.nextId++,
      points: detection.points.map(p => [...p]),
      world: detection.world.map(p => [...p]),
      side: detection.side,
      sideScore: detection.sideScore,
      lastSeen: timestamp,
      age: 1,
      missed: 0,
      stability: 1
    };
    this.tracks.push(track);
    return track;
  }

  updateTrack(track, detection, timestamp) {
    const candidate = detection.points.map(p => [...p]);
    const candidateWorld = detection.world.map(p => [...p]);
    const oldCenter = center(track.points);
    const nextCenter = center(candidate);
    const dt = Math.max(1 / 120, Math.min((timestamp - track.lastSeen) / 1000, 0.35));
    let jump = distance2(oldCenter, nextCenter);
    const maxJump = this.jumpBase + this.jumpPerSecond * dt;

    if (track.age >= 2 && jump > maxJump) {
      const ratio = maxJump / Math.max(jump, 1e-9);
      const corrected = [
        oldCenter[0] + (nextCenter[0] - oldCenter[0]) * ratio,
        oldCenter[1] + (nextCenter[1] - oldCenter[1]) * ratio
      ];
      const shift = [corrected[0] - nextCenter[0], corrected[1] - nextCenter[1]];
      for (const p of candidate) {
        p[0] += shift[0];
        p[1] += shift[1];
      }
      jump = maxJump;
    }

    const motion = clamp(jump / 0.20);
    let alpha = this.smoothingMin + (this.smoothingMax - this.smoothingMin) * motion;
    if (track.missed) alpha = Math.min(alpha, 0.58);
    const residual = candidate.reduce((sum, p, index) => sum + distance2(p, track.points[index]), 0) / candidate.length;
    track.points = mixPoints(track.points, candidate, alpha);
    track.world = mixPoints(track.world, candidateWorld, alpha);

    if (detection.side === track.side) track.sideScore = 0.72 * track.sideScore + 0.28 * detection.sideScore;
    else if (track.age <= 2 && detection.sideScore >= 0.92) {
      track.side = detection.side;
      track.sideScore = detection.sideScore;
    } else track.sideScore *= 0.96;

    const jitterScore = 1 - Math.min(1, residual / 0.12);
    track.stability = 0.78 * track.stability + 0.22 * jitterScore;
    track.lastSeen = timestamp;
    track.age += 1;
    track.missed = 0;
  }

  snapshot(track, timestamp, recovered = false) {
    const staleMs = Math.max(0, timestamp - track.lastSeen);
    const score = clamp(track.sideScore * (recovered ? 0.92 ** track.missed : 1));
    return {
      points: track.points.map(p => [...p]),
      world: track.world.map(p => [...p]),
      side: track.side,
      sideScore: score,
      tracking: {
        id: track.id,
        recuperado: recovered,
        frames_ausentes: track.missed,
        estabilidade: Number(clamp(track.stability).toFixed(3)),
        atraso_ms: Number(staleMs.toFixed(1))
      }
    };
  }

  update(result, timestamp) {
    const detections = this.detections(result);
    const assignedTracks = new Set();
    const assignedDetections = new Set();
    const pairs = [];

    this.tracks.forEach((track, trackIndex) => detections.forEach((detection, detectionIndex) => {
      pairs.push([this.cost(track, detection), trackIndex, detectionIndex]);
    }));
    pairs.sort((a, b) => a[0] - b[0]);

    for (const [cost, trackIndex, detectionIndex] of pairs) {
      if (cost > this.matchGate) break;
      if (assignedTracks.has(trackIndex) || assignedDetections.has(detectionIndex)) continue;
      this.updateTrack(this.tracks[trackIndex], detections[detectionIndex], timestamp);
      assignedTracks.add(trackIndex);
      assignedDetections.add(detectionIndex);
    }

    for (let detectionIndex = 0; detectionIndex < detections.length; detectionIndex++) {
      if (assignedDetections.has(detectionIndex)) continue;
      if (this.tracks.length >= 2) break;
      const track = this.newTrack(detections[detectionIndex], timestamp);
      assignedTracks.add(this.tracks.indexOf(track));
      assignedDetections.add(detectionIndex);
    }

    const snapshots = [];
    const survivors = [];
    this.tracks.forEach((track, trackIndex) => {
      if (assignedTracks.has(trackIndex)) {
        snapshots.push(this.snapshot(track, timestamp, false));
        survivors.push(track);
        return;
      }
      const staleMs = Math.max(0, timestamp - track.lastSeen);
      if (staleMs <= this.holdMs) {
        track.missed += 1;
        track.stability *= 0.94;
        snapshots.push(this.snapshot(track, timestamp, true));
        survivors.push(track);
      }
    });
    this.tracks = survivors;
    snapshots.sort((a, b) => a.tracking.id - b.tracking.id);

    const handednesses = snapshots.map(item => [{ categoryName: item.side, score: item.sideScore }]);
    return {
      landmarks: snapshots.map(item => item.points.map(toObject)),
      worldLandmarks: snapshots.map(item => item.world.map(toObject)),
      handedness: handednesses,
      handednesses,
      trackingMetadata: snapshots.map(item => item.tracking),
      detectedCount: detections.length
    };
  }
}
