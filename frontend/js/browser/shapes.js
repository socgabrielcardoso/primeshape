import { angle, bounds, clamp, distance, signal } from "./geometry.js";
import { TemplateMatcher } from "./shape-templates.js";

const POLYGONS = {3:"Triângulo",5:"Pentágono",6:"Hexágono",7:"Heptágono",8:"Octógono",9:"Nonágono",10:"Decágono",11:"Undecágono",12:"Dodecágono"};
export const SHAPE_CATALOG = ["Círculo","Oval","Quadrado","Retângulo","Losango","Trapézio","Paralelogramo","Deltoide",...Object.values(POLYGONS),"Estrela de 5 pontas","Estrela de 6 pontas","Cruz","Coração","Semicírculo","Seta","Chevron"];
const pointsOf = mat => Array.from({ length: mat.rows }, (_, i) => [mat.data32S[2*i], mat.data32S[2*i+1]]);
const overlap = (a,b) => Math.max(0,Math.min(a[0]+a[2],b[0]+b[2])-Math.max(a[0],b[0])) * Math.max(0,Math.min(a[1]+a[3],b[1]+b[3])-Math.max(a[1],b[1])) / Math.max(Math.min(a[2]*a[3],b[2]*b[3]),1);

function quadrilateral(points) {
  const edges = points.map((p,i) => points[(i+1)%4].map((value,j) => value-p[j]));
  const lengths = edges.map(e => Math.hypot(...e));
  const right = points.every((p,i) => Math.abs(angle(points[(i+3)%4],p,points[(i+1)%4])-90) < 13);
  const equal = Math.max(...lengths) / Math.max(Math.min(...lengths),1) < 1.18;
  const parallel = (a,b) => Math.abs(a[0]*b[1]-a[1]*b[0]) / Math.max(Math.hypot(...a)*Math.hypot(...b),1e-8) < 0.15;
  const pairs = [parallel(edges[0],edges[2]),parallel(edges[1],edges[3])];
  if (right) return [equal ? "Quadrado" : "Retângulo",0.94,4];
  if (equal && pairs.every(Boolean)) return ["Losango",0.88,4];
  if (pairs.every(Boolean)) return ["Paralelogramo",0.87,4];
  if (pairs.filter(Boolean).length === 1) return ["Trapézio",0.86,4];
  const close = (a,b) => Math.abs(a-b)/Math.max(a,b,1) < 0.14;
  if ((close(lengths[0],lengths[1]) && close(lengths[2],lengths[3])) || (close(lengths[1],lengths[2]) && close(lengths[3],lengths[0]))) return ["Deltoide",0.82,4];
  return null;
}

