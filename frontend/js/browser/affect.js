import rules from "../../../config/affect-rules.json" with { type:"json" };
import { signal } from "./geometry.js";

export function apparentAffect(blends,quality) {
  if (quality<0.4) return [];
  const pair=names=>Math.min(...names.map(name=>blends[name]||0));
  const result=[];
  for (const [code,rule] of Object.entries(rules)) {
    if (Math.max(blends.mouthSmileLeft||0,blends.mouthSmileRight||0)>=rule.max_smile) continue;
    if (rule.max_brow_down && pair(["browDownLeft","browDownRight"])>=rule.max_brow_down) continue;
    const values=rule.groups.map(group=>Math.max(...group.features.map(pair)));
    if (values.every((value,i)=>value>=rule.groups[i].threshold)) result.push(signal(code,rule.rotulo,Math.min(quality,values.reduce((sum,v)=>sum+v,0)/values.length),"estado_aparente",rule.evidencias));
  }
  return result;
}

export class AffectTracker {
  constructor() { this.reset(); }
  reset() { this.candidates=new Map();this.lastAt=null; }
  update(signals,now) {
    if (this.lastAt!==null && (now<=this.lastAt || now-this.lastAt>0.8)) this.reset();
    this.lastAt=now;
    const codes=new Set(signals.map(s=>s.codigo));
    for (const code of this.candidates.keys()) if (!codes.has(code)) this.candidates.delete(code);
    return signals.filter(s=>{
      const rule=rules[s.codigo];
      if (!rule) return true;
      if (!this.candidates.has(s.codigo)) this.candidates.set(s.codigo,now);
      return now-this.candidates.get(s.codigo)>=rule.min_seconds;
    });
  }
}
