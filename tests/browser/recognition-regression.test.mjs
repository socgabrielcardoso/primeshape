import test from "node:test";
import assert from "node:assert/strict";
import { quadrilateral, classifyHandShapes, HandShapeTracker } from "../../frontend/js/hand-shapes.js";
import { HandTracker } from "../../frontend/js/browser/hand-tracking.js";
import { cameraSideFromCenter, analyzeHands } from "../../frontend/js/browser/hands.js";
import { angle, bounds, clamp, ramp } from "../../frontend/js/browser/geometry.js";

const quad = (sx, sy, degrees = 0, dx = 0, dy = 0) => {
  const t = degrees * Math.PI / 180;
  return [[-sx,-sy],[sx,-sy],[sx,sy],[-sx,sy]].map(([x,y]) => [
    x*Math.cos(t)-y*Math.sin(t)+dx, x*Math.sin(t)+y*Math.cos(t)+dy
  ]);
};

const shapeHand = (index, thumb, center, width=640, height=480) => {
  const points=Array.from({length:21},()=>[center[0]/width,center[1]/height,0]);
  points[5]=[(center[0]-30)/width,center[1]/height,0];
  points[17]=[(center[0]+30)/width,center[1]/height,0];
  points[8]=[index[0]/width,index[1]/height,0];
  points[4]=[thumb[0]/width,thumb[1]/height,0];
  return { pontos:points, lado:center[0]<width/2?"Esquerda":"Direita" };
};

const twoHands=()=>[
  shapeHand([179,96],[179,384],[141,240]),
  shapeHand([461,96],[461,384],[499,240])
];

const rawHand=(centerX=.45,side="Left",score=.95)=>{
  const landmarks=Array.from({length:21},(_,i)=>({
    x:centerX + ((i%5)-2)*0.01, y:0.5+(Math.floor(i/5)-2)*0.01, z:0
  }));
  const worldLandmarks=landmarks.map(p=>({x:(p.x-centerX)*.5,y:(p.y-.5)*.5,z:0}));
  return {landmarks:[landmarks],worldLandmarks:[worldLandmarks],handednesses:[[{categoryName:side,score}]]};
};

test("Recognize axis-aligned squares", () => {
  assert.equal(quadrilateral(quad(75,75)),"Quadrado");
});