export class ShapeDetector {
  constructor(cv) { this.cv = cv; this.matcher = new TemplateMatcher(); }
  classify(contour) {
    const cv = this.cv, perimeter = cv.arcLength(contour,true), mats = [];
    if (perimeter < 25) return null;
    try {
      const hull = new cv.Mat(); mats.push(hull);
      cv.convexHull(contour,hull);
      const area = cv.contourArea(contour);
      if (area / Math.max(cv.contourArea(hull),1) < 0.965) return this.matcher.classify(pointsOf(contour));
      const approximations = [0.004,0.006,0.008].map(epsilon => {
        const mat = new cv.Mat(); mats.push(mat); cv.approxPolyDP(contour,mat,perimeter*epsilon,true); return mat;
      });
      const polygon = approximations[1], count = polygon.rows, points = pointsOf(polygon);
      if (count === 4 && cv.isContourConvex(polygon)) {
        const answer = quadrilateral(points); if (answer) return answer;
      }
      if (POLYGONS[count] && approximations.filter(p => p.rows === count).length >= 2 && cv.isContourConvex(polygon)) {
        const sides = points.map((p,i) => distance(p,points[(i+1)%count]));
        const mean = sides.reduce((sum,v) => sum+v,0)/count;
        const regularity = Math.sqrt(sides.reduce((sum,v) => sum+(v-mean)**2,0)/count)/Math.max(mean,1);
        if (count === 3 || regularity < 0.28) return [POLYGONS[count],clamp(0.94-regularity*0.4),count];
      }
      if (contour.rows >= 12 && count >= 7) {
        const ellipse = cv.fitEllipse(contour), a = ellipse.size.width, b = ellipse.size.height, t = ellipse.angle*Math.PI/180;
        if (Math.min(a,b) >= 12) {
          const error = pointsOf(contour).reduce((sum,p) => {
            const dx=p[0]-ellipse.center.x,dy=p[1]-ellipse.center.y;
            return sum+Math.abs(Math.hypot(2*(dx*Math.cos(t)+dy*Math.sin(t))/a,2*(-dx*Math.sin(t)+dy*Math.cos(t))/b)-1);
          },0)/contour.rows;
          const ratio = area/(Math.PI*a*b/4);
          if (error < 0.035 && ratio > 0.92 && ratio < 1.06) return [Math.max(a,b)/Math.min(a,b)<1.13 ? "Círculo" : "Oval",clamp(0.95-4*error),0];
        }
      }
      return this.matcher.classify(pointsOf(contour));
    } finally { mats.forEach(mat => mat.delete()); }
  }

  detect(image, exclusions = []) {
    const cv = this.cv, width = image.width, height = image.height, mats = [], candidates = [];
    const make = () => { const mat = new cv.Mat(); mats.push(mat); return mat; };
    try {
      const source = cv.matFromImageData(image); mats.push(source);
      const gray=make(),blur=make(),binary=make(),inverse=make(),edges=make(),kernel=cv.Mat.ones(3,3,cv.CV_8U); mats.push(kernel);
      cv.cvtColor(source,gray,cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray,blur,new cv.Size(5,5),0);
      cv.threshold(blur,binary,0,255,cv.THRESH_BINARY+cv.THRESH_OTSU);
      cv.bitwise_not(binary,inverse);
      cv.Canny(blur,edges,55,130);
      cv.morphologyEx(edges,edges,cv.MORPH_CLOSE,kernel);
      for (const mask of [binary,inverse,edges]) {
        const contours = new cv.MatVector(), hierarchy = make();
        try {
          cv.findContours(mask,contours,hierarchy,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE);
          for (let i=0;i<contours.size();i++) candidates.push(contours.get(i));
        } finally { contours.delete(); }
      }
      const blocked = exclusions.map(points => { const [x,y,w,h]=bounds(points); return [x*width,y*height,w*width,h*height]; });
      candidates.sort((a,b) => cv.contourArea(b)-cv.contourArea(a));
      const detected=[],visited=[];
      for (const contour of candidates.slice(0,70)) {
        const area=cv.contourArea(contour),rect=cv.boundingRect(contour),box=[rect.x,rect.y,rect.width,rect.height];
        if (area < 450 || area > width*height*0.85 || Math.min(rect.width,rect.height)<20) continue;
        if (rect.x<=1 || rect.y<=1 || rect.x+rect.width>=width-1 || rect.y+rect.height>=height-1) continue;
        if (visited.some(b => overlap(box,b)>0.85) || blocked.some(b => overlap(box,b)>0.3)) continue;
        const answer=this.classify(contour); if (!answer) continue;
        const simplified=make();cv.approxPolyDP(contour,simplified,cv.arcLength(contour,true)*0.003,true);
        detected.push({ ...signal("forma",answer[0],answer[1]), caixa:[rect.x/width,rect.y/height,rect.width/width,rect.height/height],contorno:pointsOf(simplified).map(p => [p[0]/width,p[1]/height]),vertices:answer[2],area_px:area });
        visited.push(box);
        if (detected.length>=12) break;
      }
      return detected;
    } finally { candidates.forEach(mat => mat.delete()); mats.forEach(mat => mat.delete()); }
  }
}
