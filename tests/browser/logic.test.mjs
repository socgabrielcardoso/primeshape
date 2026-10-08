import test from "node:test";
import assert from "node:assert/strict";
import { classifyHandShapes, quadrilateral, HandShapeTracker } from "../../frontend/js/hand-shapes.js";
import { apparentAffect, AffectTracker } from "../../frontend/js/browser/affect.js";
import { cameraSideFromCenter } from "../../frontend/js/browser/hands.js";
import { HandTracker } from "../../frontend/js/browser/hand-tracking.js";

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


test("Lateralidade segue a visão da câmera e formas pequenas continuam classificáveis",()=>{
  assert.equal(cameraSideFromCenter(0.20),"Esquerda");
  assert.equal(cameraSideFromCenter(0.80),"Direita");
  assert.equal(cameraSideFromCenter(0.50),"Esquerda");
  const a=hand([310,250],[310,310],[280,280],1280,720);
  const b=hand([430,250],[430,310],[460,280],1280,720);
  const shapes=classifyHandShapes([a,b],1280,720);
  assert.equal(shapes.length,1);
  assert.ok(["Retângulo","Quadrado","Quadrilátero"].includes(shapes[0].rotulo));
});


const rawHandResult=(centerX,side="Left",score=.95)=>{
  const landmarks=Array.from({length:21},(_,index)=>({
    x:centerX+((index%5)-2)*.01,
    y:.5+((Math.floor(index/5))-2)*.01,
    z:0
  }));
  for(const [index,dx,dy] of [[0,-.02,.03],[5,-.04,0],[9,0,-.01],[13,.03,0],[17,.05,.01]]) {
    landmarks[index]={x:centerX+dx,y:.5+dy,z:0};
  }
  const worldLandmarks=landmarks.map(p=>({x:(p.x-centerX)*.5,y:(p.y-.5)*.5,z:0}));
  return { landmarks:[landmarks],worldLandmarks:[worldLandmarks],handednesses:[[{categoryName:side,score}]] };
};

test("Rastreador de mãos segura dropout, mantém identidade e rejeita teleporte",()=>{
  const tracker=new HandTracker();
  const left=rawHandResult(.2,"Left"),right=rawHandResult(.8,"Right");
  let result=tracker.update({
    landmarks:[left.landmarks[0],right.landmarks[0]],
    worldLandmarks:[left.worldLandmarks[0],right.worldLandmarks[0]],
    handednesses:[left.handednesses[0],right.handednesses[0]]
  },0);
  assert.deepEqual(result.trackingMetadata.map(item=>item.id),[1,2]);

  result=tracker.update({
    landmarks:[right.landmarks[0],left.landmarks[0]],
    worldLandmarks:[right.worldLandmarks[0],left.worldLandmarks[0]],
    handednesses:[right.handednesses[0],left.handednesses[0]]
  },100);
  assert.deepEqual(result.trackingMetadata.map(item=>item.id),[1,2]);

  result=tracker.update({landmarks:[],worldLandmarks:[],handednesses:[]},200);
  assert.equal(result.landmarks.length,2);
  assert.ok(result.trackingMetadata.every(item=>item.recuperado));

  result=tracker.update({landmarks:[],worldLandmarks:[],handednesses:[]},500);
  assert.equal(result.landmarks.length,0);

  const single=new HandTracker();
  single.update(rawHandResult(.2),0);
  const before=single.update(rawHandResult(.21),100).landmarks[0][9].x;
  const afterResult=single.update(rawHandResult(.9),200);
  assert.equal(afterResult.landmarks.length,1);
  assert.ok(afterResult.landmarks[0][9].x-before<.30);
});


test("Recovered hand cannot render a ghost shape while partner remains visible",()=>{
  const a=hand([180,100],[180,400],[130,280]);
  const b=hand([480,100],[480,400],[530,280]);
  assert.equal(classifyHandShapes([a,b],640,480)[0].rotulo,"Quadrado");
  a.rastreio={id:1,recuperado:true};
  b.rastreio={id:2,recuperado:false};
  assert.deepEqual(classifyHandShapes([a,b],640,480),[]);
  const tracker=new HandShapeTracker();
  assert.deepEqual(tracker.update([a,b],640,480,100).shapes,[]);
});


test("An isolated fingertip spike is bounded without destabilizing the tracked palm",()=>{
  const tracker=new HandTracker();
  tracker.update(rawHandResult(.35),0);
  const baseline=tracker.update(rawHandResult(.36),100);
  const noisy=rawHandResult(.37);
  noisy.landmarks[0][8].x+=.8;
  const updated=tracker.update(noisy,200);
  assert.equal(updated.trackingMetadata[0].id,1);
  assert.ok(updated.landmarks[0][8].x-baseline.landmarks[0][8].x<.20);
  assert.ok(Math.abs(updated.landmarks[0][9].x-baseline.landmarks[0][9].x)<.08);
});
