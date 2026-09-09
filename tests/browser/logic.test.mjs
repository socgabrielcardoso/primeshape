import test from "node:test";
import assert from "node:assert/strict";
import { classifyHandShapes, quadrilateral, HandShapeTracker } from "../../frontend/js/hand-shapes.js";
import { apparentAffect, AffectTracker } from "../../frontend/js/browser/affect.js";

const hand=(index,thumb,center,width=640,height=480)=>{
  const points=Array.from({length:21},()=>[center[0]/width,center[1]/height,0]);
  points[5]=[(center[0]-30)/width,center[1]/height,0];
  points[17]=[(center[0]+30)/width,center[1]/height,0];
  points[8]=[index[0]/width,index[1]/height,0];
  points[4]=[thumb[0]/width,thumb[1]/height,0];
  return { pontos:points,lado:center[0]<320?"Esquerda":"Direita",parcial:true };
};

test("Formas seguem os quatro dedos, respeitam proporção e desaparecem quando as mãos saem",()=>{
  const a=hand([180,100],[180,400],[130,280]),b=hand([480,100],[480,400],[530,280]);
  assert.equal(classifyHandShapes([a,b],640,480)[0].rotulo,"Quadrado");
  const wideA=hand([200,100],[200,300],[130,240],1280,720),wideB=hand([400,100],[400,300],[480,240],1280,720);
  assert.equal(classifyHandShapes([wideA,wideB],1280,720)[0].rotulo,"Quadrado");
  assert.equal(classifyHandShapes([hand([320,100],[180,400],[160,300]),hand([320,100],[480,400],[500,300])],640,480)[0].rotulo,"Triângulo");
  const cases=[
    ["Retângulo",[[100,100],[500,100],[500,300],[100,300]]],
    ["Losango",[[300,50],[500,200],[300,350],[100,200]]],
    ["Trapézio",[[200,100],[400,100],[500,350],[100,350]]],
    ["Paralelogramo",[[250,100],[550,100],[400,300],[100,300]]],
    ["Quadrilátero",[[100,100],[500,50],[520,400],[300,300]]]
  ];
  for(const [name,points] of cases) assert.equal(quadrilateral(points),name);
  const circle=hand([340,210],[340,214],[300,240]);
  for(const [i,p] of [[5,[260,240]],[6,[270,210]],[7,[305,190]],[2,[270,270]],[3,[305,280]]]) circle.pontos[i]=[p[0]/640,p[1]/480,0];
  assert.equal(classifyHandShapes([circle],640,480)[0].kind,"ellipse");
  const tracker=new HandShapeTracker();
  assert.equal(tracker.update([a,b],640,480,0).shapes[0].rotulo,"Quadrado");
  assert.equal(tracker.update([b,a],640,480,100).shapes[0].rotulo,"Quadrado");
  assert.deepEqual(tracker.update([],640,480,200).shapes,[]);
  assert.deepEqual(classifyHandShapes([hand([100,100],[100,100],[100,100]),hand([101,100],[101,100],[101,100])],640,480),[]);
});

test("Tristeza e raiva exigem múltiplos sinais persistentes e rejeitam neutralidade, sorriso e baixa qualidade",()=>{
  const sadness={ mouthFrownLeft:0.55,mouthFrownRight:0.5,browInnerUp:0.45 };
  const anger={ browDownLeft:0.65,browDownRight:0.6,mouthPressLeft:0.4,mouthPressRight:0.4,eyeSquintLeft:0.4,eyeSquintRight:0.35 };
  assert.equal(apparentAffect(sadness,0.9)[0].codigo,"tristeza_aparente");
  assert.equal(apparentAffect(anger,0.9)[0].codigo,"raiva_aparente");
  for(const input of [{},{browDownLeft:0.8,browDownRight:0.8},{...sadness,mouthSmileLeft:0.7},{...anger,mouthSmileRight:0.7}]) assert.deepEqual(apparentAffect(input,0.9),[]);
  assert.deepEqual(apparentAffect(anger,0.3),[]);
  const tracker=new AffectTracker(),signals=apparentAffect(anger,0.9);
  assert.deepEqual(tracker.update(signals,0),[]);
  assert.deepEqual(tracker.update(signals,0.25),[]);
  assert.equal(tracker.update(signals,0.5)[0].codigo,"raiva_aparente");
  assert.deepEqual(tracker.update([],0.75),[]);
  assert.deepEqual(tracker.update(signals,1),[]);
  assert.deepEqual(tracker.update(signals,3),[]);
});
