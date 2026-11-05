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

test("Recognize squares despite 17-degree camera rotation", () => {
  assert.equal(quadrilateral(quad(75,75,17)),"Quadrado");
});

test("Recognize squares at reduced scale", () => {
  assert.equal(quadrilateral(quad(8,8,45)),"Quadrado");
});

test("Recognize rectangular finger contours", () => {
  assert.equal(quadrilateral(quad(115,50)),"Retângulo");
});

test("Recognize rectangles after 33-degree rotation", () => {
  assert.equal(quadrilateral(quad(115,50,33)),"Retângulo");
});

test("Recognize translated rectangles without shifting class", () => {
  assert.equal(quadrilateral(quad(115,50,0,375,-241)),"Retângulo");
});

test("Recognize rotated rhombi as distinct from rectangles", () => {
  assert.equal(quadrilateral([[300,50],[500,200],[300,350],[100,200]]),"Losango");
});

test("Recognize trapezoids formed by asymmetric fingers", () => {
  assert.equal(quadrilateral([[200,100],[400,100],[500,350],[100,350]]),"Trapézio");
});

test("Recognize slanted parallelograms", () => {
  assert.equal(quadrilateral([[250,100],[550,100],[400,300],[100,300]]),"Paralelogramo");
});

test("Keep irregular four-sided shapes as quadrilaterals", () => {
  assert.equal(quadrilateral([[100,100],[500,50],[520,400],[300,300]]),"Quadrilátero");
});

test("Reject missing quadrilateral proposals", () => {
  assert.equal(quadrilateral(null),null);
});

test("Reject empty contour arrays", () => {
  assert.equal(quadrilateral([]),null);
});

test("Reject underspecified triangles from quad classification", () => {
  assert.equal(quadrilateral([[0,0],[100,0],[50,80]]),null);
});

test("Reject five-sided candidates from quad classification", () => {
  assert.equal(quadrilateral([[0,0],[100,0],[120,70],[50,130],[-20,70]]),null);
});

test("Reject vertices containing NaN", () => {
  assert.equal(quadrilateral([[0,0],[100,0],[100,NaN],[0,100]]),null);
});

