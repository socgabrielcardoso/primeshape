import { bounds } from "./geometry.js";

export function references() {
  const shapes = [];
  for (const tips of [5,6]) for (const inner of [0.38,0.5]) {
    shapes.push([`Estrela de ${tips} pontas`, Array.from({ length: 2 * tips }, (_, i) => {
      const t = i * Math.PI / tips - Math.PI / 2, r = i % 2 ? inner : 1;
      return [r * Math.cos(t), r * Math.sin(t)];
    })]);
  }
  for (const a of [0.25,0.38]) shapes.push(["Cruz", [[-a,-1],[a,-1],[a,-a],[1,-a],[1,a],[a,a],[a,1],[-a,1],[-a,a],[-1,a],[-1,-a],[-a,-a]]]);
  shapes.push(["Coração", Array.from({ length: 160 }, (_, i) => {
    const t = i * Math.PI / 80;
    return [16 * Math.sin(t) ** 3 / 17, -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) / 17];
  })]);
  shapes.push(["Semicírculo", Array.from({ length: 100 }, (_, i) => [Math.cos(i * Math.PI / 99), -Math.sin(i * Math.PI / 99)])]);
  for (const s of [0.25,0.4]) shapes.push(["Seta", [[-1,-s],[0,-s],[0,-0.85],[1,0],[0,0.85],[0,s],[-1,s]]]);
  shapes.push(["Chevron", [[-1,-1],[-0.1,-1],[1,0],[-0.1,1],[-1,1],[0,0]]]);
  return shapes;
}

function mask(points) {
  const [x,y,w,h] = bounds(points), scale = 28 / Math.max(w,h,1e-6);
  const normalized = points.map(p => [(p[0] - x - w/2) * scale + 16, (p[1] - y - h/2) * scale + 16]);
  const rows = new Uint32Array(32);
  for (let row = 0; row < 32; row++) {
    const scan = row + 0.5, intersections = [];
    for (let i = 0; i < normalized.length; i++) {
      const a = normalized[i], b = normalized[(i + 1) % normalized.length];
      if ((a[1] > scan) !== (b[1] > scan)) intersections.push(a[0] + (scan - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    }
    intersections.sort((a,b) => a-b);
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      for (let col = Math.max(0, Math.ceil(intersections[i] - 0.5)); col < Math.min(32, Math.ceil(intersections[i+1] - 0.5)); col++) rows[row] |= 1 << col;
    }
  }
  return rows;
}

function popcount(value) {
  value -= (value >>> 1) & 0x55555555;
  value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
  return (((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

export class TemplateMatcher {
  constructor() {
    this.bank = [];
    for (const [label, points] of references()) for (let angle = 0; angle < 360; angle += 10) {
      const t = angle * Math.PI / 180;
      this.bank.push([label, mask(points.map(([x,y]) => [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)]))]);
    }
  }
  classify(points) {
    const target = mask(points), scores = new Map();
    for (const [label, reference] of this.bank) {
      let intersection = 0, union = 0;
      for (let i = 0; i < 32; i++) { intersection += popcount(target[i] & reference[i]); union += popcount(target[i] | reference[i]); }
      scores.set(label, Math.max(scores.get(label) || 0, intersection / Math.max(union, 1)));
    }
    const ordered = [...scores].sort((a,b) => b[1]-a[1]);
    return ordered[0][1] >= 0.84 && ordered[0][1] - ordered[1][1] >= 0.055 ? [...ordered[0], 0] : null;
  }
}
