import { angle, bounds, distance, signal } from "./browser/geometry.js";

export const HAND_SHAPES = ["Triângulo", "Quadrado", "Retângulo", "Losango", "Trapézio", "Paralelogramo", "Quadrilátero", "Círculo", "Oval"];
const average = points => [0,1].map(axis => points.reduce((sum,p) => sum+p[axis],0)/points.length);
const area = points => Math.abs(points.reduce((sum,p,i) => { const q=points[(i+1)%points.length]; return sum+p[0]*q[1]-q[0]*p[1]; },0))/2;
const visible = p => p && p.slice(0,2).every(value => Number.isFinite(value) && value>=0 && value<=1);
const clockwise = points => {
  const center=average(points);
  return [...points].sort((a,b) => Math.atan2(a[1]-center[1],a[0]-center[0])-Math.atan2(b[1]-center[1],b[0]-center[0]));
};

function describe(hand, width, height) {
  if (!visible(hand.pontos[4]) || !visible(hand.pontos[8])) return null;
  const pixels=hand.pontos.map(p => [p[0]*width,p[1]*height]);
  const index=pixels[8],thumb=pixels[4];
  return { pixels,index,thumb,center:average([0,5,9,13,17].map(i=>pixels[i])),palm:Math.max(distance(pixels[5],pixels[17]),12),span:distance(index,thumb),top:index[1]<=thumb[1]?index:thumb,bottom:index[1]<=thumb[1]?thumb:index };
}

export function quadrilateral(points) {
  const p=clockwise(points);
  const sides=p.map((v,i)=>distance(v,p[(i+1)%4]));
  const angles=p.map((v,i)=>angle(p[(i+3)%4],v,p[(i+1)%4]));
  if (Math.min(...angles)<12 || Math.max(...angles)>170) return null;
  const rightError=angles.reduce((sum,a)=>sum+Math.abs(a-90),0)/4;
  const ratio=Math.max(...sides)/Math.max(Math.min(...sides),1);
  const balance=Math.max(sides[0]/sides[2],sides[2]/sides[0],sides[1]/sides[3],sides[3]/sides[1]);
  const direction=(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0]);
  const parallel=(a,b)=>{
    const diff=Math.abs(a-b)%Math.PI;
    return Math.min(diff,Math.PI-diff)*180/Math.PI<18;
  };
  const first=parallel(direction(p[0],p[1]),direction(p[2],p[3]));
  const second=parallel(direction(p[1],p[2]),direction(p[3],p[0]));
  if (rightError<12 && ratio<1.28) return "Quadrado";
  if (rightError<14 && balance<1.38) return "Retângulo";
  if (ratio<1.16) return "Losango";
  if (first!==second) return "Trapézio";
  if (first && second) return "Paralelogramo";
  return "Quadrilátero";
}

function polygon(points,width,height) {
  const ordered=clockwise(points);
  const box=bounds(ordered);
  if (area(ordered)<Math.max(120,width*height*0.001) || Math.min(box[2],box[3])<10) return null;
  const label=ordered.length===3?"Triângulo":quadrilateral(ordered);
  if (!label) return null;
  return { ...signal("forma_maos",label,0.75,"inferencia",["Forma aproximada entre as pontas dos polegares e indicadores"]),kind:"polygon",pontos:ordered.map(p=>[p[0]/width,p[1]/height]) };
}

function ellipse(hands,width,height) {
  const arc=[8,7,6,5,2,3,4];
  const [x,y,w,h]=bounds(hands.flatMap(hand=>arc.map(i=>hand.pixels[i])));
  if (Math.min(w,h)<12 || w*h<200) return null;
  const ratio=w/h,label=ratio>=0.8 && ratio<=1.25?"Círculo":"Oval";
  return { ...signal("forma_maos",label,0.65,"inferencia",["Aproximação do arco entre indicador e polegar"]),kind:"ellipse",centro:[(x+w/2)/width,(y+h/2)/height],raios:[w/2/width,h/2/height] };
}

export function classifyHandShapes(hands,width,height) {
  const descriptions=hands.map(h=>describe(h,width,height)).filter(Boolean).sort((a,b)=>a.center[0]-b.center[0]);
  if (descriptions.length===2) {
    const [a,b]=descriptions,bridge=distance(a.center,b.center);
    if (bridge>Math.max(width*0.075,Math.max(a.palm,b.palm)*0.9) && a.span>a.palm*0.55 && b.span>b.palm*0.55) {
      const top=distance(a.top,b.top)/bridge,bottom=distance(a.bottom,b.bottom)/bridge;
      let shape;
      if (top<0.48 && bottom<0.48) shape=ellipse(descriptions,width,height);
      else if (top<0.48 && bottom>=0.48) shape=polygon([average([a.top,b.top]),a.bottom,b.bottom],width,height);
      else if (bottom<0.48 && top>=0.48) shape=polygon([a.top,b.top,average([a.bottom,b.bottom])],width,height);
      else shape=polygon([a.index,a.thumb,b.index,b.thumb],width,height);
      if (shape) return [shape];
    }
  }
  return descriptions.filter(h=>h.span/h.palm<0.38).map(h=>ellipse([h],width,height)).filter(Boolean);
}

export class HandShapeTracker {
  constructor() { this.reset(); }
  reset() { this.previous=[];this.lastAt=0;this.labels=[]; }
  update(hands,width,height,now) {
    const available=[...this.previous];
    const smoothed=hands.map(hand=>{
      const center=average([0,5,9,13,17].map(i=>hand.pontos[i]));
      let match=-1,best=Infinity;
      available.forEach((old,i)=>{
        const d=distance(center,average([0,5,9,13,17].map(j=>old.pontos[j])))+(old.lado!==hand.lado?0.03:0);
        if (d<best) { best=d;match=i; }
      });
      const old=match>=0?available.splice(match,1)[0]:null;
      if (!old || best>0.22 || now-this.lastAt>450) return hand;
      const weight=Math.min(0.9,0.55+best*4);
      return { ...hand,pontos:hand.pontos.map((p,i)=>p.map((v,j)=>old.pontos[i][j]+(v-old.pontos[i][j])*weight)) };
    });
    const shapes=classifyHandShapes(smoothed,width,height);
    const labels=shapes.map((shape,i)=>{
      const old=this.labels[i];
      if (!old || old.kind!==shape.kind || now-this.lastAt>450) return { label:shape.rotulo,candidate:shape.rotulo,since:now,kind:shape.kind };
      if (old.candidate!==shape.rotulo) { old.candidate=shape.rotulo;old.since=now; }
      if (now-old.since>=140) old.label=shape.rotulo;
      shape.rotulo=old.label;
      return old;
    });
    this.previous=smoothed;this.lastAt=now;this.labels=labels;
    return { hands:smoothed,shapes };
  }
}
