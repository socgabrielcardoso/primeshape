import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HandTracker } from "../../frontend/js/browser/hand-tracking.js";

const cases = JSON.parse(readFileSync(new URL("../tracking_scenarios.json", import.meta.url), "utf8"));

function hand(x, side="Left", score=.95) {
  const points = Array.from({ length:21 }, (_, i) => ({
    x:x+((i%5)-2)*.01,
    y:.5+(Math.floor(i/5)-2)*.01,
    z:0
  }));
  for (const [index, dx, dy] of [[0,-.02,.03],[5,-.04,0],[9,0,-.01],[13,.03,0],[17,.05,.01]]) {
    points[index] = { x:x+dx, y:.5+dy, z:0 };
  }
  const world = points.map(p => ({ x:(p.x-x)*.5, y:(p.y-.5)*.5, z:0 }));
  return { landmarks:[points], worldLandmarks:[world], handednesses:[[{ categoryName:side, score }]] };
}

function combine(...hands) {
  return {
    landmarks:hands.flatMap(h=>h.landmarks),
    worldLandmarks:hands.flatMap(h=>h.worldLandmarks),
    handednesses:hands.flatMap(h=>h.handednesses)
  };
}

function corrupt(value, kind) {
  if (kind==="nan") value.landmarks[0][0].x=NaN;
  else if (kind==="infinity") value.landmarks[0][0].x=Infinity;
  else if (kind==="world_nan") value.worldLandmarks[0][8].y=NaN;
  else if (kind==="short_points") value.landmarks[0].pop();
  else if (kind==="short_world") value.worldLandmarks[0].pop();
  else if (kind==="missing_coordinate") delete value.landmarks[0][0].z;
  else throw Error("Unknown corruption: "+kind);
  return value;
}

for (const item of cases) {
  test(item.name, () => {
    const tracker = new HandTracker();
    const x = item.x ?? .35;
    const dt = item.dt_ms ?? 100;
    if (item.mode==="invalid") {
      assert.equal(tracker.update(corrupt(hand(x),item.kind),0).landmarks.length,0);
    } else if (item.mode==="swap_order") {
      const a=item.left, b=item.right;
      tracker.update(combine(hand(a,"Left"),hand(b,"Right")),0);
      const output=tracker.update(combine(hand(b+(item.dx??0),"Right"),hand(a+(item.dx??0),"Left")),dt);
      assert.deepEqual(output.trackingMetadata.map(t=>t.id),[1,2]);
      assert.deepEqual(output.handednesses.map(x=>x[0].categoryName),["Left","Right"]);
    } else {
      tracker.update(hand(x),0);
      if (item.mode==="continuity") {
        const output=tracker.update(hand(x+(item.dx??.01)),dt);
        assert.equal(output.landmarks.length,1);
        assert.equal(output.trackingMetadata[0].id,1);
        assert.equal(output.trackingMetadata[0].recuperado,false);
      } else if (item.mode==="hold") {
        const output=tracker.update(combine(),dt);
        assert.equal(output.landmarks.length,1);
        assert.equal(output.trackingMetadata[0].recuperado,true);
      } else if (item.mode==="expiry") {
        assert.equal(tracker.update(combine(),dt).landmarks.length,0);
      } else if (item.mode==="reacquire") {
        const output=tracker.update(hand(x+(item.dx??.01)),dt);
        assert.equal(output.landmarks.length,1);
        assert.equal(output.trackingMetadata[0].id,2);
      } else if (item.mode==="rollback") {
        const output=tracker.update(hand(x),-dt);
        assert.equal(output.landmarks.length,1);
        assert.equal(output.trackingMetadata[0].id,1);
      } else throw Error("Unknown mode: "+item.mode);
    }
  });
}
